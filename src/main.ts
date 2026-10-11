import Phaser from 'phaser';
import { H, W } from './config';
import { AudioSys } from './systems/AudioSys';
import { Game } from './systems/GameState';
import { installDevSkip } from './systems/DevSkip';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { SettingsScene } from './scenes/SettingsScene';
import { IntroScene } from './scenes/IntroScene';
import { ForestScene } from './scenes/ForestScene';
import { CallScene } from './scenes/CallScene';
import { StoreScene } from './scenes/StoreScene';
import { HollowScene } from './scenes/HollowScene';
import { MeadowScene } from './scenes/MeadowScene';
import { CabinScene } from './scenes/CabinScene';
import { AftermathScene } from './scenes/AftermathScene';
import { WarningScene } from './scenes/WarningScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#05030c',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [BootScene, WarningScene, TitleScene, SettingsScene, CallScene, StoreScene, IntroScene, ForestScene, MeadowScene, HollowScene, CabinScene, AftermathScene],
});

// Browsers require a gesture before audio can start.
const unlock = () => AudioSys.unlock();
['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));

// Phones: go fullscreen and lock to landscape on the first touch (where the browser allows it).
let wentFull = false;
window.addEventListener('touchend', () => {
  if (wentFull) return;
  wentFull = true;
  const el = document.documentElement as any;
  try {
    const req = el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.();
    Promise.resolve(req).then(() => (screen.orientation as any)?.lock?.('landscape')).catch(() => {});
  } catch { /* not supported (e.g. iPhone Safari) */ }
}, { passive: true });

(window as any).__afterlight = game; // handy for debugging / automated tests
(window as any).__state = Game;
installDevSkip(game);
