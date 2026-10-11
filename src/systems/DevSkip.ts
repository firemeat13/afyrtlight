import Phaser from 'phaser';
import { AudioSys } from './AudioSys';
import { Game } from './GameState';

/**
 * TESTING AID: jump between parts without replaying the game.
 *   Ctrl + Right / PageDown  -> next stop
 *   Ctrl + Left  / PageUp    -> previous stop
 * (Plain arrows are movement, so the skip needs Ctrl.) Set ENABLED to false to ship without it.
 */
const ENABLED = true;

interface Stop { label: string; scene: string; setup?: (g: Phaser.Game) => void }

const STOPS: Stop[] = [
  { label: 'TITLE', scene: 'Title' },
  { label: 'PROLOGUE - phone call', scene: 'Call' },
  { label: 'PROLOGUE - store', scene: 'Store' },
  { label: 'PROLOGUE - the walk', scene: 'Intro' },
  { label: 'PART 1 - day', scene: 'Forest', setup: (g) => g.registry.set('ch1cp', 'start') },
  { label: 'PART 1 - night', scene: 'Forest', setup: (g) => g.registry.set('ch1cp', 'night') },
  { label: 'PART 1 - free roam', scene: 'Forest', setup: (g) => g.registry.set('ch1cp', 'roam') },
  { label: 'PART 2 - afterglow', scene: 'Meadow' },
  { label: 'PART 3 - the hollow cabin', scene: 'Hollow' },
  { label: 'PART 3 - cabin fight', scene: 'Cabin', setup: (g) => g.registry.set('cabinRetry', false) },
  { label: 'PART 3 - aftermath', scene: 'Aftermath' },
];

let toastEl: HTMLDivElement | null = null;
let toastTimer = 0;
function toast(text: string) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9999;padding:8px 14px;'
      + 'background:rgba(0,0,0,.82);color:#ffd23f;font:12px "Press Start 2P",monospace;border:2px solid #ffd23f;pointer-events:none;white-space:nowrap';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = text;
  toastEl.style.display = 'block';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { if (toastEl) toastEl.style.display = 'none'; }, 2200);
}

function currentIndex(game: Phaser.Game): number {
  const active = game.scene.getScenes(true).map((s) => s.scene.key);
  const cp = game.registry.get('ch1cp');
  let best = 0;
  STOPS.forEach((st, i) => {
    if (!active.includes(st.scene)) return;
    if (st.scene === 'Forest') {
      const want = cp === 'night' ? 5 : cp === 'roam' ? 6 : 4;
      if (i === want) best = i;
    } else best = i;
  });
  return best;
}

/** When skipping past the store, carry a sensible kit so later parts are testable. */
function ensureLoadout(index: number) {
  if (index <= 2 || Game.bought.size > 0) return;
  ['flashlight', 'batteries', 'firstaid', 'water', 'lighter', 'map', 'pistol'].forEach((i) => Game.inv.add(i));
  Game.initCounts();
}

export function installDevSkip(game: Phaser.Game) {
  if (!ENABLED) return;
  const jump = (dir: number) => {
    if (!game.textures.exists('adam')) return; // still booting
    const i = Phaser.Math.Clamp(currentIndex(game) + dir, 0, STOPS.length - 1);
    const stop = STOPS[i];
    AudioSys.unlock(); AudioSys.stopSpeech(); AudioSys.muffle(false);
    game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
    if (i <= 1) Game.reset();
    ensureLoadout(i);
    stop.setup?.(game);
    game.scene.start(stop.scene);
    toast(`${i}/${STOPS.length - 1}  ${stop.label}`);
  };
  window.addEventListener('keydown', (e) => {
    const next = (e.ctrlKey && e.code === 'ArrowRight') || e.code === 'PageDown';
    const prev = (e.ctrlKey && e.code === 'ArrowLeft') || e.code === 'PageUp';
    if (!next && !prev) return;
    e.preventDefault();
    jump(next ? 1 : -1);
  });
  // phones have no keyboard: two small buttons at the top of the screen
  if (window.matchMedia?.('(pointer: coarse)').matches || /[?&]touch=1/.test(location.search)) {
    const mk = (label: string, side: 'left' | 'right', dir: number) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `position:fixed;top:6px;${side}:calc(50% + 6px);z-index:9998;padding:6px 12px;background:rgba(0,0,0,.55);color:#ffd23f;`
        + 'font:11px "Press Start 2P",monospace;border:2px solid rgba(255,210,63,.6);border-radius:6px;opacity:.7;touch-action:manipulation';
      b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); jump(dir); });
      document.body.appendChild(b);
    };
    mk('< PART', 'right', -1);
    mk('PART >', 'left', 1);
  }
}
