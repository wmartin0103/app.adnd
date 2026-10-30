// Checks a page against docs/design-system.md: fields, buttons, choices,
// corners, colours, fonts and cards, in the current theme. Run it in the
// browser on a page served from the repo:
//
//   const { audit } = await import('/scripts/design-audit.js'); audit()
//
// Returns { rule: [{ what, why, count }] } for what breaks a rule (usually a
// page's older style winning over a component).

const SIZES = [22, 28, 36, 44];                          // --ctl-xs/sm/md/lg
const RADII = ['0px', '6px', '8px', '10px'];               // control, well/item, card (and none)
const isRound = r => parseFloat(r) >= 999 || /50%/.test(r);
const FONTS = /Barlow|Spectral/;

function tokenColours(doc) {
  const out = new Set(['rgba(0, 0, 0, 0)', 'transparent']);
  const probe = doc.createElement('span'); doc.body.appendChild(probe);
  const root = getComputedStyle(doc.documentElement);
  for (let i = 0; i < root.length; i++) {
    const v = root[i];
    if (!/^--(color-|tag-)/.test(v)) continue;
    probe.style.color = `var(${v})`; out.add(getComputedStyle(probe).color);
  }
  probe.remove();
  return out;
}
const name = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
const shown = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';

export function audit(doc = document) {
  const found = {};
  const add = (rule, e, why) => { const k = `${name(e)} | ${why}`; const r = found[rule] || (found[rule] = new Map()); const x = r.get(k) || { what: name(e), why, count: 0 }; x.count++; r.set(k, x); };
  const colours = tokenColours(doc);
  // A colour counts when it's a token, or a mix of them (color-mix renders as oklab/color(): skip those)
  const offToken = c => !colours.has(c) && /^rgba?\(/.test(c) && !/, 0\)$/.test(c);

  for (const e of doc.body.querySelectorAll('*')) {
    if (!shown(e)) continue;
    const cs = getComputedStyle(e), tag = e.tagName;
    const box = e.getBoundingClientRect();
    // Fields: a component, at a size
    if ((tag === 'INPUT' && !/^(checkbox|radio|hidden|file|range|color)$/.test(e.type)) || tag === 'SELECT' || tag === 'TEXTAREA') {
      const native = e.classList.contains('ui-native'), open = e.classList.contains('open-field');
      if (!native && !open && tag !== 'TEXTAREA' && !SIZES.includes(Math.round(box.height)) && !e.closest('.ui-qty')) add('Field height', e, `${Math.round(box.height)}px`);
      if (!native && !open && tag !== 'TEXTAREA' && !e.closest('.ui-qty') && cs.borderTopWidth !== '1px') add('Field border', e, `border ${cs.borderTopWidth}`);
    }
    // Checkboxes and radios: ours
    if (tag === 'INPUT' && /^(checkbox|radio)$/.test(e.type) && !e.classList.contains('ui-native') && cs.appearance !== 'none') add('Checkbox/radio drawn by the browser', e, cs.appearance);
    // Buttons: a component, at a size
    if (tag === 'BUTTON' || e.getAttribute('role') === 'button') {
      const comp = e.matches('.ui-button, .ui-disclosure, .ui-switch, .ui-tabs > button, .ui-qty > button, .ui-pagetabs > button, .ui-pagetabs > a, .round-multi-btn, .ui-control, .tab');
      if (!comp) add('Button not a component', e, (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24));
      else if (e.matches('.ui-button:not(.is-link)') && !SIZES.includes(Math.round(box.height))) add('Button height', e, `${Math.round(box.height)}px`);
    }
    // Corners
    const r = cs.borderTopLeftRadius;
    const checkLike = tag === 'INPUT' && e.type === 'checkbox' && r === '4px';   // the checkbox component's own corner
    if (!checkLike && r !== '0px' && !RADII.includes(r) && !isRound(r) && (parseFloat(cs.borderTopWidth) > 0 || cs.backgroundColor !== 'rgba(0, 0, 0, 0)')) add('Corner radius', e, r);
    // Fonts
    if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && !FONTS.test(cs.fontFamily)) add('Font', e, cs.fontFamily.split(',')[0]);
    // Colours from the tokens
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (own && offToken(cs.color)) add('Text colour off the tokens', e, cs.color);
    if (offToken(cs.backgroundColor)) add('Background off the tokens', e, cs.backgroundColor);
    if (parseFloat(cs.borderTopWidth) > 0 && offToken(cs.borderTopColor)) add('Border off the tokens', e, cs.borderTopColor);
    // Cards in cards
    if (e.matches('.ui-card, .char') && e.parentElement && e.parentElement.closest('.ui-card, .char') && cs.boxShadow !== 'none' && cs.borderTopWidth !== '0px') add('Card in a card', e, 'inside ' + name(e.parentElement.closest('.ui-card, .char')));
  }
  return Object.fromEntries(Object.entries(found).map(([k, m]) => [k, [...m.values()].sort((a, b) => b.count - a.count)]));
}
