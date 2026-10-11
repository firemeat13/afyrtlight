import Phaser from 'phaser';
import { rng, Rng } from './draw';

/**
 * High-resolution, non-pixel "analog horror" art for the cabin (Part 3 finale).
 * Everything is painted on canvas with gradients, blur and film grain, and uses LINEAR filtering,
 * so it deliberately looks nothing like the pixel art of the rest of the game.
 * Replace these keys with real photos/footage later if desired:
 *   an_room, an_monster, an_face, an_gore, an_drips, an_noise, an_scan
 */

type Ctx = CanvasRenderingContext2D;

function make(scene: Phaser.Scene, key: string, w: number, h: number, fn: (c: Ctx, w: number, h: number) => void) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h)!;
  const c = t.getContext();
  c.imageSmoothingEnabled = true;
  fn(c, w, h);
  t.refresh();
  t.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

function grain(c: Ctx, w: number, h: number, amt: number, seed = 1) {
  const r = rng(seed);
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (r() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  c.putImageData(img, 0, 0);
}

function ell(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, rot = 0) {
  c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill();
}

function drips(c: Ctx, r: Rng, x0: number, x1: number, y: number, n: number, maxLen: number, color: string) {
  c.strokeStyle = color; c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), len = 10 + r() * maxLen;
    c.lineWidth = 1.5 + r() * 5;
    c.beginPath(); c.moveTo(x, y + r() * 6); c.lineTo(x + (r() - 0.5) * 6, y + len); c.stroke();
    ell(c, x, y + len, c.lineWidth * 0.8, c.lineWidth * 1.1, color);
  }
}

/** The Hollow Man's face. r = half-height of the head. */
function drawFace(c: Ctx, cx: number, cy: number, r: number, seed: number) {
  const rnd = rng(seed);
  c.save();
  // skull
  const g = c.createRadialGradient(cx - r * 0.1, cy - r * 0.35, r * 0.05, cx, cy, r * 1.05);
  g.addColorStop(0, '#efe9dc'); g.addColorStop(0.45, '#b9b2a2'); g.addColorStop(0.8, '#5d574c'); g.addColorStop(1, '#161412');
  c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = r * 0.12;
  c.beginPath();
  c.moveTo(cx, cy - r);
  c.bezierCurveTo(cx + r * 0.85, cy - r, cx + r * 0.8, cy + r * 0.1, cx + r * 0.52, cy + r * 0.62);
  c.bezierCurveTo(cx + r * 0.4, cy + r * 1.05, cx - r * 0.4, cy + r * 1.05, cx - r * 0.52, cy + r * 0.62);
  c.bezierCurveTo(cx - r * 0.8, cy + r * 0.1, cx - r * 0.85, cy - r, cx, cy - r);
  c.fillStyle = g; c.fill();
  c.shadowBlur = 0;
  // sunken cheeks and brow
  ell(c, cx - r * 0.42, cy + r * 0.28, r * 0.16, r * 0.34, 'rgba(20,16,14,0.55)', 0.25);
  ell(c, cx + r * 0.42, cy + r * 0.28, r * 0.16, r * 0.34, 'rgba(20,16,14,0.55)', -0.25);
  ell(c, cx, cy - r * 0.62, r * 0.5, r * 0.1, 'rgba(20,16,14,0.25)');
  // eye sockets
  for (const sx of [-1, 1]) {
    const ex = cx + sx * r * 0.3, ey = cy - r * 0.2;
    const eg = c.createRadialGradient(ex, ey, r * 0.02, ex, ey, r * 0.3);
    eg.addColorStop(0, '#000000'); eg.addColorStop(0.75, '#060404'); eg.addColorStop(1, 'rgba(60,10,10,0)');
    ell(c, ex, ey, r * 0.24, r * 0.3, eg, sx * 0.18);
    // burst veins around the socket
    c.strokeStyle = 'rgba(120,10,16,0.75)';
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2; let px = ex + Math.cos(a) * r * 0.2, py = ey + Math.sin(a) * r * 0.26;
      c.lineWidth = 0.6 + rnd() * 1.6; c.beginPath(); c.moveTo(px, py);
      for (let k = 0; k < 4; k++) { px += Math.cos(a + (rnd() - 0.5)) * r * 0.05; py += Math.sin(a + (rnd() - 0.5)) * r * 0.05; c.lineTo(px, py); }
      c.stroke();
    }
    if (sx < 0) {
      // left: an empty socket with one pinprick of light far inside
      c.shadowColor = '#ffffff'; c.shadowBlur = r * 0.08;
      ell(c, ex + sx * r * 0.02, ey + r * 0.03, r * 0.022, r * 0.022, '#ffffff');
      c.shadowBlur = 0;
    } else {
      // right: a wet, living, human eye that is looking straight at you
      const sg = c.createRadialGradient(ex, ey, r * 0.01, ex, ey, r * 0.15);
      sg.addColorStop(0, '#f4ecd8'); sg.addColorStop(0.7, '#d9c9a8'); sg.addColorStop(1, '#7a2a22');
      ell(c, ex, ey + r * 0.02, r * 0.15, r * 0.13, sg);
      c.strokeStyle = 'rgba(170,20,24,0.85)';
      for (let i = 0; i < 16; i++) {
        const a = rnd() * Math.PI * 2; c.lineWidth = 0.5 + rnd();
        c.beginPath(); c.moveTo(ex + Math.cos(a) * r * 0.14, ey + r * 0.02 + Math.sin(a) * r * 0.12);
        c.quadraticCurveTo(ex + Math.cos(a + 0.4) * r * 0.09, ey + Math.sin(a + 0.4) * r * 0.08, ex + Math.cos(a) * r * 0.05, ey + r * 0.02 + Math.sin(a) * r * 0.05); c.stroke();
      }
      const ig = c.createRadialGradient(ex, ey + r * 0.02, r * 0.01, ex, ey + r * 0.02, r * 0.065);
      ig.addColorStop(0, '#0a0503'); ig.addColorStop(0.45, '#5a3a18'); ig.addColorStop(1, '#1c0f06');
      ell(c, ex, ey + r * 0.02, r * 0.065, r * 0.065, ig);
      ell(c, ex, ey + r * 0.02, r * 0.026, r * 0.026, '#000000');
      ell(c, ex - r * 0.02, ey - r * 0.005, r * 0.012, r * 0.012, 'rgba(255,255,255,0.9)');
      // torn lids
      c.strokeStyle = '#3a0a0c'; c.lineWidth = r * 0.02;
      c.beginPath(); c.ellipse(ex, ey + r * 0.02, r * 0.155, r * 0.135, 0, 0, Math.PI * 2); c.stroke();
    }
    // blood running out of the eye
    drips(c, rnd, ex - r * 0.1, ex + r * 0.1, ey + r * 0.22, 4, r * 0.5, 'rgba(96,6,12,0.9)');
  }
  // nose slits
  ell(c, cx - r * 0.05, cy + r * 0.12, r * 0.02, r * 0.07, '#0a0707', 0.2);
  ell(c, cx + r * 0.05, cy + r * 0.12, r * 0.02, r * 0.07, '#0a0707', -0.2);
  // the mouth: unhinged, far too tall
  const my = cy + r * 0.55;
  const mg = c.createRadialGradient(cx, my, r * 0.02, cx, my, r * 0.45);
  mg.addColorStop(0, '#000000'); mg.addColorStop(0.6, '#1a0204'); mg.addColorStop(1, '#5a0a10');
  ell(c, cx, my, r * 0.3, r * 0.42, mg);
  // strings of flesh between the jaws
  c.strokeStyle = 'rgba(190,150,140,0.55)';
  for (let i = 0; i < 7; i++) {
    const x = cx - r * 0.22 + rnd() * r * 0.44;
    c.lineWidth = 0.8 + rnd() * 2; c.beginPath(); c.moveTo(x, my - r * 0.36); c.quadraticCurveTo(x + (rnd() - 0.5) * r * 0.1, my, x + (rnd() - 0.5) * r * 0.08, my + r * 0.36); c.stroke();
  }
  // teeth: long, uneven, yellowed
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 11; i++) {
      const t = (i + 0.5) / 11;
      const x = cx - r * 0.27 + t * r * 0.54;
      const edge = Math.sqrt(Math.max(0, 1 - Math.pow((x - cx) / (r * 0.3), 2))) * r * 0.42;
      const baseY = my + dir * edge;
      const len = r * (0.07 + rnd() * 0.16);
      const wd = r * (0.018 + rnd() * 0.022);
      const tg = c.createLinearGradient(0, baseY, 0, baseY - dir * len);
      tg.addColorStop(0, '#6e5a3a'); tg.addColorStop(1, '#e9e0c4');
      c.fillStyle = tg; c.beginPath(); c.moveTo(x - wd, baseY); c.lineTo(x + wd, baseY); c.lineTo(x + (rnd() - 0.5) * wd, baseY - dir * len); c.closePath(); c.fill();
    }
  }
  drips(c, rnd, cx - r * 0.26, cx + r * 0.26, my + r * 0.36, 9, r * 0.55, 'rgba(110,8,14,0.92)');
  // a second, smaller ring of teeth deep in the throat
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = cx + Math.cos(a) * r * 0.13, y = my + r * 0.05 + Math.sin(a) * r * 0.17;
    c.fillStyle = '#b8ab88'; c.beginPath(); c.moveTo(x - r * 0.012, y); c.lineTo(x + r * 0.012, y); c.lineTo(cx + Math.cos(a) * r * 0.07, my + r * 0.05 + Math.sin(a) * r * 0.09); c.closePath(); c.fill();
  }
  // the left cheek is torn open to the muscle
  const tg2 = c.createRadialGradient(cx - r * 0.44, cy + r * 0.3, r * 0.01, cx - r * 0.44, cy + r * 0.3, r * 0.2);
  tg2.addColorStop(0, '#2a0204'); tg2.addColorStop(0.6, '#8a0e16'); tg2.addColorStop(1, 'rgba(120,10,16,0)');
  ell(c, cx - r * 0.44, cy + r * 0.3, r * 0.13, r * 0.22, tg2, 0.3);
  c.strokeStyle = 'rgba(190,40,44,0.8)';
  for (let i = 0; i < 9; i++) { c.lineWidth = 1 + rnd() * 2; c.beginPath(); c.moveTo(cx - r * 0.52 + i * r * 0.018, cy + r * 0.14); c.lineTo(cx - r * 0.5 + i * r * 0.022, cy + r * 0.46); c.stroke(); }
  // a stitched seam across the forehead
  c.strokeStyle = 'rgba(30,8,8,0.9)'; c.lineWidth = r * 0.012;
  c.beginPath(); c.moveTo(cx - r * 0.45, cy - r * 0.66); c.quadraticCurveTo(cx, cy - r * 0.78, cx + r * 0.45, cy - r * 0.62); c.stroke();
  for (let i = 0; i < 12; i++) { const t = i / 11; const x = cx - r * 0.45 + t * r * 0.9; const y = cy - r * 0.66 - Math.sin(t * Math.PI) * r * 0.09; c.beginPath(); c.moveTo(x - r * 0.01, y - r * 0.035); c.lineTo(x + r * 0.01, y + r * 0.035); c.stroke(); }
  // thin wet hair hanging over the face
  c.strokeStyle = 'rgba(8,6,6,0.75)';
  for (let i = 0; i < 26; i++) {
    const x = cx - r * 0.55 + rnd() * r * 1.1; c.lineWidth = 0.6 + rnd() * 1.2;
    c.beginPath(); c.moveTo(x, cy - r * 0.98); c.quadraticCurveTo(x + (rnd() - 0.5) * r * 0.2, cy - r * 0.4, x + (rnd() - 0.5) * r * 0.3, cy - r * 0.2 + rnd() * r * 0.9); c.stroke();
  }
  // cracks in the skin
  c.strokeStyle = 'rgba(15,10,10,0.7)';
  for (let i = 0; i < 9; i++) {
    let px = cx + (rnd() - 0.5) * r * 1.1, py = cy - r * 0.9 + rnd() * r * 0.9;
    c.lineWidth = 0.6 + rnd() * 1.4; c.beginPath(); c.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * r * 0.14; py += rnd() * r * 0.1; c.lineTo(px, py); }
    c.stroke();
  }
  c.restore();
}

function drawMonster(c: Ctx, w: number, h: number) {
  const rnd = rng(66);
  const cx = w / 2;
  const hy = h * 0.115, hr = w * 0.19;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const skin = (a = 1) => `rgba(28,26,28,${a})`;
  c.shadowColor = 'rgba(0,0,0,1)'; c.shadowBlur = 18;
  // legs
  c.strokeStyle = skin(); c.lineWidth = w * 0.05;
  c.beginPath(); c.moveTo(cx - w * 0.06, h * 0.56); c.lineTo(cx - w * 0.11, h * 0.78); c.lineTo(cx - w * 0.07, h * 0.99); c.stroke();
  c.beginPath(); c.moveTo(cx + w * 0.06, h * 0.56); c.lineTo(cx + w * 0.12, h * 0.77); c.lineTo(cx + w * 0.09, h * 0.99); c.stroke();
  // torso: starved, long
  const tg = c.createLinearGradient(cx - w * 0.16, 0, cx + w * 0.16, 0);
  tg.addColorStop(0, '#0b0a0c'); tg.addColorStop(0.5, '#3a3636'); tg.addColorStop(1, '#0b0a0c');
  c.fillStyle = tg;
  c.beginPath();
  c.moveTo(cx - w * 0.17, h * 0.24); c.quadraticCurveTo(cx, h * 0.2, cx + w * 0.17, h * 0.24);
  c.quadraticCurveTo(cx + w * 0.07, h * 0.42, cx + w * 0.1, h * 0.58);
  c.lineTo(cx - w * 0.1, h * 0.58);
  c.quadraticCurveTo(cx - w * 0.07, h * 0.42, cx - w * 0.17, h * 0.24);
  c.fill();
  c.shadowBlur = 0;
  // ribs
  c.strokeStyle = 'rgba(150,142,130,0.5)';
  for (let i = 0; i < 8; i++) {
    const y = h * (0.27 + i * 0.026); const half = w * (0.13 - i * 0.008);
    c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(cx - half, y); c.quadraticCurveTo(cx, y + h * 0.018, cx + half, y); c.stroke();
  }
  // wet wound down the chest
  const wg = c.createLinearGradient(0, h * 0.26, 0, h * 0.5);
  wg.addColorStop(0, 'rgba(120,8,14,0.95)'); wg.addColorStop(1, 'rgba(40,2,4,0.2)');
  c.fillStyle = wg; c.beginPath(); c.moveTo(cx - 6, h * 0.25); c.lineTo(cx + 8, h * 0.25); c.lineTo(cx + 3, h * 0.5); c.lineTo(cx - 4, h * 0.48); c.closePath(); c.fill();
  // neck
  c.strokeStyle = '#2b2828'; c.lineWidth = w * 0.045; c.beginPath(); c.moveTo(cx, hy + hr * 0.9); c.lineTo(cx, h * 0.24); c.stroke();
  // arms: far too long, ending in fingers
  for (const sx of [-1, 1]) {
    c.strokeStyle = skin(); c.lineWidth = w * 0.035; c.shadowColor = '#000'; c.shadowBlur = 10;
    const sxp = cx + sx * w * 0.16, ex = cx + sx * w * 0.33, hx = cx + sx * w * 0.29;
    c.beginPath(); c.moveTo(sxp, h * 0.25); c.lineTo(ex, h * 0.47); c.lineTo(hx, h * 0.72); c.stroke();
    c.shadowBlur = 0;
    for (let f = 0; f < 5; f++) {
      const fx = hx + sx * (f - 2) * w * 0.022;
      c.strokeStyle = f % 2 ? '#cfc8b8' : '#8a8478'; c.lineWidth = 3.5;
      c.beginPath(); c.moveTo(hx, h * 0.72); c.lineTo(fx + (rnd() - 0.5) * 6, h * (0.79 + rnd() * 0.05)); c.stroke();
      ell(c, fx, h * 0.83, 2.5, 5, 'rgba(110,8,14,0.9)');
    }
    drips(c, rnd, hx - 14, hx + 14, h * 0.82, 4, h * 0.06, 'rgba(96,6,12,0.85)');
  }
  drawFace(c, cx, hy, hr, 13);
  grain(c, w, h, 34, 5);
}

function drawRoom(c: Ctx, w: number, h: number) {
  const r = rng(21);
  c.fillStyle = '#0c0a09'; c.fillRect(0, 0, w, h);
  // back wall planks
  for (let x = 0; x < w; x += 46) {
    const v = 22 + Math.floor(r() * 18);
    c.fillStyle = `rgb(${v + 8},${v},${v - 6})`; c.fillRect(x, 40, 44, 330);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x + 44, 40, 2, 330);
    for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x + r() * 40, 40 + r() * 330, 1, 20 + r() * 80); }
  }
  // ceiling + floor
  const cg = c.createLinearGradient(0, 0, 0, 60); cg.addColorStop(0, '#000'); cg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = '#090807'; c.fillRect(0, 0, w, 40); c.fillStyle = cg; c.fillRect(0, 30, w, 60);
  c.fillStyle = '#14100d'; c.fillRect(0, 370, w, h - 370);
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2;
  for (let i = -8; i <= 20; i++) { c.beginPath(); c.moveTo(w / 2 + (i - 6) * 40, 370); c.lineTo(w / 2 + (i - 6) * 150, h); c.stroke(); }
  // door (left), ajar onto blackness
  c.fillStyle = '#060505'; c.fillRect(110, 110, 150, 262);
  c.fillStyle = '#1e1712'; c.fillRect(110, 110, 104, 262);
  c.fillStyle = '#2a2018'; c.fillRect(118, 122, 88, 110); c.fillRect(118, 244, 88, 116);
  ell(c, 198, 250, 6, 6, '#5a4a2a');
  // window (centre) with a sick moon
  c.fillStyle = '#050608'; c.fillRect(410, 120, 170, 150);
  const mg = c.createRadialGradient(495, 190, 4, 495, 190, 110); mg.addColorStop(0, '#8f9aa8'); mg.addColorStop(0.2, '#3b4654'); mg.addColorStop(1, '#070a0e');
  c.fillStyle = mg; c.fillRect(418, 128, 154, 134);
  c.fillStyle = '#16110d'; c.fillRect(491, 128, 8, 134); c.fillRect(418, 191, 154, 8);
  // table + dead radio (right)
  c.fillStyle = '#1a130e'; c.fillRect(690, 318, 210, 14); c.fillRect(704, 332, 14, 90); c.fillRect(872, 332, 14, 90);
  c.fillStyle = '#101012'; c.fillRect(752, 276, 86, 42); c.fillStyle = '#1e1e22'; c.fillRect(760, 284, 40, 26);
  ell(c, 820, 297, 7, 7, '#3a1010');
  // something is watching through the glass
  ell(c, 548, 236, 13, 17, 'rgba(200,196,186,0.5)'); ell(c, 543, 232, 3, 4, '#000'); ell(c, 553, 232, 3, 4, '#000'); ell(c, 548, 244, 4, 6, '#000');
  // shapes hanging from the rafters
  for (const hx of [330, 650]) {
    c.strokeStyle = '#050404'; c.lineWidth = 3; c.beginPath(); c.moveTo(hx, 0); c.lineTo(hx, 96); c.stroke();
    ell(c, hx, 112, 15, 18, '#070606'); c.fillStyle = '#070606';
    c.beginPath(); c.moveTo(hx - 20, 128); c.lineTo(hx + 20, 128); c.lineTo(hx + 14, 250); c.lineTo(hx - 14, 250); c.closePath(); c.fill();
    c.fillRect(hx - 13, 250, 9, 86); c.fillRect(hx + 4, 250, 9, 80);
    drips(c, r, hx - 12, hx + 12, 330, 5, 60, 'rgba(96,6,12,0.8)');
    ell(c, hx, 404, 40, 9, 'rgba(70,4,8,0.7)');
  }
  // long claw furrows in the planks
  c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineWidth = 4;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(600 + i * 12, 60); c.quadraticCurveTo(640 + i * 12, 200, 610 + i * 14, 350); c.stroke(); }
  // names clawed into the wall
  const names = ['ADAM', 'ADAM', 'NICHOLAS', 'ADAM', 'ADAM', 'come home', 'ADAM', 'DONT ANSWER', 'ADAM', 'ADAM'];
  for (let i = 0; i < 46; i++) {
    c.save();
    c.translate(20 + r() * (w - 60), 60 + r() * 300); c.rotate((r() - 0.5) * 0.7);
    c.font = `${r() < 0.5 ? 'italic ' : ''}${12 + Math.floor(r() * 26)}px Georgia, "Times New Roman", serif`;
    c.fillStyle = r() < 0.55 ? `rgba(110,8,14,${0.45 + r() * 0.5})` : `rgba(200,190,170,${0.12 + r() * 0.25})`;
    c.fillText(names[Math.floor(r() * names.length)], 0, 0);
    c.restore();
  }
  // handprints and smears
  for (let i = 0; i < 9; i++) {
    const x = r() * w, y = 80 + r() * 280;
    ell(c, x, y, 12 + r() * 10, 16 + r() * 10, 'rgba(90,6,10,0.4)', r());
    drips(c, r, x - 10, x + 10, y + 10, 3, 70, 'rgba(90,6,10,0.5)');
  }
  // heavy vignette
  const vg = c.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.92)');
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
  grain(c, w, h, 26, 9);
}

export function makeAnalogTextures(scene: Phaser.Scene) {
  make(scene, 'an_room', 960, 540, drawRoom);
  make(scene, 'an_monster', 512, 1024, drawMonster);
  make(scene, 'an_face', 768, 768, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.55);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.8, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    drawFace(c, w / 2, h * 0.47, h * 0.4, 99);
    grain(c, w, h, 40, 2);
  });
  make(scene, 'an_gore', 256, 256, (c, w, h) => {
    const r = rng(55);
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * w * 0.48;
      ell(c, w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 3 + r() * 16 * (1 - d / w), 3 + r() * 12 * (1 - d / w), `rgba(${90 + r() * 70},${r() * 10},${8 + r() * 10},${0.6 + r() * 0.4})`, a);
    }
    ell(c, w / 2, h / 2, 44, 38, 'rgba(60,2,6,0.95)');
  });
  make(scene, 'an_drips', 960, 540, (c, w) => {
    const r = rng(12);
    const g = c.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, 'rgba(90,4,8,0.95)'); g.addColorStop(1, 'rgba(90,4,8,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, 120);
    drips(c, r, 0, w, 0, 90, 480, 'rgba(100,6,12,0.85)');
  });
  make(scene, 'an_noise', 256, 256, (c, w, h) => {
    const img = c.createImageData(w, h); const r = rng(3);
    for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    c.putImageData(img, 0, 0);
  });
  make(scene, 'an_scan', 4, 4, (c) => { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 0, 4, 2); });
}
