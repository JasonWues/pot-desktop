// tailwind.config.js
const { heroui } = require('@heroui/react');

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        // ...
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
        './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {},
    },
    darkMode: 'class',
    plugins: [
        heroui({
            themes: {
                dark: {
                    colors: {
                        background: '#202020',
                        foreground: '#e7e7e7',
                        content1: '#282828',
                        content2: '#303030',
                        content3: '#383838',
                        content4: '#404040',
                        default: {
                            DEFAULT: '#484848',
                            50: '#282828',
                            100: '#383838',
                            200: '#484848',
                            300: '#585858',
                            400: '#686868',
                            500: '#a7a7a7',
                            600: '#b7b7b7',
                            700: '#c7c7c7',
                            800: '#d7d7d7',
                            900: '#e7e7e7',
                        },
                        primary: {
                            DEFAULT: '#49cee9',
                            foreground: '#181818',
                        },
                    },
                },
                light: {
                    colors: {
                        background: '#ffffff',
                        foreground: '#181818',
                        content1: '#eeeeee',
                        content2: '#dddddd',
                        content3: '#cccccc',
                        content4: '#bbbbbb',
                        default: {
                            DEFAULT: '#999999',
                            50: '#eeeeee',
                            100: '#cccccc',
                            200: '#aaaaaa',
                            300: '#999999',
                            400: '#888888',
                            500: '#686868',
                            600: '#585858',
                            700: '#484848',
                            800: '#383838',
                            900: '#282828',
                        },
                        primary: {
                            foreground: '#ffffff',
                            DEFAULT: '#3578e5',
                        },
                    },
                },
                // Nocturne. Obsidian glass over a drifting aurora, lit by violet
                // and magenta. Everything here is plain HeroUI theme tokens, so
                // every existing `bg-content1` / `text-default-500` / `border-
                // default-100` in the app recolours itself. The parts a token
                // cannot express -- the aurora, the glass, the glow, the grain --
                // live in src/themes/nocturne.css.
                nocturne: {
                    extend: 'dark',
                    layout: {
                        // Tighter than the default 0.25/0.5/0.75rem. Sharp corners
                        // read as deliberate next to the soft aurora behind them.
                        radius: { small: '0.125rem', medium: '0.3rem', large: '0.5rem' },
                        borderWidth: { small: '1px', medium: '1px', large: '2px' },
                        disabledOpacity: '0.35',
                        boxShadow: {
                            small: '0 1px 2px 0 rgb(0 0 0 / 0.5), 0 0 12px -4px rgb(123 97 255 / 0.35)',
                            medium: '0 4px 16px -4px rgb(0 0 0 / 0.6), 0 0 28px -8px rgb(123 97 255 / 0.45)',
                            large: '0 12px 40px -8px rgb(0 0 0 / 0.7), 0 0 60px -12px rgb(123 97 255 / 0.55)',
                        },
                    },
                    colors: {
                        background: '#08080f',
                        foreground: '#eae8fa',
                        content1: '#0f0f1c',
                        content2: '#16162a',
                        content3: '#1e1e38',
                        content4: '#282847',
                        focus: '#7b61ff',
                        // Like the dark theme, the scale runs darkest -> lightest.
                        default: {
                            DEFAULT: '#242440',
                            50: '#0f0f1c',
                            100: '#191930',
                            200: '#242440',
                            300: '#333355',
                            400: '#4a4a70',
                            500: '#8b88b8',
                            600: '#a6a3cc',
                            700: '#c0bedd',
                            800: '#d6d4ec',
                            900: '#eae8fa',
                        },
                        primary: {
                            DEFAULT: '#7b61ff',
                            foreground: '#ffffff',
                            50: '#171034',
                            100: '#241a55',
                            200: '#332676',
                            300: '#453498',
                            400: '#5b45c4',
                            500: '#7b61ff',
                            600: '#9179ff',
                            700: '#ac98ff',
                            800: '#c7b9ff',
                            900: '#e2d9ff',
                        },
                        secondary: {
                            DEFAULT: '#ff3ea5',
                            foreground: '#0a0a14',
                            50: '#3a0a24',
                            100: '#5c0f38',
                            200: '#80174e',
                            300: '#a81f66',
                            400: '#d42b83',
                            500: '#ff3ea5',
                            600: '#ff64b7',
                            700: '#ff8ac9',
                            800: '#ffb1db',
                            900: '#ffd8ed',
                        },
                        success: { DEFAULT: '#2ce8b4', foreground: '#04140f' },
                        warning: { DEFAULT: '#ffc247', foreground: '#1a1204' },
                        danger: { DEFAULT: '#ff4d6d', foreground: '#ffffff' },
                    },
                },
            },
        }),
    ],
};
