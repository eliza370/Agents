// -------------------------------------------------------------------
// theme.js — colour palettes for light and dark mode.
//
// Both palettes have exactly the same keys. App.jsx picks one of them
// based on the current theme, so every colour in the UI switches at
// once and nothing needs a per-component override.
//
// The urgency colours (overdue / urgent / upcoming / active) are not
// simply the light values darkened. Saturated reds and oranges that
// read as clear warnings on a pale background turn muddy and hard to
// read on a dark one, so the dark set uses lighter, less saturated
// text colours over deep, low-contrast backgrounds.
// -------------------------------------------------------------------

export const LIGHT = {
  bg: '#f5f5f0',
  card: '#ffffff',
  border: '#e0ddd6',
  text: '#1a1a1a',
  textMuted: '#666660',
  textLight: '#999990',

  // Primary button (the dark "Add document" button)
  accent: '#1a1a1a',
  accentText: '#ffffff',

  // Tells the browser how to render native widgets (date pickers, scrollbars)
  colorScheme: 'light',

  overdue:  { text: '#c0392b', bg: '#fdf0ef', border: '#e74c3c' },
  urgent:   { text: '#b7590a', bg: '#fef6ee', border: '#e67e22' },
  upcoming: { text: '#1a6fa8', bg: '#eef6fd', border: '#3498db' },
  active:   { text: '#1a7a47', bg: '#eefaf3', border: '#2ecc71' },
  ongoing:  { text: '#555555', bg: '#f5f5f5', border: '#cccccc' },
  inactive: { text: '#999999', bg: '#f5f5f5', border: '#dddddd' },
};

export const DARK = {
  bg: '#16161a',
  card: '#1e1e23',
  border: '#32323a',
  text: '#ececf0',
  textMuted: '#a0a0aa',
  textLight: '#71717c',

  // Inverted: on dark, the primary button is the light one
  accent: '#ececf0',
  accentText: '#16161a',

  colorScheme: 'dark',

  overdue:  { text: '#ff9182', bg: '#3a1f1c', border: '#e5534b' },
  urgent:   { text: '#ffb872', bg: '#3a2a17', border: '#d98324' },
  upcoming: { text: '#7cc4f5', bg: '#152a3a', border: '#3498db' },
  active:   { text: '#6fd99a', bg: '#15301f', border: '#2ecc71' },
  ongoing:  { text: '#a0a0aa', bg: '#26262c', border: '#3a3a44' },
  inactive: { text: '#71717c', bg: '#26262c', border: '#32323a' },
};

export const THEMES = { light: LIGHT, dark: DARK };
