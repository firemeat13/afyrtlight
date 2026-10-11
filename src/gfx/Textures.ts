import Phaser from 'phaser';
import { disc, line, outline, radial, rect, rng, Rng, vgrad } from './draw';
import { makeExtras } from './extras';

/**
 * ALL placeholder art is generated here, keyed by texture name.
 * To swap in real pixel art later: load images in BootScene.preload() using the
 * same keys (and skip the matching generator below). Nothing else needs to change.
 *
 * Keys: adam, nicholas (frames 0-3), tree_{day|night}_{0-2}, bush_*, rock_*, tuft_*,
 * flower_{gold|red|blue}, flower_dead, sign_{day|night}, carve_{day|night},
 * sky_{day|golden|night}, far_*, mid_*, fg_*, ground_*, light, glow, fogblob, eyes, ...
 */

type DrawFn = (c: CanvasRenderingContext2D, w: number, h: number) => void;

function make(scene: Phaser.Scene, key: string, w: number, h: number, fn: DrawFn): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, w, h)!;
  const c = t.getContext();
  c.imageSmoothingEnabled = false;
  fn(c, w, h);
  t.refresh();
  t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return t;
}

const OUT: [number, number, number, number] = [18, 10, 24, 255];
const OUT_NIGHT: [number, number, number, number] = [4, 2, 12, 255];

// ------------------------------------------------------------------ characters
interface CharPal { skin: string; hair: string; hair2: string; top: string; top2: string; pants: string; shoe: string; pack?: string; glasses?: boolean; hood?: boolean }

function drawChar(c: CanvasRenderingContext2D, ox: number, f: number, p: CharPal) {
  const bob = f === 1 || f === 3 ? -1 : 0;
  const legs = [[0, 0], [2, -2], [0, 0], [-2, 2]][f];
  const arm = [0, -1, 0, 1][f];
  // backpack
  if (p.pack) { rect(c, ox + 2, 10 + bob, 3, 7, p.pack); rect(c, ox + 2, 10 + bob, 3, 1, '#00000033'); }
  // back leg
  rect(c, ox + 5 + legs[1], 17, 2, 5, p.pants); rect(c, ox + 5 + legs[1], 22, 3, 2, p.shoe);
  // torso
  rect(c, ox + 4, 9 + bob, 7, 8, p.top);
  rect(c, ox + 4, 15 + bob, 7, 2, p.top2);
  if (p.hood) { rect(c, ox + 3, 8 + bob, 3, 3, p.top2); }
  // front leg
  rect(c, ox + 8 + legs[0], 17, 2, 5, p.pants); rect(c, ox + 8 + legs[0], 22, 4, 2, p.shoe);
  // arm
  rect(c, ox + 6 + arm, 10 + bob, 2, 6, p.top2); rect(c, ox + 6 + arm, 15 + bob, 2, 1, p.skin);
  // head
  rect(c, ox + 5, 3 + bob, 6, 6, p.skin);
  rect(c, ox + 4, 2 + bob, 7, 3, p.hair); rect(c, ox + 4, 4 + bob, 2, 4, p.hair); rect(c, ox + 9, 2 + bob, 3, 2, p.hair2);
  rect(c, ox + 9, 6 + bob, 1, 2, '#1b1020');
  if (p.glasses) { rect(c, ox + 8, 5 + bob, 3, 1, '#2b2b3a'); rect(c, ox + 8, 6 + bob, 1, 2, '#2b2b3a'); }
  rect(c, ox + 10, 8 + bob, 1, 1, '#00000022');
}

function makeChar(scene: Phaser.Scene, key: string, p: CharPal) {
  const t = make(scene, key, 16 * 4, 24, (c) => {
    for (let f = 0; f < 4; f++) drawChar(c, f * 16, f, p);
    for (let f = 0; f < 4; f++) {
      const img = c.getImageData(f * 16, 0, 16, 24);
      const tmp = document.createElement('canvas'); tmp.width = 16; tmp.height = 24;
      const tc = tmp.getContext('2d')!; tc.putImageData(img, 0, 0); outline(tc, 16, 24, OUT);
      c.clearRect(f * 16, 0, 16, 24); c.drawImage(tmp, f * 16, 0);
    }
  });
  for (let f = 0; f < 4; f++) t.add(f, 0, f * 16, 0, 16, 24);
}

// ------------------------------------------------------------------ trees
function canopy(c: CanvasRenderingContext2D, r: Rng, cx: number, cy: number, rad: number, cols: string[]) {
  disc(c, cx, cy, rad, cols[0]);
  disc(c, cx - 1, cy - 2, Math.round(rad * 0.82), cols[1]);
  disc(c, cx - 3, cy - 4, Math.round(rad * 0.5), cols[2]);
  for (let i = 0; i < rad * 3; i++) {
    const a = r() * Math.PI * 2, d = r() * rad;
    rect(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2, 1, r() < 0.5 ? cols[2] : cols[0]);
  }
}

function drawTreeDay(c: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = rng(seed);
  const tx = w / 2 - 4;
  const trunkTop = Math.floor(h * 0.42);
  rect(c, tx, trunkTop, 8, h - trunkTop, '#6b4428');
  rect(c, tx, trunkTop, 3, h - trunkTop, '#8a5a36');
  rect(c, tx + 6, trunkTop, 2, h - trunkTop, '#4a2e1c');
  rect(c, tx - 3, h - 5, 14, 5, '#6b4428'); rect(c, tx - 5, h - 2, 18, 2, '#4a2e1c');
  for (let i = 0; i < 6; i++) rect(c, tx + 1 + r() * 5, trunkTop + r() * (h - trunkTop - 8), 1, 3, '#4a2e1c');
  // branch stubs
  line(c, tx + 7, trunkTop + 6, tx + 14, trunkTop - 2, '#6b4428', 2);
  const cols = ['#2e7d32', '#43a047', '#7bd063'];
  const rad = Math.floor(w * 0.22);
  canopy(c, r, w / 2, trunkTop - 4, rad + 4, ['#256b2a', '#378c3b', '#62bf50']);
  canopy(c, r, w / 2 - rad, trunkTop + 6, rad - 2, cols);
  canopy(c, r, w / 2 + rad, trunkTop + 4, rad - 2, cols);
  canopy(c, r, w / 2 - 4, trunkTop - rad, rad, ['#2e7d32', '#4caf50', '#8fe36a']);
  // sunlit leaf speckles + pink blossoms
  for (let i = 0; i < 14; i++) rect(c, w / 2 - rad * 1.6 + r() * rad * 3.2, trunkTop - rad * 1.5 + r() * rad * 2.6, 2, 2, r() < 0.5 ? '#b5f27a' : '#ffe27a');
  outline(c, w, h, OUT);
}

function drawTreeNight(c: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = rng(seed);
  const tx = w / 2 - 4;
  const trunkTop = Math.floor(h * 0.3);
  rect(c, tx, trunkTop, 8, h - trunkTop, '#251a38');
  rect(c, tx, trunkTop, 2, h - trunkTop, '#3a2a55');
  rect(c, tx - 3, h - 5, 14, 5, '#251a38'); rect(c, tx - 6, h - 2, 20, 2, '#150e24');
  // gnarled branches
  const bx = w / 2, by = trunkTop + 4;
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 ? 1 : -1;
    let x = bx + dir * 2, y = by + i * 5;
    for (let s = 0; s < 4; s++) {
      const nx = x + dir * (4 + r() * 6), ny = y - 3 - r() * 8;
      line(c, x, y, nx, ny, '#1d1330', Math.max(1, 3 - s));
      if (s > 1 && r() < 0.7) line(c, nx, ny, nx + dir * 5, ny - 6, '#1d1330', 1);
      x = nx; y = ny;
    }
  }
  // sparse, sickly foliage
  for (let i = 0; i < 20; i++) disc(c, w / 2 + (r() - 0.5) * w * 0.8, trunkTop - 6 + (r() - 0.5) * 36, 2 + Math.floor(r() * 3), r() < 0.5 ? '#1a1530' : '#2a2148');
  // knot-hole that looks slightly like a face
  rect(c, tx + 2, trunkTop + 20, 2, 3, '#05030c'); rect(c, tx + 5, trunkTop + 20, 2, 3, '#05030c'); rect(c, tx + 3, trunkTop + 26, 3, 2, '#05030c');
  outline(c, w, h, OUT_NIGHT);
}

// ------------------------------------------------------------------ backdrops
function ridge(c: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, color: string, seed: number, tall = false) {
  const r = rng(seed);
  const ph = [r() * 6, r() * 6, r() * 6];
  c.fillStyle = color;
  for (let x = 0; x < w; x++) {
    const a = (x / w) * Math.PI * 2;
    const y = base + Math.sin(a * 2 + ph[0]) * amp + Math.sin(a * 5 + ph[1]) * amp * 0.5 + Math.sin(a * 11 + ph[2]) * amp * 0.2;
    c.fillRect(x, Math.round(y), 1, h);
  }
  // pine silhouettes (wrap-safe)
  const n = 34;
  for (let i = 0; i < n; i++) {
    const x = (i / n) * w + r() * 10;
    const a = (x / w) * Math.PI * 2;
    const y = base + Math.sin(a * 2 + ph[0]) * amp + Math.sin(a * 5 + ph[1]) * amp * 0.5 + Math.sin(a * 11 + ph[2]) * amp * 0.2;
    const th = (tall ? 38 : 22) + r() * 22;
    for (const ox of [0, -w, w]) {
      for (let k = 0; k < th; k += 2) {
        const half = Math.floor((k / th) * 7 + 1);
        c.fillRect(Math.round(x + ox - half), Math.round(y - th + k), half * 2, 2);
      }
    }
  }
}

function makeSky(scene: Phaser.Scene, key: string, stops: Array<[number, string]>, stars = false) {
  make(scene, key, 4, 540, (c, w, h) => vgrad(c, w, h, stops));
  if (stars) {
    make(scene, key, 960, 540, (c, w, h) => {
      vgrad(c, w, h, stops);
      const r = rng(7);
      for (let i = 0; i < 90; i++) rect(c, r() * w, r() * h * 0.6, r() < 0.15 ? 2 : 1, r() < 0.15 ? 2 : 1, r() < 0.5 ? '#c9c4ff' : '#ffffff');
    });
  }
}

function makeLayers(scene: Phaser.Scene) {
  // far hills, mid forest, foreground blades; day & night
  const sets: Array<[string, { far: string; far2: string; mid: string; mid2: string; fg: string; ground: string[]; }]> = [
    ['day', { far: '#9fcfb0', far2: '#7fba8f', mid: '#3f8f4a', mid2: '#2f7a3e', fg: '#1d5a2a', ground: ['#5fb04a', '#4c9a3c', '#6fc457', '#3d7f32'] }],
    ['night', { far: '#1c1a3c', far2: '#161232', mid: '#0f0c26', mid2: '#0a081c', fg: '#04030c', ground: ['#16132e', '#100e24', '#1d1a3a', '#0a0818'] }],
  ];
  for (const [ph, p] of sets) {
    make(scene, `far_${ph}`, 960, 300, (c, w, h) => {
      ridge(c, w, h, 150, 22, p.far, 11, true);
      ridge(c, w, h, 190, 16, p.far2, 21, true);
    });
    make(scene, `mid_${ph}`, 960, 300, (c, w, h) => {
      ridge(c, w, h, 150, 10, p.mid, 31, true);
      ridge(c, w, h, 200, 8, p.mid2, 41, true);
      // trunks
      const r = rng(5);
      for (let i = 0; i < 30; i++) rect(c, r() * w, 130 + r() * 50, 3 + r() * 2, 170, p.mid2);
    });
    make(scene, `fg_${ph}`, 960, 140, (c, w, h) => {
      const r = rng(9);
      c.fillStyle = p.fg;
      for (let x = 0; x < w; x += 3) {
        const hh = 10 + r() * 28 + (Math.sin(x * 0.02) + 1) * 8;
        c.fillRect(x, h - hh, 3, hh);
        if (r() < 0.3) c.fillRect(x + 1, h - hh - 5, 1, 5);
      }
      c.fillRect(0, h - 8, w, 8);
    });
    make(scene, `ground_${ph}`, 64, 64, (c, w, h) => {
      const r = rng(ph === 'day' ? 3 : 4);
      rect(c, 0, 0, w, h, p.ground[0]);
      for (let i = 0; i < 90; i++) rect(c, r() * w, r() * h, 2 + r() * 3, 1, p.ground[1 + Math.floor(r() * 3)]);
      for (let i = 0; i < 24; i++) { const x = r() * w, y = r() * h; rect(c, x, y, 1, 3, p.ground[2]); rect(c, x + 1, y + 1, 1, 2, p.ground[3]); }
    });
  }
  make(scene, 'path', 64, 64, (c, w, h) => {
    const r = rng(8);
    rect(c, 0, 0, w, h, '#b88a5a');
    for (let i = 0; i < 60; i++) rect(c, r() * w, r() * h, 2 + r() * 3, 1 + r() * 2, r() < 0.5 ? '#a0744a' : '#cf9f6c');
  });
  make(scene, 'path_night', 64, 64, (c, w, h) => {
    const r = rng(8);
    rect(c, 0, 0, w, h, '#1c1730');
    for (let i = 0; i < 60; i++) rect(c, r() * w, r() * h, 2 + r() * 3, 1 + r() * 2, r() < 0.5 ? '#14102a' : '#26204a');
  });
}

// ------------------------------------------------------------------ props
function makeProps(scene: Phaser.Scene) {
  for (let v = 0; v < 3; v++) {
    const w = 64 + v * 6, h = 112 - v * 6;
    make(scene, `tree_day_${v}`, w, h, (c, ww, hh) => drawTreeDay(c, ww, hh, 100 + v));
    make(scene, `tree_night_${v}`, w, h, (c, ww, hh) => drawTreeNight(c, ww, hh, 200 + v));
  }
  for (const ph of ['day', 'night'] as const) {
    const d = ph === 'day';
    make(scene, `bush_${ph}`, 28, 16, (c) => {
      const r = rng(d ? 1 : 2);
      disc(c, 8, 10, 6, d ? '#2e7d32' : '#14102a'); disc(c, 18, 9, 7, d ? '#388e3c' : '#1a1535'); disc(c, 13, 7, 6, d ? '#4caf50' : '#201a40');
      for (let i = 0; i < 6; i++) rect(c, 4 + r() * 20, 3 + r() * 8, 1, 1, d ? '#9be37a' : '#2c2455');
      if (d) { rect(c, 10, 6, 2, 2, '#ff6b81'); rect(c, 19, 8, 2, 2, '#ff6b81'); }
      outline(c, 28, 16, d ? OUT : OUT_NIGHT);
    });
    make(scene, `rock_${ph}`, 22, 13, (c) => {
      disc(c, 11, 8, 6, d ? '#8a8f98' : '#241f3e'); disc(c, 9, 6, 4, d ? '#a8aeb8' : '#2e2850');
      rect(c, 14, 9, 6, 3, d ? '#6f747c' : '#18142e');
      if (d) rect(c, 5, 8, 4, 3, '#4c9a3c');
      outline(c, 22, 13, d ? OUT : OUT_NIGHT);
    });
    make(scene, `tuft_${ph}`, 14, 9, (c) => {
      const r = rng(d ? 5 : 6);
      for (let i = 0; i < 6; i++) { const x = 1 + i * 2, h = 4 + r() * 4; rect(c, x, 9 - h, 1, h, d ? (i % 2 ? '#5fc457' : '#3d8f3a') : (i % 2 ? '#241f48' : '#161232')); }
    });
    make(scene, `sign_${ph}`, 26, 44, (c) => {
      c.save();
      if (!d) { c.translate(13, 44); c.rotate(-0.12); c.translate(-13, -44); }
      rect(c, 11, 8, 4, 36, d ? '#6b4428' : '#1d1330');
      rect(c, 2, 4, 22, 14, d ? '#a9774a' : '#2a2140'); rect(c, 2, 4, 22, 2, d ? '#c8935e' : '#3a2f58');
      for (let i = 0; i < 3; i++) rect(c, 5, 8 + i * 3, 16 - i * 3, 1, d ? '#4a2e1c' : '#7a1020');
      if (!d) { line(c, 3, 5, 23, 17, '#8a1020', 1); line(c, 23, 5, 3, 17, '#8a1020', 1); }
      c.restore();
      outline(c, 26, 44, d ? OUT : OUT_NIGHT);
    });
    make(scene, `carve_${ph}`, 14, 12, (c) => {
      if (d) { disc(c, 4, 4, 2, '#ffb3c1'); disc(c, 8, 4, 2, '#ffb3c1'); rect(c, 3, 5, 6, 2, '#ffb3c1'); rect(c, 4, 7, 4, 1, '#ffb3c1'); rect(c, 5, 8, 2, 1, '#ffb3c1'); }
      else { disc(c, 4, 4, 2, '#7a1020'); disc(c, 8, 4, 2, '#7a1020'); rect(c, 3, 5, 6, 2, '#7a1020'); rect(c, 4, 7, 4, 1, '#7a1020'); line(c, 0, 0, 13, 11, '#05030c', 2); line(c, 13, 0, 0, 11, '#05030c', 2); }
    });
  }
  // flower patches (day) in three colours + dead stalks (night)
  const fl: Array<[string, string, string]> = [['gold', '#ffd23f', '#fff2a8'], ['red', '#ff4d6d', '#ffb3c1'], ['blue', '#5aa9ff', '#bfe0ff']];
  for (const [name, col, hi] of fl) {
    make(scene, `flower_${name}`, 34, 22, (c) => {
      const r = rng(name.length * 13);
      for (let i = 0; i < 7; i++) {
        const x = 3 + i * 4 + r() * 2, y = 8 + r() * 5;
        rect(c, x, y, 1, 22 - y, '#2f7a3e'); rect(c, x - 1, y + 4, 2, 1, '#3f8f4a');
        rect(c, x - 1, y - 2, 3, 3, col); rect(c, x, y - 3, 1, 5, col); rect(c, x, y - 1, 1, 1, hi);
      }
      outline(c, 34, 22, OUT);
    });
  }
  make(scene, 'flower_dead', 34, 22, (c) => {
    const r = rng(77);
    for (let i = 0; i < 6; i++) { const x = 3 + i * 5 + r() * 2, y = 6 + r() * 7; line(c, x, 22, x + (r() - 0.5) * 6, y, '#2a2148', 1); rect(c, x - 1, y - 1, 2, 2, '#3a2f58'); }
  });
}

// ------------------------------------------------------------------ fx
function makeFx(scene: Phaser.Scene) {
  make(scene, 'light', 512, 512, (c, w, h) => radial(c, w, h, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.85)'], [0.7, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']]));
  make(scene, 'glow', 128, 128, (c, w, h) => radial(c, w, h, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]));
  make(scene, 'fogblob', 256, 128, (c, w, h) => {
    c.save(); c.scale(1, 0.5); radial(c, w, w, [[0, 'rgba(170,160,220,0.55)'], [0.6, 'rgba(120,110,190,0.22)'], [1, 'rgba(100,90,170,0)']]); c.restore();
  });
  make(scene, 'vignette', 480, 270, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  make(scene, 'shaft', 64, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,240,170,0.55)'); g.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(18, 0); c.lineTo(46, 0); c.lineTo(64, h); c.lineTo(0, h); c.closePath(); c.fill();
  });
  make(scene, 'mote', 4, 4, (c) => { rect(c, 1, 0, 2, 4, '#ffffff'); rect(c, 0, 1, 4, 2, '#ffffff'); });
  make(scene, 'leaf', 5, 3, (c) => { rect(c, 0, 1, 5, 2, '#8fe36a'); rect(c, 1, 0, 3, 1, '#4caf50'); });
  make(scene, 'spore', 3, 3, (c) => { rect(c, 0, 0, 3, 3, '#b8a7ff'); });
  make(scene, 'eyes', 24, 10, (c, w, h) => {
    radial(c, w, h * 2, [[0, 'rgba(255,60,60,0.45)'], [1, 'rgba(255,60,60,0)']]);
    rect(c, 3, 4, 6, 3, '#ffe9e0'); rect(c, 15, 4, 6, 3, '#ffe9e0');
    rect(c, 5, 3, 2, 5, '#ff2a2a'); rect(c, 17, 3, 2, 5, '#ff2a2a');
  });
  make(scene, 'sun', 160, 160, (c, w, h) => {
    radial(c, w, h, [[0, 'rgba(255,250,210,1)'], [0.3, 'rgba(255,230,150,0.9)'], [0.34, 'rgba(255,220,120,0.35)'], [1, 'rgba(255,200,100,0)']]);
  });
  make(scene, 'moon', 120, 120, (c, w, h) => {
    radial(c, w, h, [[0, 'rgba(200,190,255,0.5)'], [0.3, 'rgba(160,150,230,0.2)'], [1, 'rgba(120,110,200,0)']]);
    disc(c, 60, 60, 16, '#d8d4ff'); disc(c, 66, 56, 13, '#b9b3ee'); disc(c, 55, 64, 3, '#a7a1de');
  });
  make(scene, 'wisp', 48, 48, (c, w, h) => {
    radial(c, w, h, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.8)'], [0.5, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
  });
  make(scene, 'pixel', 2, 2, (c) => rect(c, 0, 0, 2, 2, '#ffffff'));
}

export function generateTextures(scene: Phaser.Scene) {
  makeChar(scene, 'adam', { skin: '#f1c9a0', hair: '#2b1b17', hair2: '#4a2f26', top: '#e8643a', top2: '#c24a28', pants: '#3b4a78', shoe: '#2a2030', hood: true });
  makeChar(scene, 'nicholas', { skin: '#f4d2b0', hair: '#c9a24a', hair2: '#e3c26e', top: '#3f7fd1', top2: '#2f62a8', pants: '#8a7a55', shoe: '#3a2c24', pack: '#b04a3a', glasses: true });
  makeSky(scene, 'sky_day', [[0, '#5eb4ff'], [0.6, '#bfe6ff'], [1, '#fff3c4']]);
  makeSky(scene, 'sky_golden', [[0, '#3a5fa8'], [0.35, '#e98a5a'], [0.7, '#ffc46b'], [1, '#ffe9a8']]);
  makeSky(scene, 'sky_night', [[0, '#05030f'], [0.5, '#140d33'], [1, '#2a1a52']], true);
  makeLayers(scene);
  makeProps(scene);
  makeFx(scene);
  makeExtras(scene);
}
