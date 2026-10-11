import Phaser from 'phaser';
import { COL, FONT, H, W } from '../config';
import { AudioSys } from './AudioSys';
import { Settings } from './Settings';

export type Speaker = 'Adam' | 'Nicholas' | '???' | 'Cashier' | 'Radio' | '';
export interface Line { who?: Speaker; text: string; /** ms pause after the line is done (auto-advance) */ auto?: number }

const PITCH: Record<string, number> = { Adam: 1, Nicholas: 1.4, '???': 0.45, Cashier: 1.2, Radio: 0.6, '': 0.8 };
const NAMECOL: Record<string, string> = { Adam: COL.adam, Nicholas: COL.nicholas, '???': COL.voice, Cashier: COL.cashier, Radio: COL.radio, '': COL.sys };

/** Undertale-style typewriter dialogue box with blips, choices and tap/key advance. */
export class DialogueBox {
  private scene: Phaser.Scene;
  private c: Phaser.GameObjects.Container;
  private box: Phaser.GameObjects.Graphics;
  private nameTxt: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Triangle;
  private choiceTxt: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Triangle;
  active = false;

  private full = '';
  private shown = 0;
  private typing = false;
  private typeEvent?: Phaser.Time.TimerEvent;
  private advanceCb: (() => void) | null = null;
  private who: string = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const bx = 50, by = 396, bw = W - 100, bh = 124;
    this.box = scene.add.graphics();
    this.box.fillStyle(0x000000, 0.88).fillRect(bx, by, bw, bh);
    this.box.lineStyle(4, 0xffffff, 1).strokeRect(bx, by, bw, bh);
    this.box.lineStyle(2, 0x444466, 1).strokeRect(bx + 8, by + 8, bw - 16, bh - 16);
    this.nameTxt = scene.add.text(bx + 24, by - 14, '', { fontFamily: FONT, fontSize: '16px', color: '#fff', backgroundColor: '#000', padding: { x: 10, y: 8 } });
    this.body = scene.add.text(bx + 30, by + 24, '', { fontFamily: FONT, fontSize: '18px', color: '#ffffff', wordWrap: { width: bw - 80 }, lineSpacing: 12 });
    this.arrow = scene.add.triangle(bx + bw - 38, by + bh - 26, 0, 0, 16, 0, 8, 12, 0xffffff);
    this.cursor = scene.add.triangle(0, 0, 0, 0, 0, 16, 12, 8, 0xffd23f).setVisible(false);
    this.c = scene.add.container(0, 0, [this.box, this.nameTxt, this.body, this.arrow, this.cursor]).setDepth(2000).setScrollFactor(0).setVisible(false);
    scene.tweens.add({ targets: this.arrow, y: this.arrow.y + 5, duration: 380, yoyo: true, repeat: -1 });
  }

  private onKey = (e: KeyboardEvent) => {
    if (['Space', 'Enter', 'KeyZ', 'KeyE'].includes(e.code)) this.advance();
  };
  private onPointer = () => this.advance();

  private open() {
    this.active = true;
    this.c.setVisible(true);
    this.scene.input.keyboard?.on('keydown', this.onKey);
    this.scene.input.on('pointerdown', this.onPointer);
  }
  private close() {
    this.active = false;
    this.c.setVisible(false);
    this.scene.input.keyboard?.off('keydown', this.onKey);
    this.scene.input.off('pointerdown', this.onPointer);
  }

  private advance() {
    if (this.typing) { this.finishTyping(); return; }
    const cb = this.advanceCb; this.advanceCb = null;
    cb?.();
  }

  private typeNext = () => {
    if (!this.typing) return;
    const ch = this.full[this.shown];
    this.shown++;
    this.body.setText(this.full.slice(0, this.shown));
    if (ch && ch.trim() && this.shown % 2 === 0) AudioSys.blip(PITCH[this.who] ?? 1);
    if (this.shown >= this.full.length) { this.finishTyping(); return; }
    const base = [90, 55, 30][Settings.get().textSpeed - 1] ?? 55;
    let d = base;
    if (ch === ',') d = base * 4;
    else if ('.!?'.includes(ch ?? '') && this.full[this.shown] !== '.') d = base * 7;
    this.typeEvent = this.scene.time.delayedCall(d, this.typeNext);
  };

  private finishTyping() {
    this.typing = false;
    this.typeEvent?.remove();
    this.shown = this.full.length;
    this.body.setText(this.full);
    this.arrow.setVisible(this.choiceTxt.length === 0);
  }

  private show(line: Line) {
    this.who = line.who ?? '';
    this.full = line.text;
    this.shown = 0;
    this.typing = true;
    this.arrow.setVisible(false);
    this.nameTxt.setText(this.who).setColor(NAMECOL[this.who] ?? '#fff').setVisible(!!this.who);
    this.body.setText('');
    this.typeEvent?.remove();
    this.typeNext();
  }

  say(lines: Line[]): Promise<void> {
    return new Promise((resolve) => {
      this.open();
      let i = 0;
      const next = () => {
        if (i >= lines.length) { this.close(); resolve(); return; }
        const l = lines[i++];
        this.show(l);
        this.advanceCb = next;
        if (l.auto !== undefined) {
          const wait = () => {
            if (this.typing) { this.scene.time.delayedCall(100, wait); return; }
            this.scene.time.delayedCall(l.auto!, () => { if (this.advanceCb === next) { this.advanceCb = null; next(); } });
          };
          wait();
        }
      };
      next();
    });
  }

  /** Shows a prompt and options; resolves with the chosen index. */
  choice(prompt: Line, options: string[]): Promise<number> {
    return new Promise((resolve) => {
      this.open();
      this.show(prompt);
      let sel = 0;
      const place = () => {
        this.cursor.setPosition(100, 458 + sel * 0);
        this.choiceTxt.forEach((t, i) => t.setColor(i === sel ? '#ffd23f' : '#ffffff'));
        this.cursor.setPosition(this.choiceTxt[sel].x - 22, this.choiceTxt[sel].y + 4);
      };
      const showOpts = () => {
        options.forEach((o, i) => {
          const t = this.scene.add.text(110 + i * 330, 462, o, { fontFamily: FONT, fontSize: '18px', color: '#fff' })
            .setInteractive({ useHandCursor: true });
          t.on('pointerdown', (_p: any, _x: any, _y: any, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); sel = i; place(); confirm(); });
          this.c.add(t); this.choiceTxt.push(t);
        });
        this.cursor.setVisible(true);
        place();
      };
      const cleanup = () => {
        this.choiceTxt.forEach((t) => t.destroy()); this.choiceTxt = [];
        this.cursor.setVisible(false);
        this.scene.input.keyboard?.off('keydown', keys);
      };
      const confirm = () => { AudioSys.select(); cleanup(); this.close(); resolve(sel); };
      const keys = (e: KeyboardEvent) => {
        if (this.typing || !this.choiceTxt.length) return;
        if (['ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW'].includes(e.code)) { sel = (sel + options.length - 1) % options.length; AudioSys.move(); place(); }
        else if (['ArrowRight', 'KeyD', 'ArrowDown', 'KeyS'].includes(e.code)) { sel = (sel + 1) % options.length; AudioSys.move(); place(); }
        else if (['Space', 'Enter', 'KeyZ', 'KeyE'].includes(e.code)) confirm();
      };
      this.scene.input.keyboard?.on('keydown', keys);
      // advance() is a no-op for choices: wait until text finishes, then show options
      this.advanceCb = null;
      const wait = () => { if (this.typing) { this.scene.time.delayedCall(60, wait); return; } showOpts(); };
      wait();
      void H;
    });
  }
}
