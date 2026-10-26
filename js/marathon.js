// ══════════════════════════════════════════
//  MARATHON — «60 дней до Нового года»
//  Отдельный список задач (bloom_marathon_v1), не связан с обычными задачами.
// ══════════════════════════════════════════
import { state, saveMarathon, saveUI, isCollapsed, setCollapsed } from './state.js';
import { today, plural, addDays } from './dates.js';
import { M_WEEKS, M_TOTAL, currentWeekN, marathonPhase, marathonStats } from './marathonplan.js';
import { byOrder } from './tasklogic.js';
import { $, esc, SM, CM, onAction, askConfirm, showToast, flashInvalid, attachCardGestures, registerModal, keepScroll, foldClass } from './ui.js';
import { attachSortable, reassignOrder } from './sortable.js';
import { sortHint } from './habits.js';
import { updateTopCard } from './topcard.js';

let built = false;
let sortMode = false;
let editId = null, mmWeek = null, mmDone = false;
let allView = 'all';

const findM = id => state.marathon.find(x => x.id === id);
const weekLabel = n => n ? `Неделя ${n} · ${M_WEEKS[n-1].label}` : 'Входящие';
// активные сверху, выполненные внизу; внутри — пользовательский порядок
const listOf = week => state.marathon.filter(t => (t.week || null) === week).sort((a, b) => (a.done - b.done) || byOrder(a, b));

function refresh() {
  saveMarathon(); renderMarathon(); updateTopCard();
  if ($('mAllModal').classList.contains('show')) keepScroll($('m-all-content'), renderAllList);
}

function addTask(text, week) {
  state.marathon.push({ id: Date.now().toString() + Math.random().toString(36).slice(2, 6), text, week: week || null, done: false, createdAt: today(), order: Date.now() });
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
    <section class="fold m-card m-inbox${foldClass('m.inbox')}">
      <button class="fold-head" data-action="fold" data-key="m.inbox">
        <span class="m-ic">📥</span><span class="fold-title">Входящие</span><span class="chev"></span><span class="fold-count" id="m-inbox-count">0</span>
      </button>
      <form class="m-quick" data-quick="m-inbox" autocomplete="off">
        <input class="minp m-quick-inp" placeholder="Что висит? Запиши сюда…" maxlength="120" enterkeyhint="done">
        <button class="m-quick-btn" type="submit" aria-label="Добавить"><span class="plus-icon"></span></button>
      </form>
      <div class="fold-body"><div class="fold-inner"><div id="m-inbox-list"></div></div></div>
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
}

function rowHTML(t, sorting, stale = false) {
  return `<div class="m-task${t.done ? ' done' : ''}${stale && !t.done ? ' stale' : ''}${sorting ? ' sort-item' : ''}" data-id="${esc(t.id)}">
    <div class="tc-check"></div>
    <div class="m-text">${esc(t.text)}</div>
    ${sorting ? '<div class="sort-grip" aria-hidden="true"></div>' : `<div class="hc-edit" data-action="m-edit" data-id="${esc(t.id)}">···</div>`}
  </div>`;
}

function fillList(container, week, emptyHTML, stale = false) {
  const list = listOf(week);
  const active = list.filter(t => !t.done), done = list.filter(t => t.done);
  // выполненные — отдельным блоком ниже; сортируются только активные
  container.innerHTML = list.length
    ? (active.length ? `<div class="m-list${sortMode ? ' sort-mode' : ''}">${active.map(t => rowHTML(t, sortMode, stale)).join('')}</div>` : '') +
      (done.length ? `<div class="m-list m-done${sortMode ? ' sort-frozen' : ''}">${done.map(t => rowHTML(t, false)).join('')}</div>` : '')
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

export function renderMarathon() {
  if (!built) buildSkeleton();
  $('m-sort-hint').innerHTML = sortMode ? sortHint('m-sort-done') : '';
  const cur = currentWeekN(), t0 = today();
  autoCollapsePast(t0);
  renderStale(cur, t0);
  renderGrid(t0);

  const inbox = listOf(null);
  $('m-inbox-count').textContent = inbox.filter(t => !t.done).length;
  fillList($('m-inbox-list'), null,
    `<div class="fold-empty m-empty">Скидывай сюда всё, что приходит в голову.<br>Неделю можно выбрать потом.</div>`);

  const staleCount = staleTasks(t0).length;
  document.querySelectorAll('.m-week').forEach(sec => {
    const n = +sec.dataset.week, w = M_WEEKS[n-1];
    const list = listOf(n), done = list.filter(t => t.done).length;
    const past = isPastWeek(w, t0), open = list.length - done;
    sec.classList.toggle('current', n === cur);
    sec.classList.toggle('past', past);
    sec.classList.toggle('complete', list.length > 0 && done === list.length);
    sec.classList.toggle('has-stale', past && open > 0);
    const count = sec.querySelector('[data-count]');
    count.textContent = past && open ? `⏰ ${open}` : list.length ? `${done}/${list.length}` : '0';
    count.classList.toggle('stale', past && open > 0);
    sec.querySelector('[data-fill]').style.width = (list.length ? Math.round(done / list.length * 100) : 0) + '%';
    fillList(sec.querySelector('[data-list]'), n, `<div class="fold-empty m-empty">${past ? 'На этой неделе задач не было' : 'Пока пусто — перенеси задачи из входящих или добавь новую'}</div>`, past);
    // в прошедшей неделе — перенести её хвосты; в текущей — забрать все хвосты сюда
    sec.querySelector('[data-move]').innerHTML = sortMode || !cur ? ''
      : past && open ? `<button class="m-move" data-action="m-move-stale" data-week="${n}">⏰ Перенести незавершённые (${open}) в неделю ${cur}</button>`
      : n === cur && staleCount ? `<button class="m-move" data-action="m-move-stale">⏰ Забрать сюда незавершённые из прошлых недель (${staleCount})</button>` : '';
    sec.querySelector('.m-add').style.display = past ? 'none' : '';
  });
}

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

// Быстрое добавление — Enter или кнопка «+», неделя не обязательна
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-quick]');
  if (!form) return;
  e.preventDefault();
  const inp = form.querySelector('input');
  const text = inp.value.trim();
  if (!text) { flashInvalid(inp); return; }
  addTask(text, null);
  inp.value = '';
  refresh();
  showToast('📥 Во входящих');
});

// ── edit / add modal ──
function buildWeekPicker() {
  const t0 = today();
  $('mm-weeks').innerHTML =
    `<div class="m-pick inbox${mmWeek === null ? ' sel' : ''}" data-action="mm-week" data-week="0">📥 Не распределена</div>` +
    `<div class="m-pick-grid">${M_WEEKS.map(w => `
      <div class="m-pick${mmWeek === w.n ? ' sel' : ''}${t0 > w.end ? ' past' : ''}" data-action="mm-week" data-week="${w.n}">
        <b>${w.n}</b><span>${w.label}</span>
      </div>`).join('')}</div>`;
}
onAction('mm-week', d => { mmWeek = +d.week || null; buildWeekPicker(); });
onAction('mm-done', () => { mmDone = !mmDone; buildDoneToggle(); });
function buildDoneToggle() {
  const ack = $('mm-done-ack'); ack.classList.toggle('on', mmDone); ack.textContent = mmDone ? '✓' : '';
}

export function openMarathonModal(id = null, week = null) {
  const base = id ? findM(id) : null;
  if (id && !base) return;
  editId = base ? base.id : null;
  mmWeek = base ? base.week : (week || null);
  mmDone = base ? !!base.done : false;
  $('mm-title').textContent = base ? 'Задача марафона' : 'Новая задача марафона';
  $('mm-name').value = base ? base.text : '';
  $('mm-done-row').style.display = base ? '' : 'none';
  buildWeekPicker(); buildDoneToggle();
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
    base.text = text; base.week = mmWeek;
    if (base.done !== mmDone) { base.done = mmDone; if (mmDone) base.doneAt = today(); else delete base.doneAt; }
  } else {
    addTask(text, mmWeek);
  }
  CM('mmodal'); refresh();
  showToast(base ? 'Сохранено ✓' : mmWeek ? `Добавлено в неделю ${mmWeek}` : '📥 Во входящих');
});

onAction('m-delete', () => {
  const id = editId;
  askConfirm('Удалить задачу марафона?', 'Это действие нельзя отменить.', () => {
    CM('mmodal');
    state.marathon = state.marathon.filter(t => t.id !== id);
    refresh(); showToast('Удалено');
  });
});

// ── all marathon tasks ──
const VIEWS = { all: () => true, inbox: t => !t.week && !t.done, active: t => !t.done, done: t => t.done };
onAction('m-open-all', () => { setAllView('all'); $('m-all-content').scrollTop = 0; SM('mAllModal'); });
onAction('m-all-view', d => setAllView(d.view));
registerModal('mAllModal', { refresh: () => keepScroll($('m-all-content'), renderAllList) });
function setAllView(v) {
  allView = v;
  document.querySelectorAll('#m-all-switch .duropt').forEach(x => x.classList.toggle('sel', x.dataset.view === v));
  renderAllList();
}
function renderAllList() {
  const el = $('m-all-content');
  const s = marathonStats(state.marathon);
  $('m-all-stats').textContent = `Всего ${s.total} · выполнено ${s.done} · без недели ${s.inbox}`;
  const list = state.marathon.filter(VIEWS[allView] || VIEWS.all)
    .sort((a, b) => (a.week || 0) - (b.week || 0) || (a.done - b.done) || byOrder(a, b));
  if (!list.length) {
    el.innerHTML = `<div class="empty-card" style="padding:28px 16px"><div class="ei">${allView === 'done' ? '🏁' : '📥'}</div><p>${allView === 'done' ? 'Пока ничего не выполнено' : 'Здесь пока пусто'}</p></div>`;
    return;
  }
  el.innerHTML = '<div class="m-list">' + list.map(t => `
    <div class="m-task${t.done ? ' done' : ''}">
      <div class="tc-check" data-action="m-toggle" data-id="${esc(t.id)}"></div>
      <div class="m-text">${esc(t.text)}<div class="tc-meta"><span class="hc-badge${t.week ? (!t.done && isPastWeek(M_WEEKS[t.week-1]) ? ' stale' : '') : ' inbox'}">${t.week ? `${!t.done && isPastWeek(M_WEEKS[t.week-1]) ? '⏰ ' : ''}${t.week} · ${M_WEEKS[t.week-1].label}` : '📥 Входящие'}</span></div></div>
      <div class="hc-edit" data-action="m-edit" data-id="${esc(t.id)}">···</div>
    </div>`).join('') + '</div>';
}
document.addEventListener('submit', e => {
  if (e.target.id !== 'm-all-quick') return;
  e.preventDefault();
  const inp = e.target.querySelector('input');
  const text = inp.value.trim();
  if (!text) { flashInvalid(inp); return; }
  addTask(text, null); inp.value = '';
  refresh(); showToast('📥 Во входящих');
});
