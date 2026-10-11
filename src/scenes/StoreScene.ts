import Phaser from 'phaser';
import { COL, EMOJI, FONT, H, W } from '../config';
import { AudioSys } from '../systems/AudioSys';
import { DialogueBox } from '../systems/Dialogue';
import { BUDGET, Game, ITEMS } from '../systems/GameState';

const COLS = 5;
const CW = 172, CH = 98, GX = 14, GY = 12;
const X0 = (W - (COLS * CW + (COLS - 1) * GX)) / 2;
const Y0 = 118;

/** Corner Mart: spend a $40 budget on what you think is essential. */
export class StoreScene extends Phaser.Scene {
  private dlg!: DialogueBox;
  private cards: Array<{ box: Phaser.GameObjects.Rectangle; tick: Phaser.GameObjects.Text; id: string }> = [];
  private sel = 0;
  private budgetTxt!: Phaser.GameObjects.Text;
  private descTxt!: Phaser.GameObjects.Text;
  private msgTxt!: Phaser.GameObjects.Text;
  private checkoutBtn!: Phaser.GameObjects.Text;
  private done = false;

  constructor() { super('Store'); }

  create() {
    this.cards = []; this.sel = 0; this.done = false;
    Game.inv.clear();
    AudioSys.setMood('golden', 1);
    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.drawShop();

    this.add.text(W / 2, 28, 'CORNER MART', { fontFamily: FONT, fontSize: '26px', color: '#ffd23f', stroke: '#2b1740', strokeThickness: 7 }).setOrigin(0.5).setDepth(10);
    this.budgetTxt = this.add.text(W / 2, 74, '', { fontFamily: FONT, fontSize: '18px', color: '#ffffff', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(10);

    ITEMS.forEach((it, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const x = X0 + col * (CW + GX), y = Y0 + row * (CH + GY);
      const box = this.add.rectangle(x, y, CW, CH, 0x1a1030, 0.92).setOrigin(0).setStrokeStyle(3, 0x6a5ca0).setDepth(10).setInteractive({ useHandCursor: true });
      // the gun emoji renders as a toy on most systems, so the pistol uses the game's own sprite
      if (it.id === 'pistol') this.add.image(x + 34, y + 30, 'gun').setScale(4).setDepth(11);
      else this.add.text(x + 12, y + 8, it.icon, { fontFamily: EMOJI, fontSize: '34px' }).setDepth(11);
      this.add.text(x + 12, y + 56, it.name, { fontFamily: FONT, fontSize: '10px', color: '#ffffff' }).setDepth(11);
      this.add.text(x + CW - 10, y + 12, `$${it.price}`, { fontFamily: FONT, fontSize: '16px', color: '#9be37a' }).setOrigin(1, 0).setDepth(11);
      const tick = this.add.text(x + CW - 10, y + CH - 12, '', { fontFamily: FONT, fontSize: '12px', color: '#ffd23f' }).setOrigin(1, 1).setDepth(11);
      box.on('pointerover', () => { this.sel = i; this.refresh(); });
      box.on('pointerdown', () => { this.sel = i; this.toggle(i); });
      this.cards.push({ box, tick, id: it.id });
    });

    this.descTxt = this.add.text(W / 2, 462, '', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', align: 'center', wordWrap: { width: W - 40 }, lineSpacing: 6 }).setOrigin(0.5).setDepth(10);
    this.msgTxt = this.add.text(W / 2, 488, '', { fontFamily: FONT, fontSize: '11px', color: '#ff8a8a' }).setOrigin(0.5).setDepth(10);
    this.checkoutBtn = this.add.text(W / 2, 516, '[ CHECKOUT ]', {
      fontFamily: FONT, fontSize: '18px', color: '#ffffff', backgroundColor: '#2b6a3a', padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true });
    this.checkoutBtn.on('pointerdown', () => void this.checkout());

    this.dlg = new DialogueBox(this);

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.move(-1)); kb.on('keydown-A', () => this.move(-1));
    kb.on('keydown-RIGHT', () => this.move(1)); kb.on('keydown-D', () => this.move(1));
    kb.on('keydown-UP', () => this.move(-COLS)); kb.on('keydown-W', () => this.move(-COLS));
    kb.on('keydown-DOWN', () => this.move(COLS)); kb.on('keydown-S', () => this.move(COLS));
    ['SPACE', 'ENTER', 'Z', 'E'].forEach((k) => kb.on(`keydown-${k}`, () => { if (!this.dlg.active && !this.done) this.toggle(this.sel); }));
    kb.on('keydown-C', () => { if (!this.dlg.active) void this.checkout(); });
    this.refresh();

    this.time.delayedCall(700, () => void this.dlg.say([
      { text: 'You have $40. Pick what you think you really need, then CHECKOUT.' },
      { text: '(Arrows move. Enter / tap buys or puts back. C or the button checks out.)' },
    ]));
  }

  private drawShop() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x2b2548).fillRect(0, 0, W, H);
    g.fillStyle(0x3a3260).fillRect(0, 0, W, 100);
    for (let x = 0; x < W; x += 60) g.fillStyle(0x4a4078).fillRect(x, 0, 30, 100);
    g.fillStyle(0x1c1634).fillRect(0, 100, W, H - 100);
    const glow = this.add.rectangle(0, 0, W, H, 0xffd23f, 0.05).setOrigin(0).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.02, duration: 600, yoyo: true, repeat: -1 });
  }

  private move(d: number) {
    if (this.dlg.active || this.done) return;
    const n = Phaser.Math.Clamp(this.sel + d, 0, ITEMS.length - 1);
    if (n !== this.sel) { this.sel = n; AudioSys.move(); this.refresh(); }
  }

  private spent() { return [...Game.inv].reduce((s, id) => s + (ITEMS.find((i) => i.id === id)?.price ?? 0), 0); }

  private toggle(i: number) {
    if (this.done) return;
    const it = ITEMS[i];
    if (Game.inv.has(it.id)) { Game.inv.delete(it.id); AudioSys.move(); this.msgTxt.setText(''); }
    else if (this.spent() + it.price > BUDGET) {
      AudioSys.tone(120, 0.2, 'square', 0.08); this.msgTxt.setText(`Not enough money for ${it.name}!`);
      this.cameras.main.shake(120, 0.003);
    } else { Game.inv.add(it.id); AudioSys.chime(1); this.msgTxt.setText(''); }
    this.refresh();
  }

  private refresh() {
    const spent = this.spent();
    this.budgetTxt.setText(`BUDGET  $${BUDGET - spent} left   (spent $${spent})`).setColor(BUDGET - spent < 5 ? '#ff8a8a' : '#ffffff');
    this.cards.forEach((c, i) => {
      const owned = Game.inv.has(c.id);
      const afford = spent + ITEMS[i].price <= BUDGET;
      c.box.setFillStyle(owned ? 0x1f4a2a : 0x1a1030, 0.92)
        .setStrokeStyle(i === this.sel ? 5 : 3, i === this.sel ? 0xffd23f : owned ? 0x5fd070 : afford ? 0x6a5ca0 : 0x5a2a3a);
      c.tick.setText(owned ? 'IN BAG' : '');
    });
    this.descTxt.setText(ITEMS[this.sel].desc);
  }

  private async checkout() {
    if (this.done || this.dlg.active) return;
    this.done = true;
    AudioSys.select();
    const spent = this.spent();
    const d = this.dlg;
    await d.say([
      { who: 'Cashier', text: `That's $${spent}. Going somewhere?` },
      { who: 'Adam', text: 'Just the forest past the quarry.' },
      { who: 'Cashier', text: '...' },
      { who: 'Cashier', text: "Be back before dark. They say things get strange out there after sundown." },
      { who: 'Adam', text: '(Probably just a story to scare kids.)' },
    ]);
    // Nicholas reacts to the haul
    const inv = Game.inv;
    const lines: Array<{ who: 'Nicholas' | 'Adam'; text: string }> = [{ who: 'Nicholas', text: 'Let me see the bag.' }];
    const essentials = ITEMS.filter((i) => i.essential && inv.has(i.id)).length;
    if (inv.has('flashlight')) lines.push({ who: 'Nicholas', text: 'A flashlight. Smart. My phone battery is at 40%.' });
    else lines.push({ who: 'Nicholas', text: "No flashlight? We're using our phones? ...Okay. Okay." });
    if (inv.has('flashlight') && !inv.has('batteries')) lines.push({ who: 'Nicholas', text: "Does that thing even come with batteries? ...It doesn't, does it." });
    if (inv.has('pistol')) lines.push({ who: 'Nicholas', text: 'Is that a GUN? Adam. What do you think is out there? ...Keep it. Just keep it pointed away from me.' });
    if (inv.has('firstaid')) lines.push({ who: 'Nicholas', text: 'A first aid kit. You are so responsible. It scares me.' });
    if (inv.has('map')) lines.push({ who: 'Nicholas', text: 'A map! You can read a map now? Wait. Can you?' });
    if (inv.has('speaker')) lines.push({ who: 'Nicholas', text: 'A speaker. ...In a forest. You want to announce ourselves to the whole forest.' });
    if (inv.has('headphones')) lines.push({ who: 'Nicholas', text: "Headphones? Adam. Whose side are you on? We'll want to HEAR things out there." });
    if (inv.has('shades')) lines.push({ who: 'Nicholas', text: "Sunglasses. For a forest. At sunset. Bold choice." });
    if (inv.has('comic')) lines.push({ who: 'Nicholas', text: 'A comic book. We have a long walk and you brought reading material. Okay.' });
    if (inv.has('candy') || inv.has('soda')) lines.push({ who: 'Nicholas', text: 'Candy and soda. A balanced forest diet.' });
    if (essentials === 0) lines.push({ who: 'Nicholas', text: "You bought... nothing useful. Adam. I said think about it." });
    else if (essentials >= 5) lines.push({ who: 'Nicholas', text: "You're better prepared than I am. Good." });
    lines.push({ who: 'Nicholas', text: "Alright. Let's go. The sun's already getting low." });
    await d.say(lines);
    Game.initCounts();
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Intro'));
    void COL;
  }
}
