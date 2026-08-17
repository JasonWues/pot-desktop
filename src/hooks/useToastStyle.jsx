/*
  The colours are handed over as `var()` references rather than resolved values.
  This used to branch on `theme == 'dark'` against the static `semanticColors`
  table, which silently fell back to the light palette for any theme that was
  not literally named 'dark' -- Nocturne would have drawn light toasts. A var
  reference is resolved by the browser against whatever theme class is on <html>
  at paint time, so it is right for every theme, including ones added later, and
  it needs no re-render to follow a theme switch.
*/
export const useToastStyle = () => {
    return {
        background: 'hsl(var(--heroui-content1))',
        color: 'hsl(var(--heroui-foreground))',
        wordBreak: 'break-all',
        // `userSelect`, not `select`: the latter is not a CSS property, so React
        // dropped it and toast text has never actually been selectable.
        userSelect: 'text',
    };
};
