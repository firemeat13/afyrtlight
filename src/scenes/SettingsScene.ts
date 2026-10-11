import Phaser from 'phaser';
import { FONT, H, W } from '../config';
import { Backdrop } from '../gfx/Backdrop';
import { AudioSys } from '../systems/AudioSys';
import { Settings } from '../systems/Settings';

interface Row { label: string; get: () => string; adjust: (d: number) => void }

export class SettingsScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private rows: Row[] = [];
  private labelTxt: Phaser.GameObjects.Text[] = [];
  private valueTxt: Phaser.GameObjects.Text[] = [];
  private sel = 0;
  private scrollX = 0;

  constructor() { super('Settings'); }

  create() {
    this.sel = 0; this.scrollX = 0; this.labelTxt = []; this.valueTxt = [];
    this.cameras.main.fadeIn(350, 0, 0, 0);
    this.backdrop = new Backdrop(this, 'day', false);
    this.add.rectangle(0, 0, W, H, 0x05030c, 0.72).setOrigin(0).setDepth(10);
    this.add.text(W / 2, 70, 'SETTINGS', { fontFamily: FONT, fontSize: '40px', color: '#fff3c4', stroke: '#2b1740', strokeThickness: 8 }).setOrigin(0.5).setDepth(20);

    const s = Settings.get();
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    this.rows = [
      { label: 'MUSIC', get: () => pct(s.music), adjust: (d) => { s.music = Phaser.Math.Clamp(Math.round((s.music + d * 0.1) * 10) / 10, 0, 1); AudioSys.applyVolumes(); } },
      { label: 'SOUND FX', get: () => pct(s.sfx), adjust: (d) => { s.sfx = Phaser.Math.Clamp(Math.round((s.sfx + d * 0.1) * 10) / 10, 0, 1); AudioSys.applyVolumes(); AudioSys.blip(1); } },
      { label: 'TEXT SPEED', get: () => ['SLOW', 'NORMAL', 'FAST'][s.textSpeed - 1], adjust: (d) => { s.textSpeed = Phaser.Math.Clamp(s.textSpeed + d, 1, 3); } },
      { label: 'SCREEN SHAKE', get: () => (s.shake ? 'ON' : 'OFF'), adjust: () => { s.shake = !s.shake; } },
      { label: 'BACK', get: () => '', adjust: () => this.back() },
    ];
    this.rows.forEach((r, i) => {
      const y = 170 + i * 66;
      const l = this.add.text(150, y, r.label, { fontFamily: FONT, fontSize: '22px', color: '#fff' }).setDepth(20).setInteractive({ useHandCursor: true });
      const v = this.add.text(W - 150, y, '', { fontFamily: FONT, fontSize: '22px', color: '#fff' }).setOrigin(1, 0).setDepth(20);
      l.on('pointerdown', () => { this.sel = i; this.refresh(); if (r.label === 'BACK') this.back(); });
      l.on('pointerover', () => { this.sel = i; this.refresh(); });
      this.labelTxt.push(l); this.valueTxt.push(v);
      if (r.label !== 'BACK') {
        const mk = (x: number, ch: string, d: number) => {
          const b = this.add.text(x, y - 4, ch, { fontFamily: FONT, fontSize: '28px', color: '#ffd23f', padding: { x: 10, y: 4 } }).setDepth(20).setInteractive({ useHandCursor: true });
          b.on('pointerdown', () => { this.sel = i; AudioSys.move(); r.adjust(d); this.refresh(); });
        };
        mk(W - 410, '<', -1); mk(W - 110, '>', 1);
      }
    });
    this.add.text(W / 2, H - 30, 'UP/DOWN select   LEFT/RIGHT change   ESC back', { fontFamily: FONT, fontSize: '11px', color: '#9a90c8' }).setOrigin(0.5).setDepth(20);
    this.refresh();

    const kb = this.input.keyboard!;
    kb.on('keydown-UP', () => { this.sel = (this.sel + this.rows.length - 1) % this.rows.length; AudioSys.move(); this.refresh(); });
    kb.on('keydown-DOWN', () => { this.sel = (this.sel + 1) % this.rows.length; AudioSys.move(); this.refresh(); });
    kb.on('keydown-LEFT', () => { AudioSys.move(); this.rows[this.sel].adjust(-1); this.refresh(); });
    kb.on('keydown-RIGHT', () => { AudioSys.move(); this.rows[this.sel].adjust(1); this.refresh(); });
    kb.on('keydown-ESC', () => this.back());
    ['ENTER', 'SPACE'].forEach((k) => kb.on(`keydown-${k}`, () => { if (this.rows[this.sel].label === 'BACK') this.back(); }));
  }

  private refresh() {
    this.rows.forEach((r, i) => {
      const on = i === this.sel;
      this.labelTxt[i].setColor(on ? '#ffd23f' : '#ffffff').setText((on ? '> ' : '  ') + r.label);
      this.valueTxt[i].setText(r.get()).setColor(on ? '#ffd23f' : '#ffffff');
    });
  }

  private back() {
    Settings.save();
    AudioSys.select();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
  }

  update(_t: number, dt: number) { this.scrollX += dt * 0.012; this.backdrop.update(dt, this.scrollX); }
}
