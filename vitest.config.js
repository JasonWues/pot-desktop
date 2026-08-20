import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Separate from vite.config.js on purpose. That file carries the build targets
// and the watch exclusions the Tauri build depends on, several of them with a
// bug behind them; nothing about running tests should be able to disturb it.
export default defineConfig({
    plugins: [react()],
    test: {
        // Node by default -- most of what is worth testing here is plain
        // functions. The files that need a DOM ask for one with a
        // `@vitest-environment jsdom` docblock at the top.
        environment: 'node',
        setupFiles: ['./vitest.setup.js'],
        globals: true,
        include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    },
});
