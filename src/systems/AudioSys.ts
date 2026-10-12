import { Settings } from './Settings';

export type Mood = 'none' | 'day' | 'golden' | 'night' | 'title' | 'cabin';

/** Fully procedural audio (WebAudio) - no asset files needed. */
class AudioSysImpl {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private mood: Mood = 'none';
  private layers = new Map<string, GainNode>();
  private timers: number[] = [];
  private built = false;

  /** Must be called from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      // limiter so the loud scares never clip
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = 0.002; comp.release.value = 0.2;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (!this.built) this.build();
    this.loadVoices();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = Settings.get();
    this.musicBus.gain.setTargetAtTime(s.music, this.ctx.currentTime, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx, this.ctx.currentTime, 0.05);
  }

  private layerGain(name: string): GainNode {
    let g = this.layers.get(name);
    if (!g) {
      g = this.ctx!.createGain();
      g.gain.value = 0;
      g.connect(this.musicBus);
      this.layers.set(name, g);
    }
    return g;
  }

  private noiseSrc(filterType: BiquadFilterType, freq: number, q = 0.7): { src: AudioBufferSourceNode; filter: BiquadFilterNode } {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    src.connect(filter);
    src.start();
    return { src, filter };
  }

  /** Builds persistent ambience layers (all silent until a mood fades them in). */
  private build() {
    const c = this.ctx!;
    this.built = true;
    // WIND (day, soft)
    {
      const n = this.noiseSrc('lowpass', 500, 0.5);
      const lfo = c.createOscillator(); lfo.frequency.value = 0.13;
      const lg = c.createGain(); lg.gain.value = 220;
      lfo.connect(lg).connect(n.filter.frequency); lfo.start();
      n.filter.connect(this.layerGain('windDay'));
    }
    // WIND (night, hollow + higher)
    {
      const n = this.noiseSrc('bandpass', 700, 4);
      const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
      const lg = c.createGain(); lg.gain.value = 400;
      lfo.connect(lg).connect(n.filter.frequency); lfo.start();
      n.filter.connect(this.layerGain('windNight'));
    }
    // WARM PAD (day / golden): major-ish chord
    {
      const g = this.layerGain('padDay');
      [220, 277.18, 329.63, 440].forEach((f, i) => {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const og = c.createGain(); og.gain.value = 0.05;
        const l = c.createOscillator(); l.frequency.value = 0.1 + i * 0.03;
        const lgn = c.createGain(); lgn.gain.value = 0.03;
        l.connect(lgn).connect(og.gain); l.start();
        o.connect(og).connect(g); o.start();
      });
    }
    // NIGHT DRONE: detuned low saws + tritone-ish dissonance
    {
      const g = this.layerGain('droneNight');
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      lp.connect(g);
      [55, 55.6, 82.4, 116.5].forEach((f, i) => {
        const o = c.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f;
        const og = c.createGain(); og.gain.value = 0.16;
        o.connect(og).connect(lp); o.start();
      });
      const l = c.createOscillator(); l.frequency.value = 0.05;
      const lg = c.createGain(); lg.gain.value = 90; l.connect(lg).connect(lp.frequency); l.start();
    }
    // ANALOG HUM (cabin): mains hum + tape hiss
    {
      const g = this.layerGain('hum');
      [60, 120, 180].forEach((f, i) => {
        const o = c.createOscillator(); o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = f;
        const og = c.createGain(); og.gain.value = [0.3, 0.12, 0.05][i];
        o.connect(og).connect(g); o.start();
      });
      const n = this.noiseSrc('highpass', 5000, 0.5);
      const ng = c.createGain(); ng.gain.value = 0.05; n.filter.connect(ng).connect(g);
    }
    // TITLE: simple music-box arpeggio scheduled by timer
    this.timers.push(window.setInterval(() => this.tick(), 1400));
    this.setMood(this.mood, 0.1);
  }

  private arpIdx = 0;
  private tick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const m = this.mood;
    if (m === 'day' || m === 'golden' || m === 'title') {
      if (Math.random() < 0.7) this.bird();
      const scale = [392, 440, 523.25, 587.33, 659.25, 783.99];
      const n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        this.tone(scale[(this.arpIdx++ * 2 + i) % scale.length] / 2, 0.9, 'sine', 0.07, 'music', i * 0.45);
      }
    } else if (m === 'night') {
      const r = Math.random();
      if (r < 0.25) this.creak();
      else if (r < 0.45) this.tone(110 * Math.pow(2, Math.floor(Math.random() * 5) / 12), 2.5, 'sine', 0.05, 'music');
      else if (r < 0.55) this.whisper(0.35);
    }
  }

  setMood(mood: Mood, fade = 2.5) {
    this.mood = mood;
    if (!this.ctx || !this.built) return;
    const t = this.ctx.currentTime;
    const day = mood === 'day' || mood === 'golden' || mood === 'title';
    const night = mood === 'night';
    const set = (name: string, v: number) => this.layerGain(name).gain.setTargetAtTime(v, t, fade / 3);
    set('windDay', day ? 0.22 : 0);
    set('padDay', day ? (mood === 'golden' ? 0.9 : 0.6) : 0);
    set('windNight', night ? 0.35 : 0);
    set('droneNight', night ? 0.7 : mood === 'cabin' ? 0.45 : 0);
    set('hum', mood === 'cabin' ? 0.55 : 0);
  }

  // ---- one-shots ----
  tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.1, bus: 'sfx' | 'music' = 'sfx', delay = 0, slideTo?: number) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus === 'sfx' ? this.sfxBus : this.musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  blip(pitch = 1) {
    this.tone(180 * pitch + Math.random() * 20, 0.06, 'square', 0.05);
  }
  select() { this.tone(660, 0.08, 'square', 0.06); this.tone(880, 0.1, 'square', 0.05, 'sfx', 0.07); }
  move() { this.tone(440, 0.05, 'square', 0.04); }
  step() { this.noise(0.05, 'lowpass', 400, 0.04); }
  chime(i = 0) {
    const f = [523.25, 659.25, 783.99, 1046.5][i % 4];
    this.tone(f, 1.2, 'sine', 0.12); this.tone(f * 2, 0.9, 'sine', 0.04, 'sfx', 0.02);
  }
  bird() {
    const base = 1800 + Math.random() * 1500;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      this.tone(base, 0.09, 'sine', 0.035, 'music', i * 0.11, base * (1.2 + Math.random() * 0.4));
    }
  }
  creak() {
    this.tone(90 + Math.random() * 60, 1.2, 'sawtooth', 0.025, 'music', 0, 60 + Math.random() * 40);
  }
  noise(dur: number, type: BiquadFilterType, freq: number, vol: number, q = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start(c.currentTime, Math.random()); s.stop(c.currentTime + dur + 0.05);
  }
  whisper(vol = 0.5) {
    if (!this.ctx) return;
    const c = this.ctx;
    const dur = 1.4;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 9;
    f.frequency.setValueAtTime(900, c.currentTime);
    f.frequency.linearRampToValueAtTime(1900, c.currentTime + 0.5);
    f.frequency.linearRampToValueAtTime(1100, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(vol * 0.35, c.currentTime + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, c.currentTime + dur);
    const pan = c.createStereoPanner(); pan.pan.value = Math.random() * 2 - 1;
    s.connect(f).connect(g).connect(pan).connect(this.sfxBus);
    s.start(c.currentTime, Math.random()); s.stop(c.currentTime + dur + 0.1);
  }
  heartbeat() {
    this.tone(60, 0.18, 'sine', 0.35); this.tone(52, 0.22, 'sine', 0.3, 'sfx', 0.2);
  }
  stinger() {
    this.tone(220, 1.6, 'sawtooth', 0.18, 'sfx', 0, 55);
    this.tone(233, 1.6, 'sawtooth', 0.14, 'sfx', 0, 58);
    this.noise(0.9, 'highpass', 2500, 0.2);
  }
  gunshot() {
    this.noise(0.28, 'lowpass', 2600, 0.55, 0.5);
    this.noise(0.12, 'highpass', 3000, 0.25);
    this.tone(140, 0.25, 'sawtooth', 0.25, 'sfx', 0, 38);
  }
  click() { this.tone(1800, 0.03, 'square', 0.06); this.tone(900, 0.03, 'square', 0.05, 'sfx', 0.06); }
  /** Headphones on: sound effects get muffled. */
  muffle(on: boolean) {
    if (!this.ctx) return;
    const s = Settings.get().sfx;
    this.sfxBus.gain.setTargetAtTime(on ? s * 0.2 : s, this.ctx.currentTime, 0.05);
  }
  /** A burst of tape static. */
  staticBurst(dur = 0.25, vol = 0.35) {
    this.noise(dur, 'highpass', 1200, vol, 0.3);
    this.noise(dur, 'bandpass', 3200, vol * 0.7, 2);
  }
  /** Loud, ugly jumpscare shriek (limited by the SFX volume and the master limiter). */
  scream(dur = 0.9) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(1.0, t + 0.015);
    out.gain.setValueAtTime(1.0, t + dur * 0.7);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * 6); }
    shaper.curve = curve;
    shaper.connect(out).connect(this.sfxBus);
    [311, 466, 587, 740, 933, 1397].forEach((f, i) => {
      const o = c.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'square';
      o.frequency.setValueAtTime(f * 0.7, t);
      o.frequency.exponentialRampToValueAtTime(f * (1.25 + Math.random() * 0.3), t + 0.12);
      o.frequency.linearRampToValueAtTime(f * (0.8 + Math.random() * 0.4), t + dur);
      const l = c.createOscillator(); l.frequency.value = 17 + i * 7;
      const lg = c.createGain(); lg.gain.value = f * 0.08; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur);
      const og = c.createGain(); og.gain.value = 0.2;
      o.connect(og).connect(shaper); o.start(t); o.stop(t + dur + 0.05);
    });
    const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const ng = c.createGain(); ng.gain.value = 0.5; n.connect(ng).connect(shaper); n.start(t); n.stop(t + dur);
    this.tone(48, dur, 'sine', 0.8);
  }
  private voices: SpeechSynthesisVoice[] = [];
  /** Voices load asynchronously in most browsers, so cache them as soon as they exist. */
  loadVoices() {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      const get = () => { const v = synth.getVoices(); if (v.length) this.voices = v; };
      get();
      synth.addEventListener?.('voiceschanged', get);
    } catch { /* no speech */ }
  }
  /** Always an ENGLISH voice (never the system default language); deepest male voice available. */
  private pickVoice(): SpeechSynthesisVoice | null {
    if (!this.voices.length) { try { this.voices = window.speechSynthesis.getVoices(); } catch { /* ignore */ } }
    const en = this.voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
    if (!en.length) return null;
    const prefs = [/guy/i, /christopher/i, /eric/i, /roger/i, /steffan/i, /davis/i, /david/i, /mark/i, /english male/i, /daniel/i, /george/i, /ryan/i, /thomas/i, /fred/i, /alex/i, /male/i];
    for (const p of prefs) { const v = en.find((x) => p.test(x.name)); if (v) return v; }
    return en.find((v) => /en[-_]US/i.test(v.lang)) ?? en[0];
  }
  /** A wet, throat-deep growl shaped a little like a vowel. Layered under every spoken word. */
  private growl(delay: number, dur: number, vol = 0.22) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(46 + Math.random() * 10, t);
    o.frequency.linearRampToValueAtTime(38 + Math.random() * 8, t + dur);
    const trem = c.createOscillator(); trem.frequency.value = 23 + Math.random() * 9; // vocal fry
    const tg = c.createGain(); tg.gain.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    trem.connect(tg).connect(g.gain);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5; f1.frequency.setValueAtTime(300 + Math.random() * 500, t); f1.frequency.linearRampToValueAtTime(250 + Math.random() * 300, t + dur);
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 7; f2.frequency.value = 900 + Math.random() * 600;
    o.connect(f1).connect(g); o.connect(f2).connect(g);
    g.connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05); trem.start(t); trem.stop(t + dur + 0.05);
  }
  /**
   * The Hollow Man's voice: slow, bottomed-out English text-to-speech with a second, inhuman
   * throat growling under each word, a breath before it speaks, and tape hiss. No API needed.
   * If the browser has no English voice, it growls instead (it never falls back to another language).
   */
  speak(text: string) {
    const vol = Settings.get().sfx;
    const words = text.split(/\s+/).filter(Boolean);
    const rate = 0.5;
    const per = 0.52; // seconds per word at this rate (approx.)
    const dur = Math.max(1.4, words.length * per + 0.6);
    // breath in, then hiss under the whole line
    this.noise(0.5, 'bandpass', 700, 0.12, 0.8);
    this.noise(dur, 'bandpass', 2400, 0.045, 0.5);
    this.tone(41, dur, 'sine', 0.22, 'sfx', 0.35, 36);
    words.forEach((w, i) => this.growl(0.45 + i * per, Math.min(0.6, 0.22 + w.length * 0.05)));
    // a thin, wrong, high whine riding on top
    this.tone(2890, dur, 'sine', 0.012, 'sfx', 0.3, 2710);
    const voice = this.pickVoice();
    try {
      const synth = window.speechSynthesis;
      if (!synth || !voice || vol <= 0) throw new Error('no english tts');
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice; u.lang = voice.lang || 'en-US';
      u.pitch = 0; u.rate = rate; u.volume = Math.min(1, vol);
      window.setTimeout(() => { try { synth.speak(u); } catch { /* ignore */ } }, 400);
    } catch {
      words.forEach((w, i) => this.growl(0.45 + i * per, Math.min(0.7, 0.3 + w.length * 0.06), 0.4));
    }
  }
  stopSpeech() { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }
  silence(sec = 2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(0.0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(Settings.get().music, t + sec, 0.4);
  }
}

export const AudioSys = new AudioSysImpl();
