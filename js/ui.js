// ══════════════════════════════════════════
//  UI HELPERS: модалки, тосты, делегирование кликов, жесты
// ══════════════════════════════════════════
import { isCollapsed, setCollapsed } from './state.js';

export const $ = id => document.getElementById(id);

export const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

// ── Стек модальных окон ──
// Дочернее окно открывается поверх родительского, не закрывая его. Когда дочернее
// закрывается (сохранение, отмена, удаление), родительское снова показывается в том
// же состоянии и обновляет свои данные через хук refresh.
const stack = [];
const modalHooks = {};
export function registerModal(id, hooks) { modalHooks[id] = hooks; }
export const topModal = () => stack[stack.length - 1] || null;

export function SM(id) {
  if (topModal() === id) return;
  const i = stack.indexOf(id);
  if (i >= 0) stack.splice(i, 1);
  const parent = topModal();
  if (parent) $(parent).classList.add('covered');
  stack.push(id);
  const el = $(id);
  el.classList.remove('covered');
  el.classList.add('show');
}
// Закрывает окно (и всё, что открыто поверх него) и возвращает к родителю
export function CM(id = topModal()) {
  if (!id) return;
  const i = stack.lastIndexOf(id);
  if (i < 0) { $(id).classList.remove('show', 'covered'); return; }
  stack.splice(i).forEach(m => $(m).classList.remove('show', 'covered'));
  const parent = topModal();
  if (parent) {
    $(parent).classList.remove('covered');
    modalHooks[parent]?.refresh?.();
  }
}
document.querySelectorAll('.moverlay').forEach(o => o.addEventListener('click', e => { if (e.target === o && topModal() === o.id) CM(o.id); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && topModal()) CM(); });

// Перерисовка списка внутри окна без потери позиции прокрутки
export function keepScroll(el, render) {
  const top = el.scrollTop; render(); el.scrollTop = top;
}

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
export function askConfirm(title, text, cb, yesLabel = 'Да, удалить') {
  confirmCallback = cb;
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  $('confirm-yes-btn').textContent = yesLabel;
  SM('confirmModal');
}
onAction('confirm-yes', () => { const cb = confirmCallback; confirmCallback = null; CM('confirmModal'); if (cb) cb(); });

let tT;
export function showToast(m) {
  const el = $('toast'); el.textContent = m; el.classList.add('show');
  clearTimeout(tT); tT = setTimeout(() => el.classList.remove('show'), 1800);
}

export function flashInvalid(inp) {
  inp.style.borderColor = 'rgb(var(--accent-rgb))';
  setTimeout(() => inp.style.borderColor = '', 600);
}

// ── Сворачиваемые разделы ──
// <section class="fold" data-fold="key"><button data-action="fold" data-key="key">…</button><div class="fold-body"><div class="fold-inner">…
export function foldClass(key) { return isCollapsed(key) ? ' collapsed' : ''; }
onAction('fold', (d, e, el) => {
  const sec = el.closest('.fold'); if (!sec) return;
  const collapsed = !sec.classList.contains('collapsed');
  setCollapsed(d.key, collapsed);
  const body = sec.querySelector(':scope > .fold-body');
  // overflow:hidden только на время анимации — иначе обрезаются тени карточек
  sec.classList.add('animating');
  sec.classList.toggle('collapsed', collapsed);
  el.setAttribute('aria-expanded', String(!collapsed));
  const done = () => { sec.classList.remove('animating'); body.removeEventListener('transitionend', done); };
  body.addEventListener('transitionend', done);
  setTimeout(done, 450);
});

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
