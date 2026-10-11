import Phaser from 'phaser';
import { BAND_TOP, H, Phase, S, TREE_S, W } from '../config';
import { AudioSys } from '../systems/AudioSys';
import { Line } from '../systems/Dialogue';
import { Game } from '../systems/GameState';
import { Light, WorldScene, Zone } from './WorldScene';

const LAMPS = [650, 1950, 3300, 4550];
const PHOTO_X = [1500, 2900, 4150];
const CABIN_X = 5050;

interface Photo { x: number; img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; taken: boolean }

/** PART 3 - THE HOLLOW CABIN. Night. The Hollow Man hunts you; find three photographs. */
export class HollowScene extends WorldScene {
  private photos: Photo[] = [];
  private door!: Phaser.GameObjects.Image;
  private collected = 0;
  private lampImgs: Phaser.GameObjects.Image[] = [];

  constructor() { super('Hollow'); }

  protected startPhase(): Phase { return 'night'; }
  protected onInit() { this.worldW = 5600; this.photos = []; this.collected = 0; this.lampImgs = []; }
  protected retry() { this.scene.restart(); }

  protected buildWorld() {
    const r = Phaser.Math.RND;
    r.sow(['hollow']);
    let x = 40;
    while (x < this.worldW + 100) { this.addTree(x, r.between(318, 348), r.between(0, 2)); x += r.between(120, 220); }
    for (let i = 0; i < 120; i++) {
      const kind = r.pick(['tuft', 'tuft', 'bush', 'rock']);
      this.addProp(`${kind}_day`, `${kind}_night`, r.between(0, this.worldW), r.between(BAND_TOP - 10, 424), S);
    }
    // dressing: more of the forest's cruelty
    [[1100, 'scarecrow_night', 385], [2350, 'well_night', 380], [3650, 'swing_night', 385], [4400, 'log_night', 392], [1750, 'tent_night', 392]].forEach(([px, key, py]) =>
      this.addProp(key as string, key as string, px as number, py as number, S));
    [[1100, 400], [2350, 392], [3650, 398], [4400, 400], [1750, 405], [5050, 410], [2900, 405]].forEach(([bx, by]) => this.addNightOnly('blood', bx, by, 3, by - 1));
    [500, 1300, 1800, 2600, 3200, 3900, 4600, 5200].forEach((hx, i) => {
      this.addNightOnly('hanging', hx, 60 + (i % 3) * 22, 3.6, 345, 0).setData('sway', true);
    });

    LAMPS.forEach((lx) => {
      const l = this.addProp('lamp_on', 'lamp_on', lx, 372, S);
      this.lampImgs.push(l);
    });

    // cabin
    this.addTree(CABIN_X - 220, 340, 2, TREE_S + 0.3, false);
    this.addTree(CABIN_X + 230, 338, 1, TREE_S + 0.3, false);
    const cabin = this.add.image(CABIN_X, 400, 'cabin').setOrigin(0.5, 1).setScale(3.4).setDepth(399);
    void cabin;
    this.door = this.add.image(CABIN_X, 400, 'door_closed').setOrigin(0.5, 1).setScale(3.4).setDepth(400);
    this.interactables.push({ id: 'door', x: CABIN_X, y: 395, reach: 240, run: () => this.openDoor() });

    // ammo boxes
    [[1000, 405], [2250, 398], [3500, 408], [4350, 400]].forEach(([ax, ay]) =>
      this.addPickup(`ammo_${ax}`, 'ammo', ax, ay, 3, () => this.pickupAmmo(3)));

    // photographs
    PHOTO_X.forEach((px, i) => {
      const glow = this.add.image(px, 360, 'wisp').setScale(2).setTint(0xfff1b0).setBlendMode(Phaser.BlendModes.ADD).setDepth(960);
      const img = this.add.image(px, 392, 'photo').setOrigin(0.5, 1).setScale(S).setDepth(392);
      this.tweens.add({ targets: [glow], alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
      const ph: Photo = { x: px, img, glow, taken: false };
      this.photos.push(ph);
      this.interactables.push({ id: `photo${i}`, x: px, y: 392, reach: 110, run: () => this.takePhoto(ph, i) });
    });
  }

  protected begin() {
    const cp = this.registry.get('ch2cp');
    this.nickHurt = !!this.registry.get('nickHurt');
    void cp;
    this.spawnEyes(5);
    this.dread = 0.2;
    this.busy = true;
    AudioSys.setMood('night', 2);
    this.cameras.main.fadeIn(1800, 255, 255, 255);
    this.updateHud();
    void (async () => {
      await this.wait(900);
      void this.card('PART 3', 'THE HOLLOW CABIN', '#c9a0ff');
      await this.wait(3600);
      const lines: Line[] = [
        { who: 'Adam', text: 'The music stopped. The sun is gone. ...Nick? Are you still you?' },
        { who: 'Nicholas', text: "I think so. I do not know. Look, there are lamps lit along the path. Someone wants us to follow them to that cabin." },
      ];
      if (this.nickHurt) {
        lines.push({ who: 'Nicholas', text: "My arm's gone numb. I can't tell if that's good." });
        if (Game.has('firstaid')) {
          lines.push({ who: 'Adam', text: 'I still have the first aid kit. Use it from the item bar to bandage you.' });
        } else {
          lines.push({ who: 'Adam', text: "I have nothing to wrap it with. Keep pressure on it." });
        }
      }
      lines.push({ who: 'Nicholas', text: "Stay between the lamps. It can't touch you in the light." });
      lines.push({ who: 'Adam', text: 'The cabin door is nailed shut with three empty frames beside it. Photographs, maybe. Let us find them.' });
      await this.dlg.say(lines);
      this.busy = false;
      this.startHunt();
    })();
  }

  protected objective(): string {
    if (this.collected < 3) return `Find the three photographs  ${this.collected}/3\nStay in the lamplight. SHIFT to run.`;
    return 'Enter the cabin';
  }
  protected objectiveX(): number | null {
    if (this.collected >= 3) return CABIN_X;
    return this.photos.find((p) => !p.taken)?.x ?? null;
  }

  protected extraLights(): Light[] {
    const out: Light[] = LAMPS.map((lx) => ({ x: lx, y: 330, d: 460 }));
    for (const p of this.photos) if (!p.taken) out.push({ x: p.x, y: 360, d: 150 });
    out.push({ x: CABIN_X - 90, y: 360, d: this.collected >= 3 ? 340 : 120 });
    return out;
  }
  protected safeZones(): Zone[] { return LAMPS.map((lx) => ({ x: lx, y: 390, r: 240 })); }

  private async takePhoto(p: Photo, i: number) {
    const scripts: Line[][] = [
      [
        { text: 'A photograph, nailed to a post. Two boys around a campfire.' },
        { who: 'Adam', text: "That's us. Me and Nick. But I've never seen this fire." },
        { text: 'On the back, in red: "TOMORROW."' },
        { who: 'Nicholas', text: "That's not funny. Tell me that's not funny." },
      ],
      [
        { text: 'A second photograph. Adam, alone, in the middle of the clearing.' },
        { text: 'Behind him, something pale and long is leaning over his shoulder.' },
        { who: 'Nicholas', text: "Why am I not in that one?" },
        { who: 'Adam', text: "...Maybe you took it." },
        { who: 'Nicholas', text: 'I did not take it.' },
      ],
      [
        { text: 'The last photograph. Nicholas, smiling, looking straight into the lens.' },
        { text: "A hand reaches into the frame. It is dripping. It is wearing Adam's watch." },
        { who: 'Nicholas', text: '...Adam. Why would you take that?' },
        { who: 'Adam', text: "I didn't. I swear I didn't." },
        { who: 'Nicholas', text: "Then why does the hand look so familiar?" },
      ],
    ];
    await this.lock(async () => {
      await this.dlg.say(scripts[i]);
    });
    p.taken = true;
    this.collected++;
    this.tweens.add({ targets: [p.img, p.glow], alpha: 0, duration: 500 });
    AudioSys.chime(this.collected);
    AudioSys.stinger();
    this.shake(500, 0.012);
    this.cameras.main.flash(160, 255, 255, 255, false);
    this.dread = Math.min(1, this.dread + 0.2);
    this.spawnEyes(2);
    this.updateHud();
    if (this.collected >= 3) {
      this.door.setTint(0xffd7a0);
      this.stopHunt();
      await this.lock(() => this.dlg.say([
        { text: 'Three nails. Three photographs. The cabin door groans... and swings inward on its own.' },
        { who: 'Nicholas', text: 'The woods went quiet again. It wants us inside.' },
      ]));
    } else {
      this.spawnStalker(true);
    }
  }

  private async openDoor() {
    if (this.collected < 3) {
      await this.lock(() => this.dlg.say([
        { text: 'The door is nailed shut. Three empty nails beside it, as if for photographs.' },
        { who: 'Adam', text: 'Whoever lives here wants something first.' },
      ]));
      return;
    }
    this.stopHunt();
    this.door.setTexture('door_open');
    await this.lock(() => this.dlg.say([
      { text: 'The door hangs open. The dark inside does not look like the dark out here.' },
      { who: 'Nicholas', text: "Adam. I can't. I can't go in there." },
      { who: 'Adam', text: 'Nick...' },
      { who: 'Nicholas', text: "My legs won't do it. I'll wait out here. I'll keep watch. I'll be right by the door." },
      { who: 'Adam', text: "Don't move. Whatever you hear, don't move." },
      { who: 'Nicholas', text: "Just come back out. Okay? Promise me you come back out." },
      { who: 'Adam', text: 'I promise.' },
    ]));
    this.busy = true; this.touch.freeze(true); this.ending = true;
    AudioSys.setMood('none', 1.5);
    AudioSys.stinger();
    this.cameras.main.fadeOut(1800, 0, 0, 0);
    await this.wait(2100);
    this.registry.set('cabinRetry', false);
    this.scene.start('Cabin');
  }

  protected onFrame() {
    for (const p of this.photos) if (!p.taken) p.glow.setScale(2 + Math.sin(this.worldT * 0.005) * 0.25);
  }
  /** The cabin is solid: you can reach the door, but you cannot walk past or behind it. */
  protected worldLimit() { return CABIN_X - 215; }
}
