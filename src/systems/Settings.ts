export interface SettingsData {
  music: number; // 0..1
  sfx: number;
  textSpeed: number; // 1..3
  shake: boolean;
}

const KEY = 'afterlight.settings.v1';
const DEFAULTS: SettingsData = { music: 0.7, sfx: 0.8, textSpeed: 2, shake: true };

let cache: SettingsData | null = null;

export const Settings = {
  get(): SettingsData {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      cache = { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
    } catch {
      cache = { ...DEFAULTS };
    }
    return cache!;
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.get())); } catch { /* private mode */ }
  },
};
