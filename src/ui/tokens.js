// ── DESIGN TOKENS ───────────────────────────────────────────────
// The design system's values (docs/design-system.md): Midnight & Brass in
// light and dark, Barlow and Spectral, the control sizes, radii and shadows.
// scripts/build-legacy.mjs writes them into the <head> of every page (the
// tools and the site pages), with a line that sets the theme before the
// page draws, so there's no flash of the other theme. Components use these
// names only; the two themes differ in values, never in components.

export const COLORS = {
  light: {
    bg: '#eef2f6', surface: '#fdfeff', raised: '#fdfeff', sunken: '#e3e8ee', divider: '#d8dde3',
    text: '#0f1923', 'text-muted': '#414f5d', 'text-faint': '#596571', border: '#687686',
    accent: '#dcaf6c', 'accent-strong': '#ce9e58', 'accent-edge': '#966b2e', 'on-accent': '#261a09', 'accent-text': '#754f19', focus: '#835a20',
    accent2: '#334a62', 'on-accent2': '#f6f9fb', 'accent2-text': '#334a62',
    danger: '#a03f3c', 'on-danger': '#fefbfb', 'danger-text': '#983b38',
    'success-text': '#286648', highlight: '#96ddb6', 'on-highlight': '#0e271b',
    bar: '#1b222a', 'bar-text': '#f0f2f4', 'bar-muted': '#b0b8c1', 'bar-title': '#e8bc7d', 'bar-active': '#e3b572',
  },
  dark: {
    bg: '#0a0f14', surface: '#12181e', raised: '#1b2129', sunken: '#06080d', divider: '#242b33',
    text: '#ebeff4', 'text-muted': '#b2bbc8', 'text-faint': '#969fab', border: '#5f6a77',
    accent: '#dcaf61', 'accent-strong': '#edc47d', 'accent-edge': '#dcaf61', 'on-accent': '#201300', 'accent-text': '#e0b771', focus: '#e0b771',
    accent2: '#9bbeff', 'on-accent2': '#0d1a32', 'accent2-text': '#a5c5fe',
    danger: '#f07f77', 'on-danger': '#290b0a', 'danger-text': '#f4928a',
    'success-text': '#6ccea6', highlight: '#5ed8a9', 'on-highlight': '#002115',
    bar: '#04080d', 'bar-text': '#ebeff4', 'bar-muted': '#a3acb8', 'bar-title': '#e6bd77', 'bar-active': '#e3b667',
  },
};

// The select chevron, in the muted text colour (an image: a data URI can't read a CSS colour)
const chevron = hex => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23${hex}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

// A number field's up/down icon, the same strokes
const spin = hex => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 16'%3E%3Cpath d='M2 6l3-3 3 3M2 10l3 3 3-3' fill='none' stroke='%23${hex}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

// Tags (docs/design-system.md, Tags; "Rising power", decided 2026-10-28): spell
// levels 1-9 deepen from slate to brass-gold; Wizard, Priest, Magic items and
// proficiency rolls each have a hue. A soft fill, a deep text, a hairline edge.
export const TAGS = {
  light: { 'tag-l1-bg': '#dfebf8', 'tag-l1-text': '#2d4a67', 'tag-l1-edge': '#bbcde0',
    'tag-l2-bg': '#d9edf7', 'tag-l2-text': '#164e65', 'tag-l2-edge': '#b3d0de',
    'tag-l3-bg': '#d5eff3', 'tag-l3-text': '#02525b', 'tag-l3-edge': '#acd3d9',
    'tag-l4-bg': '#d4f1ed', 'tag-l4-text': '#01544e', 'tag-l4-edge': '#aad5cf',
    'tag-l5-bg': '#d6f1e4', 'tag-l5-text': '#00553d', 'tag-l5-edge': '#add5c3',
    'tag-l6-bg': '#dbf0db', 'tag-l6-text': '#1e5523', 'tag-l6-edge': '#b5d4b5',
    'tag-l7-bg': '#e4eed2', 'tag-l7-text': '#3d5001', 'tag-l7-edge': '#c2d2a8',
    'tag-l8-bg': '#eeebcc', 'tag-l8-text': '#504900', 'tag-l8-edge': '#d1cd9e',
    'tag-l9-bg': '#f9e7c9', 'tag-l9-text': '#5e4201', 'tag-l9-edge': '#e0c799',
    'tag-wizard-bg': '#dfeafe', 'tag-wizard-text': '#254582', 'tag-wizard-edge': '#b5cbf3',
    'tag-priest-bg': '#d2f3e3', 'tag-priest-text': '#00563c', 'tag-priest-edge': '#a7d8c1',
    'tag-magic-bg': '#f2e3fe', 'tag-magic-text': '#5a3473', 'tag-magic-edge': '#d7c0e8',
    'tag-roll-bg': '#d2f3e3', 'tag-roll-text': '#00563c', 'tag-roll-edge': '#a7d8c1' },
  dark: { 'tag-l1-bg': '#232f3b', 'tag-l1-text': '#bbd4ef', 'tag-l1-edge': '#3a4959',
    'tag-l2-bg': '#1d313a', 'tag-l2-text': '#aed8ed', 'tag-l2-edge': '#324c58',
    'tag-l3-bg': '#173337', 'tag-l3-text': '#a4dce5', 'tag-l3-edge': '#2b4e53',
    'tag-l4-bg': '#143431', 'tag-l4-text': '#a0dfd8', 'tag-l4-edge': '#28504c',
    'tag-l5-bg': '#173429', 'tag-l5-text': '#a5e0c6', 'tag-l5-edge': '#2c5041',
    'tag-l6-bg': '#1f3420', 'tag-l6-text': '#b2dfb3', 'tag-l6-edge': '#355035',
    'tag-l7-bg': '#293215', 'tag-l7-text': '#c6db9f', 'tag-l7-edge': '#414d29',
    'tag-l8-bg': '#332f0c', 'tag-l8-text': '#dbd490', 'tag-l8-edge': '#4e491e',
    'tag-l9-bg': '#3c2b07', 'tag-l9-text': '#f0cb88', 'tag-l9-edge': '#5a4418',
    'tag-wizard-bg': '#202e47', 'tag-wizard-text': '#b9d2fe', 'tag-wizard-edge': '#364868',
    'tag-priest-bg': '#103627', 'tag-priest-text': '#9be3c3', 'tag-priest-edge': '#245240',
    'tag-magic-bg': '#352641', 'tag-magic-text': '#e2c2fb', 'tag-magic-edge': '#523e60',
    'tag-roll-bg': '#103627', 'tag-roll-text': '#9be3c3', 'tag-roll-edge': '#245240' },
};

// Shadows and the step direction differ by theme too (depth: shadow in light,
// a lighter surface in dark; hover and pressing mix toward black or white)
const DEPTH = {
  light: {
    'shadow-card': '0 1px 2px rgb(20 16 12 / .06), 0 1px 3px rgb(20 16 12 / .10)',
    'shadow-raised': '0 12px 30px rgb(20 16 12 / .16), 0 2px 6px rgb(20 16 12 / .08)',
    'shadow-well': 'inset 0 2px 4px rgb(20 16 12 / .14), inset 0 1px 1px rgb(20 16 12 / .08)',
    'edge-top': 'transparent', toward: '#000', scrim: 'rgb(15 25 35 / .45)', chevron: chevron('414f5d'), spin: spin('414f5d'),
  },
  dark: {
    'shadow-card': '0 1px 2px rgb(0 0 0 / .5)',
    'shadow-raised': '0 14px 34px rgb(0 0 0 / .55), 0 2px 6px rgb(0 0 0 / .4)',
    'shadow-well': 'inset 0 2px 5px rgb(0 0 0 / .45), inset 0 1px 1px rgb(0 0 0 / .3)',
    'edge-top': 'rgb(255 255 255 / .05)', toward: '#fff', scrim: 'rgb(0 0 0 / .6)', chevron: chevron('b2bbc8'), spin: spin('b2bbc8'),
  },
};

// The same in both themes
export const CONSTANTS = {
  'font-serif': "'Spectral', Georgia, serif",
  'font-sans': "'Barlow', system-ui, sans-serif",
  'ctl-xs': '22px', 'ctl-sm': '28px', 'ctl-md': '36px', 'ctl-lg': '44px',
  'ctl-fs-xs': '12px', 'ctl-fs-sm': '13px', 'ctl-fs-md': '15px', 'ctl-fs-lg': '17px',
  'ctl-ico-xs': '12px', 'ctl-ico-sm': '14px', 'ctl-ico-md': '16px', 'ctl-ico-lg': '20px',
  'ctl-pad-xs': '6px', 'ctl-pad-sm': '8px', 'ctl-pad-md': '12px', 'ctl-pad-lg': '16px',
  'radius-ctl': '6px', 'radius-inner': '8px', 'radius-card': '10px',
  'page-max': '1440px', 'page-gutter': 'clamp(16px, 3vw, 40px)',
};

// The fonts: Barlow 400/500/600, Spectral 600/700 (docs/design-system.md, Type)
export const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Spectral:wght@600;700&display=swap';

const block = vars => Object.entries(vars).map(([k, v]) => `  --${/^(font|ctl|radius|page)/.test(k) ? '' : 'color-'}${k}: ${v};`).join('\n');
const themeVars = mode => `${block(COLORS[mode])}\n${Object.entries(DEPTH[mode]).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n${Object.entries(TAGS[mode]).map(([k, v]) => `  --${k}: ${v};`).join('\n')}`;

// Light by default; dark when the system asks for it and no choice was made,
// or when the page chose it (data-theme on <html>, set by the toggle)
export function tokensCSS() {
  return [
    `:root {\n${block(CONSTANTS)}\n${themeVars('light')}\n  color-scheme: light;\n}`,
    `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n${themeVars('dark').replace(/^/gm, '  ')}\n    color-scheme: dark;\n  }\n}`,
    `:root[data-theme="dark"] {\n${themeVars('dark')}\n  color-scheme: dark;\n}`,
  ].join('\n');
}

// Runs in <head> before the page draws: a choice made with the toggle wins
export const THEME_KEY = 'adnd-theme';
export const themeInitScript = () =>
  `try { var t = localStorage.getItem('${THEME_KEY}'); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) { /* storage blocked: follow the system */ }`;
