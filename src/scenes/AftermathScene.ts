import Phaser from 'phaser';
import { BAND_TOP, FONT, H, Phase, S, TREE_S, W } from '../config';
import { AudioSys } from '../systems/AudioSys';
import { WorldScene } from './WorldScene';

const CABIN_X = 1300;
const BODY_X = 640;

/** PART 3 epilogue - outside the cabin, back in pixel art. Adam finds Nicholas. */
export class AftermathScene extends WorldScene {
  private found = false;

  constructor() { super('Aftermath'); }

  protected startPhase(): Phase { return 'night'; }
  protected onInit() { this.worldW = 1800; this.found = false; }
  protected retry() { this.scene.restart(); }
  protected worldLimit() { return CABIN_X - 215; }

  protected buildWorld() {
    const r = Phaser.Math.RND;
    r.sow(['aftermath']);
    let x = 40;
    while (x < this.worldW + 100) { this.addTree(x, r.between(318, 348), r.between(0, 2)); x += r.between(120, 220); }
    for (let i = 0; i < 40; i++) {
      const kind = r.pick(['tuft', 'tuft', 'bush', 'rock']);
      this.addProp(`${kind}_day`, `${kind}_night`, r.between(0, CABIN_X - 260), r.between(BAND_TOP - 10, 424), S);
    }
    // the cabin (door open) and the dead lamps
    this.addTree(CABIN_X - 230, 340, 2, TREE_S + 0.3, false);
    this.add.image(CABIN_X, 400, 'cabin').setOrigin(0.5, 1).setScale(3.4).setDepth(399);
    this.add.image(CABIN_X, 400, 'door_open').setOrigin(0.5, 1).setScale(3.4).setDepth(400);
    [300, 900].forEach((lx) => this.addProp('lamp_off', 'lamp_off', lx, 372, S));
    // the trail from the door
    for (let bx = CABIN_X - 190; bx > BODY_X + 40; bx -= 70) {
      this.addNightOnly('blood', bx, 396 + ((bx / 70) % 2) * 8, 2.6, 2);
      this.addNightOnly('blooddrop', bx - 30, 402, 3, 2);
    }
    // Nicholas
    this.addNightOnly('blood', BODY_X - 20, 404, 5, 3);
    this.addNightOnly('blood', BODY_X + 50, 398, 4, 3);
    this.addNightOnly('nick_dead', BODY_X, 398, 4, 398);
    this.interactables.push({ id: 'body', x: BODY_X, y: 398, reach: 130, run: () => this.findNick() });
  }

  protected begin() {
    this.nickMode = 'stay';
    this.nick.setVisible(false).setPosition(-900, 380); this.nickShadow.setVisible(false);
    this.adam.setPosition(CABIN_X - 225, 396).setFlipX(true);
    AudioSys.setMood('night', 3);
    this.cameras.main.fadeIn(2500, 0, 0, 0);
    this.busy = true;
    this.updateHud();
    void (async () => {
      await this.wait(2200);
      await this.dlg.say([
        { who: 'Adam', text: "Nick! It's dead. I killed it. It's over." },
        { who: 'Adam', text: 'We can go home. Nick?' },
        { who: 'Adam', text: '...Nick?' },
        { text: 'The lamps have gone out. A dark, wet trail leads away from the door.' },
      ]);
      this.busy = false; this.touch.freeze(false);
    })();
  }

  protected objective(): string { return this.found ? '' : 'Find Nicholas'; }
  protected objectiveX(): number | null { return this.found ? null : BODY_X; }

  private async findNick() {
    if (this.found) return;
    this.found = true;
    this.busy = true; this.touch.freeze(true); this.ending = true;
    this.updateHud();
    AudioSys.setMood('none', 0.4);
    AudioSys.stinger();
    this.shake(600, 0.015);
    this.bloodFx.explode(10, BODY_X, 380);
    await this.wait(900);
    await this.dlg.say([
      { who: 'Adam', text: 'Nick.' },
      { text: 'Nicholas is lying in the grass. He is not moving.' },
      { text: 'His chest has been opened in four long furrows. The ground under him is black with it.' },
      { text: 'His glasses are a few feet away. One arm is stretched toward the cabin door.' },
      { who: 'Adam', text: 'No. No, no, no. Nick. Get up. Get up, we won. We WON.' },
      { who: 'Adam', text: 'I promised I would come back out. I came back. I came back...' },
      { text: 'He waited for you. He waited right by the door, just like he said he would.' },
    ]);
    AudioSys.whisper(1);
    this.spawnEyes(10);
    this.dread = 1;
    await this.wait(1800);
    await this.dlg.say([
      { who: '???', text: 'Adam.' },
      { who: '???', text: 'Only one of you was ever going to leave.' },
    ]);
    this.cameras.main.fadeOut(2200, 0, 0, 0);
    await this.wait(2400);
    this.dark.setVisible(false);
    this.add.rectangle(0, 0, W, H, 0x05030c).setOrigin(0).setScrollFactor(0).setDepth(5000);
    this.add.text(W / 2, H / 2 - 50, 'PART 3 COMPLETE', { fontFamily: FONT, fontSize: '36px', color: '#c9a0ff', stroke: '#05030c', strokeThickness: 10 }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);
    this.add.text(W / 2, H / 2 + 20, 'To be continued...', { fontFamily: FONT, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);
    const t3 = this.add.text(W / 2, H / 2 + 120, 'TAP / PRESS ANY KEY TO RETURN', { fontFamily: FONT, fontSize: '12px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(5001);
    this.tweens.add({ targets: t3, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
    this.cameras.main.fadeIn(1500, 0, 0, 0);
    AudioSys.setMood('title', 3);
    await this.wait(2000);
    const back = () => this.scene.start('Title');
    this.input.keyboard!.once('keydown', back);
    this.input.once('pointerdown', back);
  }
}
