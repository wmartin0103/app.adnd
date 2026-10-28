// ── SPIN BUTTONS ────────────────────────────────────────────────
// A number field that keeps up/down buttons (class="has-spin") shows our own
// icon (the --spin token, drawn in its right padding, no box behind it) in
// place of the browser's. Clicking the top half of that area steps up, the
// bottom half steps down; the arrow keys work as they always do. One listener
// for the page, so fields drawn later work too.

const FIELD = 'input[type=number].has-spin';
// Is the pointer over the icon (the field's right padding)?
function overSpin(el, e) {
  const r = el.getBoundingClientRect();
  const pad = parseFloat(getComputedStyle(el).paddingRight) || 0;
  return e.clientX >= r.right - pad - 2 && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

export function mountSpin(doc = document) {
  doc.addEventListener('mousedown', e => {
    const el = e.target.closest && e.target.closest(FIELD);
    if (!el || el.disabled || el.readOnly || !overSpin(el, e)) return;
    e.preventDefault();
    el.focus();
    const r = el.getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) el.stepUp(); else el.stepDown();
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // The pointer cursor over the icon only
  doc.addEventListener('mousemove', e => {
    const el = e.target.closest && e.target.closest(FIELD);
    if (el) el.classList.toggle('on-spin', overSpin(el, e));
  });
}
