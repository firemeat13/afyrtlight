# AFTERLIGHT
2D atmospheric psychological-horror adventure. Phaser 3 + TypeScript + Vite. No external assets, no API keys.

    npm install
    npm run dev       # http://localhost:5173 (also reachable on your LAN for phone testing)
    npm run build     # production build in dist/

Controls: WASD/arrows move, E/Space/Enter interact + advance dialogue. Touch: left-side drag = joystick, ACT button, tap to advance text.

Replacing art: all placeholder graphics are generated in `src/gfx/Textures.ts` under named keys.
Load real images with the same keys in `BootScene.preload()` and skip the matching generator.
