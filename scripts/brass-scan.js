// Finds the action colour (brass) on things you can't press: text, borders
// and fills on elements that aren't buttons, links, fields or summaries, and
// aren't inside one. Run in the browser on a page served from the repo:
//
//   const { brassScan } = await import('/scripts/brass-scan.js'); brassScan()
//
// Returns [{ what, where, prop, count }] grouped by the element's classes.

const INTERACTIVE = 'a[href], button, summary, select, input, textarea, label, [role=button], [role=tab], [tabindex]:not([tabindex="-1"])';

function brassColours(doc) {
  const probe = doc.createElement('span');
  doc.body.appendChild(probe);
  const out = new Set();
  for (const v of ['--color-accent', '--color-accent-text', '--color-accent-strong', '--color-accent-edge', '--color-focus']) {
    probe.style.color = `var(${v})`;
    out.add(getComputedStyle(probe).color);
  }
  probe.remove();
  return out;
}

export function brassScan(doc = document) {
  const brass = brassColours(doc);
  const groups = new Map();
  for (const el of doc.body.querySelectorAll('*')) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
    if (el.closest(INTERACTIVE)) continue;
    const cs = getComputedStyle(el);
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const hits = [];
    if (own && brass.has(cs.color)) hits.push('color');
    if (brass.has(cs.backgroundColor)) hits.push('background');
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(cs[`border${side}Width`]) > 0 && brass.has(cs[`border${side}Color`])) { hits.push('border'); break; }
    }
    if (/inset/.test(cs.boxShadow) && [...brass].some(c => cs.boxShadow.includes(c))) hits.push('shadow');
    if (!hits.length) continue;
    const what = `${el.tagName.toLowerCase()}${el.classList.length ? '.' + [...el.classList].join('.') : ''}`;
    const key = `${what}|${hits.join(',')}`;
    const g = groups.get(key) || { what, prop: hits.join(','), count: 0, sample: (el.textContent || '').trim().slice(0, 40) };
    g.count++;
    groups.set(key, g);
  }
  return [...groups.values()];
}
