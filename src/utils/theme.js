// @ts-check
/*
  Single source of truth for the theme names, so the Settings dropdown and the
  next-themes provider cannot drift apart. That matters more than it looks:
  next-themes only strips the classes it was told about, so a theme missing from
  this list would be added to <html> and then never removed when the user
  switches away, leaving two theme classes fighting.
*/

// Values that can end up as a class on <html>.
export const colorThemes = ['light', 'dark'];

// What Settings offers. `system` is resolved to light or dark in App.jsx and is
// never applied as a class itself.
export const themeOptions = ['system', ...colorThemes];
