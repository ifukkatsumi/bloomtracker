// ══════════════════════════════════════════
//  MARATHON — «60 дней до Нового года»
//  Отдельный список задач (bloom_marathon_v1), не связан с обычными задачами.
//  Категории (bloom_mcats_v1) — метка задачи; задача остаётся в своей неделе.
// ══════════════════════════════════════════
import { state, saveMarathon, saveCats, saveUI, isCollapsed, setCollapsed } from './state.js';
import { today, plural, addDays } from './dates.js';
import { M_WEEKS, M_TOTAL, currentWeekN, marathonPhase } from './marathonplan.js';
import { byOrder } from './tasklogic.js';
import { $, esc, SM, CM, onAction, askConfirm, showToast, flashInvalid, attachCardGestures, registerModal, keepScroll, foldClass } from './ui.js';
import { attachSortable, reassignOrder } from './sortable.js';
import { sortHint } from './habits.js';
import { updateTopCard } from './topcard.js';

const MAX_CATS = 9;          // сетка 3×3
const LIST_ROWS = 5;         // «Задачи» раскрываются максимум на 5 строк, дальше — прокрутка

let built = false;
let sortMode = false;
let editId = null, mmWeek = null, mmDone = false, mmCat = null;
let catId = null;            // открытая категория
let catEditId = null;        // переименовываемая категория (null — новая)

const findM = id => state.marathon.find(x => x.id === id);
const findCat = id => state.mcats.find(c => c.id === id);
const sortedCats = () => state.mcats.slice().sort(byOrder);
// активные сверху, выполненные внизу; внутри — пользовательский порядок
const activeFirst = (a, b) => (a.done - b.done) || byOrder(a, b);
const listOf = week => state.marathon.filter(t => (t.week || null) === week).sort(activeFirst);

// Фильтры карточки «Задачи»
const VIEWS = {
  all:  { label: 'все',    filter: () => true,     empty: 'Задач пока нет — напиши первую выше' },
  plan: { label: 'план',   filter: t => !t.week,   empty: 'Все задачи распределены по неделям' },
  done: { label: 'готово', filter: t => t.done,    empty: 'Пока ничего не выполнено' },
};
const mView = () => VIEWS[state.ui.mView] ? state.ui.mView : 'all';

function refresh() {
  saveMarathon(); renderMarathon(); updateTopCard();
  if ($('catModal').classList.contains('show')) keepScroll($('cat-list'), renderCatScreen);
}

function addTask(text, week, category = null) {
  state.marathon.push({ id: Date.now().toString() + Math.random().toString(36).slice(2, 6), text, week: week || null, category, done: false, createdAt: today(), order: Date.now() });
}

// ── sort mode ──
export function exitMarathonSort() { if (sortMode) { sortMode = false; renderMarathon(); } }
onAction('m-sort-done', exitMarathonSort);

// ── page ──
// Каркас строится один раз: поле быстрого добавления не пересоздаётся, поэтому
// после Enter клавиатура остаётся открытой и можно вводить задачи подряд.
function buildSkeleton() {
  const el = $('marathon-content');
  el.innerHTML = `
    <div id="m-sort-hint"></div>
    <div id="m-stale"></div>
    <section class="fold m-card m-grid-card${foldClass('m.grid')}">
      <button class="fold-head" data-action="fold" data-key="m.grid">
        <span class="m-ic">📅</span><span class="fold-title">60 дней</span><span class="chev"></span><span class="m-grid-sum" id="m-grid-sum"></span>
      </button>
      <div class="fold-body"><div class="fold-inner"><div id="m-grid"></div></div></div>
    </section>
    <section class="fold m-card m-cats${foldClass('m.cats')}">
      <button class="fold-head" data-action="fold" data-key="m.cats">
        <span class="m-ic">🗂</span><span class="fold-title">Категории</span><span class="chev"></span><span class="fold-count" id="m-cats-count">0</span>
      </button>
      <div class="fold-body"><div class="fold-inner"><div id="m-cats"></div></div></div>
    </section>
    <section class="fold m-card m-inbox${foldClass('m.inbox')}">
      <button class="fold-head" data-action="fold" data-key="m.inbox">
        <span class="m-ic">📝</span><span class="fold-title">Задачи</span><span class="chev"></span><span class="fold-count" id="m-inbox-count">0</span>
      </button>
      <div class="fold-body"><div class="fold-inner">
        <div class="m-filter" id="m-filter">${Object.entries(VIEWS).map(([v, o]) => `<button class="m-fbtn" data-action="m-view" data-view="${v}">${o.label}</button>`).join('')}</div>
        <form class="m-quick" data-quick="m-inbox" autocomplete="off">
          <input class="minp m-quick-inp" placeholder="Напиши, что нужно сделать…" maxlength="120" enterkeyhint="done">
          <button class="m-quick-btn" type="submit" aria-label="Добавить"><span class="plus-icon"></span></button>
        </form>
        <div class="m-scrollbox" id="m-inbox-list"></div>
      </div></div>
    </section>
    <div class="slabel m-plan-label">План по неделям</div>
    <div class="m-timeline">
      ${M_WEEKS.map(w => `
      <section class="fold m-card m-week${foldClass('m.w' + w.n)}" data-week="${w.n}">
        <span class="m-dot"></span>
        <button class="fold-head" data-action="fold" data-key="m.w${w.n}">
          <span class="m-wnum">${w.n}</span>
          <span class="m-whead"><span class="fold-title">Неделя ${w.n}</span><span class="m-wdates">${w.label}${w.days < 7 ? ` · ${w.days} ${plural(w.days,'день','дня','дней')}` : ''}</span></span>
          <span class="chev"></span>
          <span class="fold-count" data-count></span>
        </button>
        <div class="m-wtrack"><div class="m-wfill" data-fill></div></div>
        <div class="fold-body"><div class="fold-inner"><div data-list></div>
          <div data-move></div>
          <button class="m-add" data-action="m-add" data-week="${w.n}">+ Добавить в неделю ${w.n}</button>
        </div></div>
      </section>`).join('')}
    </div>`;
  built = true;
  // список «Задач» видно целиком максимум на 5 строк — пересчитываем, когда он становится видимым
  if (window.ResizeObserver) new ResizeObserver(() => fitRows($('m-inbox-list'))).observe($('m-inbox-list'));
}

// Высота прокручиваемого списка — ровно до низа 5-й задачи
function fitRows(box) {
  if (!box) return;
  const rows = box.querySelectorAll('.m-task');
  if (rows.length <= LIST_ROWS) { box.style.maxHeight = ''; return; }
  const first = rows[0].getBoundingClientRect(), fifth = rows[LIST_ROWS - 1].getBoundingClientRect();
  if (!fifth.height) return; // вкладка скрыта — пересчитаем, когда появится
  box.style.maxHeight = Math.ceil(fifth.bottom - first.top + 4) + 'px';
}

function badgesHTML(t, { week = false, cat = false } = {}) {
  const parts = [];
  if (week && t.week) {
    const w = M_WEEKS[t.week - 1], stale = !t.done && isPastWeek(w);
    parts.push(`<span class="hc-badge${stale ? ' stale' : ''}">${stale ? '⏰ ' : ''}${t.week} · ${w.label}</span>`);
  }
  const c = cat && t.category && findCat(t.category);
  if (c) parts.push(`<span class="hc-badge cat">${esc(c.name)}</span>`);
  return parts.length ? `<div class="tc-meta">${parts.join('')}</div>` : '';
}

function rowHTML(t, sorting, { stale = false, week = false, cat = true } = {}) {
  return `<div class="m-task${t.done ? ' done' : ''}${stale && !t.done ? ' stale' : ''}${sorting ? ' sort-item' : ''}" data-id="${esc(t.id)}">
    <div class="tc-check"></div>
    <div class="m-text">${esc(t.text)}${badgesHTML(t, { week, cat })}</div>
    ${sorting ? '<div class="sort-grip" aria-hidden="true"></div>' : `<div class="hc-edit" data-action="m-edit" data-id="${esc(t.id)}">···</div>`}
  </div>`;
}

// Список: активные (их можно перетаскивать) и отдельным блоком выполненные
function fillList(container, list, emptyHTML, opts = {}) {
  const active = list.filter(t => !t.done), done = list.filter(t => t.done);
  container.innerHTML = list.length
    ? (active.length ? `<div class="m-list${sortMode ? ' sort-mode' : ''}">${active.map(t => rowHTML(t, sortMode, opts)).join('')}</div>` : '') +
      (done.length ? `<div class="m-list m-done${sortMode ? ' sort-frozen' : ''}">${done.map(t => rowHTML(t, false, opts)).join('')}</div>` : '')
    : emptyHTML;
  container.querySelectorAll('.m-list').forEach(box => {
    const frozen = box.classList.contains('m-done');
    box.querySelectorAll('.m-task').forEach(row => {
      const id = row.dataset.id;
      if (sortMode) {
        if (frozen) return;
        attachSortable(row, {
          container: box, itemSel: '.m-task',
          onTap: exitMarathonSort,
          onDrop: ids => { reassignOrder(state.marathon, ids); saveMarathon(); renderMarathon(); },
        });
      } else {
        attachCardGestures(row, {
          checkSel: '.tc-check', ignoreSel: '.hc-edit',
          onTap: () => toggleM(id),
          onLong: () => { sortMode = true; renderMarathon(); showToast('Удерживай и перетаскивай'); },
        });
      }
    });
  });
}

// Незавершённые задачи прошедших недель (до текущей; после финиша — все недели)
const isPastWeek = (w, t0 = today()) => t0 > w.end;
const staleTasks = (t0 = today()) => state.marathon.filter(t => t.week && !t.done && isPastWeek(M_WEEKS[t.week-1], t0));

// Прошедшая неделя сворачивается один раз, когда она закончилась. Если потом
// развернуть её вручную, она так и останется развёрнутой.
function autoCollapsePast(t0) {
  const done = state.ui.autoCollapsed || (state.ui.autoCollapsed = []);
  let changed = false;
  M_WEEKS.forEach(w => {
    if (!isPastWeek(w, t0) || done.includes(w.n)) return;
    done.push(w.n); changed = true;
    setCollapsed('m.w' + w.n, true);
    document.querySelector(`.m-week[data-week="${w.n}"]`)?.classList.add('collapsed');
  });
  if (changed) saveUI();
}

function renderStale(cur, t0) {
  const stale = staleTasks(t0);
  const n = stale.length;
  $('m-stale').innerHTML = !n ? '' : `
    <div class="m-stale">
      <span class="m-stale-ic">⏰</span>
      <span class="m-stale-txt"><b>${n} ${plural(n,'задача','задачи','задач')}</b> из прошлых недель ${plural(n,'не выполнена','не выполнены','не выполнены')}</span>
      ${cur ? `<button class="m-stale-btn" data-action="m-move-stale">Перенести в неделю ${cur}</button>` : ''}
    </div>`;
}

// Сетка 60 дней: строка — неделя марафона, столбец — день недели (старт в понедельник).
// Заливка — сколько задач марафона выполнено в этот день.
function renderGrid(t0) {
  const ph = marathonPhase(t0);
  const perDay = {};
  state.marathon.forEach(t => { if (t.done && t.doneAt) perDay[t.doneAt] = (perDay[t.doneAt] || 0) + 1; });
  $('m-grid-sum').textContent = ph.phase === 'before' ? `старт через ${ph.daysToStart} ${plural(ph.daysToStart,'день','дня','дней')}`
    : ph.phase === 'running' ? `пройдено ${ph.day - 1} · осталось ${ph.daysLeft + 1}` : `все ${M_TOTAL} позади 🎉`;
  const head = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => `<span>${d}</span>`).join('');
  const rows = M_WEEKS.map(w => {
    const cells = Array.from({ length: 7 }, (_, i) => {
      if (i >= w.days) return `<span class="m-gc none"></span>`;
      const dk = addDays(w.start, i), cnt = perDay[dk] || 0;
      const cls = dk === t0 ? 'today' : dk < t0 ? 'past' : 'future';
      const lvl = cnt ? ` l${Math.min(cnt, 3)}` : '';
      return `<span class="m-gc ${cls}${lvl}" title="${+dk.slice(8)}.${dk.slice(5,7)}${cnt ? ` · выполнено ${cnt}` : ''}"></span>`;
    }).join('');
    return `<button class="m-grow${isPastWeek(w, t0) ? ' past' : ''}" data-action="m-goto-week" data-week="${w.n}"><span class="m-gnum">${w.n}</span><span class="m-gcells">${cells}</span></button>`;
  }).join('');
  $('m-grid').innerHTML = `<div class="m-ghead"><span></span><span class="m-gcells">${head}</span></div>${rows}
    <div class="m-glegend"><span class="m-gc past"></span>прошёл<span class="m-gc today"></span>сегодня<span class="m-gc past l2"></span>есть выполненные</div>`;
}

// Категории: сетка 3×3 из кнопок-категорий и кнопки «+»
function renderCats() {
  const cats = sortedCats();
  $('m-cats-count').textContent = cats.length;
  const tiles = cats.map(c => {
    const list = state.marathon.filter(t => t.category === c.id), done = list.filter(t => t.done).length;
    return `<button class="m-cat" data-action="m-cat-open" data-id="${esc(c.id)}">
      <span class="m-cat-name">${esc(c.name)}</span>
      <span class="m-cat-cnt">${list.length ? `${done}/${list.length}` : 'пусто'}</span>
    </button>`;
  });
  if (cats.length < MAX_CATS) tiles.push(`<button class="m-cat m-cat-add" data-action="m-cat-new" aria-label="Добавить категорию"><span class="m-cat-plus">+</span><span class="m-cat-cnt">категория</span></button>`);
  $('m-cats').innerHTML = (cats.length ? '' : `<div class="fold-empty m-empty">Создай свои категории — например, «Красота» или «Дом».</div>`) +
    `<div class="m-cat-grid">${tiles.join('')}</div>`;
}

export function renderMarathon() {
  if (!built) buildSkeleton();
  $('m-sort-hint').innerHTML = sortMode ? sortHint('m-sort-done') : '';
  const cur = currentWeekN(), t0 = today();
  autoCollapsePast(t0);
  renderStale(cur, t0);
  renderGrid(t0);
  renderCats();

  // «Задачи»: все / план (без недели) / готово
  const view = mView();
  document.querySelectorAll('#m-filter .m-fbtn').forEach(b => b.classList.toggle('sel', b.dataset.view === view));
  const list = state.marathon.filter(VIEWS[view].filter).sort(activeFirst);
  $('m-inbox-count').textContent = list.length;
  const box = $('m-inbox-list');
  fillList(box, list, `<div class="fold-empty m-empty">${VIEWS[view].empty}</div>`, { week: view !== 'plan' });
  fitRows(box);

  const staleCount = staleTasks(t0).length;
  document.querySelectorAll('.m-week').forEach(sec => {
    const n = +sec.dataset.week, w = M_WEEKS[n-1];
    const wl = listOf(n), done = wl.filter(t => t.done).length;
    const past = isPastWeek(w, t0), open = wl.length - done;
    sec.classList.toggle('current', n === cur);
    sec.classList.toggle('past', past);
    sec.classList.toggle('complete', wl.length > 0 && done === wl.length);
    sec.classList.toggle('has-stale', past && open > 0);
    const count = sec.querySelector('[data-count]');
    count.textContent = past && open ? `⏰ ${open}` : wl.length ? `${done}/${wl.length}` : '0';
    count.classList.toggle('stale', past && open > 0);
    sec.querySelector('[data-fill]').style.width = (wl.length ? Math.round(done / wl.length * 100) : 0) + '%';
    fillList(sec.querySelector('[data-list]'), wl, `<div class="fold-empty m-empty">${past ? 'На этой неделе задач не было' : 'Пока пусто — добавь новую задачу'}</div>`, { stale: past });
    // в прошедшей неделе — перенести её хвосты; в текущей — забрать все хвосты сюда
    sec.querySelector('[data-move]').innerHTML = sortMode || !cur ? ''
      : past && open ? `<button class="m-move" data-action="m-move-stale" data-week="${n}">⏰ Перенести незавершённые (${open}) в неделю ${cur}</button>`
      : n === cur && staleCount ? `<button class="m-move" data-action="m-move-stale">⏰ Забрать сюда незавершённые из прошлых недель (${staleCount})</button>` : '';
    sec.querySelector('.m-add').style.display = past ? 'none' : '';
  });
}

onAction('m-view', d => { state.ui.mView = d.view; saveUI(); $('m-inbox-list').scrollTop = 0; renderMarathon(); });

// Перенос незавершённых задач прошедших недель (всех или одной) в текущую неделю.
// Задачи встают в конец списка текущей недели в прежнем порядке.
onAction('m-move-stale', d => {
  const cur = currentWeekN(); if (!cur) return;
  const from = +d.week || null;
  const list = staleTasks().filter(t => !from || t.week === from)
    .sort((a, b) => a.week - b.week || byOrder(a, b));
  if (!list.length) return;
  const base = Date.now();
  list.forEach((t, i) => { t.week = cur; t.order = base + i; });
  refresh();
  showToast(`Перенесено в неделю ${cur}: ${list.length}`);
});

// Тап по строке сетки — к соответствующей неделе (развернув её)
onAction('m-goto-week', d => {
  const sec = document.querySelector(`.m-week[data-week="${d.week}"]`); if (!sec) return;
  if (isCollapsed('m.w' + d.week)) {
    setCollapsed('m.w' + d.week, false); sec.classList.remove('collapsed');
    // ждём конца разворачивания — иначе высоты страницы не хватит, чтобы доскроллить
    setTimeout(() => scrollToSection(sec, true), 340);
  } else scrollToSection(sec, true);
});

function scrollToSection(sec, smooth) {
  const scroller = document.querySelector('.scroll');
  const top = scroller.scrollTop + sec.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 10;
  scroller.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
}

// При открытии вкладки — сразу к текущей неделе (до старта и после финиша — в начало)
export function focusCurrentWeek() {
  const cur = currentWeekN();
  const sec = cur && document.querySelector(`.m-week[data-week="${cur}"]`);
  if (sec) scrollToSection(sec, false);
  else document.querySelector('.scroll').scrollTop = 0;
}

function toggleM(id) {
  const t = findM(id); if (!t) return;
  t.done = !t.done;
  if (t.done) t.doneAt = today(); else delete t.doneAt;
  refresh();
  if (t.done) showToast('Выполнено ✓');
}
onAction('m-toggle', d => toggleM(d.id));

// Быстрое добавление — Enter или кнопка «+», неделя не обязательна.
// На экране категории задача сразу получает эту категорию.
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-quick]');
  if (!form) return;
  e.preventDefault();
  const inp = form.querySelector('input');
  const text = inp.value.trim();
  if (!text) { flashInvalid(inp); return; }
  const inCat = form.dataset.quick === 'cat' && catId;
  addTask(text, null, inCat ? catId : null);
  inp.value = '';
  refresh();
  showToast(inCat ? `Добавлено в «${findCat(catId).name}»` : '✅ Задача добавлена');
});

// ── edit / add modal ──
function buildWeekPicker() {
  const t0 = today();
  $('mm-weeks').innerHTML =
    `<div class="m-pick inbox${mmWeek === null ? ' sel' : ''}" data-action="mm-week" data-week="0">Не распределена</div>` +
    `<div class="m-pick-grid">${M_WEEKS.map(w => `
      <div class="m-pick${mmWeek === w.n ? ' sel' : ''}${t0 > w.end ? ' past' : ''}" data-action="mm-week" data-week="${w.n}">
        <b>${w.n}</b><span>${w.label}</span>
      </div>`).join('')}</div>`;
}
function buildCatPicker() {
  const cats = sortedCats();
  $('mm-cat-row').style.display = cats.length ? '' : 'none';
  $('mm-cats').innerHTML = [`<div class="duropt${mmCat === null ? ' sel' : ''}" data-action="mm-cat" data-id="">Без категории</div>`,
    ...cats.map(c => `<div class="duropt${mmCat === c.id ? ' sel' : ''}" data-action="mm-cat" data-id="${esc(c.id)}">${esc(c.name)}</div>`)].join('');
}
onAction('mm-week', d => { mmWeek = +d.week || null; buildWeekPicker(); });
onAction('mm-cat', d => { mmCat = d.id || null; buildCatPicker(); });
onAction('mm-done', () => { mmDone = !mmDone; buildDoneToggle(); });
function buildDoneToggle() {
  const ack = $('mm-done-ack'); ack.classList.toggle('on', mmDone); ack.textContent = mmDone ? '✓' : '';
}

export function openMarathonModal(id = null, week = null, category = null) {
  const base = id ? findM(id) : null;
  if (id && !base) return;
  editId = base ? base.id : null;
  mmWeek = base ? base.week : (week || null);
  mmCat = base ? (base.category && findCat(base.category) ? base.category : null) : category;
  mmDone = base ? !!base.done : false;
  $('mm-title').textContent = base ? 'Задача марафона' : 'Новая задача марафона';
  $('mm-name').value = base ? base.text : '';
  $('mm-done-row').style.display = base ? '' : 'none';
  buildWeekPicker(); buildCatPicker(); buildDoneToggle();
  $('mm-actions').innerHTML = base
    ? `<button class="mbtn danger" data-action="m-delete">Удалить</button><button class="mbtn secondary" data-action="close" data-modal="mmodal">Отмена</button><button class="mbtn primary" data-action="m-save">Готово</button>`
    : `<button class="mbtn secondary" data-action="close" data-modal="mmodal">Отмена</button><button class="mbtn primary" data-action="m-save">Добавить</button>`;
  $('mmodal').querySelector('.mscroll').scrollTop = 0;
  SM('mmodal');
  if (!base) setTimeout(() => $('mm-name').focus(), 280);
}
onAction('m-edit', d => openMarathonModal(d.id));
onAction('m-add', d => openMarathonModal(null, +d.week || null));

onAction('m-save', () => {
  const text = $('mm-name').value.trim();
  if (!text) { flashInvalid($('mm-name')); return; }
  const base = editId && findM(editId);
  if (base) {
    // при переносе в другую неделю задача встаёт в конец списка этой недели
    if ((base.week || null) !== mmWeek) base.order = Date.now();
    base.text = text; base.week = mmWeek; base.category = mmCat;
    if (base.done !== mmDone) { base.done = mmDone; if (mmDone) base.doneAt = today(); else delete base.doneAt; }
  } else {
    addTask(text, mmWeek, mmCat);
  }
  CM('mmodal'); refresh();
  showToast(base ? 'Сохранено ✓' : mmWeek ? `Добавлено в неделю ${mmWeek}` : '✅ Задача добавлена');
});

onAction('m-delete', () => {
  const id = editId;
  askConfirm('Удалить задачу марафона?', 'Это действие нельзя отменить.', () => {
    CM('mmodal');
    state.marathon = state.marathon.filter(t => t.id !== id);
    refresh(); showToast('Удалено');
  });
});

// ── категории ──
function openCatEdit(id) {
  catEditId = id;
  const c = id && findCat(id);
  $('catedit-title').textContent = c ? 'Переименовать категорию' : 'Новая категория';
  $('catedit-name').value = c ? c.name : '';
  SM('catEditModal');
  setTimeout(() => $('catedit-name').focus(), 280);
}
onAction('m-cat-new', () => {
  if (state.mcats.length >= MAX_CATS) { showToast('Можно создать до 9 категорий'); return; }
  openCatEdit(null);
});
onAction('m-cat-rename', () => openCatEdit(catId));
function saveCatEdit() {
  const name = $('catedit-name').value.trim();
  if (!name) { flashInvalid($('catedit-name')); return; }
  const c = catEditId && findCat(catEditId);
  if (c) c.name = name;
  else state.mcats.push({ id: Date.now().toString(), name, order: Date.now() });
  saveCats(); CM('catEditModal'); renderMarathon();
  showToast(c ? 'Сохранено ✓' : `Категория «${name}» создана`);
}
onAction('m-cat-save', saveCatEdit);
$('catedit-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveCatEdit(); } });

onAction('m-cat-delete', () => {
  const c = findCat(catId); if (!c) return;
  const n = state.marathon.filter(t => t.category === c.id).length;
  askConfirm(`Удалить категорию «${c.name}»?`, n ? `Задачи (${n}) останутся в марафоне, просто без категории.` : 'В категории нет задач.', () => {
    state.marathon.forEach(t => { if (t.category === c.id) t.category = null; });
    state.mcats = state.mcats.filter(x => x.id !== c.id);
    saveCats(); saveMarathon(); CM('catModal'); renderMarathon(); updateTopCard();
    showToast('Категория удалена');
  });
});

// Экран категории: её задачи и быстрое добавление
onAction('m-cat-open', d => { catId = d.id; $('cat-list').scrollTop = 0; renderCatScreen(); SM('catModal'); });
registerModal('catModal', { refresh: () => keepScroll($('cat-list'), renderCatScreen) });
registerModal('catEditModal', {});

function renderCatScreen() {
  const c = findCat(catId); if (!c) { CM('catModal'); return; }
  const list = state.marathon.filter(t => t.category === c.id).sort((a, b) => activeFirst(a, b));
  const done = list.filter(t => t.done).length;
  $('cat-title').textContent = c.name;
  $('cat-sub').textContent = list.length ? `${done} из ${list.length} выполнено` : 'Пока нет задач';
  const el = $('cat-list');
  el.innerHTML = list.length ? `<div class="m-list">${list.map(t => `
    <div class="m-task${t.done ? ' done' : ''}">
      <div class="tc-check" data-action="m-toggle" data-id="${esc(t.id)}"></div>
      <div class="m-text">${esc(t.text)}${badgesHTML(t, { week: true })}</div>
      <div class="hc-edit" data-action="m-edit" data-id="${esc(t.id)}">···</div>
    </div>`).join('')}</div>`
    : `<div class="fold-empty m-empty">Добавь первую задачу в эту категорию — неделю можно выбрать в настройках задачи (···).</div>`;
}
