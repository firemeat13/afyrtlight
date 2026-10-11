export const W = 960;
export const H = 540;
/** Pixel-art upscale factor for generated sprites. */
export const S = 3;
export const TREE_S = 2.5;
/** Adam and Nicholas are the same height. */
export const ADAM_SCALE = 4.4;
export const NICK_SCALE = 4.4;
export const FONT = '"Press Start 2P", "Courier New", monospace';
export const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

/** Y where the ground begins (trees/props must stand on or below this line). */
export const GROUND_TOP = 300;
export const BAND_TOP = 335; // walkable band (feet y)
export const BAND_BOT = 410;

export type Phase = 'day' | 'night';

export const COL = {
  adam: '#ff8a5c',
  nicholas: '#7fc4ff',
  voice: '#c9a0ff',
  sys: '#d8d8d8',
  cashier: '#9be37a',
  radio: '#ff6b6b',
};

export const PETAL = { gold: 0xffd23f, red: 0xff4d6d, blue: 0x5aa9ff } as const;
export type PetalKey = keyof typeof PETAL;
