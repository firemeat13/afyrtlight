import Phaser from 'phaser';
import { ADAM_SCALE, FONT, H, NICK_SCALE, S, TREE_S, W } from '../config';
import { Backdrop } from '../gfx/Backdrop';
import { AudioSys } from '../systems/AudioSys';
import { DialogueBox } from '../systems/Dialogue';

interface Prop { o: Phaser.GameObjects.Image; }

/** Opening cinematic: two friends walking through the forest in the late afternoon. */
export class IntroScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private dlg!: DialogueBox;
  private adam!: Phaser.GameObjects.Sprite;
  private nick!: Phaser.GameObjects.Sprite;
  private props: Prop[] = [];
  private speed = 0; // world scroll px/s
  private scrollX = 0;
  private nextSpawn = 0;
  private dusk!: Phaser.GameObjects.Rectangle;
  private ended = false;
  private stepT = 0;

  constructor() { super('Intro'); }

  create() {
    this.props = []; this.speed = 0; this.scrollX = 0; this.nextSpawn = 0; this.ended = false;
    AudioSys.setMood('golden');
    this.backdrop = new Backdrop(this, 'golden');
    this.dusk = this.add.rectangle(0, 0, W, H, 0x2a0a4a, 0).setOrigin(0).setDepth(860);

    // pre-populate trees so the screen is not empty
    for (let x = 60; x < W + 200; x += Phaser.Math.Between(170, 260)) this.spawnProp(x);

    const mk = (key: string, x: number, y: number, sc: number) => {
      const sh = this.add.ellipse(x, y - 2, 56, 12, 0x000000, 0.28).setDepth(y - 1);
      const s = this.add.sprite(x, y, key, 0).setOrigin(0.5, 1).setScale(sc).setDepth(y);
      return { s, sh };
    };
    const a = mk('adam', 520, 390, ADAM_SCALE);
    const n = mk('nicholas', 400, 382, NICK_SCALE);
    this.adam = a.s; this.nick = n.s;

    // light motes in the golden light
    this.add.particles(0, 0, 'mote', {
      x: { min: 0, max: W }, y: { min: 60, max: H - 60 }, lifespan: { min: 4000, max: 8000 },
      speedX: { min: -30, max: -8 }, speedY: { min: -10, max: 8 }, scale: { start: 1.4, end: 0.4 },
      alpha: { start: 0.9, end: 0 }, tint: [0xffe9a8, 0xffffff], frequency: 110, blendMode: 'ADD',
    }).setScrollFactor(0).setDepth(700);
    this.add.particles(0, 0, 'leaf', {
      x: { min: 0, max: W }, y: -10, lifespan: 9000, speedX: { min: -60, max: -20 }, speedY: { min: 20, max: 50 },
      rotate: { start: 0, end: 360 }, scale: 2, alpha: 0.9, frequency: 900,
    }).setScrollFactor(0).setDepth(705);

    this.add.image(0, 0, 'vignette').setOrigin(0).setScale(2).setDepth(820).setAlpha(0.5);

    // letterbox bars
    const top = this.add.rectangle(0, -56, W, 56, 0x000000).setOrigin(0).setDepth(1900);
    const bot = this.add.rectangle(0, H, W, 56, 0x000000).setOrigin(0).setDepth(1900);
    this.tweens.add({ targets: top, y: 0, duration: 1200 });
    this.tweens.add({ targets: bot, y: H - 56, duration: 1200 });

    this.dlg = new DialogueBox(this);

    const skip = this.add.text(W - 20, 14, 'SKIP >>', { fontFamily: FONT, fontSize: '14px', color: '#ffffffcc', padding: { x: 10, y: 8 } })
      .setOrigin(1, 0).setDepth(4000).setInteractive({ useHandCursor: true });
    skip.on('pointerdown', (_p: any, _x: any, _y: any, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); this.finish(); });
    this.input.keyboard!.on('keydown-ESC', () => this.finish());

    this.cameras.main.fadeIn(1500, 0, 0, 0);
    void this.script();
  }

  private spawnProp(x: number) {
    const r = Math.random();
    let key: string, y: number, sc = S, depth: number | null = null;
    if (r < 0.5) { key = `tree_day_${Phaser.Math.Between(0, 2)}`; y = Phaser.Math.Between(318, 348); sc = TREE_S; }
    else if (r < 0.7) { key = 'bush_day'; y = Phaser.Math.Between(340, 410); }
    else if (r < 0.85) { key = 'rock_day'; y = Phaser.Math.Between(350, 412); }
    else { key = `flower_${['gold', 'red', 'blue'][Phaser.Math.Between(0, 2)]}`; y = Phaser.Math.Between(350, 412); }
    const o = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(sc).setDepth(depth ?? y);
    if (key.startsWith('tree')) this.tweens.add({ targets: o, angle: { from: -0.7, to: 0.7 }, duration: Phaser.Math.Between(2500, 4000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.props.push({ o });
  }

  private wait(ms: number) { return new Promise<void>((res) => this.time.delayedCall(ms, res)); }

  private walk(on: boolean, dur = 800) {
    this.tweens.addCounter({
      from: this.speed, to: on ? 150 : 0, duration: dur,
      onUpdate: (t) => { this.speed = t.getValue() ?? 0; },
    });
    [this.adam, this.nick].forEach((s, i) => {
      const k = i === 0 ? 'adam' : 'nicholas';
      if (on) s.anims.play(`${k}_walk`, true); else { s.anims.stop(); s.setFrame(0); }
    });
  }

  private card(text: string, hold = 2200) {
    const t = this.add.text(W / 2, H / 2 - 30, text, {
      fontFamily: FONT, fontSize: '26px', color: '#fff3c4', stroke: '#2b1740', strokeThickness: 8, align: 'center',
    }).setOrigin(0.5).setDepth(3600).setAlpha(0);
    return new Promise<void>((res) => {
      this.tweens.add({ targets: t, alpha: 1, duration: 900, yoyo: true, hold, onComplete: () => { t.destroy(); res(); } });
    });
  }

  private async script() {
    const d = this.dlg;
    await this.wait(1400);
    void this.card('LATE AFTERNOON', 1400);
    await this.wait(600);
    this.walk(true, 1500);
    await this.wait(3200);

    await d.say([
      { who: 'Nicholas', text: 'Hey, Adam. How long have we been walking?' },
      { who: 'Adam', text: "Dunno. An hour? Maybe two." },
      { who: 'Nicholas', text: 'You said this was a shortcut.' },
      { who: 'Adam', text: "It IS a shortcut. Technically." },
      { who: 'Nicholas', text: 'Technically.' },
      { who: 'Adam', text: '...Okay. Maybe I was a little wrong about the shortcut.' },
    ]);
    await this.wait(900);
    AudioSys.chime(1);
    await d.say([
      { who: 'Nicholas', text: "Remember when we were seven and got lost in the supermarket?" },
      { who: 'Adam', text: 'You cried.' },
      { who: 'Nicholas', text: 'YOU cried. I was comforting you. Loudly.' },
      { who: 'Adam', text: "Ten years later and you still can't win an argument." },
      { who: 'Nicholas', text: "Ten years later and you still can't read a map." },
    ]);
    await this.wait(1600);
    await d.say([
      { who: 'Nicholas', text: '...Hey. Whatever happens out here, we stick together. Okay?' },
      { who: 'Adam', text: 'Obviously. Who else would put up with you?' },
      { who: 'Nicholas', text: 'Wow. Emotional.' },
    ]);
    await this.wait(1800);

    // the first wrong thing
    this.tweens.add({ targets: this.dusk, alpha: 0.22, duration: 5000 });
    await this.wait(2600);
    AudioSys.setMood('none', 0.4); // birds stop. everything stops.
    this.walk(false, 900);
    await this.wait(2600);
    await d.say([
      { who: 'Adam', text: '...Did the birds just stop?' },
      { who: 'Nicholas', text: "Probably nothing. They do that when it's getting late." },
      { who: 'Adam', text: "It's not that late." },
      { who: 'Nicholas', text: "..." },
      { who: 'Nicholas', text: "Let's just find a trail. Before the sun goes down." },
    ]);
    this.walk(true, 1200);
    await this.wait(2600);
    this.finish();
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    this.registry.set('ch1cp', 'start');
    AudioSys.setMood('none', 1.5);
    this.cameras.main.fadeOut(1500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Forest'));
  }

  update(_t: number, dt: number) {
    const s = dt / 1000;
    this.scrollX += this.speed * s;
    this.backdrop.update(dt, this.scrollX);
    for (const p of this.props) p.o.x -= this.speed * s;
    this.props = this.props.filter((p) => {
      if (p.o.x < -200) { p.o.destroy(); return false; }
      return true;
    });
    this.nextSpawn -= this.speed * s;
    if (this.nextSpawn <= 0 && this.speed > 0) {
      this.spawnProp(W + 160);
      this.nextSpawn = Phaser.Math.Between(150, 240);
    }
    if (this.speed > 20) {
      this.stepT -= s;
      if (this.stepT <= 0) { AudioSys.step(); this.stepT = 0.36; }
    }
  }
}
