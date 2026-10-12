import Phaser from 'phaser';
import { H, W } from '../config';
import { makeAnalogTextures } from '../gfx/analog';
import { AudioSys } from '../systems/AudioSys';
import { Game } from '../systems/GameState';
import { Settings } from '../systems/Settings';

type State = 'intro' | 'fight' | 'event' | 'dead' | 'end';

const VHS = '"Courier New", Courier, monospace';
const SPOTS = [{ x: 185, y: 215 }, { x: 495, y: 205 }, { x: 800, y: 215 }];
const STAGE_SCALE = [0.2, 0.34, 0.54];
const HEAD_R = 512 * 0.19; // head half-height inside the an_monster texture
const BOSS_HP = 6; // reduced HP but fight is harder with more events

/**
 * PART 3 finale - inside the cabin. The pixel art is gone: this is "found footage".
 * First-person: sweep your light around the room, shoot the Hollow Man in the face before it reaches you.
 */
export class CabinScene extends Phaser.Scene {
  private state: State = 'intro';
  private bg!: Phaser.GameObjects.Image;
  private drips!: Phaser.GameObjects.Image;
  private mon!: Phaser.GameObjects.Image;
  private ghostR!: Phaser.GameObjects.Image;
  private ghostC!: Phaser.GameObjects.Image;
  private eyeL!: Phaser.GameObjects.Image;
  private eyeR!: Phaser.GameObjects.Image;
  private dark!: Phaser.GameObjects.RenderTexture;
  private lightImg!: Phaser.GameObjects.Image;
  private face!: Phaser.GameObjects.Image;
  private flash!: Phaser.GameObjects.Rectangle;
  private noise!: Phaser.GameObjects.TileSprite;
  private bar!: Phaser.GameObjects.TileSprite;
  private cross!: Phaser.GameObjects.Arc;
  private cap!: Phaser.GameObjects.Text;
  private hud!: Phaser.GameObjects.Text;
  private stamp!: Phaser.GameObjects.Text;
  private bossBar!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private aim = new Phaser.Math.Vector2(W / 2, H / 2);
  private hp = 3;
  private bossHp = BOSS_HP;
  private shells = 2;
  private reloadT = 0;
  private muzzleT = 0;
  private lightMul = 1;
  private scareT = 0;
  private t = 0;
  // monster
  private vis = false;
  private spot = 1;
  private stage = 0;
  private stepT = 0;
  private hiddenT = 2;
  private eventsDone = new Set<number>();
  private subT = 5;
  private breathT = 2;
  private twitch = 0;
  private sub!: Phaser.GameObjects.Text;
  private subFace!: Phaser.GameObjects.Image;
  private watchers: Array<{ l: Phaser.GameObjects.Image; r: Phaser.GameObjects.Image; x: number; y: number; ph: number }> = [];
  private uiHit = false;
  private isTouch = false;
  private dragId = -1;
  private dragLast = new Phaser.Math.Vector2();

  constructor() { super('Cabin'); }

  // ------------------------------------------------------------------ setup
  create() {
    makeAnalogTextures(this);
    this.state = 'intro';
    this.hp = Game.maxHp; this.bossHp = BOSS_HP; this.shells = 2; this.reloadT = 0; this.muzzleT = 0;
    this.lightMul = 1; this.scareT = 0; this.t = 0; this.vis = false; this.stage = 0; this.hiddenT = 2;
    this.eventsDone = new Set(); this.dragId = -1; this.aim.set(W / 2, H / 2); this.subT = 5; this.breathT = 2; this.twitch = 0;
    AudioSys.setMood('cabin', 1);

    this.bg = this.add.image(0, 0, 'an_room').setOrigin(0).setDepth(0);
    this.drips = this.add.image(0, 0, 'an_drips').setOrigin(0).setDepth(5).setAlpha(0);
    const mk = (tint?: number) => {
      const m = this.add.image(0, 0, 'an_monster').setOrigin(0.5, 0.115).setDepth(10).setVisible(false);
      if (tint !== undefined) m.setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(11);
      return m;
    };
    this.mon = mk(); this.ghostR = mk(0xff2020); this.ghostC = mk(0x20ffff);
    this.dark = this.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(20);
    this.lightImg = new Phaser.GameObjects.Image(this, 0, 0, 'light');
    const eye = () => this.add.image(0, 0, 'glow').setTint(0xff1010).setBlendMode(Phaser.BlendModes.ADD).setDepth(21).setVisible(false);
    this.eyeL = eye(); this.eyeR = eye();
    // things that watch from the parts of the room your light is not on
    this.watchers = [];
    for (let i = 0; i < 5; i++) {
      const x = Phaser.Math.Between(60, W - 60), y = Phaser.Math.Between(90, 400);
      const mkE = () => this.add.image(0, 0, 'glow').setTint(0xff1818).setBlendMode(Phaser.BlendModes.ADD).setDepth(21).setScale(0.07).setAlpha(0);
      this.watchers.push({ l: mkE(), r: mkE(), x, y, ph: Math.random() * 10 });
    }
    // subliminal frames
    this.subFace = this.add.image(W / 2, H / 2, 'an_face').setDepth(58).setVisible(false);
    this.sub = this.add.text(W / 2, H / 2, '', { fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '64px', color: '#b5121f', fontStyle: 'italic bold', align: 'center' }).setOrigin(0.5).setDepth(59).setVisible(false);
    this.face = this.add.image(W / 2, H / 2, 'an_face').setDepth(60).setVisible(false);
    this.flash = this.add.rectangle(0, 0, W, H, 0xff0000, 0).setOrigin(0).setDepth(70);

    // VHS layer
    this.add.tileSprite(0, 0, W, H, 'an_scan').setOrigin(0).setDepth(80).setAlpha(0.5);
    this.noise = this.add.tileSprite(0, 0, W, H, 'an_noise').setOrigin(0).setDepth(81).setAlpha(0.09).setBlendMode(Phaser.BlendModes.ADD);
    this.bar = this.add.tileSprite(0, 0, W, 34, 'an_noise').setOrigin(0).setDepth(82).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(0, 0, 'vignette').setOrigin(0).setScale(2).setDepth(83).setAlpha(0.8);
    this.cross = this.add.circle(0, 0, 9).setStrokeStyle(2, 0xffffff, 0.8).setDepth(88);
    this.add.text(26, 20, 'PLAY ▶', { fontFamily: VHS, fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setDepth(90).setAlpha(0.85);
    this.stamp = this.add.text(26, H - 40, '', { fontFamily: VHS, fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setDepth(90).setAlpha(0.85);
    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(90);
    this.hud = this.add.text(W - 26, 20, '', { fontFamily: VHS, fontSize: '18px', color: '#ffffff', fontStyle: 'bold', align: 'right' }).setOrigin(1, 0).setDepth(90).setAlpha(0.9);
    this.cap = this.add.text(W / 2, H - 92, '', {
      fontFamily: VHS, fontSize: '24px', color: '#ffffff', fontStyle: 'bold', align: 'center', stroke: '#000000', strokeThickness: 5, wordWrap: { width: W - 160 },
    }).setOrigin(0.5).setDepth(95);

    // subtle lens distortion where WebGL post effects exist
    try { (this.cameras.main as any).postFX?.addBarrel(1.04); } catch { /* canvas renderer */ }

    // touch / click buttons
    const btn = (x: number, label: string, fn: () => void) => {
      const b = this.add.text(x, H - 40, label, { fontFamily: VHS, fontSize: '18px', color: '#ffffff', fontStyle: 'bold', backgroundColor: '#00000099', padding: { x: 10, y: 8 } })
        .setOrigin(1, 0.5).setDepth(92).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => { this.uiHit = true; fn(); });
      return b;
    };
    this.isTouch = !!this.sys.game.device.input.touch || /[?&]touch=1/.test(location.search);
    btn(W - 26, this.isTouch ? 'RELOAD' : '[R] RELOAD', () => this.reload());
    btn(W - 190, this.isTouch ? 'HEAL' : '[H] HEAL', () => this.heal());
    if (this.isTouch) {
      // phones: drag anywhere to sweep the light (like a trackpad), press FIRE to shoot
      this.input.addPointer(2);
      const fb = this.add.circle(W - 100, H - 150, 62, 0xff3030, 0.22).setStrokeStyle(4, 0xff6060, 0.7).setDepth(92).setInteractive({ useHandCursor: true });
      this.add.text(W - 100, H - 150, 'FIRE', { fontFamily: VHS, fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(93);
      fb.on('pointerdown', () => { this.uiHit = true; fb.setFillStyle(0xff3030, 0.5); this.fire(); });
      fb.on('pointerup', () => fb.setFillStyle(0xff3030, 0.22));
      fb.on('pointerout', () => fb.setFillStyle(0xff3030, 0.22));
    }

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,F,R,H,ENTER') as any;
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) { this.aim.set(p.x, p.y); return; } // mouse: the light follows the cursor
      if (p.id !== this.dragId) return;
      this.aim.x = Phaser.Math.Clamp(this.aim.x + (p.x - this.dragLast.x) * 1.7, 0, W);
      this.aim.y = Phaser.Math.Clamp(this.aim.y + (p.y - this.dragLast.y) * 1.7, 0, H);
      this.dragLast.set(p.x, p.y);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.uiHit) { this.uiHit = false; return; }
      if (p.wasTouch) { this.dragId = p.id; this.dragLast.set(p.x, p.y); return; } // touch: drag aims, FIRE shoots
      this.aim.set(p.x, p.y); this.fire();
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.id === this.dragId) this.dragId = -1; });
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyF' || e.code === 'Enter') this.fire();
      else if (e.code === 'KeyR') this.reload();
      else if (e.code === 'KeyH') this.heal();
    });
    this.events.once('shutdown', () => {
      AudioSys.stopSpeech(); this.input.keyboard!.removeAllListeners(); this.input.removeAllListeners(); this.tweens.killAll();
      try { (this.cameras.main as any).postFX?.clear(); } catch { /* ignore */ }
    });

    this.cameras.main.fadeIn(900, 0, 0, 0);
    this.refreshHud();
    this.updateBossBar();
    void this.intro();
  }

  // ------------------------------------------------------------------ helpers
  private wait(ms: number) { return new Promise<void>((res) => this.time.delayedCall(ms, res)); }

  private async caption(text: string, hold = 2400, voice = false) {
    this.cap.setText(text.toUpperCase()).setColor(voice ? '#ff3030' : '#ffffff');
    if (voice) { AudioSys.speak(text); AudioSys.staticBurst(0.2, 0.2); }
    await this.wait(hold);
    this.cap.setText('');
  }

  private updateBossBar() {
    const barW = 200, barH = 16, x = 20, y = 20;
    const pct = Math.max(0, this.bossHp / BOSS_HP);
    this.bossBar.clear();
    this.bossBar.fillStyle(0x330000, 0.8);
    this.bossBar.fillRect(x, y, barW, barH);
    if (pct > 0.5) this.bossBar.fillStyle(0xff3030, 0.9);
    else if (pct > 0.25) this.bossBar.fillStyle(0xff6060, 0.9);
    else this.bossBar.fillStyle(0xff0000, 0.9);
    this.bossBar.fillRect(x, y, barW * pct, barH);
    this.bossBar.lineStyle(2, 0xff5555, 0.95);
    this.bossBar.strokeRect(x, y, barW, barH);
  }

  private refreshHud() {
    const shells = this.reloadT > 0 ? 'RELOADING...' : `SHELLS ${'●'.repeat(this.shells)}${'○'.repeat(2 - this.shells)}`;
    const aid = Game.has('firstaid') ? '\n[H] FIRST AID' : '';
    this.hud.setText(`${shells}\nHEALTH ${'█'.repeat(Math.max(0, this.hp))}${'░'.repeat(Math.max(0, Game.maxHp - this.hp))}${aid}`);
  }

  private shake(ms: number, amt: number) { this.cameras.main.shake(ms, Settings.get().shake ? amt : amt * 0.25); }

  // ------------------------------------------------------------------ intro
  private async intro() {
    const retry = !!this.registry.get('cabinRetry');
    await this.wait(900);
    if (!retry) {
      await this.caption('The door closes behind you.', 2200);
      await this.caption('Nicholas is still outside. You can hear him breathing through the wood.', 3200);
      await this.caption('A shotgun hangs on the wall. You take it.', 2600);
      AudioSys.click();
      await this.caption(this.isTouch ? 'Drag anywhere: move your light.   FIRE: shoot.   RELOAD when empty.' : 'Mouse / arrows: move your light.   Click / SPACE: fire.   R: reload.', 4200);
      await this.caption('It only shows itself in the light. Shoot it in the FACE before it reaches you.', 4000);
      AudioSys.staticBurst(0.5, 0.4);
      this.lightMul = 0; await this.wait(700); this.lightMul = 1;
      await this.caption(this.registry.get('answered') ? 'A... dam. You answered me.' : 'A... dam. You never answered me.', 3600, true);
    } else {
      await this.caption('Again.', 1400, true);
    }
    this.state = 'fight';
    this.hiddenT = 1.2;
  }

  // ------------------------------------------------------------------ the fight
  private get phase() { return this.bossHp > 6 ? 0 : this.bossHp > 3 ? 1 : 2; }

  private appear() {
    this.vis = true; this.stage = 0;
    this.spot = Phaser.Math.Between(0, 2);
    this.stepT = [1.4, 1.0, 0.7][this.phase]; // harder: faster stepping
    AudioSys.staticBurst(0.15, 0.2);
    if (Math.random() < 0.3) {
      AudioSys.speak(Phaser.Math.RND.pick(['Adam.', 'Look at me.', 'Nicholas is outside.', 'He is so quiet now.', 'Come home.', 'I can smell you.']));
    }
  }

  private advance() {
    this.stage++;
    AudioSys.staticBurst(0.2, 0.3);
    this.flash.setFillStyle(0xffffff, 0.22); this.tweens.add({ targets: this.flash, alpha: 0, duration: 90 });
    this.twitch = 0.12;
    AudioSys.heartbeat();
    if (this.stage > 2) { void this.attack(); return; }
    if (this.phase >= 1 && Math.random() < 0.5) this.spot = Phaser.Math.Between(0, 2);
    this.stepT = [1.4, 1.0, 0.7][this.phase]; // harder: faster stepping
  }

  private hide(delay: number) { this.vis = false; this.hiddenT = delay; }

  /** Full-screen face, shriek, red strobing. */
  private async jumpscare(ms = 750) {
    this.scareT = ms / 1000;
    this.face.setVisible(true).setScale(0.85).setAlpha(1);
    this.tweens.add({ targets: this.face, scale: 1.75, duration: ms, ease: 'Quad.easeOut' });
    AudioSys.scream(ms / 1000 + 0.2);
    this.shake(ms, 0.035);
    await this.wait(ms);
    this.face.setVisible(false); this.flash.setAlpha(0);
  }

  private async attack() {
    this.state = 'event';
    this.hide(99);
    await this.jumpscare();
    this.hp--;
    this.refreshHud();
    this.drips.setAlpha(Math.min(0.9, this.drips.alpha + 0.2));
    if (this.hp <= 0) { void this.die(); return; }
    await this.caption('It tears into you.', 1200);
    this.hide([1.4, 1.0, 0.6][this.phase]); // harder: reappear faster
    this.state = 'fight';
  }

  private headPos() {
    const s = SPOTS[this.spot];
    return { x: s.x, y: s.y + this.stage * 14, scale: STAGE_SCALE[Math.min(2, this.stage)] };
  }

  private reload() {
    if (this.state !== 'fight' && this.state !== 'event') return;
    if (this.reloadT > 0 || this.shells >= 2) return;
    this.reloadT = 1.15;
    AudioSys.click(); this.time.delayedCall(450, () => AudioSys.click()); this.time.delayedCall(950, () => AudioSys.tone(180, 0.08, 'square', 0.1));
    this.refreshHud();
  }

  private heal() {
    if (this.state !== 'fight' || !Game.has('firstaid') || this.hp >= Game.maxHp) return;
    this.hp = Math.min(Game.maxHp, this.hp + 2); Game.use('firstaid'); AudioSys.chime(0); this.refreshHud();
  }

  private fire() {
    if (this.state !== 'fight') return;
    if (this.reloadT > 0) return;
    if (this.shells <= 0) { AudioSys.click(); this.reload(); return; }
    this.shells--; this.muzzleT = 0.1;
    AudioSys.gunshot(); AudioSys.tone(70, 0.3, 'sawtooth', 0.4, 'sfx', 0, 30);
    this.shake(160, 0.012);
    this.refreshHud();
    if (!this.vis) return;
    const h = this.headPos();
    const d = Phaser.Math.Distance.Between(this.aim.x, this.aim.y, h.x, h.y);
    if (d < HEAD_R * h.scale * 0.95 + 12) {
      this.bossHp--;
      this.gore(h.x, h.y, 1.4 * h.scale + 0.5);
      AudioSys.scream(0.35);
      this.flash.setFillStyle(0xffffff, 0.5); this.tweens.add({ targets: this.flash, alpha: 0, duration: 200 });
      this.hide([1.2, 0.8, 0.5][this.phase]); // harder: much shorter recovery after hit
      if (this.bossHp <= 0) { void this.win(); return; }
    this.updateBossBar();
      if ((this.bossHp === 4 || this.bossHp === 2) && !this.eventsDone.has(this.bossHp)) void this.phaseEvent(this.bossHp);
    } else if (Math.abs(this.aim.x - h.x) < 130 * h.scale && this.aim.y > h.y && this.aim.y < h.y + 760 * h.scale) {
      // body shot: it staggers back a step, but is not hurt
      this.gore(this.aim.x, this.aim.y, 0.5);
      this.stage = Math.max(0, this.stage - 1);
      this.stepT = [1.7, 1.3, 1.0][this.phase];
      AudioSys.staticBurst(0.15, 0.25);
    }
  }

  private gore(x: number, y: number, scale: number) {
    const g = this.add.image(x, y, 'an_gore').setDepth(12).setScale(scale * 0.4).setAngle(Phaser.Math.Between(0, 360));
    this.tweens.add({ targets: g, scale, duration: 160, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: g, alpha: 0, y: y + 60, delay: 500, duration: 1400, onComplete: () => g.destroy() });
  }

  private async phaseEvent(at: number) {
    this.eventsDone.add(at);
    this.state = 'event';
    this.hide(99);
    AudioSys.staticBurst(0.6, 0.5);
    this.lightMul = 0;
    await this.wait(900);
    this.tweens.add({ targets: this.drips, alpha: at === 6 ? 0.5 : 0.95, duration: 2500 });
    if (at === 6) {
      await this.caption('Do you know what I did to the others.', 3600, true);
      await this.caption('The walls are bleeding.', 1800);
    } else {
      await this.caption('He called your name. At the end.', 3400, true);
      await this.wait(400);
      await this.jumpscare(450); // it is right in front of the lens
      await this.caption('It is faster now.', 1500);
    }
    this.lightMul = 1;
    this.hide(0.9);
    this.state = 'fight';
  }

  private async die() {
    this.state = 'dead';
    AudioSys.setMood('none', 0.2);
    AudioSys.staticBurst(1.5, 0.5);
    this.noise.setAlpha(1).setBlendMode(Phaser.BlendModes.NORMAL);
    this.cap.setText('SIGNAL LOST').setColor('#ffffff');
    await this.wait(1600);
    this.cap.setText('SIGNAL LOST\n\nPRESS ANY KEY / TAP TO REWIND');
    const go = () => { this.registry.set('cabinRetry', true); this.scene.restart(); };
    this.input.keyboard!.once('keydown', go);
    this.input.once('pointerdown', go);
  }

  private async win() {
    this.state = 'event';
    this.vis = true; this.spot = 1; this.stage = 2;
    AudioSys.setMood('none', 0.5);
    for (let i = 0; i < 6; i++) {
      const h = this.headPos();
      this.gore(h.x + Phaser.Math.Between(-90, 90), h.y + Phaser.Math.Between(-40, 260), 0.8 + Math.random());
      AudioSys.scream(0.25); this.shake(200, 0.02);
      this.flash.setFillStyle(i % 2 ? 0xff0000 : 0xffffff, 0.45); this.tweens.add({ targets: this.flash, alpha: 0, duration: 150 });
      await this.wait(260);
    }
    await this.caption('Only... one... leaves.', 3200, true);
    AudioSys.scream(1.1); this.shake(900, 0.04);
    for (let i = 0; i < 14; i++) this.gore(Phaser.Math.Between(250, 740), Phaser.Math.Between(120, 460), 1 + Math.random() * 1.6);
    this.vis = false;
    this.tweens.add({ targets: this.drips, alpha: 1, duration: 600 });
    await this.wait(1500);
    AudioSys.staticBurst(0.8, 0.4);
    await this.caption('It comes apart.', 2200);
    await this.caption('The door is open.', 2200);
    await this.leave();
  }

  // ------------------------------------------------------------------ leaving
  /** The tape ends. Outside, the world is pixel art again. */
  private async leave() {
    this.state = 'end';
    this.flash.setFillStyle(0x000000, 0); this.tweens.add({ targets: this.flash, alpha: 1, duration: 900 });
    AudioSys.staticBurst(1.0, 0.4);
    await this.wait(1100);
    this.cross.setVisible(false);
    this.cap.setY(H / 2).setColor('#ffffff').setText('STOP ■');
    await this.wait(1600);
    this.registry.set('cabinRetry', false);
    this.scene.start('Aftermath');
  }

  // ------------------------------------------------------------------ frame
  update(_time: number, dtMs: number) {
    const dt = Math.min(dtMs, 50) / 1000;
    this.t += dt;

    // tape artefacts
    this.noise.setTilePosition(Math.random() * 256, Math.random() * 256);
    this.bar.setTilePosition(Math.random() * 256, Math.random() * 256);
    this.bar.y = (this.t * 70) % (H + 80) - 40;
    const sec = Math.floor(this.t);
    this.stamp.setText(`OCT 11 2026   03:${String(13 + Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')} AM`);
    if (Math.random() < 0.02) this.cameras.main.setScroll(Phaser.Math.Between(-3, 3), Phaser.Math.Between(-1, 1));
    else if (Math.random() < 0.2) this.cameras.main.setScroll(0, 0);

    // aim with keys too
    if (this.state === 'fight') {
      const k = this.keys;
      const ax = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
      const ay = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
      this.aim.x = Phaser.Math.Clamp(this.aim.x + ax * 620 * dt, 0, W);
      this.aim.y = Phaser.Math.Clamp(this.aim.y + ay * 620 * dt, 0, H);
    }
    this.cross.setPosition(this.aim.x, this.aim.y);

    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { this.shells = 2; this.refreshHud(); } }
    if (this.muzzleT > 0) this.muzzleT -= dt;

    // the room breathes
    this.bg.setScale(1.02 + Math.sin(this.t * 0.7) * 0.012).setPosition(-10 + Math.sin(this.t * 0.31) * 4, -6);
    this.breathT -= dt;
    if (this.breathT <= 0 && (this.state === 'fight' || this.state === 'event')) {
      this.breathT = 2.6 - this.phase * 0.5;
      AudioSys.noise(0.9, 'bandpass', 420, 0.07 + this.phase * 0.03, 1.2);
    }
    // watchers in the dark: they vanish the moment your light finds them
    for (const wv of this.watchers) {
      const lit = Phaser.Math.Distance.Between(wv.x, wv.y, this.aim.x, this.aim.y) < 170;
      const open = Math.sin(this.t * 0.5 + wv.ph) > 0.2 && this.state === 'fight';
      const al = lit || !open ? 0 : 0.55 + Math.random() * 0.25;
      wv.l.setPosition(wv.x - 7, wv.y).setAlpha(al); wv.r.setPosition(wv.x + 7, wv.y).setAlpha(al);
      if (lit && open) { wv.x = Phaser.Math.Between(60, W - 60); wv.y = Phaser.Math.Between(90, 400); wv.ph = -this.t * 0.5 - 1.2; }
    }
    // subliminal frames: a face, or a sentence, for a blink
    if (this.state === 'fight') {
      this.subT -= dt;
      if (this.subT <= 0) {
        this.subT = Phaser.Math.FloatBetween(4, 9) - this.phase;
        if (Math.random() < 0.5) {
          this.subFace.setVisible(true).setAlpha(0.3).setScale(Phaser.Math.FloatBetween(0.7, 1.4)).setPosition(Phaser.Math.Between(200, 760), Phaser.Math.Between(160, 380));
        } else {
          this.sub.setVisible(true).setText(Phaser.Math.RND.pick(['BEHIND YOU', "DON'T ANSWER", 'LOOK AT ME', 'HE IS SCREAMING', 'ADAM', 'IT IS IN THE ROOM', 'COME HOME']))
            .setPosition(Phaser.Math.Between(260, 700), Phaser.Math.Between(150, 380)).setAngle(Phaser.Math.Between(-10, 10));
        }
        AudioSys.staticBurst(0.08, 0.18);
        this.time.delayedCall(90, () => { this.subFace.setVisible(false); this.sub.setVisible(false); });
        if (this.phase >= 1 && Math.random() < 0.5) { this.lightMul = 0; this.time.delayedCall(140, () => { if (this.state === 'fight') this.lightMul = 1; }); }
      }
    }
    // monster brain
    if (this.state === 'fight') {
      if (!this.vis) { this.hiddenT -= dt; if (this.hiddenT <= 0) { this.appear(); if (Math.random() < 0.6) AudioSys.creature(0.6, 0.8 + Math.random() * 0.4); } }
      else { this.stepT -= dt; if (this.stepT <= 0) { this.advance(); } }
    }
    // monster sprite
    const show = this.vis && (this.state === 'fight' || this.state === 'event');
    this.mon.setVisible(show); this.ghostR.setVisible(show); this.ghostC.setVisible(show);
    this.eyeL.setVisible(show); this.eyeR.setVisible(show);
    if (show) {
      const h = this.headPos();
      const jx = (Math.random() - 0.5) * 4, jy = (Math.random() - 0.5) * 3;
      const sway = Math.sin(this.t * 2.3) * 6 * h.scale;
      // it does not move like a person: it snaps between poses
      if (this.twitch > 0) this.twitch -= dt; else if (Math.random() < 0.035 + this.phase * 0.02) this.twitch = 0.07;
      const tw = this.twitch > 0;
      const ang = tw ? Phaser.Math.Between(-16, 16) : Math.sin(this.t * 1.7) * 2;
      const sxm = tw ? h.scale * Phaser.Math.FloatBetween(0.9, 1.18) : h.scale;
      const tremble = this.stage >= 2 ? 3 : 1;
      this.mon.setPosition(h.x + jx * tremble + sway, h.y + jy * tremble).setScale(sxm, h.scale * (tw ? 1.06 : 1)).setAngle(ang);
      const gap = tw ? 26 : 5;
      this.ghostR.setPosition(h.x + sway + gap + jx * 2, h.y).setScale(h.scale).setAngle(ang * 0.5);
      this.ghostC.setPosition(h.x + sway - gap - jx * 2, h.y + 1).setScale(h.scale).setAngle(-ang * 0.5);
      const ex = HEAD_R * 0.3 * h.scale, ey = -HEAD_R * 0.2 * h.scale;
      const es = 0.12 + h.scale * 0.35;
      this.eyeL.setPosition(h.x + sway - ex, h.y + ey).setScale(es).setAlpha(0.5 + Math.random() * 0.3);
      this.eyeR.setPosition(h.x + sway + ex, h.y + ey).setScale(es).setAlpha(0.5 + Math.random() * 0.3);
    }

    // jumpscare strobe
    if (this.scareT > 0) {
      this.scareT -= dt;
      this.face.setPosition(W / 2 + Phaser.Math.Between(-16, 16), H / 2 + Phaser.Math.Between(-12, 12)).setAngle(Phaser.Math.Between(-4, 4));
      this.flash.setFillStyle(0xff0000, Math.random() < 0.5 ? 0.45 : 0);
    }

    // darkness + the cone of your light
    const dk = this.dark;
    dk.clear();
    if (this.scareT > 0) return; // the face is lit by nothing; it is simply there
    dk.fill(0x000000, 0.965);
    const base = Game.flashlightLit ? 470 : 310;
    const flick = 0.96 + Math.random() * 0.08;
    const size = this.muzzleT > 0 ? 1500 : base * flick * this.lightMul;
    if (size > 4) { this.lightImg.setPosition(this.aim.x, this.aim.y).setScale(size / 512); dk.erase(this.lightImg); }

  }
}
