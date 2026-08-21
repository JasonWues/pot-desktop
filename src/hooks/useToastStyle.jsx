/*
  The colours are handed over as `var()` references rather than resolved values.
  This used to branch on `theme == 'dark'` against the static `semanticColors`
  table, which silently fell back to the light palette for any theme that was
  not literally named 'dark' -- so any third dark theme drew light toasts. A var
  reference is resolved by the browser against whatever theme class is on <html>
  at paint time, so it is right for every theme, including ones added later, and
  it needs no re-render to follow a theme switch.

  The two vars it named, though, were v2's: `hsl(var(--heroui-content1))` wrapped
  a bare HSL triplet that no longer exists anywhere in the tree, so since the v3
  migration every one of the 55 toasts in the app has been asking for an invalid
  colour and getting the library's own default instead -- a white bar with dark
  text, under a dark theme as much as a light one.

  `--overlay` is the pair `.modal__dialog` paints itself with, which is the point:
  a toast and a modal are the same kind of thing -- a surface floating over the
  window -- and they should not be two different surfaces.
*/
export const useToastStyle = () => {
    return {
        background: 'var(--overlay)',
        color: 'var(--overlay-foreground)',

        // Nothing else in the app is rounded, and the library's default is a
        // pill with a soft drop shadow. A 2px rule is how every other floating
        // or divided surface here states its edge.
        borderRadius: 0,
        border: '2px solid var(--border-secondary)',
        boxShadow: 'none',

        // `overflow-wrap: anywhere`, not `word-break: break-all`. Both stop a
        // service's error string -- which is regularly one unbroken URL or JSON
        // blob -- from running off the edge, but break-all also breaks ordinary
        // words mid-letter, so every multi-word message was being hyphenless-
        // hyphenated. `anywhere` breaks only where nothing else will fit.
        overflowWrap: 'anywhere',

        // A translate window is 440 wide; without a cap a long provider error
        // grows the toast past it.
        maxWidth: '90vw',

        // `userSelect`, not `select`: the latter is not a CSS property, so React
        // dropped it and toast text has never actually been selectable.
        userSelect: 'text',
    };
};
