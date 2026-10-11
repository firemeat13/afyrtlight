import Phaser from 'phaser';
import { ADAM_SCALE, BAND_BOT, BAND_TOP, EMOJI, FONT, H, NICK_SCALE, Phase, TREE_S, W } from '../config';
import { Backdrop } from '../gfx/Backdrop';
import { AudioSys } from '../systems/AudioSys';
import { DialogueBox } from '../systems/Dialogue';
import { Game, ITEMS } from '../systems/GameState';
import { Settings } from '../systems/Settings';
import { TouchControls } from '../systems/TouchControls';

export interface Interactable { id: string; x: number; y: number; reach: number; run: () => Promise<void> }
export interface Swap { o: { setTexture: (k: string) => unknown; setVisible?: (v: boolean) => unknown }; day: string; night: string }
export interface Light { x: number; y: number; d: number }
export interface Zone { x: number; y: number; r: number }
interface Eye { img: Phaser.GameObjects.Image; x: number; y: number; phase: number; fade: number }
interface Stalker { spr: Phaser.GameObjects.Image; eyes: Phaser.GameObjects.Image; x: number; y: number; blinkT: number; stun: number; hits: number }

const SPEED_X = 200;
const SPEED_Y = 120;

/**
 * Shared exploration engine: movement, camera, interaction, night lighting, eyes,
 * the Hollow Man stalker, health/stamina, HUD. Parts subclass this.
 */
export abstract class WorldScene extends Phaser.Scene {
  protected worldW = 6000;
  protected phase: Phase = 'day';
  protected backdrop!: Backdrop;
  protected dlg!: DialogueBox;
  protected touch!: TouchControls;
  protected keys!: Record<string, Phaser.Input.Keyboard.Key>;

  protected adam!: Phaser.GameObjects.Sprite;
  protected nick!: Phaser.GameObjects.Sprite;
  protected adamShadow!: Phaser.GameObjects.Ellipse;
  protected nickShadow!: Phaser.GameObjects.Ellipse;
  protected history: Array<{ x: number; y: number }> = [];
  protected nickFlip = false;
  protected nickMode: 'follow' | 'stay' = 'follow';
  protected nickHurt = false;
  /** True while a cutscene is walking Nicholas somewhere (plays his walk cycle in 'stay' mode). */
  protected nickWalking = false;

  protected swaps: Swap[] = [];
  protected interactables: Interactable[] = [];
  protected path!: Phaser.GameObjects.TileSprite;
  protected pathNight!: Phaser.GameObjects.TileSprite;
  protected prompt!: Phaser.GameObjects.Text;

  protected busy = false;
  protected ending = false;
  protected camX = 0;
  protected worldT = 0;
  private stepT = 0;
  private dropT = 0;
  private hbT = 0;
  private interactCd = 0;
  // usable items / gun
  protected flameT = 0;
  protected autoWalk = false;
  /** Solid footprints (ponds...). Blocks x within +-w while y <= yMax; the strip in front stays walkable. */
  protected obstacles: Array<{ x: number; w: number; yMax: number }> = [];
  protected boostT = 0;
  private fireCd = 0;
  private muzzleT = 0;
  private hotbar: Array<{ id: string; bg: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Text; key: Phaser.GameObjects.Text; info: Phaser.GameObjects.Text }> = [];
  private hotbarSig = '';
  private ammoTxt!: Phaser.GameObjects.Text;
  private flameGlow!: Phaser.GameObjects.Image;
  private gunImg!: Phaser.GameObjects.Image;
  private muzzleImg!: Phaser.GameObjects.Image;
  private tracer!: Phaser.GameObjects.Graphics;
  private prevBusy = false;

  // health / stamina
  protected hp = 3;
  protected stamina = 100;
  private staminaLock = false;
  private hurtCd = 0;
  private hearts: Phaser.GameObjects.Text[] = [];
  private staminaBar!: Phaser.GameObjects.Graphics;

  // lighting & fx
  protected dark!: Phaser.GameObjects.RenderTexture;
  private lightImg!: Phaser.GameObjects.Image;
  protected fog: Phaser.GameObjects.Image[] = [];
  protected eyes: Eye[] = [];
  protected vignette!: Phaser.GameObjects.Image;
  protected hurtVig!: Phaser.GameObjects.Image;
  protected dread = 0;
  protected dayMotes!: Phaser.GameObjects.Particles.ParticleEmitter;
  protected nightSpores!: Phaser.GameObjects.Particles.ParticleEmitter;
  protected bloodFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  protected duskTint!: Phaser.GameObjects.Rectangle;
  protected hudObj!: Phaser.GameObjects.Text;
  protected hudClock!: Phaser.GameObjects.Text;
  private mapArrow!: Phaser.GameObjects.Text;
  private lightOutT = 0;
  private nextOutage = 14;
  protected nightOnly: Phaser.GameObjects.Image[] = [];

  // the Hollow Man
  protected stalker: Stalker | null = null;
  protected stalkerOn = false; // is the hunt active?
  private stalkerCd = 0;

  // ---------------------------------------------------------------- hooks
  protected abstract startPhase(): Phase;
  protected abstract buildWorld(): void;
  protected abstract begin(): void;
  protected abstract objective(): string;
  protected objectiveX(): number | null { return null; }
  protected extraLights(): Light[] { return []; }
  protected safeZones(): Zone[] { return []; }
  protected onFrame(_dt: number): void { /* optional */ }
  protected onInit(_data: any): void { /* optional */ }
  protected abstract retry(): void;

  init(data: any) {
    this.phase = this.startPhase(); this.swaps = []; this.interactables = []; this.history = [];
    this.busy = false; this.ending = false; this.camX = 0; this.worldT = 0;
    this.fog = []; this.eyes = []; this.dread = 0; this.nightOnly = [];
    this.nickMode = 'follow'; this.nickHurt = false; this.nickWalking = false;
    this.hp = Game.maxHp; this.stamina = Game.maxStamina; this.staminaLock = false; this.hurtCd = 0;
    this.stalker = null; this.stalkerOn = false; this.stalkerCd = 0; this.hearts = [];
    this.lightOutT = 0; this.nextOutage = 14; this.flameT = 0; this.boostT = 0; this.obstacles = []; this.fireCd = 0; this.muzzleT = 0; this.hotbar = []; this.hotbarSig = '';
    this.onInit(data ?? {});
  }

  // ---------------------------------------------------------------- build
  create() {
    const night = this.phase === 'night';
    this.cameras.main.setBounds(0, 0, this.worldW, H);
    this.backdrop = new Backdrop(this, night ? 'night' : 'day');
    const mkPath = (key: string, a: number) =>
      this.add.tileSprite(0, 372, W, 62, key).setOrigin(0).setScrollFactor(0).setDepth(-55).setAlpha(a);
    this.path = mkPath('path', 0.9);
    this.pathNight = mkPath('path_night', night ? 1 : 0).setDepth(-54);

    this.buildWorld();
    this.buildActors();
    this.buildFx();
    this.buildHud();

    this.dlg = new DialogueBox(this);
    this.touch = new TouchControls(this);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ENTER,SHIFT') as any;
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (this.busy || this.ending) return;
      if (e.code === 'KeyF' || e.code === 'KeyJ') this.fire();
      else if (e.code === 'KeyL') this.useItem('flashlight');
      else if (/^(Digit|Numpad)\d$/.test(e.code)) {
        const n = parseInt(e.code.slice(-1), 10);
        const slot = this.hotbar[n === 0 ? 9 : n - 1];
        if (slot) this.useItem(slot.id);
      }
    });
    this.events.once('shutdown', () => { this.input.keyboard!.removeAllListeners(); this.tweens.killAll(); AudioSys.muffle(false); });

    if (night) this.applyPhaseVisuals(true);
    this.begin();
  }

  protected addEnv(o: Swap['o'], day: string, night: string) { this.swaps.push({ o, day, night }); }

  /** Trees stand ON the ground (feet below the horizon line) and have a contact shadow. */
  protected addTree(x: number, y: number, v: number, scale = TREE_S, sway = true) {
    this.add.ellipse(x, y - 1, 88 * (scale / TREE_S), 14, 0x000000, 0.28).setDepth(y - 1);
    const t = this.add.image(x, y, `tree_day_${v}`).setOrigin(0.5, 1).setScale(scale).setDepth(y);
    this.addEnv(t, `tree_day_${v}`, `tree_night_${v}`);
    if (sway) this.tweens.add({ targets: t, angle: { from: -0.4, to: 0.4 }, duration: Phaser.Math.Between(3000, 5000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return t;
  }

  protected addProp(day: string, night: string, x: number, y: number, scale = 3) {
    const o = this.add.image(x, y, day).setOrigin(0.5, 1).setScale(scale).setDepth(y);
    this.addEnv(o, day, night);
    return o;
  }

  /** Images that only exist at night (hanging bodies, blood...). */
  protected addNightOnly(key: string, x: number, y: number, scale = 3, depth?: number, originY = 1) {
    const o = this.add.image(x, y, key).setOrigin(0.5, originY).setScale(scale).setDepth(depth ?? y).setVisible(this.phase === 'night');
    this.nightOnly.push(o);
    return o;
  }

  /** A pickup lying in the world (any time of day). */
  protected addDayPickup(id: string, key: string, x: number, y: number, scale: number, take: () => void | Promise<void>) {
    const img = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(y);
    let taken = false;
    this.interactables.push({
      id, x, y, reach: 100,
      run: async () => {
        if (taken) return;
        taken = true; img.destroy(); this.interactables = this.interactables.filter((i) => i.id !== id);
        await take();
      },
    });
    return img;
  }

  /** Add (or stack) an item in the item bar. */
  protected giveItem(id: string, n = 1) {
    Game.bought.add(id); Game.inv.add(id); Game.counts[id] = (Game.counts[id] ?? 0) + n;
    this.refreshHotbar(true);
  }

  /** A pickup that exists at night only. */
  protected addPickup(id: string, key: string, x: number, y: number, scale: number, take: () => void) {
    const img = this.addNightOnly(key, x, y, scale, y);
    let taken = false;
    this.interactables.push({
      id, x, y, reach: 100,
      run: async () => {
        if (taken || this.phase !== 'night') return;
        taken = true; img.destroy(); this.interactables = this.interactables.filter((i) => i.id !== id);
        take();
      },
    });
    return img;
  }

  private buildActors() {
    const mk = (key: string, x: number, y: number, sc: number) => {
      const sh = this.add.ellipse(x, y - 2, 14 * sc, 12, 0x000000, 0.3).setDepth(1);
      const s = this.add.sprite(x, y, key, 0).setOrigin(0.5, 1).setScale(sc).setDepth(y);
      return { s, sh };
    };
    const a = mk('adam', 260, 380, ADAM_SCALE);
    const n = mk('nicholas', 200, 386, NICK_SCALE);
    this.adam = a.s; this.adamShadow = a.sh; this.nick = n.s; this.nickShadow = n.sh;
    this.prompt = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '16px', color: '#ffffff', backgroundColor: '#000000bb', padding: { x: 8, y: 6 },
    }).setOrigin(0.5).setDepth(1200).setVisible(false);
    this.tweens.add({ targets: this.prompt, scale: 1.12, duration: 500, yoyo: true, repeat: -1 });
  }

  private buildFx() {
    this.dayMotes = this.add.particles(0, 0, 'mote', {
      x: { min: 0, max: W }, y: { min: 100, max: H - 40 }, lifespan: { min: 4000, max: 8000 },
      speedX: { min: 4, max: 22 }, speedY: { min: -14, max: 6 }, scale: { start: 1.2, end: 0.4 },
      alpha: { start: 0.9, end: 0 }, tint: [0xfff2a8, 0xffffff, 0xb5f27a], frequency: 130, blendMode: 'ADD',
    }).setScrollFactor(0).setDepth(700);
    this.nightSpores = this.add.particles(0, 0, 'spore', {
      x: { min: 0, max: W }, y: { min: 100, max: H }, lifespan: { min: 5000, max: 9000 },
      speedX: { min: -12, max: 12 }, speedY: { min: -22, max: -4 }, scale: { start: 1.6, end: 0.3 },
      alpha: { start: 0.7, end: 0 }, frequency: 140, blendMode: 'ADD',
    }).setScrollFactor(0).setDepth(965).setVisible(false);
    this.nightSpores.stop();
    this.bloodFx = this.add.particles(0, 0, 'pixel', {
      speed: { min: 80, max: 300 }, angle: { min: 195, max: 345 }, gravityY: 700, lifespan: { min: 400, max: 900 },
      scale: { start: 2.2, end: 0.6 }, tint: [0xaa0010, 0x7d0e19, 0xd01a2a], emitting: false,
    }).setDepth(1100);

    this.duskTint = this.add.rectangle(0, 0, W, H, 0x3a1060, 0).setOrigin(0).setScrollFactor(0).setDepth(860);
    for (let i = 0; i < 12; i++) {
      const f = this.add.image(Phaser.Math.Between(-200, W), Phaser.Math.Between(250, 420), 'fogblob')
        .setScale(Phaser.Math.FloatBetween(3, 5)).setTint(0x8a80c8).setAlpha(0).setScrollFactor(0).setDepth(890);
      f.setData('v', Phaser.Math.FloatBetween(6, 18));
      this.fog.push(f);
    }
    this.dark = this.add.renderTexture(0, 0, W, H).setOrigin(0).setScrollFactor(0).setDepth(900).setVisible(false);
    this.lightImg = new Phaser.GameObjects.Image(this, 0, 0, 'light');
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setScale(2).setScrollFactor(0).setDepth(1000).setAlpha(0.3);
    this.flameGlow = this.add.image(0, 0, 'glow').setScale(3).setTint(0xff9a3a).setBlendMode(Phaser.BlendModes.ADD).setDepth(955).setVisible(false);
    this.gunImg = this.add.image(0, 0, 'gun').setScale(3.4).setDepth(2000).setVisible(false);
    this.muzzleImg = this.add.image(0, 0, 'glow').setScale(2.2).setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setDepth(960).setVisible(false);
    this.tracer = this.add.graphics().setDepth(959);
    this.hurtVig = this.add.image(0, 0, 'vignette').setOrigin(0).setScale(2).setScrollFactor(0).setDepth(1001).setTint(0xff0010).setAlpha(0);
  }

  private buildHud() {
    this.hudObj = this.add.text(18, 14, '', { fontFamily: FONT, fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 4, wordWrap: { width: 600 } }).setScrollFactor(0).setDepth(1500);
    this.hudClock = this.add.text(W - 18, 14, '', { fontFamily: FONT, fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(1, 0).setScrollFactor(0).setDepth(1500);
    for (let i = 0; i < Game.maxHp; i++) {
      this.hearts.push(this.add.text(18 + i * 26, 56, '♥', { fontFamily: 'sans-serif', fontSize: '24px', color: '#ff3b4e', stroke: '#000', strokeThickness: 4 }).setScrollFactor(0).setDepth(1500));
    }
    this.staminaBar = this.add.graphics().setScrollFactor(0).setDepth(1500);
    this.mapArrow = this.add.text(0, 130, '', { fontFamily: FONT, fontSize: '14px', color: '#ffd23f', stroke: '#000', strokeThickness: 4, backgroundColor: '#00000066', padding: { x: 6, y: 4 } }).setScrollFactor(0).setDepth(1500).setVisible(false);
    this.ammoTxt = this.add.text(18, 106, '', { fontFamily: FONT, fontSize: '12px', color: '#ffd23f', stroke: '#000', strokeThickness: 4 }).setScrollFactor(0).setDepth(1500);
    this.updateHud();
  }

  // ---------------------------------------------------------------- items
  private ITEM_ICON: Record<string, string> = {
    flashlight: '🔦', batteries: '🔋', firstaid: '🩹', water: '💧', snacks: '🥜', lighter: '🔥', map: '🗺️',
    pistol: '', candy: '🍬', soda: '🥤', comic: '📖', shades: '🕶️', headphones: '🎧', speaker: '🔊',
  };

  private slotInfo(id: string): string {
    const n = Game.counts[id] ?? 1;
    switch (id) {
      case 'flashlight': return Game.flashOn ? `${Math.round(Game.charge)}%` : 'OFF';
      case 'pistol': return String(Game.ammo);
      case 'lighter': return this.flameT > 0 ? `${Math.ceil(this.flameT)}s` : `x${n}`;
      case 'map': return Game.mapOn ? 'ON' : 'OFF';
      case 'shades': return Game.wearShades ? 'ON' : 'OFF';
      case 'headphones': return Game.muffled ? 'ON' : 'OFF';
      default: return n > 1 ? `x${n}` : '';
    }
  }

  private refreshHotbar(force = false) {
    const ids = ITEMS.filter((i) => Game.bought.has(i.id)).map((i) => i.id); // stable slots: numbers never shift
    const sig = ids.map((i) => i + (Game.has(i) ? this.slotInfo(i) : "-")).join('|') + (Game.hasGun ? `G${Game.ammo}` : '');
    if (!force && sig === this.hotbarSig) return;
    const layout = ids.join(',');
    if (this.hotbar.map((h) => h.id).join(',') !== layout) {
      this.hotbar.forEach((h) => { h.bg.destroy(); h.icon.destroy(); h.key.destroy(); h.info.destroy(); });
      this.hotbar = ids.map((id, i) => {
        const x = W - 18 - (ids.length - i) * 46 + 3, y = 52;
        const bg = this.add.rectangle(x, y, 42, 46, 0x000000, 0.55).setOrigin(0).setStrokeStyle(2, 0x6a5ca0).setScrollFactor(0).setDepth(1500).setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => { if (!this.busy && !this.ending) this.useItem(id); });
        const icon = this.add.text(x + 21, y + 20, this.ITEM_ICON[id] ?? '?', { fontFamily: EMOJI, fontSize: '22px' }).setOrigin(0.5).setScrollFactor(0).setDepth(1501);
        const key = this.add.text(x + 3, y + 1, String(i + 1 === 10 ? 0 : i + 1), { fontFamily: FONT, fontSize: '8px', color: '#ffd23f' }).setScrollFactor(0).setDepth(1501);
        const info = this.add.text(x + 21, y + 44, '', { fontFamily: FONT, fontSize: '7px', color: '#ffffff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1502);
        if (id === 'pistol') { const gi = this.add.image(x + 21, y + 20, 'gun').setScale(2.4).setScrollFactor(0).setDepth(1501); bg.once('destroy', () => gi.destroy()); }
        return { id, bg, icon, key, info };
      });
    }
    this.hotbar.forEach((h) => {
      const have = Game.has(h.id);
      h.info.setText(have ? this.slotInfo(h.id) : '');
      h.icon.setAlpha(have ? 1 : 0.25); h.bg.setAlpha(have ? 1 : 0.5);
      const on = (h.id === 'flashlight' && Game.flashlightLit) || (h.id === 'lighter' && this.flameT > 0) || (h.id === 'shades' && Game.wearShades) || (h.id === 'headphones' && Game.muffled);
      h.bg.setStrokeStyle(2, on ? 0xffd23f : 0x6a5ca0);
    });
    this.ammoTxt.setText(Game.hasGun ? `PISTOL  ${Game.ammo}/${Game.maxAmmo}   [F] fire` : '');
    this.hotbarSig = sig;
  }

  /** A short floating line above Adam (non-blocking). */
  protected bubble(text: string, color = '#ffffff') {
    const t = this.add.text(this.adam.x, this.adam.y - 130, text, { fontFamily: FONT, fontSize: '12px', color, stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(1300);
    this.tweens.add({ targets: t, y: t.y - 36, alpha: 0, duration: 1700, delay: 600, onComplete: () => t.destroy() });
  }

  protected useItem(id: string) {
    if (!Game.has(id) || this.busy || this.ending) return;
    const night = this.phase === 'night';
    switch (id) {
      case 'pistol': this.fire(); break;
      case 'flashlight':
        if (Game.charge <= 0) { this.bubble('The flashlight is dead.', '#ff8a8a'); AudioSys.click(); break; }
        Game.flashOn = !Game.flashOn; AudioSys.click(); this.bubble(Game.flashOn ? 'Flashlight ON' : 'Flashlight OFF');
        break;
      case 'batteries':
        if (!Game.has('flashlight')) { this.bubble('No flashlight to put them in.', '#ff8a8a'); break; }
        if (Game.charge > 85) { this.bubble('The flashlight is still strong.'); break; }
        Game.charge = 100; Game.flashOn = true; Game.use('batteries'); AudioSys.chime(1); this.bubble('Fresh batteries. 100%', '#9be37a');
        break;
      case 'firstaid':
        if (this.hp < Game.maxHp) { this.hp = Math.min(Game.maxHp, this.hp + 2); Game.use('firstaid'); AudioSys.chime(0); this.bubble('+2 hearts', '#ff8a9a'); this.updateHud(); }
        else if (this.nickHurt) { this.nickHurt = false; Game.use('firstaid'); AudioSys.chime(0); this.nick.setTint(night ? 0x9aa0d8 : 0xffffff); this.bubble("Nicholas's arm is bandaged.", '#7fc4ff'); this.nickSay('Nicholas', 'Thanks, Adam.'); }
        else this.bubble('No wounds to treat.');
        break;
      case 'water':
        if (this.stamina > Game.maxStamina * 0.8) { this.bubble('Not thirsty yet.'); break; }
        this.stamina = Game.maxStamina; this.staminaLock = false; Game.use('water'); AudioSys.chime(0); this.bubble('Stamina restored', '#9be37a');
        break;
      case 'snacks':
        if (this.hp >= Game.maxHp && this.stamina > Game.maxStamina * 0.8) { this.bubble('Not hungry yet.'); break; }
        this.hp = Math.min(Game.maxHp, this.hp + 1); this.stamina = Math.min(Game.maxStamina, this.stamina + 40); this.staminaLock = false;
        Game.use('snacks'); AudioSys.chime(0); this.bubble('+1 heart, +stamina', '#9be37a'); this.updateHud();
        break;
      case 'lighter':
        if (this.flameT > 0) { this.bubble('The flame is already lit.'); break; }
        this.flameT = 28; Game.use('lighter'); AudioSys.click(); AudioSys.chime(2);
        this.bubble(night ? 'Fire. It will not cross it.' : 'A little flame.', '#ffb35a');
        break;
      case 'map':
        Game.mapOn = !Game.mapOn; AudioSys.click(); this.bubble(Game.mapOn ? 'Map arrow ON' : 'Map arrow OFF');
        break;
      case 'candy':
        this.boostT = 10; Game.use('candy'); AudioSys.chime(3); this.bubble('Sugar rush! Faster!', '#ff9ad0');
        break;
      case 'soda':
        this.stamina = Math.min(Game.maxStamina, this.stamina + 45); this.staminaLock = false; this.boostT = Math.max(this.boostT, 5);
        Game.use('soda'); AudioSys.noise(0.15, 'highpass', 4000, 0.1); this.bubble('*burp* Fizzy!', '#ff9ad0');
        break;
      case 'comic':
        this.bubble('Issue #214 is great. Not helpful.', '#c9c4ff'); if (night) this.dread = Math.min(1, this.dread + 0.1);
        break;
      case 'shades':
        Game.wearShades = !Game.wearShades; AudioSys.click(); this.bubble(Game.wearShades ? (night ? 'It is so dark. Great idea.' : 'Looking cool.') : 'Sunglasses off.');
        break;
      case 'headphones':
        Game.muffled = !Game.muffled; AudioSys.muffle(Game.muffled); this.bubble(Game.muffled ? "You can't hear anything." : 'Headphones off.');
        break;
      case 'speaker':
        AudioSys.tone(523, 0.3, 'square', 0.08); AudioSys.tone(659, 0.3, 'square', 0.08, 'sfx', 0.2); AudioSys.tone(784, 0.4, 'square', 0.08, 'sfx', 0.4);
        this.bubble('♪ ♪ ♪', '#ffd23f');
        if (night) { this.spawnEyes(2); this.dread = Math.min(1, this.dread + 0.3); if (!this.stalker) this.spawnStalker(true); this.nickSay('Nicholas', 'TURN IT OFF!'); }
        else this.nickSay('Nicholas', 'Not now, Adam.');
        break;
    }
    this.refreshHotbar(true);
  }

  // ---------------------------------------------------------------- gun
  protected pickupAmmo(n: number) {
    Game.ammo = Math.min(Game.maxAmmo, Game.ammo + n);
    AudioSys.chime(1); this.bubble(`+${n} rounds`, '#ffd23f');
    this.refreshHotbar(true);
  }

  protected fire() {
    if (!Game.hasGun || this.busy || this.ending || this.fireCd > 0) return;
    if (Game.ammo <= 0) { this.fireCd = 0.4; AudioSys.click(); this.bubble('*click* Out of ammo!', '#ff8a8a'); return; }
    Game.ammo--; this.fireCd = 0.45; this.muzzleT = 0.12;
    AudioSys.gunshot();
    this.shake(120, 0.006);
    const dir = this.adam.flipX ? -1 : 1;
    const mx = this.adam.x + dir * 58, my = this.adam.y - 62;
    this.adam.setFlipX(dir < 0);
    this.gunImg.setVisible(true).setFlipX(dir < 0).setPosition(this.adam.x + dir * 40, my).setData('t', 0.28);
    this.muzzleImg.setVisible(true).setPosition(mx + dir * 14, my);
    this.tracer.clear().lineStyle(3, 0xffe9a8, 0.9).lineBetween(mx, my, mx + dir * 760, my);
    this.tweens.add({ targets: this.tracer, alpha: { from: 1, to: 0 }, duration: 120 });
    // hit scan: the Hollow Man
    const s = this.stalker;
    if (s && this.phase === 'night') {
      const dx = (s.x - this.adam.x) * dir;
      if (dx > 0 && dx < 780 && Math.abs(s.y - this.adam.y) < 90) this.hitStalker(dir);
    }
    for (const e of this.eyes) {
      const dx = (e.x - this.adam.x) * dir;
      if (dx > 0 && dx < 760) { e.fade = 0; e.x = Phaser.Math.Clamp(e.x + dir * 400, 40, this.worldW - 40); }
    }
    this.refreshHotbar(true);
  }

  private hitStalker(dir: number) {
    const s = this.stalker;
    if (!s) return;
    s.hits++;
    this.bloodFx.explode(22, s.x, s.y - 90);
    s.spr.setTint(0xff6a6a);
    this.time.delayedCall(180, () => s.spr.clearTint());
    if (s.hits >= 4) {
      this.bloodFx.explode(60, s.x, s.y - 90);
      this.bubble('It collapses into ash.', '#c9a0ff');
      AudioSys.whisper(1);
      this.despawnStalker();
      this.stalkerCd = 55;
      this.dread = Math.max(0, this.dread - 0.4);
      return;
    }
    s.stun = 3.2;
    s.x = Phaser.Math.Clamp(s.x + dir * 280, 80, this.worldW - 80);
    AudioSys.whisper(0.5);
  }

  protected updateHud() {
    this.hudObj.setText(this.objective());
    this.hearts.forEach((h, i) => h.setColor(i < this.hp ? '#ff3b4e' : '#3a2a30'));
  }

  // ---------------------------------------------------------------- helpers
  protected wait(ms: number) { return new Promise<void>((res) => this.time.delayedCall(ms, res)); }
  protected shake(ms: number, amt: number) { if (Settings.get().shake) this.cameras.main.shake(ms, amt); }

  protected async lock<T>(fn: () => Promise<T>): Promise<T> {
    this.busy = true; this.touch.freeze(true);
    try { return await fn(); } finally { this.busy = false; this.interactCd = 0.35; this.touch.freeze(false); }
  }

  protected card(title: string, sub: string, color = '#fff3c4') {
    const t = this.add.text(W / 2, H / 2 - 40, title, { fontFamily: FONT, fontSize: '34px', color, stroke: '#05030c', strokeThickness: 10, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(3000).setAlpha(0);
    const s = this.add.text(W / 2, H / 2 + 14, sub, { fontFamily: FONT, fontSize: '16px', color: '#c9c4ff', stroke: '#05030c', strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(3000).setAlpha(0);
    return new Promise<void>((res) => {
      this.tweens.add({ targets: [t, s], alpha: 1, duration: 1200, yoyo: true, hold: 1500, onComplete: () => { t.destroy(); s.destroy(); res(); } });
    });
  }

  protected applyPhaseVisuals(instant = false) {
    const night = this.phase === 'night';
    this.swaps.forEach((s) => s.o.setTexture(night ? s.night : s.day));
    this.backdrop.setMood(night ? 'night' : 'day', 0);
    this.pathNight.setAlpha(night ? 1 : 0);
    this.duskTint.setAlpha(0);
    this.dark.setVisible(night);
    this.fog.forEach((f) => f.setAlpha(night ? 0.35 : 0));
    this.vignette.setAlpha(night ? 0.75 : 0.3);
    this.nightOnly.forEach((o) => o.setVisible(night));
    if (night) {
      this.dayMotes.stop();
      this.nightSpores.setVisible(true).start();
      this.nick.setTint(0x9aa0d8); this.adam.setTint(0x9aa0d8);
    } else {
      this.nick.clearTint(); this.adam.clearTint();
    }
    void instant;
  }

  // ---------------------------------------------------------------- eyes
  protected spawnEyes(n: number) {
    const target = Math.min(12, this.eyes.length + n + (Game.has('speaker') ? 1 : 0));
    while (this.eyes.length < target) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = Phaser.Math.Clamp(this.adam.x + side * Phaser.Math.Between(300, 520), 40, this.worldW - 40);
      const y = Phaser.Math.Between(200, 320);
      const img = this.add.image(x, y, 'eyes').setScale(2).setDepth(950).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      this.eyes.push({ img, x, y, phase: Math.random() * 10, fade: 0 });
    }
  }

  // ---------------------------------------------------------------- the Hollow Man
  protected startHunt() { this.stalkerOn = true; this.stalkerCd = 6; }
  protected stopHunt() { this.stalkerOn = false; this.despawnStalker(); }

  protected spawnStalker(near = false) {
    if (this.stalker) return;
    let dir = Math.random() < 0.5 ? -1 : 1;
    const dist = near ? 480 : 760;
    let x = this.adam.x + dir * dist;
    if (x < 80 || x > this.worldW - 80) { dir = -dir; x = this.adam.x + dir * dist; }
    x = Phaser.Math.Clamp(x, 80, this.worldW - 80);
    const y = Phaser.Math.Between(BAND_TOP, BAND_BOT);
    const spr = this.add.image(x, y, 'hollow').setOrigin(0.5, 1).setScale(4.4).setDepth(y).setAlpha(0);
    const eyes = this.add.image(x, y - 170, 'eyes').setScale(1.6).setDepth(955).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setTint(0xff2020);
    this.stalker = { spr, eyes, x, y, blinkT: 4, stun: 0, hits: 0 };
    this.tweens.add({ targets: [spr, eyes], alpha: 1, duration: 1800 });
    AudioSys.whisper(0.9); AudioSys.heartbeat();
    this.dread = Math.min(1, this.dread + 0.2);
  }

  protected despawnStalker() {
    if (!this.stalker) return;
    const s = this.stalker; this.stalker = null;
    this.tweens.add({ targets: [s.spr, s.eyes], alpha: 0, duration: 800, onComplete: () => { s.spr.destroy(); s.eyes.destroy(); } });
  }

  protected inSafe(x: number, y: number): boolean {
    if (this.flameT > 0 && Math.abs(x - this.adam.x) < 5) return true;
    const zones = this.safeZones();
    if (this.nickMode === 'stay') zones.push({ x: this.nick.x, y: this.nick.y, r: 230 });
    return zones.some((z) => Phaser.Math.Distance.Between(x, y, z.x, z.y) < z.r);
  }

  private updateStalker(dt: number) {
    if (this.phase !== 'night') return;
    if (!this.stalker) {
      if (this.stalkerOn && !this.busy) {
        this.stalkerCd -= dt;
        if (this.stalkerCd <= 0) { this.spawnStalker(); this.stalkerCd = 26; }
      }
      return;
    }
    const s = this.stalker;
    this.hurtCd = Math.max(0, this.hurtCd - dt);
    const dx = this.adam.x - s.x;
    const dist = Math.abs(dx);
    const safe = this.inSafe(this.adam.x, this.adam.y);
    if (s.stun > 0) {
      s.stun -= dt;
      s.spr.setAlpha(0.55 + Math.sin(this.worldT * 0.05) * 0.4);
    } else if (!this.busy && !this.ending) {
      if (safe) {
        // pushed back by the light, but it never leaves
        if (dist < 420) s.x -= Math.sign(dx || 1) * 140 * dt;
        s.spr.setAlpha(0.6 + Math.sin(this.worldT * 0.03) * 0.3);
      } else {
        const speed = 78 + this.dread * 34 + (this.hp <= 1 ? 14 : 0);
        s.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
        s.y += (this.adam.y - s.y) * Math.min(1, dt * 1.2);
        s.spr.setAlpha(1);
        s.blinkT -= dt;
        if (s.blinkT <= 0 && dist > 480) { // it skips ahead when you look away
          s.x = this.adam.x + Math.sign(-dx || 1) * 380; s.blinkT = 7; AudioSys.whisper(0.7);
          s.x = Phaser.Math.Clamp(s.x, 80, this.worldW - 80);
        }
        if (dist < 62 && Math.abs(this.adam.y - s.y) < 50 && this.hurtCd <= 0) this.hurt(Math.sign(dx || 1));
      }
    }
    s.y = Phaser.Math.Clamp(s.y, BAND_TOP, BAND_BOT);
    s.spr.setPosition(s.x, s.y).setDepth(s.y).setFlipX(dx < 0).setAngle(Math.sin(this.worldT * 0.004) * 2);
    s.eyes.setPosition(s.x + (dx > 0 ? 2 : -2), s.y - 175 + Math.sin(this.worldT * 0.004) * 2);
    this.dread = Math.min(1, Math.max(this.dread, dist < 400 ? 0.5 : 0));
    if (dist < 350) {
      this.hbT -= dt;
      if (this.hbT <= 0) { AudioSys.heartbeat(); this.hbT = 0.4 + dist / 600; }
    }
  }

  protected hurt(dir: number) {
    this.hp--;
    this.hurtCd = 2.6;
    this.updateHud();
    AudioSys.stinger();
    this.shake(450, 0.02);
    this.bloodFx.explode(26, this.adam.x, this.adam.y - 60);
    const cl = this.add.image(W / 2 + Phaser.Math.Between(-60, 60), H / 2 - 20, 'claw').setScrollFactor(0).setDepth(3100).setScale(2.6).setAlpha(0.95).setAngle(Phaser.Math.Between(-12, 12));
    this.tweens.add({ targets: cl, alpha: 0, duration: 900, delay: 150, onComplete: () => cl.destroy() });
    this.hurtVig.setAlpha(1);
    this.tweens.add({ targets: this.hurtVig, alpha: this.hp <= 1 ? 0.55 : 0, duration: 900 });
    this.adam.x = Phaser.Math.Clamp(this.adam.x - dir * 150, 60, this.worldW - 60);
    if (this.stalker) this.stalker.x = Phaser.Math.Clamp(this.adam.x + dir * 520, 80, this.worldW - 80);
    this.nickSay('Nicholas', this.hp > 0 ? ['ADAM! RUN!', "It's on you! Move!", 'Get away from it!'][Phaser.Math.Between(0, 2)] : '...');
    if (this.hp <= 0) void this.gameOver();
  }

  /** Short shout above Nicholas without blocking gameplay. */
  protected nickSay(_who: string, text: string) {
    const t = this.add.text(this.nick.x, this.nick.y - 130, text, { fontFamily: FONT, fontSize: '12px', color: '#7fc4ff', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(1300);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 1600, delay: 500, onComplete: () => t.destroy() });
  }

  protected async gameOver() {
    if (this.ending) return;
    this.ending = true; this.busy = true; this.touch.freeze(true);
    AudioSys.setMood('none', 0.3);
    this.shake(900, 0.03);
    await this.wait(900);
    this.cameras.main.fadeOut(1200, 60, 0, 6);
    await this.wait(1300);
    const bg = this.add.rectangle(0, 0, W, H, 0x0a0004).setOrigin(0).setScrollFactor(0).setDepth(5000);
    const t = this.add.text(W / 2, H / 2 - 40, 'YOU WERE TAKEN', { fontFamily: FONT, fontSize: '42px', color: '#b5121f', stroke: '#000', strokeThickness: 10 }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);
    const s = this.add.text(W / 2, H / 2 + 50, 'TAP / PRESS ANY KEY TO TRY AGAIN', { fontFamily: FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);
    this.tweens.add({ targets: s, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
    void bg; void t;
    this.cameras.main.fadeIn(600, 10, 0, 4);
    await this.wait(1200);
    const go = () => this.retry();
    this.input.keyboard!.once('keydown', go);
    this.input.once('pointerdown', go);
  }

  // ---------------------------------------------------------------- update
  update(_t: number, dtMs: number) {
    const dt = Math.min(dtMs, 50) / 1000;
    this.worldT += dtMs;
    const cam = this.cameras.main;

    // ---- movement + sprint
    let vx = 0, vy = 0, sprint = false;
    const free = !this.busy && !this.ending;
    if (free) {
      const k = this.keys;
      vx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
      vy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
      if (this.touch.enabled) { vx += this.touch.vec.x; vy += this.touch.vec.y; }
      const len = Math.hypot(vx, vy);
      sprint = k.SHIFT.isDown || (this.touch.enabled && this.touch.sprint);
      if (len > 1) { vx /= len; vy /= len; }
    }
    const moving = Math.abs(vx) + Math.abs(vy) > 0.05 || this.autoWalk;
    const maxSt = Game.maxStamina;
    if (sprint && moving && !this.staminaLock && this.stamina > 0) {
      this.stamina = Math.max(0, this.stamina - 34 * dt);
      if (this.stamina <= 0) this.staminaLock = true;
    } else {
      sprint = false;
      this.stamina = Math.min(maxSt, this.stamina + 16 * dt);
      if (this.staminaLock && this.stamina > maxSt * 0.3) this.staminaLock = false;
    }
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.boostT = Math.max(0, this.boostT - dt);
    const mult = (sprint ? 1.55 : 1) * (this.boostT > 0 ? 1.25 : 1);
    const limitX = this.worldLimit();
    let nx = Phaser.Math.Clamp(this.adam.x + vx * SPEED_X * mult * dt, 60, limitX);
    let ny = Phaser.Math.Clamp(this.adam.y + vy * SPEED_Y * mult * dt, BAND_TOP, BAND_BOT);
    const solid = (x: number, y: number) => this.obstacles.some((o) => Math.abs(x - o.x) < o.w && y <= o.yMax);
    if (!this.autoWalk && solid(nx, ny) && !solid(this.adam.x, this.adam.y)) {
      if (!solid(this.adam.x, ny)) nx = this.adam.x; // slide along the edge
      else if (!solid(nx, this.adam.y)) ny = this.adam.y;
      else { nx = this.adam.x; ny = this.adam.y; }
    }
    this.adam.x = nx; this.adam.y = ny;
    if (vx !== 0) this.adam.setFlipX(vx < 0);
    this.adam.setDepth(this.adam.y);
    this.adamShadow.setPosition(this.adam.x, this.adam.y - 2).setDepth(this.adam.y - 1);
    if (moving) {
      this.adam.anims.play('adam_walk', true);
      this.adam.anims.timeScale = sprint ? 1.6 : 1;
      this.stepT -= dt;
      if (this.stepT <= 0) { AudioSys.step(); this.stepT = sprint ? 0.22 : 0.34; }
    } else { this.adam.anims.stop(); this.adam.setFrame(0); }
    this.drawStamina(maxSt);

    // ---- nicholas
    this.updateNick(dt);

    // ---- camera (manual so the light mask never lags the sprites)
    const targetCam = Phaser.Math.Clamp(this.adam.x - W / 2 + 40, 0, this.worldW - W);
    this.camX += (targetCam - this.camX) * Math.min(1, dt * 6);
    cam.scrollX = Math.round(this.camX);
    this.backdrop.update(dtMs, cam.scrollX);
    this.path.tilePositionX = cam.scrollX; this.pathNight.tilePositionX = cam.scrollX;

    this.updateInteraction();
    // flame, gun and flashlight effects
    if (this.flameT > 0) { this.flameT = Math.max(0, this.flameT - dt); }
    this.flameGlow.setVisible(this.flameT > 0 && this.phase === 'night').setPosition(this.adam.x + (this.adam.flipX ? -30 : 30), this.adam.y - 50).setAlpha(0.6 + Math.sin(this.worldT * 0.03) * 0.15);
    if (this.muzzleT > 0) { this.muzzleT -= dt; if (this.muzzleT <= 0) this.muzzleImg.setVisible(false); }
    const gt = (this.gunImg.getData('t') as number) ?? 0;
    if (gt > 0) { this.gunImg.setData('t', gt - dt); if (gt - dt <= 0) this.gunImg.setVisible(false); }
    if (this.phase === 'night' && Game.has('flashlight') && Game.flashOn && Game.charge > 0 && !this.busy) {
      Game.charge = Math.max(0, Game.charge - 0.35 * dt);
      if (Game.charge <= 0) this.bubble('The flashlight died!', '#ff8a8a');
    }
    this.touch.setGun(Game.hasGun);
    if (this.touch.consumeFire()) this.fire();
    this.refreshHotbar();
    if (this.phase === 'night') this.updateNight(dt, cam.scrollX);
    this.updateStalker(dt);
    for (const f of this.fog) { f.x += f.getData('v') * dt; if (f.x > W + 400) f.x = -400; }
    const baseVig = this.phase === 'night' ? 0.7 : 0.3;
    this.vignette.setAlpha(baseVig + this.dread * 0.25 + Math.sin(this.worldT * 0.004) * 0.05 * this.dread);
    this.dread = Math.max(0, this.dread - dt * 0.02);
    this.updateMapArrow(cam.scrollX);
    this.onFrame(dt);
  }

  protected worldLimit(): number { return this.worldW - 120; }

  private drawStamina(maxSt: number) {
    const g = this.staminaBar;
    g.clear();
    if (this.stamina >= maxSt - 0.5) return;
    g.fillStyle(0x000000, 0.6).fillRect(18, 90, 124, 10);
    g.fillStyle(this.staminaLock ? 0xb5121f : 0x9be37a, 1).fillRect(20, 92, 120 * (this.stamina / maxSt), 6);
  }

  private updateNick(dt: number) {
    const dirSign = this.adam.flipX ? -1 : 1;
    if (this.nickMode === 'follow') {
      this.history.push({ x: this.adam.x, y: this.adam.y });
      if (this.history.length > (this.nickHurt ? 70 : 46)) this.history.shift();
      const tgt = this.history[0];
      const wantX = tgt.x - dirSign * 54, wantY = tgt.y + 6;
      const k = Math.min(1, dt * (this.nickHurt ? 4.5 : 7));
      this.nick.x += (wantX - this.nick.x) * k;
      this.nick.y += (wantY - this.nick.y) * k;
      if (Math.abs(wantX - this.nick.x) > 2) this.nickFlip = wantX < this.nick.x;
      const lag = Phaser.Math.Distance.Between(this.nick.x, this.nick.y, wantX, wantY);
      if (lag > 14) this.nick.anims.play('nicholas_walk', true); else { this.nick.anims.stop(); this.nick.setFrame(0); }
    } else if (this.nickWalking) {
      this.nick.anims.play('nicholas_walk', true); // facing is set by whoever is moving him
    } else {
      this.nick.anims.stop(); this.nick.setFrame(0);
      this.nickFlip = this.adam.x < this.nick.x;
    }
    this.nick.setFlipX(this.nickFlip).setDepth(this.nick.y);
    this.nickShadow.setPosition(this.nick.x, this.nick.y - 2).setDepth(this.nick.y - 1);
    if (this.nickHurt && this.phase === 'night') {
      this.dropT -= dt;
      if (this.dropT <= 0) {
        this.dropT = 0.9;
        const d = this.add.image(this.nick.x + Phaser.Math.Between(-6, 6), this.nick.y - 1, 'blooddrop').setScale(2).setDepth(2);
        this.tweens.add({ targets: d, alpha: 0, delay: 20000, duration: 4000, onComplete: () => d.destroy() });
      }
    }
  }

  private updateInteraction() {
    let best: Interactable | null = null;
    let bestD = 1e9;
    if (!this.busy && !this.ending) {
      for (const it of this.interactables) {
        const dx = Math.abs(it.x - this.adam.x), dy = Math.abs(it.y - this.adam.y);
        if (dx < it.reach && dy < 70 && dx < bestD) { best = it; bestD = dx; }
      }
    }
    if (best) this.prompt.setVisible(true).setText(this.touch.enabled ? 'ACT' : '[E]').setPosition(best.x, best.y - 130);
    else this.prompt.setVisible(false);
    const pressed = Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)
      || Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || this.touch.consumeAction();
    if (this.prevBusy && !this.busy) this.interactCd = 0.35;
    this.prevBusy = this.busy;
    this.interactCd = Math.max(0, this.interactCd - 1 / 60);
    if (pressed && best && !this.busy && this.interactCd <= 0) void best.run();
  }

  private updateMapArrow(camX: number) {
    const tx = Game.has('map') && Game.mapOn ? this.objectiveX() : null;
    if (tx === null || this.busy) { this.mapArrow.setVisible(false); return; }
    const sx = tx - camX;
    if (sx > 40 && sx < W - 40) { this.mapArrow.setVisible(false); return; }
    const right = sx >= W - 40;
    this.mapArrow.setVisible(true).setText(right ? 'MAP >>' : '<< MAP').setX(right ? W - 120 : 14);
  }

  private updateNight(dt: number, camX: number) {
    const flick = 1 + Math.sin(this.worldT * 0.013) * 0.02 + Math.sin(this.worldT * 0.031) * 0.015;
    // a flashlight without batteries cuts out
    let outage = 1;
    if (Game.flashlightLit && Game.charge < 12) outage = Math.random() < 0.3 ? 0.45 : 0.85; // dying battery flickers
    const dk = this.dark;
    dk.clear();
    dk.fill(0x03020a, Game.wearShades ? 0.95 : 0.9);
    const stamp = (x: number, y: number, diameter: number) => {
      this.lightImg.setPosition(x, y).setScale(diameter / 512);
      dk.erase(this.lightImg);
    };
    stamp(this.adam.x - camX, this.adam.y - 60, Game.lightSize * flick * outage * (this.safeBoost() ? 1.12 : 1));
    stamp(this.nick.x - camX, this.nick.y - 55, 190 * flick);
    if (this.flameT > 0) stamp(this.adam.x - camX + (this.adam.flipX ? -30 : 30), this.adam.y - 50, 330 * (0.95 + Math.random() * 0.1));
    if (this.muzzleT > 0) stamp(this.adam.x - camX, this.adam.y - 60, 900);
    for (const l of this.extraLights()) {
      const sx = l.x - camX;
      if (sx > -400 && sx < W + 400) stamp(sx, l.y, l.d);
    }

    // eyes
    const creep = 6 + this.dread * 14;
    for (const e of this.eyes) {
      const dist = Phaser.Math.Distance.Between(e.x, e.y + 60, this.adam.x, this.adam.y);
      const blink = Math.sin(this.worldT * 0.002 + e.phase) > 0.93 || Math.sin(this.worldT * 0.0007 + e.phase * 3) > 0.985;
      const inLight = dist < 250;
      const goal = inLight || blink ? 0 : 1;
      e.fade += (goal - e.fade) * Math.min(1, dt * (inLight ? 6 : 1.4));
      e.img.setAlpha(e.fade * 0.9).setPosition(e.x, e.y);
      if (!inLight && dist > 280) e.x += Math.sign(this.adam.x - e.x) * creep * dt;
      if (inLight && e.fade < 0.05) {
        const side = Math.random() < 0.5 ? -1 : 1;
        e.x = Phaser.Math.Clamp(this.adam.x + side * Phaser.Math.Between(360, 620), 40, this.worldW - 40);
        e.y = Phaser.Math.Between(200, 320);
      }
    }
    const near = this.eyes.some((e) => e.fade > 0.5 && Math.abs(e.x - this.adam.x) < 420);
    if (near) {
      this.dread = Math.min(1, Math.max(this.dread, 0.2));
      this.hbT -= dt;
      if (this.hbT <= 0) { AudioSys.heartbeat(); this.hbT = 1.3 - this.dread * 0.5; }
    }
    // hanging bodies sway
    for (const o of this.nightOnly) if (o.getData('sway')) o.setAngle(Math.sin(this.worldT * 0.0015 + o.x) * 4);
  }

  private safeBoost() { return false; }
}
