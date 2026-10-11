import Phaser from 'phaser';
import { FONT, H, W } from '../config';
import { generateTextures } from '../gfx/Textures';

/**
 * Boot: waits for the pixel font, generates all placeholder textures, registers animations.
 * To use real art, add this.load.image / this.load.spritesheet in preload() using the same keys
 * documented at the top of gfx/Textures.ts.
 */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.add.text(W / 2, H / 2, 'loading...', { fontFamily: FONT, fontSize: '16px', color: '#8a7fc8' }).setOrigin(0.5);
    const fontReady = (document as any).fonts?.load
      ? Promise.race([(document as any).fonts.load('16px "Press Start 2P"'), new Promise((r) => setTimeout(r, 2500))])
      : Promise.resolve();
    fontReady.catch(() => {}).then(() => {
      generateTextures(this);
      for (const k of ['adam', 'nicholas']) {
        this.anims.create({ key: `${k}_walk`, frames: [1, 0, 3, 2].map((f) => ({ key: k, frame: f })), frameRate: 8, repeat: -1 });
        this.anims.create({ key: `${k}_idle`, frames: [{ key: k, frame: 0 }], frameRate: 1 });
      }
      this.scene.start('Warning');
    });
  }
}
