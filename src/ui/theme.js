// ── LIGHT / DARK ────────────────────────────────────────────────
// The toggle in each page's header. Until it's pressed the page follows the
// system's setting; pressed, it picks the other theme and remembers it
// (localStorage, the same key the <head> line reads before the page draws).

import { THEME_KEY } from './tokens.js';

const MOON = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M13.5 9.6A5.5 5.5 0 0 1 6.4 2.5a5.5 5.5 0 1 0 7.1 7.1Z"/></svg>';
const SUN = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3"/></svg>';

const systemDark = () => { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } };
// The theme in use now: the page's choice, else the system's
export function currentTheme(doc = document) {
  const t = doc.documentElement.getAttribute('data-theme');
  return t === 'light' || t === 'dark' ? t : (systemDark() ? 'dark' : 'light');
}
export function setTheme(theme, doc = document) {
  doc.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* storage blocked: this visit only */ }
}

// A button for a header: it shows where you'd go (a moon in light, a sun in
// dark) and says so to a screen reader; pressed means dark is on
export function mountThemeToggle(el) {
  if (!el) return null;
  const doc = el.ownerDocument;
  const btn = doc.createElement('button');
  btn.type = 'button'; btn.className = 'theme-toggle ui-button is-secondary is-icon size-sm';
  const paint = () => {
    const dark = currentTheme(doc) === 'dark';
    btn.innerHTML = dark ? SUN : MOON;
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', 'Dark theme');
    btn.title = dark ? 'Switch to the light theme' : 'Switch to the dark theme';
  };
  btn.addEventListener('click', () => { setTheme(currentTheme(doc) === 'dark' ? 'light' : 'dark', doc); paint(); });
  // Following the system: repaint when it changes
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paint); } catch (e) { /* older browsers */ }
  paint();
  el.appendChild(btn);
  return btn;
}

// The toggle is a secondary icon button (src/ui/components.js); nothing of its own
export const THEME_TOGGLE_CSS = '';
