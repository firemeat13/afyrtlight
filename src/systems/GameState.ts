export interface Item {
  id: string; name: string; price: number; icon: string; essential: boolean; desc: string;
}

export const BUDGET = 40;

/** Essentials are worth more than $40 combined - you have to choose. Junk is tempting but useless (or harmful). */
export const ITEMS: Item[] = [
  { id: 'flashlight', name: 'FLASHLIGHT', price: 12, icon: '🔦', essential: true, desc: 'USABLE: toggle a real beam of light (key L). Drains its battery while on.' },
  { id: 'batteries', name: 'BATTERIES', price: 5, icon: '🔋', essential: true, desc: 'USABLE: fully recharge your flashlight when it runs low.' },
  { id: 'firstaid', name: 'FIRST AID', price: 9, icon: '🩹', essential: true, desc: 'USABLE: heal 2 hearts, or bandage a bleeding friend. Also +1 max heart.' },
  { id: 'water', name: 'WATER', price: 3, icon: '💧', essential: true, desc: 'USABLE x2: instantly refill your sprint stamina. Bigger stamina bar.' },
  { id: 'snacks', name: 'TRAIL MIX', price: 4, icon: '🥜', essential: true, desc: 'USABLE: restores a heart and some stamina. Bigger stamina bar.' },
  { id: 'lighter', name: 'LIGHTER', price: 4, icon: '🔥', essential: true, desc: 'USABLE x3: a flame for 28s that the Hollow Man will not cross.' },
  { id: 'map', name: 'TRAIL MAP', price: 6, icon: '🗺️', essential: true, desc: 'USABLE: toggle an arrow pointing to your objective.' },
  { id: 'pistol', name: 'PISTOL', price: 16, icon: '🔫', essential: true, desc: 'USABLE: a revolver with 6 rounds (key F). Four hits stop the thing in the woods.' },
  { id: 'candy', name: 'CANDY', price: 3, icon: '🍬', essential: false, desc: 'A sugar rush: you run faster for 10 seconds. Short-lived.' },
  { id: 'soda', name: 'SODA', price: 3, icon: '🥤', essential: false, desc: 'A little stamina and a short burst of speed.' },
  { id: 'comic', name: 'COMIC BOOK', price: 7, icon: '📖', essential: false, desc: 'Issue #214. Fun. Not exactly survival gear.' },
  { id: 'shades', name: 'SUNGLASSES', price: 8, icon: '🕶️', essential: false, desc: 'Cool. Very cool. Wearing them at night is... not smart.' },
  { id: 'headphones', name: 'HEADPHONES', price: 14, icon: '🎧', essential: false, desc: 'Noise cancelling. You will not hear anything coming.' },
  { id: 'speaker', name: 'BT SPEAKER', price: 15, icon: '🔊', essential: false, desc: 'Music in the woods! Surely nothing will hear it.' },
];

class GameStateImpl {
  inv = new Set<string>();
  /** What you walked out of the store with (for permanent bonuses). */
  bought = new Set<string>();
  counts: Record<string, number> = {};
  spent = 0;
  // usable-item state (persists across parts)
  flashOn = true;
  charge = 55; // flashlight battery %
  wearShades = false;
  muffled = false;
  mapOn = true;
  // the gun
  hasGun = false;
  ammo = 0;
  readonly maxAmmo = 18;

  reset() {
    this.inv.clear(); this.bought.clear(); this.counts = {}; this.spent = 0;
    this.flashOn = true; this.charge = 55; this.wearShades = false; this.muffled = false; this.mapOn = true;
    this.hasGun = false; this.ammo = 0;
  }
  /** Called at checkout: how many uses each purchased item has. */
  initCounts() {
    this.counts = {};
    this.bought = new Set(this.inv);
    this.inv.forEach((id) => { this.counts[id] = id === 'lighter' ? 3 : id === 'water' ? 2 : 1; });
    this.hasGun = this.inv.has('pistol'); this.ammo = this.hasGun ? 6 : 0;
    this.flashOn = true; this.charge = 55; this.wearShades = false; this.muffled = false; this.mapOn = true;
  }
  has(id: string) { return this.inv.has(id); }
  /** Consume one use; removes the item when empty. */
  use(id: string) {
    this.counts[id] = (this.counts[id] ?? 1) - 1;
    if (this.counts[id] <= 0) this.inv.delete(id);
  }
  get flashlightLit() { return this.has('flashlight') && this.flashOn && this.charge > 0; }
  /** Light diameter (px) around Adam at night. */
  get lightSize(): number {
    let d = this.flashlightLit ? 600 : 340;
    if (this.wearShades) d *= 0.8;
    return d;
  }
  get maxHp() { return 3 + (this.bought.has('firstaid') ? 1 : 0); }
  get maxStamina() { return 100 + (this.bought.has('water') ? 45 : 0) + (this.bought.has('snacks') ? 30 : 0); }
}

export const Game = new GameStateImpl();
