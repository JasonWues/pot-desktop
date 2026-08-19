import { useTranslation } from 'react-i18next';
import { warn } from '@tauri-apps/plugin-log';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';

import { useConfig } from './useConfig';

// Theme, language and typeface, applied to whichever window is rendering. Every
// window mounts App.jsx, so this runs once per window and each keeps itself in
// step through the `<key>_changed` events `useConfig` already emits -- there is
// no second copy of the state anywhere, the config store is still the only one.
export function useAppConfig() {
    const [appTheme] = useConfig('app_theme', 'system');
    const [appLanguage] = useConfig('app_language', 'en');
    const [appFont] = useConfig('app_font', 'default');
    const [appFallbackFont] = useConfig('app_fallback_font', 'default');
    const [appFontSize] = useConfig('app_font_size', 16);
    const { setTheme } = useTheme();
    const { i18n } = useTranslation();

    useEffect(() => {
        if (appTheme === null) return;
        if (appTheme !== 'system') {
            setTheme(appTheme);
            return;
        }
        try {
            const query = window.matchMedia('(prefers-color-scheme: dark)');
            const apply = (isDark) => setTheme(isDark ? 'dark' : 'light');
            apply(query.matches);
            // Returned as the effect's cleanup, so switching away from 'system'
            // drops the listener. The old code added one each time this ran and
            // removed none, which left a stale listener fighting the new theme.
            const listener = (e) => apply(e.matches);
            query.addEventListener('change', listener);
            return () => query.removeEventListener('change', listener);
        } catch {
            warn("Can't detect system theme.");
        }
    }, [appTheme]);

    useEffect(() => {
        if (appLanguage !== null) {
            i18n.changeLanguage(appLanguage);
        }
    }, [appLanguage]);

    useEffect(() => {
        if (appFont !== null && appFallbackFont !== null) {
            document.documentElement.style.fontFamily = `"${appFont === 'default' ? 'sans-serif' : appFont}","${
                appFallbackFont === 'default' ? 'sans-serif' : appFallbackFont
            }"`;
        }
    }, [appFont, appFallbackFont]);

    // On `<html>`, which is what makes `1rem` the reading size the user picked --
    // see the note in src/styles/flat.css about chrome in px and content in rem.
    useEffect(() => {
        if (appFontSize !== null) {
            document.documentElement.style.fontSize = `${appFontSize}px`;
        }
    }, [appFontSize]);
}
