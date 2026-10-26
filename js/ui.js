// ══════════════════════════════════════════
//  UI HELPERS: модалки, тосты, делегирование кликов
// ══════════════════════════════════════════
export const $ = id => document.getElementById(id);

export const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export function SM(id) { $(id).classList.add('show'); }
export function CM(id) { $(id).classList.remove('show'); }
document.querySelectorAll('.moverlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('show'); }));

// Вместо inline onclick: <div data-action="name" data-id="…"> + onAction('name', (data, event, el) => …)
const actions = {};
export function onAction(name, fn) { actions[name] = fn; }
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el.dataset, e, el);
});
onAction('close', d => CM(d.modal));

let confirmCallback = null;
export function askConfirm(title, text, cb) {
  confirmCallback = cb;
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  SM('confirmModal');
}
onAction('confirm-yes', () => { if (confirmCallback) confirmCallback(); CM('confirmModal'); });

let tT;
export function showToast(m) {
  const el = $('toast'); el.textContent = m; el.classList.add('show');
  clearTimeout(tT); tT = setTimeout(() => el.classList.remove('show'), 1800);
}

export function flashInvalid(inp) {
  inp.style.borderColor = '#f472a8';
  setTimeout(() => inp.style.borderColor = '', 600);
}

// Тап по чекбоксу / долгое нажатие / (опционально) свайп влево на карточке
export function attachCardGestures(card, { checkSel, ignoreSel, onTap, onLong, swipe }) {
  let x0=0, y0=0, dragging=false, moved=false, longTimer=null, longFired=false, active=false, onCheckbox=false, isTouch=false;

  const start = (e) => {
    if (ignoreSel && e.target.closest(ignoreSel)) { active = false; return; }
    active = true;
    onCheckbox = !!e.target.closest(checkSel);
    const pt = e.touches ? e.touches[0] : e;
    x0 = pt.clientX; y0 = pt.clientY; dragging = false; moved = false; longFired = false;
    longTimer = setTimeout(() => { longFired = true; onLong(); }, 550);
  };
  const move = (e) => {
    if (!active) return;
    const pt = e.touches ? e.touches[0] : e;
    const dx = pt.clientX - x0, dy = pt.clientY - y0;
    // Any real movement (in any direction) cancels the long-press timer
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) { clearTimeout(longTimer); moved = true; }
    // Only treat as a horizontal swipe if horizontal motion clearly dominates vertical motion
    if (swipe && Math.abs(dx) > Math.abs(dy) * 1.5 && dx < 0) {
      dragging = true;
      swipe.set(Math.max(dx, -swipe.width));
    }
  };
  const end = (e) => {
    if (!active) return;
    clearTimeout(longTimer);
    if (dragging) {
      const pt = e.changedTouches ? e.changedTouches[0] : e;
      const dx = pt.clientX - x0;
      swipe.set(dx < -40 ? -swipe.width : 0);
      dragging = false;
      return;
    }
    if (longFired) { longFired = false; return; }
    // The finger moved (e.g. scrolling the page vertically) — do NOT act in that case.
    if (moved) return;
    if (swipe && swipe.isOpen()) { swipe.set(0); return; }
    // Only a tap directly on the checkbox toggles — tapping elsewhere does nothing.
    if (onCheckbox) onTap();
  };
  const cancel = () => { clearTimeout(longTimer); dragging = false; };

  card.addEventListener('touchstart', e => { isTouch=true; start(e); }, {passive:true});
  card.addEventListener('touchmove', move, {passive:true});
  card.addEventListener('touchend', e => { end(e); setTimeout(()=>isTouch=false,400); });
  card.addEventListener('touchcancel', cancel);
  card.addEventListener('mousedown', e => { if (!isTouch) start(e); });
  card.addEventListener('mousemove', e => { if (!isTouch && e.buttons===1) move(e); });
  card.addEventListener('mouseup', e => { if (!isTouch) end(e); });
}
