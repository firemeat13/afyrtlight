import Phaser from 'phaser';
import { disc, line, outline, radial, rect, rng } from './draw';

type DrawFn = (c: CanvasRenderingContext2D, w: number, h: number) => void;
const OUT: [number, number, number, number] = [18, 10, 24, 255];
const OUTN: [number, number, number, number] = [4, 2, 12, 255];

function make(scene: Phaser.Scene, key: string, w: number, h: number, fn: DrawFn) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, w, h)!;
  const c = t.getContext();
  fn(c, w, h);
  t.refresh();
  t.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function ell(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}

/** Landmarks, gore, the Hollow Man and part-2 props. */
export function makeExtras(scene: Phaser.Scene) {
  // ---------- the Hollow Man
  make(scene, 'hollow', 24, 48, (c, w, h) => {
    rect(c, 10, 12, 5, 20, '#0c0816'); rect(c, 9, 14, 7, 3, '#171026');
    line(c, 9, 15, 4, 30, '#0c0816', 2); line(c, 4, 30, 3, 43, '#0c0816', 1);
    line(c, 16, 15, 21, 30, '#0c0816', 2); line(c, 21, 30, 22, 43, '#0c0816', 1);
    [[3, 44, 1, 47], [3, 44, 3, 47], [3, 44, 5, 47], [22, 44, 20, 47], [22, 44, 22, 47], [22, 44, 23, 47]].forEach(([a, b, d, e]) => line(c, a, b, d, e, '#d9d4e8', 1));
    rect(c, 10, 32, 2, 14, '#0c0816'); rect(c, 13, 32, 2, 14, '#0c0816');
    rect(c, 8, 2, 9, 11, '#d9d4e8'); rect(c, 9, 12, 7, 2, '#bdb7d3');
    rect(c, 9, 5, 3, 3, '#05030c'); rect(c, 14, 5, 3, 3, '#05030c');
    rect(c, 10, 6, 1, 1, '#ff2a2a'); rect(c, 15, 6, 1, 1, '#ff2a2a');
    rect(c, 10, 10, 5, 1, '#05030c');
    for (let x = 10; x <= 14; x += 2) rect(c, x, 9, 1, 3, '#05030c');
    rect(c, 9, 13, 1, 4, '#8a0f1c'); rect(c, 15, 13, 1, 3, '#8a0f1c');
    outline(c, w, h, OUTN);
  });
  make(scene, 'hanging', 16, 48, (c, w, h) => {
    rect(c, 8, 0, 1, 12, '#3a2c20');
    disc(c, 8, 16, 4, '#bdb7a8'); rect(c, 6, 15, 1, 1, '#05030c'); rect(c, 9, 15, 1, 1, '#05030c');
    rect(c, 5, 20, 7, 14, '#4a2a2a'); rect(c, 5, 26, 7, 2, '#8a0f1c');
    rect(c, 3, 21, 2, 12, '#3b2424'); rect(c, 12, 21, 2, 12, '#3b2424');
    rect(c, 6, 34, 2, 12, '#2a2030'); rect(c, 9, 34, 2, 12, '#2a2030');
    rect(c, 7, 45, 1, 3, '#8a0f1c'); rect(c, 10, 44, 1, 2, '#8a0f1c');
    outline(c, w, h, OUTN);
  });
  make(scene, 'blood', 32, 10, (c) => {
    const r = rng(3);
    c.fillStyle = '#6a0a14';
    for (let i = 0; i < 40; i++) { const x = 16 + (r() - 0.5) * 28, y = 5 + (r() - 0.5) * 8; c.fillRect(Math.round(x), Math.round(y), 2 + Math.floor(r() * 3), 1 + Math.floor(r() * 2)); }
    rect(c, 9, 3, 14, 4, '#7d0e19'); rect(c, 12, 4, 6, 2, '#a3121f');
  });
  make(scene, 'blooddrop', 4, 3, (c) => { rect(c, 0, 0, 4, 2, '#8a0f1c'); rect(c, 1, 2, 2, 1, '#8a0f1c'); });

  // ---------- landmarks (day / night pairs)
  make(scene, 'log_day', 40, 14, (c, w, h) => {
    rect(c, 2, 3, 36, 9, '#6b4428'); rect(c, 2, 3, 36, 2, '#8a5a36'); rect(c, 2, 10, 36, 2, '#4a2e1c');
    disc(c, 3, 7, 4, '#a9774a'); disc(c, 3, 7, 2, '#8a5a36');
    rect(c, 20, 1, 6, 2, '#4caf50'); outline(c, w, h, OUT);
  });
  make(scene, 'log_night', 40, 14, (c, w, h) => {
    rect(c, 6, 3, 30, 9, '#4b2224'); rect(c, 10, 5, 22, 5, '#7d0e19');
    for (let x = 8; x < 34; x += 4) line(c, x, 4, x + 2, 10, '#d9d4c4', 1); // ribs
    disc(c, 4, 6, 4, '#3a2c30'); rect(c, 0, 5, 3, 1, '#d9d4c4'); rect(c, 1, 8, 2, 1, '#05030c');
    rect(c, 2, 11, 36, 3, '#6a0a14'); rect(c, 10, 12, 20, 2, '#8a0f1c');
    outline(c, w, h, OUTN);
  });
  make(scene, 'tent_day', 44, 32, (c, w, h) => {
    c.fillStyle = '#e8863a'; c.beginPath(); c.moveTo(22, 2); c.lineTo(43, 31); c.lineTo(1, 31); c.closePath(); c.fill();
    c.fillStyle = '#c96a24'; c.beginPath(); c.moveTo(22, 2); c.lineTo(43, 31); c.lineTo(28, 31); c.closePath(); c.fill();
    rect(c, 18, 16, 8, 15, '#3a2412'); line(c, 22, 2, 22, 16, '#f6c27a', 1);
    outline(c, w, h, OUT);
  });
  make(scene, 'tent_night', 44, 32, (c, w, h) => {
    c.fillStyle = '#2a2138'; c.beginPath(); c.moveTo(20, 6); c.lineTo(43, 31); c.lineTo(1, 31); c.closePath(); c.fill();
    c.fillStyle = '#1a1428'; c.beginPath(); c.moveTo(20, 6); c.lineTo(43, 31); c.lineTo(28, 31); c.closePath(); c.fill();
    rect(c, 16, 14, 10, 17, '#05030c');
    line(c, 8, 12, 22, 28, '#05030c', 2); line(c, 28, 14, 36, 28, '#05030c', 2);
    for (let i = 0; i < 4; i++) line(c, 10 + i * 6, 8 + i * 3, 12 + i * 6, 24 + i * 2, '#8a0f1c', 1);
    rect(c, 14, 29, 14, 3, '#6a0a14'); rect(c, 0, 31, 8, 1, '#6a0a14');
    outline(c, w, h, OUTN);
  });
  make(scene, 'pond_day', 72, 22, (c) => {
    ell(c, 36, 12, 34, 9, '#3d86c9'); ell(c, 34, 10, 28, 6, '#5aa9e8');
    c.fillStyle = '#bfe6ff'; for (let i = 0; i < 8; i++) c.fillRect(10 + i * 7, 8 + (i % 3) * 3, 3, 1);
    disc(c, 50, 13, 3, '#4caf50'); rect(c, 49, 11, 2, 2, '#ff9ab3');
  });
  make(scene, 'pond_night', 72, 22, (c) => {
    ell(c, 36, 12, 34, 9, '#1a0a18'); ell(c, 34, 11, 28, 6, '#4a0a16'); ell(c, 34, 11, 4, 3, '#bdb7a8');
    rect(c, 32, 10, 2, 2, '#05030c'); rect(c, 36, 10, 2, 2, '#05030c');
  });
  make(scene, 'well_day', 32, 36, (c, w, h) => {
    rect(c, 4, 18, 24, 16, '#8a8f98'); rect(c, 4, 18, 24, 3, '#a8aeb8'); rect(c, 6, 21, 20, 2, '#2a3a52');
    for (let y = 24; y < 34; y += 4) for (let x = 5 + ((y / 4) % 2) * 3; x < 27; x += 6) rect(c, x, y, 5, 3, '#757a82');
    rect(c, 5, 4, 2, 16, '#6b4428'); rect(c, 25, 4, 2, 16, '#6b4428'); rect(c, 2, 2, 28, 4, '#a9774a'); rect(c, 2, 2, 28, 1, '#c8935e');
    outline(c, w, h, OUT);
  });
  make(scene, 'well_night', 32, 36, (c, w, h) => {
    rect(c, 4, 18, 24, 16, '#241f3e'); rect(c, 4, 18, 24, 3, '#2e2850'); rect(c, 6, 21, 20, 2, '#05030c');
    rect(c, 5, 4, 2, 16, '#1d1330'); rect(c, 25, 4, 2, 16, '#1d1330'); rect(c, 2, 2, 28, 4, '#2a2140');
    rect(c, 8, 20, 2, 12, '#7d0e19'); rect(c, 19, 21, 2, 9, '#7d0e19'); rect(c, 14, 33, 8, 1, '#7d0e19');
    line(c, 15, 6, 15, 20, '#3a2c20', 1);
    outline(c, w, h, OUTN);
  });
  make(scene, 'swing_day', 36, 54, (c, w, h) => {
    line(c, 4, 52, 8, 4, '#6b4428', 3); line(c, 32, 52, 28, 4, '#6b4428', 3); rect(c, 6, 2, 24, 4, '#8a5a36');
    line(c, 13, 6, 13, 38, '#c9b27a', 1); line(c, 23, 6, 23, 38, '#c9b27a', 1); rect(c, 10, 38, 17, 3, '#a9774a');
    outline(c, w, h, OUT);
  });
  make(scene, 'swing_night', 36, 54, (c, w, h) => {
    line(c, 4, 52, 8, 4, '#1d1330', 3); line(c, 32, 52, 28, 4, '#1d1330', 3); rect(c, 6, 2, 24, 4, '#2a2140');
    line(c, 13, 6, 13, 30, '#3a2c20', 1); line(c, 23, 6, 23, 30, '#3a2c20', 1); rect(c, 10, 30, 17, 3, '#2a2140');
    rect(c, 15, 34, 3, 5, '#6a0a14'); rect(c, 20, 33, 2, 6, '#6a0a14');
    outline(c, w, h, OUTN);
  });
  make(scene, 'scarecrow_day', 28, 52, (c, w, h) => {
    rect(c, 13, 14, 3, 38, '#6b4428'); rect(c, 3, 20, 22, 3, '#6b4428');
    rect(c, 8, 18, 12, 14, '#8a5aa0'); rect(c, 8, 18, 12, 3, '#a874c0');
    disc(c, 14, 11, 5, '#e6c98a'); rect(c, 12, 10, 1, 1, '#2a1a10'); rect(c, 16, 10, 1, 1, '#2a1a10'); rect(c, 12, 13, 5, 1, '#2a1a10');
    rect(c, 6, 5, 16, 2, '#c8935e'); rect(c, 9, 1, 10, 5, '#a9774a');
    rect(c, 1, 22, 3, 4, '#e6c98a'); rect(c, 24, 22, 3, 4, '#e6c98a');
    outline(c, w, h, OUT);
  });
  make(scene, 'scarecrow_night', 28, 52, (c, w, h) => {
    rect(c, 13, 14, 3, 38, '#1d1330'); rect(c, 3, 20, 22, 3, '#1d1330');
    rect(c, 9, 20, 3, 10, '#3b2a50'); rect(c, 17, 22, 2, 8, '#3b2a50');
    rect(c, 12, 22, 6, 24, '#6a0a14'); rect(c, 13, 30, 3, 14, '#8a0f1c');
    rect(c, 1, 22, 2, 3, '#6a0a14'); rect(c, 25, 22, 2, 3, '#6a0a14');
    outline(c, w, h, OUTN);
  });

  // ---------- part 2
  make(scene, 'cabin', 112, 84, (c, w, h) => {
    rect(c, 8, 34, 96, 50, '#2a1c20'); for (let y = 36; y < 84; y += 6) rect(c, 8, y, 96, 1, '#1a1014');
    c.fillStyle = '#1a1420'; c.beginPath(); c.moveTo(0, 36); c.lineTo(56, 2); c.lineTo(112, 36); c.closePath(); c.fill();
    c.fillStyle = '#241a2c'; c.beginPath(); c.moveTo(6, 36); c.lineTo(56, 6); c.lineTo(106, 36); c.closePath(); c.fill();
    rect(c, 16, 46, 18, 16, '#05030c'); rect(c, 78, 46, 18, 16, '#05030c');
    rect(c, 20, 50, 4, 8, '#7d0e19'); rect(c, 84, 52, 8, 3, '#7d0e19');
    rect(c, 47, 50, 18, 34, '#05030c');
    line(c, 16, 46, 34, 62, '#3a2430', 1); line(c, 34, 46, 16, 62, '#3a2430', 1);
    rect(c, 90, 14, 8, 20, '#1a1014');
    outline(c, w, h, OUTN);
  });
  make(scene, 'door_closed', 18, 34, (c, w, h) => {
    rect(c, 0, 0, 18, 34, '#3a2418'); rect(c, 2, 2, 14, 30, '#4a2e1c'); rect(c, 4, 4, 10, 12, '#3a2418');
    rect(c, 12, 18, 3, 3, '#c9b27a');
    for (let i = 0; i < 3; i++) line(c, 3, 22 + i * 3, 15, 20 + i * 3, '#6a0a14', 1);
    outline(c, w, h, OUTN);
  });
  make(scene, 'door_open', 18, 34, (c) => { rect(c, 0, 0, 18, 34, '#05030c'); rect(c, 0, 0, 2, 34, '#4a2e1c'); rect(c, 6, 8, 6, 26, '#2a1a10'); });
  make(scene, 'lamp_off', 14, 56, (c, w, h) => {
    rect(c, 6, 10, 2, 44, '#1d1330'); rect(c, 3, 52, 8, 3, '#1d1330'); rect(c, 3, 2, 8, 9, '#2a2140'); rect(c, 4, 3, 6, 7, '#0a0818');
    outline(c, w, h, OUTN);
  });
  make(scene, 'lamp_on', 14, 56, (c, w, h) => {
    rect(c, 6, 10, 2, 44, '#2a2140'); rect(c, 3, 52, 8, 3, '#2a2140'); rect(c, 3, 2, 8, 9, '#3a2f58'); rect(c, 4, 3, 6, 7, '#ffd23f'); rect(c, 5, 4, 3, 4, '#fff2a8');
    outline(c, w, h, OUTN);
  });
  make(scene, 'photo', 14, 12, (c, w, h) => {
    rect(c, 0, 0, 14, 12, '#e8e0cc'); rect(c, 1, 1, 12, 8, '#4a5a6a'); rect(c, 3, 3, 3, 5, '#e8643a'); rect(c, 8, 3, 3, 5, '#3f7fd1');
    rect(c, 0, 10, 14, 2, '#c9bfa6'); line(c, 0, 0, 13, 11, '#7d0e19', 1);
    outline(c, w, h, OUTN);
  });
  make(scene, 'claw', 220, 220, (c) => {
    c.strokeStyle = '#b5121f'; c.lineCap = 'round';
    [[40, 10, 150, 210, 12], [90, 0, 190, 190, 14], [0, 40, 110, 215, 10]].forEach(([a, b, d, e, lw]) => {
      c.lineWidth = lw; c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo((a + d) / 2 + 20, (b + e) / 2, d, e); c.stroke();
    });
  });
  make(scene, 'gun', 14, 8, (c, w, h) => {
    rect(c, 0, 2, 11, 3, '#2b2b36'); rect(c, 0, 2, 11, 1, '#4a4a5c'); rect(c, 9, 4, 3, 4, '#3a2418'); rect(c, 6, 5, 2, 2, '#2b2b36'); rect(c, 11, 2, 3, 2, '#1a1a22');
    outline(c, w, h, OUTN);
  });
  make(scene, 'ammo', 14, 9, (c, w, h) => {
    rect(c, 0, 2, 14, 7, '#7a5a2a'); rect(c, 0, 2, 14, 2, '#a07a3a'); rect(c, 3, 0, 2, 3, '#d9b24a'); rect(c, 6, 0, 2, 3, '#d9b24a'); rect(c, 9, 0, 2, 3, '#d9b24a'); rect(c, 4, 5, 6, 2, '#e8e0cc');
    outline(c, w, h, OUTN);
  });
  make(scene, 'crate', 18, 14, (c, w, h) => {
    rect(c, 0, 2, 18, 12, '#8a5a36'); rect(c, 0, 2, 18, 2, '#a9774a'); rect(c, 0, 12, 18, 2, '#5a3a22');
    rect(c, 6, 5, 6, 6, '#f4f0e6'); rect(c, 8, 4, 2, 8, '#d03a3a'); rect(c, 5, 7, 8, 2, '#d03a3a');
    outline(c, w, h, OUT);
  });
  make(scene, 'musicbox', 18, 14, (c, w, h) => {
    rect(c, 1, 5, 16, 9, '#6b3a2a'); rect(c, 1, 5, 16, 2, '#8a4a34'); rect(c, 0, 3, 18, 3, '#d9b24a'); rect(c, 7, 8, 4, 3, '#ffd23f');
    rect(c, 8, 0, 2, 4, '#f4f0e6'); rect(c, 7, 0, 4, 1, '#f4f0e6');
    outline(c, w, h, OUT);
  });
  // Nicholas, after the cabin (pixel art)
  make(scene, 'nick_dead', 44, 18, (c, w, h) => {
    rect(c, 2, 12, 40, 6, '#6a0a14'); rect(c, 8, 13, 28, 5, '#8a0f1c'); rect(c, 0, 15, 6, 2, '#6a0a14'); rect(c, 38, 16, 6, 2, '#6a0a14');
    rect(c, 26, 9, 12, 4, '#8a7a55'); rect(c, 36, 7, 4, 4, '#8a7a55'); rect(c, 39, 6, 4, 2, '#3a2c24'); rect(c, 30, 12, 9, 3, '#8a7a55'); rect(c, 38, 13, 4, 2, '#3a2c24');
    rect(c, 12, 7, 15, 7, '#3f7fd1'); rect(c, 12, 12, 15, 2, '#2f62a8');
    rect(c, 15, 7, 2, 7, '#7d0e19'); rect(c, 18, 8, 2, 6, '#a3121f'); rect(c, 21, 7, 2, 7, '#7d0e19'); rect(c, 24, 8, 1, 5, '#a3121f');
    rect(c, 6, 13, 7, 2, '#3f7fd1'); rect(c, 3, 13, 3, 2, '#f4d2b0');
    rect(c, 5, 6, 7, 6, '#f4d2b0'); rect(c, 4, 4, 8, 3, '#c9a24a'); rect(c, 4, 6, 2, 4, '#c9a24a'); rect(c, 5, 5, 4, 2, '#7d0e19');
    rect(c, 9, 9, 1, 1, '#1b1020');
    rect(c, 0, 9, 3, 1, '#2b2b3a'); rect(c, 0, 10, 1, 2, '#2b2b3a'); rect(c, 2, 10, 1, 1, '#2b2b3a');
    outline(c, w, h, OUTN);
  });
  void radial;
}
