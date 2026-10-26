// ══════════════════════════════════════════
//  SORTABLE — перетаскивание в режиме сортировки (как иконки на iPhone)
//  Без HTML5 drag-and-drop: свои обработчики touch и mouse.
//  Долгое нажатие поднимает элемент, его копия следует за пальцем, пунктирный
//  плейсхолдер показывает место вставки. Короткое нажатие — onTap.
// ══════════════════════════════════════════
const HOLD_MS = 280, MOVE_TOLERANCE = 8, EDGE = 64, MAX_SPEED = 14;

let session = null; // одно перетаскивание за раз

const directChildren = (container, sel) => [...container.children].filter(el => el.matches(sel));

function pickUp(item, opts, y) {
  const { container, itemSel } = opts;
  const rect = item.getBoundingClientRect();
  const ph = document.createElement('div');
  ph.className = 'sort-ph';
  ph.style.height = rect.height + 'px';
  container.insertBefore(ph, item);

  const ghost = item.cloneNode(true);
  ghost.classList.add('sort-ghost');
  Object.assign(ghost.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px' });
  document.body.appendChild(ghost);
  requestAnimationFrame(() => ghost.classList.add('lifted'));
  item.style.display = 'none';
  if (navigator.vibrate) navigator.vibrate(8);

  const scroller = item.closest('.scroll, .mscroll');
  const offset = y - rect.top;
  let lastY = y, raf = 0, settling = false;

  const reposition = () => {
    ghost.style.top = (lastY - offset) + 'px';
    let before = null;
    for (const s of directChildren(container, itemSel)) {
      if (s === item) continue;
      const r = s.getBoundingClientRect();
      if (lastY < r.top + r.height / 2) { before = s; break; }
    }
    if (before) { if (ph.nextElementSibling !== before) container.insertBefore(ph, before); }
    else if (container.lastElementChild !== ph) container.appendChild(ph);
  };

  // Автопрокрутка у верхнего/нижнего края — для длинных списков
  const tick = () => {
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      const top = r.top + EDGE, bottom = Math.min(r.bottom, window.innerHeight - 90) - EDGE;
      let v = 0;
      if (lastY < top) v = -Math.min(MAX_SPEED, (top - lastY) / 3);
      else if (lastY > bottom) v = Math.min(MAX_SPEED, (lastY - bottom) / 3);
      if (v) { scroller.scrollTop += v; reposition(); }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  session = {
    item,
    move(y2) { if (settling) return; lastY = y2; reposition(); },
    drop() {
      if (settling) return;
      settling = true;
      cancelAnimationFrame(raf);
      const r = ph.getBoundingClientRect();
      ghost.classList.remove('lifted');
      ghost.style.top = r.top + 'px';
      setTimeout(() => {
        container.insertBefore(item, ph);
        ph.remove(); ghost.remove();
        item.style.display = '';
        session = null;
        opts.onDrop(directChildren(container, itemSel).map(el => el.dataset.id));
      }, 170);
    },
  };
}

export function attachSortable(item, opts) {
  let timer = null, x0 = 0, y0 = 0, moved = false, pressed = false, isTouch = false;

  const begin = (pt) => {
    if (session) return;
    pressed = true; moved = false; x0 = pt.clientX; y0 = pt.clientY;
    timer = setTimeout(() => { timer = null; pickUp(item, opts, y0); }, HOLD_MS);
  };
  const move = (pt, e) => {
    if (session && session.item === item) { if (e.cancelable) e.preventDefault(); session.move(pt.clientY); return; }
    if (!pressed || moved) return;
    if (Math.abs(pt.clientX - x0) > MOVE_TOLERANCE || Math.abs(pt.clientY - y0) > MOVE_TOLERANCE) {
      moved = true; clearTimeout(timer); timer = null; // это прокрутка, а не перетаскивание
    }
  };
  const finish = () => {
    if (session && session.item === item) { session.drop(); pressed = false; return; }
    const isTap = pressed && timer && !moved;
    clearTimeout(timer); timer = null; pressed = false;
    // Откладываем, чтобы синтетический click попал в старую разметку, а не в перерисованную
    if (isTap && opts.onTap) setTimeout(opts.onTap, 0);
  };

  item.addEventListener('touchstart', e => { isTouch = true; begin(e.touches[0]); }, { passive: true });
  // passive:false — чтобы во время перетаскивания отменить прокрутку страницы
  item.addEventListener('touchmove', e => move(e.touches[0], e), { passive: false });
  item.addEventListener('touchend', e => {
    finish();
    if (e.cancelable) e.preventDefault(); // без синтетического click после тапа
    setTimeout(() => isTouch = false, 400);
  });
  item.addEventListener('touchcancel', () => { clearTimeout(timer); timer = null; pressed = false; if (session && session.item === item) session.drop(); });

  item.addEventListener('mousedown', e => {
    if (isTouch || e.button !== 0) return;
    begin(e);
    const mm = ev => move(ev, ev);
    const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); finish(); };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  });
}

// Новые значения order: те же числа, что были у элементов раздела, но в новом
// порядке — так соседние разделы и скрытые задачи не сдвигаются.
export function reassignOrder(list, ids) {
  const byId = new Map(list.map(x => [x.id, x]));
  const items = ids.map(id => byId.get(id)).filter(Boolean);
  const slots = items.map(x => x.order || 0).sort((a, b) => a - b);
  // одинаковые значения (старые данные) разводим, чтобы порядок был однозначным
  for (let i = 1; i < slots.length; i++) if (slots[i] <= slots[i-1]) slots[i] = slots[i-1] + 1;
  items.forEach((x, i) => { x.order = slots[i]; });
}
