import Phaser from 'phaser';
import { ADAM_SCALE, FONT, H, NICK_SCALE, S, W } from '../config';
import { Backdrop } from '../gfx/Backdrop';
import { AudioSys } from '../systems/AudioSys';

export class TitleScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private letters: Phaser.GameObjects.Text[] = [];
  private buttons: Phaser.GameObjects.Text[] = [];
  private cursor!: Phaser.GameObjects.Triangle;
  private sel = 0;
  private scrollX = 0;
  private eyes: Phaser.GameObjects.Image[] = [];
  private flickering = false;
  private starting = false;

  constructor() { super('Title'); }

  create() {
    this.starting = false; this.flickering = false; this.scrollX = 0; this.sel = 0;
    this.letters = []; this.buttons = []; this.eyes = [];
    AudioSys.setMood('title');
    this.cameras.main.fadeIn(1200, 0, 0, 0);

    this.backdrop = new Backdrop(this, 'day');

    // a few trees + the two friends watching the sun
    const treeX = [80, 250, 760, 900];
    treeX.forEach((x, i) => {
      const t = this.add.image(x, 372 + (i % 2) * 10, `tree_day_${i % 3}`).setOrigin(0.5, 1).setScale(S).setDepth(372);
      this.tweens.add({ targets: t, angle: { from: -0.6, to: 0.6 }, duration: 3000 + i * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.add.image(420, 425, 'bush_day').setOrigin(0.5, 1).setScale(S).setDepth(425);
    this.add.image(560, 440, 'tuft_day').setOrigin(0.5, 1).setScale(S).setDepth(440);
    const mk = (key: string, x: number, y: number, flip: boolean, sc: number) => {
      this.add.ellipse(x, y - 2, 56, 12, 0x000000, 0.25).setDepth(y - 1);
      return this.add.sprite(x, y, key, 0).setOrigin(0.5, 1).setScale(sc).setFlipX(flip).setDepth(y);
    };
    const adam = mk('adam', 640, 462, false, ADAM_SCALE);
    const nick = mk('nicholas', 700, 468, true, NICK_SCALE);
    this.tweens.add({ targets: [adam, nick], y: '-=2', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // pollen / motes
    this.add.particles(0, 0, 'mote', {
      x: { min: 0, max: W }, y: { min: 120, max: H - 40 }, lifespan: { min: 4000, max: 8000 },
      speedX: { min: 5, max: 24 }, speedY: { min: -14, max: 6 }, scale: { start: 1.2, end: 0.4 },
      alpha: { start: 0.9, end: 0 }, tint: [0xfff2a8, 0xffffff, 0xb5f27a], frequency: 140, blendMode: 'ADD',
    }).setScrollFactor(0).setDepth(700);

    // eyes for the night flicker
    [[200, 300], [470, 280], [850, 310]].forEach(([x, y]) => {
      this.eyes.push(this.add.image(x, y, 'eyes').setScale(2).setDepth(810).setAlpha(0));
    });

    this.add.image(0, 0, 'vignette').setOrigin(0).setScale(2).setDepth(820).setAlpha(0.55);

    // title lettering
    const word = 'AFTERLIGHT';
    const size = 76;
    const spacing = 72;
    const startX = W / 2 - (word.length - 1) * spacing / 2;
    [...word].forEach((ch, i) => {
      const t = this.add.text(startX + i * spacing, 120, ch, {
        fontFamily: FONT, fontSize: `${size}px`, color: '#fff3c4', stroke: '#2b1740', strokeThickness: 10,
        shadow: { offsetX: 0, offsetY: 6, color: '#ff8a3a', blur: 0, fill: true },
      }).setOrigin(0.5).setDepth(900);
      this.letters.push(t);
      this.tweens.add({ targets: t, y: 120 - 5, duration: 1800, delay: i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    const glow = this.add.image(W / 2, 128, 'glow').setScale(14, 3).setTint(0xffc46b).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(890);
    this.tweens.add({ targets: glow, alpha: 0.2, duration: 2200, yoyo: true, repeat: -1 });

    const tag = this.add.text(W / 2, 205, '"When the forest calls your name, don\'t answer."', {
      fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#2b1740', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(900).setAlpha(0);
    this.tweens.add({ targets: tag, alpha: 1, duration: 2000, delay: 1400 });

    // buttons
    const labels = ['PLAY', 'SETTINGS'];
    labels.forEach((l, i) => {
      const b = this.add.text(190, 322 + i * 66, l, {
        fontFamily: FONT, fontSize: '30px', color: '#ffffff', stroke: '#2b1740', strokeThickness: 8,
        backgroundColor: '#00000066', padding: { x: 26, y: 14 },
      }).setOrigin(0.5).setDepth(900).setInteractive({ useHandCursor: true });
      b.on('pointerover', () => { if (this.sel !== i) { this.sel = i; AudioSys.move(); this.refresh(); } });
      b.on('pointerdown', () => { this.sel = i; this.refresh(); this.activate(); });
      this.buttons.push(b);
    });
    this.cursor = this.add.triangle(0, 0, 0, 0, 0, 22, 18, 11, 0xffd23f).setDepth(901);
    this.tweens.add({ targets: this.cursor, scaleX: 1.3, duration: 400, yoyo: true, repeat: -1 });
    this.refresh();

    this.add.text(14, H - 12, 'TEST: Ctrl + Left/Right (or PgUp/PgDn) skips between parts', { fontFamily: FONT, fontSize: '9px', color: '#ffffffaa' }).setOrigin(0, 1).setDepth(900);
    this.add.text(W - 14, H - 12, 'v0.1 prototype', { fontFamily: FONT, fontSize: '10px', color: '#ffffffaa' }).setOrigin(1).setDepth(900);

    const kb = this.input.keyboard!;
    kb.on('keydown-UP', () => this.nav(-1)); kb.on('keydown-W', () => this.nav(-1));
    kb.on('keydown-DOWN', () => this.nav(1)); kb.on('keydown-S', () => this.nav(1));
    ['ENTER', 'SPACE', 'Z', 'E'].forEach((k) => kb.on(`keydown-${k}`, () => this.activate()));

    this.time.delayedCall(6000, () => this.flicker());
  }

  private nav(d: number) {
    if (this.starting) return;
    this.sel = (this.sel + d + this.buttons.length) % this.buttons.length;
    AudioSys.move(); this.refresh();
  }

  private refresh() {
    this.buttons.forEach((b, i) => {
      b.setColor(i === this.sel ? '#ffd23f' : '#ffffff').setScale(i === this.sel ? 1.08 : 1);
    });
    const b = this.buttons[this.sel];
    this.cursor.setPosition(b.x - b.displayWidth / 2 - 26, b.y - 11);
  }

  private activate() {
    if (this.starting) return;
    AudioSys.unlock();
    AudioSys.select();
    if (this.sel === 1) {
      this.starting = true;
      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Settings'));
      return;
    }
    this.starting = true;
    AudioSys.setMood('none', 2);
    this.cameras.main.fadeOut(1400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Call'));
  }

  /** A brief, wrong-feeling glimpse of the night version of the forest. */
  private flicker() {
    if (this.starting) return;
    this.flickering = true;
    AudioSys.heartbeat();
    const dark = (on: boolean) => {
      this.backdrop.setMood(on ? 'night' : 'day', 0);
      this.eyes.forEach((e) => e.setAlpha(on ? 1 : 0));
      this.letters.forEach((l) => l.setColor(on ? '#b00020' : '#fff3c4'));
    };
    dark(true);
    this.cameras.main.shake(220, 0.004);
    this.time.delayedCall(110, () => dark(false));
    this.time.delayedCall(190, () => dark(true));
    this.time.delayedCall(420, () => { dark(false); this.flickering = false; });
    this.time.delayedCall(Phaser.Math.Between(9000, 15000), () => this.flicker());
  }

  update(_t: number, dt: number) {
    this.scrollX += dt * 0.012;
    this.backdrop.update(dt, this.scrollX);
  }
}
