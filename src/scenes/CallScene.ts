import Phaser from 'phaser';
import { ADAM_SCALE, EMOJI, FONT, H, W } from '../config';
import { AudioSys } from '../systems/AudioSys';
import { DialogueBox } from '../systems/Dialogue';
import { Game } from '../systems/GameState';

/** Opening scene: Nicholas calls Adam and asks if he wants to go to the forest. */
export class CallScene extends Phaser.Scene {
  private dlg!: DialogueBox;
  private ringing = true;
  private answered = false;

  constructor() { super('Call'); }

  create() {
    Game.reset();
    this.ringing = true; this.answered = false;
    AudioSys.setMood('none');
    this.cameras.main.fadeIn(1200, 0, 0, 0);
    this.drawRoom();

    const adam = this.add.sprite(300, 400, 'adam', 0).setOrigin(0.5, 1).setScale(ADAM_SCALE).setDepth(10);
    this.add.ellipse(300, 398, 64, 12, 0x000000, 0.25).setDepth(9);
    this.tweens.add({ targets: adam, y: 398, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // phone
    const phone = this.add.container(W / 2 + 170, 250).setDepth(20);
    const body = this.add.rectangle(0, 0, 150, 250, 0x15121f).setStrokeStyle(4, 0x4a4560);
    const screen = this.add.rectangle(0, 0, 130, 226, 0x241a44);
    const who = this.add.text(0, -80, 'NICHOLAS', { fontFamily: FONT, fontSize: '14px', color: '#7fc4ff' }).setOrigin(0.5);
    const sub = this.add.text(0, -54, 'incoming call', { fontFamily: FONT, fontSize: '9px', color: '#c9c4ff' }).setOrigin(0.5);
    const ico = this.add.text(0, 10, '📞', { fontFamily: EMOJI, fontSize: '52px' }).setOrigin(0.5);
    const hint = this.add.text(0, 86, 'TAP / ENTER\nTO ANSWER', { fontFamily: FONT, fontSize: '10px', color: '#ffffff', align: 'center', lineSpacing: 6 }).setOrigin(0.5);
    phone.add([body, screen, who, sub, ico, hint]);
    this.tweens.add({ targets: phone, angle: { from: -3, to: 3 }, duration: 90, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: hint, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

    const ring = () => {
      if (!this.ringing) return;
      AudioSys.tone(880, 0.12, 'square', 0.06); AudioSys.tone(1046, 0.12, 'square', 0.06, 'sfx', 0.16);
      AudioSys.tone(880, 0.12, 'square', 0.06, 'sfx', 0.5); AudioSys.tone(1046, 0.12, 'square', 0.06, 'sfx', 0.66);
      this.time.delayedCall(1700, ring);
    };
    this.time.delayedCall(1400, ring);

    this.dlg = new DialogueBox(this);
    const answer = () => {
      if (this.answered || !this.ringing) return;
      this.answered = true; this.ringing = false;
      AudioSys.select();
      this.tweens.killTweensOf(phone); phone.setAngle(0);
      sub.setText('connected  00:01'); ico.setText('🎧'); hint.setVisible(false);
      this.time.delayedCall(500, () => void this.talk(phone));
    };
    this.time.delayedCall(2000, () => {
      this.input.keyboard!.once('keydown', answer);
      this.input.once('pointerdown', answer);
    });
  }

  private drawRoom() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0xf2dcb4).fillRect(0, 0, W, 330); // wall
    for (let x = 0; x < W; x += 48) g.fillStyle(0xe9cfa0).fillRect(x, 0, 24, 330);
    g.fillStyle(0x8a5a36).fillRect(0, 330, W, 210); // floor
    for (let y = 330; y < H; y += 30) g.fillStyle(0x7a4c2c).fillRect(0, y, W, 3);
    g.fillStyle(0x5a3a22).fillRect(0, 326, W, 8);
    // window with late sun
    g.fillStyle(0x6b4428).fillRect(580, 40, 250, 190);
    g.fillStyle(0xffc46b).fillRect(592, 52, 226, 166);
    g.fillStyle(0xffe9a8).fillCircle(740, 150, 40);
    g.fillStyle(0x5aa05a).fillRect(592, 180, 226, 38);
    g.fillStyle(0x6b4428).fillRect(700, 52, 6, 166).fillRect(592, 130, 226, 6);
    // bed and poster
    g.fillStyle(0x3f4c78).fillRect(30, 250, 220, 90).fillStyle(0xe8e0cc).fillRect(30, 240, 70, 30);
    g.fillStyle(0x5a3a22).fillRect(30, 330, 220, 12);
    g.fillStyle(0x222233).fillRect(330, 60, 110, 150).fillStyle(0x7fc4ff).fillRect(340, 70, 90, 100).fillStyle(0x1b5e20).fillTriangle(340, 170, 385, 100, 430, 170);
    this.add.text(385, 190, 'WILD', { fontFamily: FONT, fontSize: '10px', color: '#fff' }).setOrigin(0.5).setDepth(1);
    const sun = this.add.rectangle(0, 0, W, H, 0xff8a3a, 0.12).setOrigin(0).setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
    void sun;
  }

  private async talk(phone: Phaser.GameObjects.Container) {
    const d = this.dlg;
    AudioSys.setMood('golden', 2);
    await d.say([
      { who: 'Nicholas', text: 'Adam! Finally. Do you ever answer your phone on the first ring?' },
      { who: 'Adam', text: "It's Saturday, Nick. I was asleep." },
      { who: 'Nicholas', text: "It's four in the afternoon." },
      { who: 'Adam', text: '...A very productive sleep.' },
      { who: 'Nicholas', text: "Okay, listen. Remember that forest past the old quarry? The one we were never allowed to go into?" },
      { who: 'Nicholas', text: 'I want to go. Today. Right now, while the weather is perfect.' },
    ]);
    const pick = await d.choice({ who: 'Nicholas', text: 'So? Do you want to go to the forest with me?' }, ['Yeah, sure', 'In a FOREST?']);
    if (pick === 0) {
      await d.say([
        { who: 'Adam', text: "Yeah. Yeah, why not. It's been a boring summer." },
        { who: 'Nicholas', text: "THAT'S the Adam I know!" },
      ]);
    } else {
      await d.say([
        { who: 'Adam', text: 'In a FOREST? Nick, there are bugs. And bears. And bugs.' },
        { who: 'Nicholas', text: "There are no bears. Probably." },
        { who: 'Nicholas', text: "Come on. Ten years of friendship. Do it for me." },
        { who: 'Adam', text: '...Ugh. Fine. But I am complaining the entire time.' },
        { who: 'Nicholas', text: 'I would expect nothing less.' },
      ]);
    }
    await d.say([
      { who: 'Nicholas', text: "Stop by the Corner Mart first. We'll need supplies." },
      { who: 'Nicholas', text: "Don't go crazy though. You only have forty bucks and I only trust you with half of it." },
      { who: 'Nicholas', text: "Buy what we NEED. Think about it. We could be out there a while." },
      { who: 'Adam', text: "A while? You said it was a quick walk." },
      { who: 'Nicholas', text: 'It is! Probably. Just... be smart. See you outside the store.' },
    ]);
    this.tweens.add({ targets: phone, y: H + 300, duration: 700, ease: 'Back.easeIn' });
    await new Promise<void>((r) => this.time.delayedCall(900, r));
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Store'));
  }
}
