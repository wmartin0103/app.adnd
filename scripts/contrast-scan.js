// A dev check for the light and dark themes (docs/design-system.md,
// Accessibility): every visible piece of text on the page, measured against
// the background it sits on, in both themes. Returns the ones under 4.5:1
// (3:1 for large text). Run it in the browser on a page served from the repo:
//
//   const { scan } = await import('/scripts/contrast-scan.js'); await scan();
//
// Disabled controls are skipped (WCAG exempts them).

export async function scan(doc = document) {
  const cv = doc.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data]; };
  const lum = d => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(d[0]) + 0.7152 * f(d[1]) + 0.0722 * f(d[2]); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // The nearest painted background (a gradient counts by its last colour)
  const bgOf = e => {
    for (let n = e; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage.includes('gradient')) { const m = cs.backgroundImage.match(/(rgba?\([^)]*\)|oklab\([^)]*\)|color\([^)]*\))/g); if (m) return rgba(m[m.length - 1]); }
      const d = rgba(cs.backgroundColor); if (d[3] > 200) return d;
    }
    return rgba(getComputedStyle(doc.body).backgroundColor);
  };
  const name = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const was = doc.documentElement.getAttribute('data-theme');
  const out = {};
  for (const theme of ['light', 'dark']) {
    doc.documentElement.setAttribute('data-theme', theme);
    await new Promise(r => setTimeout(r, 150));
    const bad = {};
    doc.querySelectorAll('body *').forEach(e => {
      if (!e.getClientRects().length) return;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || +cs.opacity < 0.6) return;
      if (e.disabled || e.closest('[disabled]')) return;
      const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || ((e.tagName === 'INPUT' || e.tagName === 'SELECT') && String(e.value || '').trim());
      if (!own) return;
      const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && +cs.fontWeight >= 700);
      const r = ratio(rgba(cs.color), bgOf(e));
      if (r < (large ? 3 : 4.5)) { const k = `${name(e)} ${r.toFixed(2)}`; bad[k] = (bad[k] || 0) + 1; }
    });
    out[theme] = Object.entries(bad).sort((a, b) => b[1] - a[1]).slice(0, 40);
  }
  if (was) doc.documentElement.setAttribute('data-theme', was); else doc.documentElement.removeAttribute('data-theme');
  return out;
}
