/** Tiny pixel-drawing helpers shared by the procedural texture generators. */

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;

export function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function disc(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  c.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
    c.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

export function line(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, th = 1) {
  c.fillStyle = color;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    c.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), th, th);
  }
}

/** Adds a 1px dark outline around all opaque pixels. */
export function outline(c: CanvasRenderingContext2D, w: number, h: number, color: [number, number, number, number]) {
  const img = c.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(img.data);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y) > 0) continue;
      if (a(x - 1, y) > 200 || a(x + 1, y) > 200 || a(x, y - 1) > 200 || a(x, y + 1) > 200) {
        const i = (y * w + x) * 4;
        img.data[i] = color[0]; img.data[i + 1] = color[1]; img.data[i + 2] = color[2]; img.data[i + 3] = color[3];
      }
    }
  }
  c.putImageData(img, 0, 0);
}

export function radial(c: CanvasRenderingContext2D, w: number, h: number, stops: Array<[number, string]>) {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

export function vgrad(c: CanvasRenderingContext2D, w: number, h: number, stops: Array<[number, string]>) {
  const g = c.createLinearGradient(0, 0, 0, h);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}
