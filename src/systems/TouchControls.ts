import Phaser from 'phaser';
import { FONT, H, W } from '../config';

/** Floating virtual joystick (left half) + action button (bottom right). */
export class TouchControls {
  readonly enabled: boolean;
  vec = new Phaser.Math.Vector2();
  private action = false;
  private fire = false;
  private btn2!: Phaser.GameObjects.Arc;
  private btn2Txt!: Phaser.GameObjects.Text;
  gunVisible = false;
  /** True while the RUN button is held. */
  sprint = false;
  private runId = -1;
  private btn3!: Phaser.GameObjects.Arc;
  private btn3Txt!: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  private base: Phaser.GameObjects.Arc;
  private knob: Phaser.GameObjects.Arc;
  private btn: Phaser.GameObjects.Arc;
  private btnTxt: Phaser.GameObjects.Text;
  private stickId = -1;
  private origin = new Phaser.Math.Vector2();
  private readonly R = 70;
  private frozen = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const touch = scene.sys.game.device.input.touch || /[?&]touch=1/.test(location.search);
    this.enabled = !!touch;
    const mk = (a: number) => scene.add.circle(0, 0, 1, 0xffffff, a).setScrollFactor(0).setDepth(3000).setVisible(false);
    this.base = mk(0.12).setStrokeStyle(3, 0xffffff, 0.35);
    this.knob = mk(0.3);
    this.btn = scene.add.circle(W - 110, H - 110, 54, 0xffffff, 0.16).setStrokeStyle(3, 0xffffff, 0.45).setScrollFactor(0).setDepth(3000);
    this.btnTxt = scene.add.text(W - 110, H - 110, 'ACT', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
    this.btn2 = scene.add.circle(W - 240, H - 80, 44, 0xff5a5a, 0.18).setStrokeStyle(3, 0xff8a8a, 0.55).setScrollFactor(0).setDepth(3000).setVisible(false);
    this.btn2Txt = scene.add.text(W - 240, H - 80, 'FIRE', { fontFamily: FONT, fontSize: '13px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(3001).setVisible(false);
    this.btn3 = scene.add.circle(W - 110, H - 232, 42, 0x9be37a, 0.16).setStrokeStyle(3, 0x9be37a, 0.5).setScrollFactor(0).setDepth(3000);
    this.btn3Txt = scene.add.text(W - 110, H - 232, 'RUN', { fontFamily: FONT, fontSize: '13px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
    if (!this.enabled) { this.btn.setVisible(false); this.btnTxt.setVisible(false); this.btn3.setVisible(false); this.btn3Txt.setVisible(false); return; }
    scene.input.addPointer(2);
    scene.input.on('pointerdown', this.down, this);
    scene.input.on('pointermove', this.move, this);
    scene.input.on('pointerup', this.up, this);
    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', this.down, this);
      scene.input.off('pointermove', this.move, this);
      scene.input.off('pointerup', this.up, this);
    });
  }

  /** Hide/disable while dialogue or cutscene is active. */
  freeze(f: boolean) {
    this.frozen = f;
    if (f) this.release();
    this.btn.setVisible(this.enabled && !f); this.btnTxt.setVisible(this.enabled && !f);
    this.btn3.setVisible(this.enabled && !f); this.btn3Txt.setVisible(this.enabled && !f);
    if (f) { this.sprint = false; this.runId = -1; this.btn3.setFillStyle(0x9be37a, 0.16); }
    this.syncFire();
  }

  private syncFire() { const v = this.enabled && this.gunVisible && !this.frozen; this.btn2.setVisible(v); this.btn2Txt.setVisible(v); }
  setGun(on: boolean) { if (this.gunVisible !== on) { this.gunVisible = on; this.syncFire(); } }
  consumeFire(): boolean { const a = this.fire; this.fire = false; return a; }

  private release() {
    this.stickId = -1; this.vec.set(0, 0);
    this.base.setVisible(false); this.knob.setVisible(false);
  }

  private down(p: Phaser.Input.Pointer) {
    if (this.frozen || p.y < 100) return;
    if (this.gunVisible && Phaser.Math.Distance.Between(p.x, p.y, this.btn2.x, this.btn2.y) < 56) { this.fire = true; return; }
    if (Phaser.Math.Distance.Between(p.x, p.y, this.btn3.x, this.btn3.y) < 54) { this.sprint = true; this.runId = p.id; this.btn3.setFillStyle(0x9be37a, 0.45); return; }
    if (Phaser.Math.Distance.Between(p.x, p.y, this.btn.x, this.btn.y) < 70) { this.action = true; this.btn.setFillStyle(0xffffff, 0.35); return; }
    if (p.x < W * 0.6 && this.stickId < 0) {
      this.stickId = p.id; this.origin.set(p.x, p.y);
      this.base.setPosition(p.x, p.y).setRadius(this.R).setVisible(true);
      this.knob.setPosition(p.x, p.y).setRadius(30).setVisible(true);
    }
  }
  private move(p: Phaser.Input.Pointer) {
    if (p.id !== this.stickId) return;
    const d = new Phaser.Math.Vector2(p.x - this.origin.x, p.y - this.origin.y);
    const len = Math.min(d.length(), this.R);
    d.setLength(len);
    this.knob.setPosition(this.origin.x + d.x, this.origin.y + d.y);
    this.vec.set(d.x / this.R, d.y / this.R);
    if (this.vec.length() < 0.2) this.vec.set(0, 0);
  }
  private up(p: Phaser.Input.Pointer) {
    if (p.id === this.stickId) this.release();
    if (p.id === this.runId) { this.sprint = false; this.runId = -1; this.btn3.setFillStyle(0x9be37a, 0.16); }
    this.btn.setFillStyle(0xffffff, 0.16);
  }

  consumeAction(): boolean { const a = this.action; this.action = false; return a; }
}
