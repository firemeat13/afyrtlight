import Phaser from 'phaser';
import { FONT, H, W } from '../config';
import { AudioSys } from '../systems/AudioSys';

/** Content warning shown before the title screen. */
export class WarningScene extends Phaser.Scene {
  constructor() { super('Warning'); }

  create() {
    this.cameras.main.setBackgroundColor('#05030c');
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.add.text(W / 2, 58, 'CONTENT WARNING', { fontFamily: FONT, fontSize: '30px', color: '#ff3b4e', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5);
    const lines = [
      'AFTERLIGHT is a horror game. It contains:',
      '',
      '- Sudden, LOUD jumpscares',
      '- Flashing lights and screen shaking',
      '- Blood, graphic gore and violence',
      '- Death, including of young characters',
      '- Disturbing imagery and psychological horror',
      '',
      'Not suitable for children, or for players sensitive',
      'to flashing lights. Lower your volume before playing.',
      'Screen shake and volume can be changed in SETTINGS.',
    ];
    this.add.text(W / 2, 270, lines.join('\n'), { fontFamily: FONT, fontSize: '14px', color: '#ffffff', align: 'left', lineSpacing: 12 }).setOrigin(0.5);
    const go = this.add.text(W / 2, H - 46, 'PRESS ANY KEY / TAP TO CONTINUE', { fontFamily: FONT, fontSize: '14px', color: '#ffd23f' }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: go, alpha: 1, duration: 600, delay: 1500, yoyo: true, repeat: -1, hold: 400 });
    let done = false;
    const next = () => {
      if (done) return;
      done = true;
      AudioSys.unlock(); AudioSys.select();
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
    };
    // short delay so the warning cannot be skipped by accident
    this.time.delayedCall(1500, () => {
      this.input.keyboard!.once('keydown', next);
      this.input.once('pointerdown', next);
    });
  }
}
