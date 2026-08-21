import { Toaster } from 'react-hot-toast';
import React from 'react';

import { useToastStyle } from '../../hooks';

/*
  The app's one toaster, mounted per window from App.jsx.

  There used to be sixteen bare `<Toaster />`s, one per page and one more inside
  several of the modals those pages open. A `<Toaster>` renders every toast in
  the store that shares its `toasterId`, and all sixteen took the default id --
  so whenever two were mounted at once, which is exactly what happens when a
  service config modal sits on top of the Service page, every toast was drawn
  twice, stacked. Mounting one above the window's own component is what makes
  that structurally impossible rather than merely fixed.

  `toastOptions.style` covers the toasts that pass no style of their own;
  the 55 that call `useToastStyle()` pass the same object, so the two agree.
*/
export default function AppToaster() {
    const toastStyle = useToastStyle();

    return (
        <Toaster
            position='top-center'
            toastOptions={{
                style: toastStyle,
                /*
                  The library's own icons are a green tick and a red cross at
                  fixed hex values, which are the two colours in the app that do
                  not come from the theme. Pointing them at the tokens means an
                  error reads as the app's danger colour and a success as its
                  accent, in every theme -- and `secondary` is the glyph drawn
                  *inside* the disc, so it has to be the paired foreground or the
                  tick disappears into its own background.
                */
                success: {
                    iconTheme: { primary: 'var(--accent)', secondary: 'var(--accent-foreground)' },
                },
                error: {
                    iconTheme: { primary: 'var(--danger)', secondary: 'var(--danger-foreground)' },
                    // A provider's failure is worth reading; the default 4s is
                    // not enough for a sentence of it.
                    duration: 6000,
                },
                loading: {
                    iconTheme: { primary: 'var(--muted)', secondary: 'var(--overlay)' },
                },
            }}
        />
    );
}
