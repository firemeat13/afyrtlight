import Phaser from 'phaser';
import { BAND_TOP, Phase, S } from '../config';
import { AudioSys } from '../systems/AudioSys';
import { Line } from '../systems/Dialogue';
import { Game } from '../systems/GameState';
import { Interactable, WorldScene } from './WorldScene';

const SEAT_X = 560;
const BOX_X = 5000;
const THINGS = ['camp', 'pond', 'crate', 'ammo', 'swing'];

/** PART 2 - AFTERGLOW. The light turns it back to day. Nicholas rests; you roam, then find the music box. */
export class MeadowScene extends WorldScene {
  private found = new Set<string>();
  private nickI?: Interactable;

  constructor() { super('Meadow'); }

  protected startPhase(): Phase { return 'day'; }
  protected onInit() { this.worldW = 5800; this.found = new Set(); this.nickI = undefined; }
  protected retry() { this.scene.restart(); }

  // ------------------------------------------------------------------ world
  protected buildWorld() {
    const r = Phaser.Math.RND;
    r.sow(['afterglow']);
    let x = 40;
    while (x < this.worldW + 100) { this.addTree(x, r.between(318, 348), r.between(0, 2)); x += r.between(130, 250); }
    for (let i = 0; i < 130; i++) {
      const kind = r.pick(['tuft', 'tuft', 'tuft', 'bush', 'rock']);
      this.addProp(`${kind}_day`, `${kind}_night`, r.between(0, this.worldW), r.between(BAND_TOP - 10, 424), S);
    }
    // flower beds for colour
    ['gold', 'red', 'blue'].forEach((k, i) => [900 + i * 700, 2600 + i * 600].forEach((fx) => {
      this.addProp(`flower_${k}`, `flower_${k}`, fx + i * 40, 400 + (i % 2) * 10, S + 1);
    }));

    // Nicholas's resting spot
    this.addProp('log_day', 'log_day', SEAT_X + 70, 392, S);

    // --- things to find ---
    const camp = this.addProp('tent_day', 'tent_day', 1500, 392, S);
    void camp;
    this.interactables.push({ id: 'camp', x: 1500, y: 392, reach: 130, run: () => this.camp() });

    this.addProp('pond_day', 'pond_day', 2300, 396, 3.4);
    this.interactables.push({ id: 'pond', x: 2300, y: 396, reach: 150, run: () => this.pond() });

    this.obstacles.push({ x: 2300, w: 120, yMax: 398 }); // the pond is solid
    this.addDayPickup('crate', 'crate', 2900, 396, S, () => this.crate());
    this.addDayPickup('ammo', 'ammo', 3500, 404, S, () => this.ammoBox());

    this.addProp('swing_day', 'swing_night', 4100, 385, S);
    this.interactables.push({ id: 'swing', x: 4100, y: 385, reach: 120, run: () => this.swing() });

    // flavour (not counted)
    this.addProp('well_day', 'well_night', 3200, 380, S);
    this.interactables.push({
      id: 'well', x: 3200, y: 380, reach: 120, run: () => this.lock(() => this.dlg.say([
        { text: 'The old well. Clear water glints at the bottom. No tapping. Just water.' },
        { who: 'Adam', text: 'Huh. Normal.' },
      ])),
    });
    this.addProp('scarecrow_day', 'scarecrow_night', 800, 385, S);
    this.interactables.push({
      id: 'scarecrow', x: 800, y: 385, reach: 120, run: () => this.lock(() => this.dlg.say([
        { text: 'A scarecrow in a purple shirt. It is smiling. Is it smiling?' },
        { who: 'Adam', text: "...Yeah. It's painted on." },
      ])),
    });

    // Nicholas
    this.nickI = { id: 'nick', x: SEAT_X, y: 388, reach: 130, run: () => this.talkNick() };
    this.interactables.push(this.nickI);
    for (let i = 0; i < 6; i++) this.addTree(this.worldW + 30 + i * 8, 330 + i * 6, 0);
  }

  // ------------------------------------------------------------------ flow
  protected begin() {
    this.nickHurt = false;
    this.adam.x = 300; this.nick.x = 240; this.history = [];
    AudioSys.setMood('day', 3);
    this.cameras.main.fadeIn(2800, 255, 255, 255);
    this.busy = true;
    this.updateHud();
    void (async () => {
      await this.wait(1200);
      void this.card('PART 2', 'AFTERGLOW', '#fff3c4');
      await this.wait(3600);
      await this.dlg.say([
        { who: 'Adam', text: '...Birds. Do you hear that? Birds.' },
        { who: 'Nicholas', text: "It's morning, Adam. It's actually morning." },
        { who: 'Nicholas', text: this.registry.get('nickHurt') ? 'My arm... the bleeding stopped. The cuts are closing. I do not understand this.' : 'My legs have stopped shaking. I do not understand this.' },
        { who: 'Adam', text: "Don't question it. We're alive." },
        { who: 'Nicholas', text: "Yeah. It's just... it's too quiet. And too nice. Do you feel that?" },
        { who: 'Adam', text: '...Yeah.' },
        { who: 'Nicholas', text: "I need to sit down for a while. Look around, okay? Find some supplies. A way out. Anything." },
        { who: 'Nicholas', text: "Come get me when you're ready. I'll be on that log." },
        { who: 'Adam', text: "Don't go anywhere." },
        { who: 'Nicholas', text: 'Where would I go?' },
      ]);
      this.nickMode = 'stay';
      this.autoWalk = false;
      // he walks to the log (with his walk cycle, at walking pace) and sits facing Adam
      this.nickWalking = true;
      this.nickFlip = SEAT_X < this.nick.x;
      const walkMs = Math.max(600, Math.abs(SEAT_X - this.nick.x) / 150 * 1000);
      await new Promise<void>((res) => this.tweens.add({ targets: this.nick, x: SEAT_X, y: 388, duration: walkMs, ease: 'Linear', onComplete: () => res() }));
      this.nickWalking = false;
      this.busy = false; this.touch.freeze(false);
      this.updateHud();
    })();
  }

  protected objective(): string {
    const n = THINGS.filter((k) => this.found.has(k)).length;
    return `Free roam: find things around the forest  ${n}/5\nReturn to Nicholas [E] when you're ready.`;
  }
  protected objectiveX(): number | null {
    const next = this.found.size < THINGS.length ? [1500, 2300, 2900, 3500, 4100][THINGS.findIndex((k) => !this.found.has(k))] : undefined;
    return next ?? SEAT_X;
  }

  private mark(id: string) { this.found.add(id); this.updateHud(); AudioSys.chime(Math.min(3, this.found.size)); }

  // ------------------------------------------------------------------ things
  private async camp() {
    const first = !this.found.has('camp');
    await this.lock(async () => {
      if (first) {
        await this.dlg.say([
          { text: 'A neat little camp. Someone left in a hurry, but carefully. A logbook lies on the stove.' },
          { text: '"The light heals. The dark always comes back when the music begins."' },
          { text: '"If you find the music box, DO NOT WIND IT. Leave it. Burn it. Do not wind it."' },
          { who: 'Adam', text: "That's... weirdly specific." },
          { text: 'Beside the logbook: a spare set of batteries.' },
        ]);
        this.giveItem('batteries'); this.bubble('+ Batteries', '#9be37a');
        this.mark('camp');
      } else await this.dlg.say([{ who: 'Adam', text: "Do not wind the music box. Got it." }]);
    });
  }

  private async pond() {
    const first = !this.found.has('pond');
    await this.lock(async () => {
      if (first) {
        await this.dlg.say([
          { text: 'The pond is clear again. Two reflections look back at you.' },
          { who: 'Adam', text: "Two of us. Good. That's... good." },
          { text: 'You fill your water bottle from the cool water.' },
        ]);
        this.giveItem('water'); this.bubble('+ Water', '#9be37a');
        this.mark('pond');
      } else await this.dlg.say([{ who: 'Adam', text: 'Still two reflections.' }]);
    });
  }

  private async crate() {
    await this.lock(async () => {
      await this.dlg.say([
        { text: "A ranger's emergency crate, half buried in leaves." },
        { text: 'Inside: a first aid kit, still sealed.' },
      ]);
      this.giveItem('firstaid'); this.bubble('+ First aid', '#ff8a9a');
      this.mark('crate');
    });
  }

  private async ammoBox() {
    await this.lock(async () => {
      await this.dlg.say([
        { text: 'A rusted ammo tin under a root.' },
        { who: 'Adam', text: "Four rounds. Someone else carried a gun out here too." },
      ]);
      this.pickupAmmo(4);
      this.mark('ammo');
    });
  }

  private async swing() {
    const first = !this.found.has('swing');
    await this.lock(async () => {
      if (first) {
        await this.dlg.say([
          { text: 'A child\'s drawing is tucked into the rope: two boys holding hands under a bright sun.' },
          { text: 'A third figure stands behind them. Tall. Thin. Its face has been scribbled out so hard the paper tore.' },
          { text: 'On the back, in crayon: "NICHOLAS DOESN\'T GO HOME."' },
          { who: 'Adam', text: "...Kids draw weird things." },
        ]);
        this.mark('swing');
      } else await this.dlg.say([{ who: 'Adam', text: 'I am not looking at that drawing again.' }]);
    });
  }

  // ------------------------------------------------------------------ nicholas + the music box
  private async talkNick() {
    let go = false;
    await this.lock(async () => {
      const n = THINGS.filter((k) => this.found.has(k)).length;
      const opener: Line[] = n === 0
        ? [{ who: 'Nicholas', text: "Hey. Find anything yet? No? Take your time. I'm not going anywhere." }]
        : n < 5
          ? [{ who: 'Nicholas', text: `${n} thing${n > 1 ? 's' : ''}, huh? Good. There might be more out there.` }]
          : [{ who: 'Nicholas', text: "You found everything. You're a hero, Adam." }];
      await this.dlg.say(opener);
      const pick = await this.dlg.choice({ who: 'Nicholas', text: 'Ready to look together?' }, ['Yes, ready', 'Not yet']);
      if (pick === 0) {
        await this.dlg.say([
          { who: 'Nicholas', text: "Good. I saw something shining past the swing earlier. East. Let's check it out together." },
          { who: 'Adam', text: 'Lead the way.' },
        ]);
        go = true;
      } else await this.dlg.say([{ who: 'Nicholas', text: "Okay. I'll be here." }]);
    });
    if (go) await this.discovery();
  }

  private async discovery() {
    this.busy = true; this.touch.freeze(true);
    this.nickMode = 'follow'; this.history = [];
    this.interactables = this.interactables.filter((i) => i.id !== 'nick');
    const walkTo = (tx: number) => new Promise<void>((res) => {
      this.autoWalk = true; this.adam.setFlipX(false);
      this.tweens.add({ targets: this.adam, x: tx, duration: Math.abs(tx - this.adam.x) / 175 * 1000, ease: 'Linear', onComplete: () => { this.autoWalk = false; res(); } });
    });
    await walkTo(BOX_X - 140);
    await this.wait(500);
    const box = this.add.image(BOX_X, 392, 'musicbox').setOrigin(0.5, 1).setScale(S).setDepth(392);
    this.add.image(BOX_X + 60, 392, 'rock_day').setOrigin(0.5, 1).setScale(S).setDepth(392);
    this.tweens.add({ targets: box, y: 388, duration: 900, yoyo: true, repeat: -1 });
    await this.wait(600);
    const hadLog = this.found.has('camp');
    await this.dlg.say([
      { who: 'Nicholas', text: 'There. The shiny thing.' },
      { text: 'A small music box sits on a stump, its brass lid catching the sunlight.' },
      hadLog
        ? { who: 'Adam', text: 'Nick. The logbook. "If you find the music box, do not wind it."' }
        : { who: 'Adam', text: "Weird. Who leaves a music box in the middle of a forest?" },
      { who: 'Nicholas', text: "It's a toy, Adam. It's just a toy." },
      { who: 'Adam', text: "Nick. Don't." },
      { who: 'Nicholas', text: "I just want to hear it. One time." },
    ]);

    // the music box plays, the day dies
    AudioSys.setMood('none', 1);
    const melody = [392, 440, 523, 440, 392, 330, 392, 440, 349, 392];
    melody.forEach((f, i) => AudioSys.tone(f, 0.7, 'triangle', 0.1, 'sfx', i * 0.45 + 0.2));
    await this.wait(1800);
    this.dayMotes.stop();
    this.backdrop.setMood('golden', 2800);
    this.tweens.add({ targets: this.duskTint, alpha: 0.45, duration: 3000 });
    await this.wait(2200);
    melody.forEach((f, i) => AudioSys.tone(f * 0.85, 0.9, 'sawtooth', 0.05, 'sfx', i * 0.75 + 0.1, f * 0.7)); // the tune warps
    this.backdrop.setMood('night', 3000);
    this.tweens.add({ targets: this.duskTint, alpha: 0.8, duration: 3000 });
    this.shake(2400, 0.006);
    await this.wait(3200);
    await this.dlg.say([
      { who: 'Adam', text: 'Nick... the music is slowing down.' },
      { who: 'Adam', text: "Why is it getting dark?" },
      { who: 'Nicholas', text: '...' },
      { who: 'Nicholas', text: 'There you are.' },
    ]);
    AudioSys.stinger();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    await this.wait(900);
    this.registry.set('nickHurt', false);
    this.scene.start('Hollow');
  }
}
