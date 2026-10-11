import Phaser from 'phaser';
import { BAND_TOP, H, PETAL, PetalKey, Phase, S, TREE_S, W } from '../config';
import { AudioSys } from '../systems/AudioSys';
import { Line } from '../systems/Dialogue';
import { Game } from '../systems/GameState';
import { Interactable, Light, WorldScene, Zone } from './WorldScene';

interface Patch { key: PetalKey; sprite: Phaser.GameObjects.Image; wisp: Phaser.GameObjects.Image; x: number; y: number; lit: boolean }
interface Landmark {
  id: string; x: number; y: number; day: string; night: string; scale: number; reach: number; required: boolean;
  dayLines: Line[]; nightLines: Line[]; yOff?: number;
}

const SEQUENCE: PetalKey[] = ['gold', 'red', 'blue'];
const REQUIRED = ['sign', 'tent', 'pond', 'carve'];
const LAMPS = [2350, 3950, 5350];
const BEAM_X = 6020;

/** PART 1 - LOST. Day exploration, a violent night, and a puzzle. */
export class ForestScene extends WorldScene {
  private patches: Patch[] = [];
  private seen = new Set<string>();
  private duskStarted = false;
  private progress = 0;
  private solved = false;
  private voiceDone = false;
  private answered = false;
  private failures = 0;
  private clockMin = 17 * 60 + 12;
  private beam?: Phaser.GameObjects.Image;
  private beamGlow?: Phaser.GameObjects.Image;
  private lampImgs: Phaser.GameObjects.Image[] = [];
  private nickI?: Interactable;
  private healT = 0;

  constructor() { super('Forest'); }

  protected startPhase(): Phase { return this.registry.get('ch1cp') === 'night' || this.registry.get('ch1cp') === 'roam' ? 'night' : 'day'; }

  protected onInit() {
    this.worldW = 6300;
    this.patches = []; this.seen = new Set(); this.duskStarted = false; this.progress = 0; this.solved = false;
    this.voiceDone = false; this.answered = false; this.failures = 0; this.clockMin = 17 * 60 + 12;
    this.beam = undefined; this.beamGlow = undefined; this.lampImgs = []; this.nickI = undefined; this.healT = 0;
  }

  protected retry() { this.scene.restart(); }

  // ------------------------------------------------------------------ world
  protected buildWorld() {
    const r = Phaser.Math.RND;
    r.sow(['afterlight']);
    let x = 40;
    while (x < this.worldW + 100) {
      this.addTree(x, r.between(318, 348), r.between(0, 2));
      x += r.between(130, 250);
    }
    for (let i = 0; i < 130; i++) {
      const px = r.between(0, this.worldW);
      const py = r.between(BAND_TOP - 10, 424);
      const kind = r.pick(['tuft', 'tuft', 'tuft', 'bush', 'rock']);
      this.addProp(`${kind}_day`, `${kind}_night`, px, py, S);
    }

    // landmarks: required clues + optional curiosities
    const lm: Landmark[] = [
      { id: 'sign', x: 520, y: 385, day: 'sign_day', night: 'sign_night', scale: S, reach: 130, required: true, dayLines: [], nightLines: [] },
      { id: 'log', x: 840, y: 392, day: 'log_day', night: 'log_night', scale: S, reach: 120, required: false,
        dayLines: [
          { text: 'A fallen log. Someone left half a sandwich on it. The ants are winning.' },
          { who: 'Nicholas', text: "Don't." }, { who: 'Adam', text: "I wasn't going to." },
        ],
        nightLines: [
          { text: 'It was a deer. Most of it is... gone.' },
          { text: 'The ribs have been pulled apart and set in a neat circle.' },
          { who: 'Nicholas', text: "Something didn't just eat it. Something played with it." },
        ] },
      { id: 'tent', x: 2000, y: 392, day: 'tent_day', night: 'tent_night', scale: S, reach: 130, required: true, dayLines: [], nightLines: [] },
      { id: 'pond', x: 2780, y: 396, day: 'pond_day', night: 'pond_night', scale: S, reach: 150, required: true, dayLines: [], nightLines: [] },
      { id: 'well', x: 3650, y: 380, day: 'well_day', night: 'well_night', scale: S, reach: 120, required: false,
        dayLines: [
          { text: 'An old stone well. The rope has rotted through. Cold air breathes up from the dark.' },
          { who: 'Nicholas', text: 'Throw a coin in. Make a wish.' },
          { who: 'Adam', text: "I spent all my money on... " }, { who: 'Adam', text: 'Never mind. Wish made.' },
        ],
        nightLines: [
          { text: 'Something is tapping from inside the well. Slow. Patient.' },
          { text: 'A pale hand grips the rim. It slides back down into the dark.' },
          { who: 'Nicholas', text: 'Adam. Step away from the well.' },
        ] },
      { id: 'swing', x: 4250, y: 385, day: 'swing_day', night: 'swing_night', scale: S, reach: 120, required: false,
        dayLines: [
          { text: 'A rope swing on a thick branch.' },
          { who: 'Nicholas', text: 'I bet I can go higher than you.' },
          { who: 'Adam', text: "We're seventeen." }, { who: 'Nicholas', text: "So that's a yes." },
        ],
        nightLines: [
          { text: 'The swing is moving. There is no wind.' },
          { text: "A child's shoe lies underneath it. The laces are still wet." },
          { who: 'Nicholas', text: "I want to leave. I want to leave right now." },
        ] },
      { id: 'scarecrow', x: 5200, y: 385, day: 'scarecrow_day', night: 'scarecrow_night', scale: S, reach: 120, required: false,
        dayLines: [
          { text: 'A scarecrow in a purple shirt, staring at nothing.' },
          { who: 'Nicholas', text: 'Why does it look like it is smiling?' }, { who: 'Adam', text: "It's painted on." },
        ],
        nightLines: [
          { text: 'The scarecrow is gone. Only the pole remains, slick and red.' },
          { text: 'The straw is still warm.' },
          { who: 'Nicholas', text: '...Where did it go, Adam?' },
        ] },
    ];
    for (const L of lm) {
      this.addProp(L.day, L.night, L.x, L.y, L.id === 'pond' ? 3.4 : L.scale);
      const it: Interactable = { id: L.id, x: L.x, y: L.y, reach: L.reach, run: () => this.landmark(L) };
      this.interactables.push(it);
    }
    this.obstacles.push({ x: 2780, w: 120, yMax: 398 }); // the pond is solid
    // blood around the gruesome places (night only)
    [[840, 400], [2000, 405], [3650, 392], [5200, 398], [1500, 400]].forEach(([bx, by]) => this.addNightOnly('blood', bx, by, 3, by - 1));

    // the carved tree
    const ct = this.addTree(1520, 345, 1, TREE_S + 0.5, false);
    const carve = this.add.image(1520 + 8, 345 - 52, 'carve_day').setScale(S).setDepth(346);
    this.addEnv(carve, 'carve_day', 'carve_night');
    void ct;
    this.interactables.push({ id: 'carve', x: 1520, y: 392, reach: 130, run: () => this.landmark({ id: 'carve', x: 1520, y: 392, day: '', night: '', scale: 1, reach: 0, required: true, dayLines: [], nightLines: [] }) });

    // hanging bodies - only exist at night
    [900, 1750, 2500, 3400, 4500, 5500].forEach((hx, i) => {
      const h = this.addNightOnly('hanging', hx, 60 + (i % 3) * 20, 3.6, 345, 0);
      h.setData('sway', true).setAlpha(0.95);
    });

    // ammo boxes (night only)
    [[2600, 405], [3480, 398], [4300, 408], [5650, 400]].forEach(([ax, ay]) =>
      this.addPickup(`ammo_${ax}`, 'ammo', ax, ay, 3, () => this.pickupAmmo(3)));

    // trail lamps - safe spots at night
    LAMPS.forEach((lx) => {
      const l = this.add.image(lx, 372, 'lamp_off').setOrigin(0.5, 1).setScale(S).setDepth(372);
      this.addEnv(l, 'lamp_off', 'lamp_on'); this.lampImgs.push(l);
    });

    // flowers / beacons
    const spots: Array<[PetalKey, number]> = [['gold', 1250], ['red', 3250], ['blue', 4700]];
    for (const [key, px] of spots) {
      const py = 395;
      const sprite = this.add.image(px, py, `flower_${key}`).setOrigin(0.5, 1).setScale(S + 1).setDepth(py);
      this.addEnv(sprite, `flower_${key}`, 'flower_dead');
      const wisp = this.add.image(px, py - 70, 'wisp').setScale(2.2).setTint(PETAL[key]).setBlendMode(Phaser.BlendModes.ADD).setDepth(960).setAlpha(0);
      this.tweens.add({ targets: wisp, y: wisp.y - 14, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const patch: Patch = { key, sprite, wisp, x: px, y: py, lit: false };
      this.patches.push(patch);
      this.interactables.push({ id: `patch_${key}`, x: px, y: py, reach: 120, run: () => this.touchPatch(patch) });
    }
    // the beam's interactable (end of the map)
    this.interactables.push({
      id: 'beam', x: BEAM_X - 100, y: 390, reach: 160, run: async () => {
        if (!this.solved) return;
        await this.enterLight();
      },
    });
    for (let i = 0; i < 6; i++) this.addTree(this.worldW + 30 + i * 8, 330 + i * 6, 0);
  }

  // ------------------------------------------------------------------ begin
  protected begin() {
    const cp = this.registry.get('ch1cp') as string | undefined;
    if (cp === 'night' || cp === 'roam') {
      REQUIRED.forEach((k) => this.seen.add(k));
      this.duskStarted = true;
      this.enterNight(true);
      AudioSys.setMood('night', 1);
      this.cameras.main.fadeIn(1200, 0, 0, 0);
      this.adam.x = cp === 'roam' ? 4600 : 400; this.nick.x = this.adam.x - 54; this.history = [];
      this.spawnEyes(3);
      if (cp === 'roam') this.resumeRoam();
      this.updateHud();
      return;
    }
    this.registry.set('ch1cp', 'start');
    AudioSys.setMood('day', 3);
    this.cameras.main.fadeIn(1800, 0, 0, 0);
    this.busy = true;
    this.updateHud();
    void (async () => {
      await this.wait(900);
      void this.card('PART 1', 'LOST');
      await this.wait(3400);
      await this.dlg.say([
        { who: 'Adam', text: 'This clearing looks different... bigger, somehow.' },
        { who: 'Nicholas', text: "Let's search around for a trail. A sign, a camp, anything." },
        { who: 'Nicholas', text: 'Stay where I can see you, okay?' },
      ]);
      if (Game.has('speaker')) await this.dlg.say([{ who: 'Nicholas', text: "And do NOT turn that speaker on." }]);
      this.busy = false;
    })();
  }

  protected objective(): string {
    if (this.phase === 'day') {
      const n = REQUIRED.filter((k) => this.seen.has(k)).length;
      return `Search the forest for a way out  ${n}/4`;
    }
    if (this.solved) return 'FREE ROAM - explore, or enter the light in the east [E] when ready';
    return `Wake the three beacons in order  ${this.progress}/3\nDon't stand still. Don't answer.`;
  }

  protected objectiveX(): number | null {
    if (this.phase === 'day') {
      const lm: Record<string, number> = { sign: 520, tent: 2000, pond: 2780, carve: 1520 };
      const next = REQUIRED.find((k) => !this.seen.has(k));
      return next ? lm[next] : null;
    }
    if (this.solved) return BEAM_X - 100;
    return this.patches[this.progress]?.x ?? null;
  }

  private refresh() {
    const m = this.clockMin % (24 * 60);
    const h24 = Math.floor(m / 60), mm = m % 60;
    const h12 = ((h24 + 11) % 12) + 1;
    this.hudClock.setText(`${h12}:${String(mm).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`);
    this.updateHud();
  }

  protected updateHud() {
    super.updateHud();
    if (this.hudClock) {
      const m = this.clockMin % (24 * 60);
      const h24 = Math.floor(m / 60), mm = m % 60;
      this.hudClock.setText(`${((h24 + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`);
    }
  }

  // ------------------------------------------------------------------ lighting hooks
  protected extraLights(): Light[] {
    const out: Light[] = [];
    for (const p of this.patches) out.push({ x: p.x, y: p.wisp.y, d: p.lit ? 380 : 150 });
    LAMPS.forEach((lx) => out.push({ x: lx, y: 330, d: 430 }));
    if (this.beamGlow) out.push({ x: this.beamGlow.x, y: 330, d: 560 });
    return out;
  }

  protected safeZones(): Zone[] {
    const z: Zone[] = [];
    this.patches.forEach((p) => { if (p.lit) z.push({ x: p.x, y: p.y, r: 290 }); });
    LAMPS.forEach((lx) => z.push({ x: lx, y: 390, r: 230 }));
    return z;
  }

  // ------------------------------------------------------------------ interactions
  private markSeen(id: string) {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    if (this.phase === 'day') this.clockMin += 38;
    this.updateHud();
  }

  private async landmark(L: Landmark) {
    const day = this.phase === 'day';
    await this.lock(async () => {
      const d = this.dlg;
      switch (L.id) {
        case 'sign':
          if (day) {
            await d.say([
              { text: 'A weathered wooden sign. Something is carved into it:' },
              { text: '"GOLD WAKES.  RED WEEPS.  BLUE SLEEPS."' },
              { who: 'Nicholas', text: 'Cheerful.' },
              { who: 'Adam', text: 'Gold, red, blue... Flowers, maybe? There are patches of them all over this place.' },
              { who: 'Nicholas', text: "Probably a kids' rhyme. ...Remember it anyway." },
              { who: 'Adam', text: 'Gold. Then red. Then blue. Got it.' },
            ]);
            this.markSeen('sign');
          } else {
            await d.say([
              { text: 'The sign has been scratched over, again and again.' },
              { text: 'Only one phrase is left, carved deep:' },
              { who: '???', text: "DON'T ANSWER." },
              { who: 'Nicholas', text: '...The rest of it. Can you remember the rest of it?' },
            ]);
          }
          break;
        case 'tent':
          if (day) {
            await d.say([
              { text: 'A tent, torn at the seams. Inside: a rotting backpack and a journal.' },
              { text: '"DAY 3. It only calls at night. It uses voices you trust."' },
              { text: '"DAY 4. Do not answer. If you answer, it knows where you are."' },
              { text: '"DAY 5. The flowers by the sign are beacons. Wake them in the order it carved, and the woods will let you rest. For a while."' },
              { text: '"DAY 6. It is outside the tent. It is saying my sister\'s name. I\'m' },
              { text: 'The rest of the page is gone. Brown stains soak the paper.' },
              { who: 'Adam', text: "Those stains aren't mud." },
              { who: 'Nicholas', text: "...Let's get out of here before dark." },
            ]);
            this.markSeen('tent');
          } else {
            await d.say([
              { text: 'The tent has been slashed open from the inside out.' },
              { text: 'Long red furrows lead into the trees. Fingernails are still caught in the dirt.' },
              { who: 'Nicholas', text: "Don't follow them. Please don't follow them." },
            ]);
          }
          break;
        case 'pond':
          if (day) {
            await d.say([
              { text: 'A still, clear pond. Water lilies drift on the surface.' },
              { who: 'Adam', text: 'Look at us. Two reflections, perfect.' },
              { who: 'Nicholas', text: '...Adam. There is only one reflection.' },
              { who: 'Adam', text: "It's the angle, Nick." },
              { who: 'Nicholas', text: 'Sure. The angle.' },
            ]);
            this.markSeen('pond');
          } else {
            await d.say([
              { text: 'The water is thick and dark. A pale face drifts just beneath the surface.' },
              { text: 'It does not blink. It does not float away.' },
              { who: 'Nicholas', text: "Don't look at it. Don't look at it. Don't look." },
            ]);
          }
          break;
        case 'carve':
          if (day) {
            await d.say([
              { text: 'Two initials are carved into the bark. A + N.' },
              { who: 'Adam', text: '...We never carved this.' },
              { who: 'Nicholas', text: 'No. We never came here before.' },
              { who: 'Adam', text: 'Probably other kids. Those initials are pretty common.' },
              { who: 'Nicholas', text: 'Sure. Common.' },
            ]);
            this.markSeen('carve');
          } else {
            await d.say([
              { text: 'The carving has been crossed out.' },
              { text: 'Underneath, in fresh cuts: IT KNOWS YOUR NAME.' },
              { who: 'Nicholas', text: "Okay. Okay, I'm done with this tree." },
            ]);
          }
          break;
        default:
          await d.say(day ? L.dayLines : L.nightLines);
          if (day) this.markSeen(L.id);
      }
    });
    if (day) this.checkDusk();
  }

  private async touchPatch(p: Patch) {
    if (this.phase === 'day') {
      const lines: Record<PetalKey, Line[]> = {
        gold: [
          { who: 'Nicholas', text: 'Golden ones. They smell like honey.' },
          { who: 'Adam', text: "Like your mom's garden." },
          { who: 'Nicholas', text: 'Until you ran them over with your bike.' },
          { who: 'Adam', text: 'That was ONE time.' },
        ],
        red: [
          { who: 'Nicholas', text: 'Red ones. Pretty. Kind of... sad-looking, though.' },
          { who: 'Adam', text: "Flowers can't look sad." },
          { who: 'Nicholas', text: 'These ones do.' },
        ],
        blue: [
          { who: 'Adam', text: "These are all closed up. Like they're sleeping." },
          { who: 'Nicholas', text: 'Smart flowers. I wish I could do that right now.' },
        ],
      };
      await this.lock(() => this.dlg.say(lines[p.key]));
      this.markSeen(`patch_${p.key}`);
      return;
    }
    if (this.solved || p.lit) {
      await this.lock(() => this.dlg.say([{ who: 'Nicholas', text: 'It is already awake. Leave it.' }]));
      return;
    }
    if (p.key === SEQUENCE[this.progress]) {
      p.lit = true;
      AudioSys.chime(this.progress);
      this.tweens.add({ targets: p.wisp, scale: 4, duration: 500, ease: 'Back.easeOut' });
      this.cameras.main.flash(250, 255, 255, 255, false);
      this.progress++;
      this.dread = Math.max(0, this.dread - 0.2);
      this.updateHud();
      if (this.progress >= SEQUENCE.length) await this.solve();
      else {
        await this.lock(() => this.dlg.say([{ who: 'Nicholas', text: ['Gold. It... woke up. Its light is warm. Stay close to it.', 'Red. It is crying. Can you hear it? Keep going, east.'][this.progress - 1] }]));
      }
    } else {
      await this.failPuzzle();
    }
  }

  private async failPuzzle() {
    this.failures++;
    this.dread = Math.min(1, this.dread + 0.3);
    AudioSys.stinger();
    this.shake(500, 0.015);
    this.cameras.main.flash(180, 255, 30, 30, false);
    this.bloodFx.explode(18, this.adam.x, this.adam.y - 80);
    this.patches.forEach((q) => { q.lit = false; this.tweens.add({ targets: q.wisp, scale: 2.2, duration: 400 }); });
    this.progress = 0;
    this.updateHud();
    this.spawnEyes(2 + this.failures);
    this.startHunt();
    this.spawnStalker(true);
    await this.lock(() => this.dlg.say([
      { who: 'Nicholas', text: 'No-no-no. That was wrong. They all went dark.' },
      { who: 'Nicholas', text: 'It heard that. It is coming. RUN when you see it.' },
      { who: 'Adam', text: 'Gold, then red, then blue. Hold SHIFT to sprint. Try again.' },
    ]));
  }

  private async solve() {
    this.solved = true;
    this.stopHunt();
    this.updateHud();
    await this.lock(async () => {
      AudioSys.chime(3);
      this.shake(1400, 0.006);
      await this.wait(1200);
      this.makeBeam();
      await this.dlg.say([
        { who: 'Adam', text: 'The woods went quiet. Do you hear that?' },
        { who: 'Nicholas', text: '...Nothing. Not a single thing.' },
        { who: 'Nicholas', text: "Adam, look. East. There's a light." },
      ]);
      await this.dlg.say([
        { who: 'Nicholas', text: this.nickHurt ? "My arm... it hurts. But I'm still standing. I'm still with you." : "My legs are shaking. But I'm okay. I'm still with you." },
        { who: 'Adam', text: "The woods are calm for now. We can look around before we go to the light." },
        { who: 'Nicholas', text: "Whenever you're ready, the light is east. I'm right behind you." },
      ]);
    });
    this.registry.set('ch1cp', 'roam');
    this.resumeRoam();
  }

  private resumeRoam() {
    this.solved = true; this.progress = 3; this.stopHunt();
    this.patches.forEach((p) => { p.lit = true; p.wisp.setScale(4).setAlpha(1); });
    if (!this.beam) this.makeBeam();
    this.updateHud();
  }

  private makeBeam() {
    this.beam = this.add.image(BEAM_X, 400, 'shaft').setOrigin(0.5, 1).setScale(3.4, 2.6).setFlipY(true).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff1b0).setAlpha(0).setDepth(970);
    this.beamGlow = this.add.image(BEAM_X, 380, 'glow').setScale(10).setTint(0xffe9a8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(970);
    this.tweens.add({ targets: this.beam, alpha: 0.9, duration: 2000 });
    this.tweens.add({ targets: this.beamGlow, alpha: 0.7, duration: 2000 });
    this.tweens.add({ targets: this.beamGlow, scale: 11.5, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private async enterLight() {
    let go = false;
    await this.lock(async () => {
      await this.dlg.say([{ text: 'The light is warm. Almost kind. It hums, like it is humming your name.' }]);
      const pick = await this.dlg.choice({ who: 'Nicholas', text: 'Are you ready to go into the light?' }, ['Yes, ready', 'Not yet']);
      if (pick === 0) {
        await this.dlg.say([
          { who: 'Nicholas', text: 'Okay.' },
          { who: 'Nicholas', text: 'Adam? Whatever is in there... we stay together.' },
          { who: 'Adam', text: 'Together.' },
        ]);
        go = true;
      } else await this.dlg.say([{ who: 'Nicholas', text: "Take your time. I'm right here." }]);
    });
    if (go) await this.startPartTwo();
  }

  private async startPartTwo() {
    this.busy = true; this.touch.freeze(true); this.ending = true;
    AudioSys.setMood('none', 1.5);
    AudioSys.chime(2);
    this.cameras.main.fadeOut(2000, 255, 255, 255);
    await this.wait(2200);
    this.registry.set('ch2cp', 'start');
    this.registry.set('nickHurt', this.nickHurt);
    this.registry.set('answered', this.answered);
    this.scene.start('Meadow');
  }

  // ------------------------------------------------------------------ day -> night
  private checkDusk() {
    if (this.duskStarted) return;
    if (REQUIRED.every((k) => this.seen.has(k))) {
      this.duskStarted = true;
      this.time.delayedCall(500, () => void this.duskSequence());
    }
  }

  private async duskSequence() {
    this.busy = true; this.touch.freeze(true);
    const d = this.dlg;
    this.clockMin = 20 * 60 + 41;
    this.updateHud();
    this.backdrop.setMood('golden', 4000);
    AudioSys.setMood('golden', 3);
    this.tweens.add({ targets: this.duskTint, alpha: 0.3, duration: 5000 });
    await this.wait(2200);
    await d.say([
      { who: 'Nicholas', text: "Adam. The light's gone orange." },
      { who: 'Adam', text: 'We were only out here... what, twenty minutes?' },
      { who: 'Nicholas', text: 'My phone says 8:41 PM.' },
      { who: 'Nicholas', text: "That is not possible. We left at five." },
      { who: 'Adam', text: 'That journal. "It only calls at night." We need to find those flowers. Now.' },
    ]);
    this.tweens.add({ targets: this.duskTint, alpha: 0.55, duration: 3000 });
    await this.wait(1500);
    AudioSys.setMood('none', 0.3);
    this.dayMotes.stop();
    await d.say([
      { who: 'Adam', text: "Nick... the sun. It's not setting." },
      { who: 'Adam', text: "It's going out." },
    ]);
    AudioSys.heartbeat();
    await this.wait(600);
    AudioSys.heartbeat();
    this.shake(900, 0.01);
    await this.wait(500);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    await this.wait(450);
    this.enterNight(false);
    AudioSys.stinger();
    await this.wait(900);
    this.cameras.main.fadeIn(2200, 0, 0, 0);
    void this.card('NIGHTFALL', '', '#8a7fc8');
    await this.wait(2800);
    AudioSys.setMood('night', 3);
    this.registry.set('ch1cp', 'night');
    this.spawnEyes(3);
    await d.say([
      { who: 'Nicholas', text: 'The trees... they moved.' },
      { who: 'Adam', text: "They didn't move." },
      { who: 'Nicholas', text: 'The path was on my left. It is on my right now.' },
      { who: 'Nicholas', text: "And those... are people. Hanging in the branches. Adam, those are PEOPLE." },
      { who: 'Adam', text: "Don't look up. Stay close. Stay in the light." },
      { who: 'Adam', text: 'Gold wakes. Red weeps. Blue sleeps. The beacons. We wake them in that order.' },
      { who: 'Adam', text: 'Gold is behind us. Then east. And hold SHIFT to run if anything comes.' },
    ]);
    this.busy = false; this.touch.freeze(false);
    this.updateHud();
  }

  private enterNight(instant: boolean) {
    this.phase = 'night';
    this.clockMin = 23 * 60 + 58;
    this.applyPhaseVisuals(instant);
    this.darkenPatches();
  }

  private darkenPatches() {
    this.patches.forEach((q) => this.tweens.add({ targets: q.wisp, alpha: 1, duration: 2500 }));
  }

  // ------------------------------------------------------------------ night events
  private async voiceEvent() {
    this.voiceDone = true;
    this.busy = true; this.touch.freeze(true);
    const d = this.dlg;
    AudioSys.whisper(0.9);
    await this.wait(900);
    AudioSys.heartbeat();
    await d.say([{ who: '???', text: 'Adaaaam...' }]);
    await d.say([
      { who: 'Nicholas', text: 'Did you hear that?' },
      { who: 'Nicholas', text: '...It sounded like me.' },
    ]);
    AudioSys.whisper(1);
    const pick = await d.choice({ who: '???', text: 'Adam. Over here. Come here, Adam.' }, ['Answer', 'Stay silent']);
    if (pick === 0) {
      this.answered = true;
      this.dread = Math.min(1, this.dread + 0.4);
      await d.say([{ who: 'Adam', text: '...Hello?' }]);
      AudioSys.stinger();
      this.shake(900, 0.015);
      this.cameras.main.flash(250, 160, 0, 40, false);
      this.spawnEyes(3);
      await this.wait(500);
      await d.say([{ who: '???', text: 'There you are.' }]);
      // it goes for Nicholas
      const sp = this.add.image(this.nick.x + 240, this.nick.y, 'hollow').setOrigin(0.5, 1).setScale(4.4).setDepth(this.nick.y + 1).setAlpha(0).setFlipX(true);
      this.tweens.add({ targets: sp, alpha: 1, duration: 200 });
      await new Promise<void>((res) => this.tweens.add({ targets: sp, x: this.nick.x + 34, duration: 380, ease: 'Quad.easeIn', onComplete: () => res() }));
      AudioSys.stinger();
      this.bloodFx.explode(44, this.nick.x, this.nick.y - 60);
      this.shake(700, 0.025);
      this.cameras.main.flash(200, 255, 20, 30, false);
      this.nick.setTint(0xff6a6a);
      this.nickSay('Nicholas', 'AAAGH!');
      await this.wait(600);
      this.tweens.add({ targets: sp, alpha: 0, x: sp.x + 200, duration: 700, onComplete: () => sp.destroy() });
      this.nick.setTint(0x9aa0d8);
      this.nickHurt = true;
      await d.say([
        { who: 'Nicholas', text: 'My arm... it opened my arm up. It is okay. It is okay. Just a cut.' },
        { who: 'Adam', text: "Nick, you're bleeding everywhere--" },
        { who: 'Nicholas', text: "I SAID KEEP MOVING. It's not done with us." },
        { text: 'The Hollow Man is hunting you. Stay in the light of the beacons and lamps. Hold SHIFT to run.' },
        ...(Game.hasGun ? [{ text: 'You have the PISTOL. Face it and press F (or FIRE) to shoot. Four hits turn it to ash.' }] : []),
      ]);
    } else {
      await d.say([{ who: 'Adam', text: '(...)' }]);
      await this.wait(1200);
      AudioSys.whisper(0.7);
      await d.say([
        { who: '???', text: 'Adam?  ...Adam?' },
        { who: 'Nicholas', text: '(whispering) ...Good. Keep walking.' },
      ]);
      // a body drops out of the trees right in front of you
      const body = this.add.image(this.adam.x + 280, -90, 'hanging').setOrigin(0.5, 0).setScale(3.6).setDepth(360);
      await new Promise<void>((res) => this.tweens.add({ targets: body, y: 120, duration: 260, ease: 'Quad.easeIn', onComplete: () => res() }));
      AudioSys.stinger();
      this.shake(800, 0.02);
      this.bloodFx.explode(36, body.x, 330);
      this.cameras.main.flash(160, 255, 255, 255, false);
      this.tweens.add({ targets: body, angle: { from: -6, to: 6 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      await this.wait(700);
      await d.say([
        { who: 'Nicholas', text: "...It's a hiker. Don't look at the face." },
        { who: 'Adam', text: 'He has a backpack. Just like mine.' },
        { who: 'Nicholas', text: 'It knows we did not answer. It is going to come find us.' },
        { text: 'The Hollow Man is hunting you. Stay in the light of the beacons and lamps. Hold SHIFT to run.' },
        ...(Game.hasGun ? [{ text: 'You have the PISTOL. Face it and press F (or FIRE) to shoot. Four hits turn it to ash.' }] : []),
      ]);
    }
    this.startHunt();
    this.busy = false; this.touch.freeze(false);
  }

  protected onFrame(_dt: number) {
    if (this.phase === 'night') {
      for (const p of this.patches) {
        const base = p.lit ? 4 : 2.2;
        p.wisp.setScale(base + Math.sin(this.worldT * 0.006 + p.x) * 0.2);
      }
      if (!this.voiceDone && !this.busy && !this.solved && this.adam.x > 1800) void this.voiceEvent();
    }
    void H; void W; void this.refresh;
  }

  protected worldLimit() { return this.worldW - 140; }
}
