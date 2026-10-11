import Phaser from 'phaser';
import { H, W } from '../config';

export type BackdropMood = 'day' | 'golden' | 'night';

/**
 * Layered parallax forest (sky, sun/moon, far hills, mid trees, ground).
 * Day layers sit at the bottom; night layers crossfade over them.
 * Everything is scrollFactor 0 and scrolled manually in update(camX).
 */
export class Backdrop {
  private scene: Phaser.Scene;
  mood: BackdropMood;
  private skyDay!: Phaser.GameObjects.Image;
  private skyGold!: Phaser.GameObjects.Image;
  private skyNight!: Phaser.GameObjects.Image;
  private sun!: Phaser.GameObjects.Image;
  private moon!: Phaser.GameObjects.Image;
  private far: Phaser.GameObjects.TileSprite[] = [];
  private mid: Phaser.GameObjects.TileSprite[] = [];
  private ground: Phaser.GameObjects.TileSprite[] = [];
  private fg: Phaser.GameObjects.TileSprite[] = [];
  private nightLayers: Phaser.GameObjects.GameObject[] = [];
  private goldTint!: Phaser.GameObjects.Rectangle;
  private shafts: Phaser.GameObjects.Image[] = [];
  private t = 0;

  constructor(scene: Phaser.Scene, mood: BackdropMood, withForeground = true) {
    this.scene = scene;
    this.mood = mood;
    const img = (key: string, d: number) => scene.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setDepth(d);

    this.skyDay = img('sky_day', -100).setDisplaySize(W, H);
    this.skyGold = img('sky_golden', -99).setDisplaySize(W, H);
    this.skyNight = img('sky_night', -98);
    this.sun = scene.add.image(720, 160, 'sun').setScrollFactor(0).setDepth(-97).setScale(2).setBlendMode(Phaser.BlendModes.ADD);
    this.moon = scene.add.image(720, 110, 'moon').setScrollFactor(0).setDepth(-97).setScale(2);

    const tile = (key: string, y: number, h: number, d: number) =>
      scene.add.tileSprite(0, y, W, h, key).setOrigin(0).setScrollFactor(0).setDepth(d);

    for (const ph of ['day', 'night'] as const) {
      const base = ph === 'day' ? 0 : 0.01;
      const far = tile(`far_${ph}`, 20, 300, -90 + base);
      const mid = tile(`mid_${ph}`, 60, 300, -80 + base);
      const gr = tile(`ground_${ph}`, 300, 242, -60 + base);
      this.far.push(far); this.mid.push(mid); this.ground.push(gr);
      far.setScale(1); mid.setScale(1);
      if (ph === 'night') this.nightLayers.push(far, mid, gr);
      if (withForeground) {
        const fg = tile(`fg_${ph}`, H - 52, 52, 800 + base).setScale(1);
        fg.setTilePosition(0, 88);
        this.fg.push(fg);
        if (ph === 'night') this.nightLayers.push(fg);
      }
    }
    this.nightLayers.push(this.skyNight);
    // sun shafts (day only)
    for (let i = 0; i < 4; i++) {
      this.shafts.push(
        scene.add.image(380 + i * 150, 60, 'shaft').setOrigin(0.5, 0).setScrollFactor(0).setDepth(-50)
          .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setScale(2.4, 2.2).setAngle(-12),
      );
    }
    this.goldTint = scene.add.rectangle(0, 0, W, H, 0xff8a3a, 0.16).setOrigin(0).setScrollFactor(0).setDepth(850)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.apply(mood, 0);
  }

  /** Crossfade to a mood. Returns the tween duration for chaining. */
  setMood(mood: BackdropMood, dur = 2000) { this.mood = mood; this.apply(mood, dur); }

  private apply(mood: BackdropMood, dur: number) {
    const night = mood === 'night';
    const gold = mood === 'golden';
    const to = (targets: any, alpha: number) => {
      if (dur <= 0) (Array.isArray(targets) ? targets : [targets]).forEach((t: any) => t.setAlpha(alpha));
      else this.scene.tweens.add({ targets, alpha, duration: dur, ease: 'Sine.easeInOut' });
    };
    to(this.nightLayers, night ? 1 : 0);
    to(this.skyGold, gold ? 1 : 0);
    to(this.skyDay, night ? 0 : 1);
    to(this.sun, night ? 0 : 1);
    to(this.moon, night ? 1 : 0);
    to(this.goldTint, gold ? 0.16 : 0);
    to(this.shafts, night ? 0 : 0.35);
    const sunY = gold ? 250 : 110;
    if (dur <= 0) this.sun.y = sunY;
    else this.scene.tweens.add({ targets: this.sun, y: sunY, duration: dur, ease: 'Sine.easeInOut' });
  }

  update(dt: number, camX: number, autoScroll = 0) {
    this.t += dt;
    const x = camX + this.t * autoScroll;
    this.far.forEach((l) => (l.tilePositionX = x * 0.12));
    this.mid.forEach((l) => (l.tilePositionX = x * 0.35));
    this.ground.forEach((l) => (l.tilePositionX = x));
    this.fg.forEach((l) => (l.tilePositionX = x * 1.35));
    this.shafts.forEach((s, i) => (s.angle = -12 + Math.sin(this.t * 0.0004 + i) * 2));
    this.sun.setScale(2 + Math.sin(this.t * 0.0007) * 0.05);
  }
}
