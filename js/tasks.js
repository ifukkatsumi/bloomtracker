// ══════════════════════════════════════════
//  TASKS
// ══════════════════════════════════════════
import { state, saveTasks } from './state.js';
import { today, pad, MO_RU, currentWeekStartStr, mondayOf, fmtShortDate, taskDayLabel, plural } from './dates.js';
import { mainSections, sectionOf, subtasksOf, hasOpenSubtasks, isOverdue, byOrder } from './tasklogic.js';
import { $, esc, SM, CM, onAction, askConfirm, showToast, flashInvalid, attachCardGestures, registerModal, keepScroll, foldClass } from './ui.js';
import { attachSortable, reassignOrder } from './sortable.js';
import { sortHint } from './habits.js';
import { updateTopCard } from './topcard.js';

const TSCOPES = [{v:'week',l:'Эта неделя'},{v:'month',l:'Этот месяц'}];
const URGENT_BADGE = '<span class="hc-badge urgent">🔥 срочно</span>';
const DELETE_TITLE = 'Удалить задачу?', DELETE_TEXT = 'Подзадачи тоже будут удалены.';
const SECTIONS = [
  { key: 'week',  title: 'Задачи на этой неделе', empty: 'На этой неделе пока пусто' },
  { key: 'month', title: 'Задачи в этом месяце',  empty: 'До конца месяца больше ничего' },
  { key: 'done',  title: 'Выполнено',             empty: 'Пока ничего не выполнено' },
];

let taskEditId = null, taskParentId = null;
let tmScope = 'week', tmDue = null, tmUrgent = false;
let taskCalY = 0, taskCalM = 0;
let taskActionsId = null;
let allTasksView = 'all';
let sortMode = false;

const findT = id => state.tasks.find(x => x.id === id);
function refresh() {
  saveTasks(); renderTasks(); updateTopCard();
  if ($('allTasksModal').classList.contains('show')) keepScroll($('all-tasks-content'), renderAllTasksList);
}

// ── sort mode ──
export function exitTaskSort() { if (sortMode) { sortMode = false; renderTasks(); } }
function enterTaskSort() { sortMode = true; renderTasks(); showToast('Удерживай и перетаскивай'); }
onAction('task-sort-done', exitTaskSort);

// ── list ──
function badges(task, sec) {
  const subs = subtasksOf(state.tasks, task.id);
  const parts = [];
  if (task.urgent && !task.done) parts.push(URGENT_BADGE);
  if (isOverdue(task)) parts.push(`<span class="hc-badge overdue">⏰ ${fmtShortDate(task.dueDate)}</span>`);
  else if (task.dueDate) parts.push(`<span class="hc-badge">${sec === 'week' ? taskDayLabel(task.dueDate) : fmtShortDate(task.dueDate)}</span>`);
  else if (task.scope === 'month') parts.push('<span class="hc-badge">Месяц</span>');
  if (subs.length) parts.push(`<span class="hc-badge subs">☑ ${subs.filter(s => s.done).length}/${subs.length}</span>`);
  return parts.join('');
}

function buildTaskGroup(task, sec, sorting) {
  const id = esc(task.id);
  let html = `<div class="task-group${sorting ? ' sort-item' : ''}" data-id="${id}">
  <div class="task-swipe-wrap" data-id="${id}">
    ${sorting ? '' : `<div class="task-delete-bg" data-action="task-delete-confirm" data-id="${id}">🗑<span>Удалить</span></div>`}
    <div class="task-card${task.done?' done':''}${task.urgent && !task.done?' urgent':''}" data-id="${id}">
      <div class="tc-check"></div>
      <div class="tc-info">
        <div class="tc-text">${esc(task.text)}</div>
        <div class="tc-meta">${badges(task, sec)}</div>
      </div>
      ${sorting ? '<div class="sort-grip" aria-hidden="true"></div>' : ''}
    </div>
  </div>`;
  subtasksOf(state.tasks, task.id).sort(byOrder).forEach(s => {
    const act = !sorting;
    html += `<div class="subtask-row${s.done?' done':''}" data-id="${esc(s.id)}">
      <div class="sub-connector"></div>
      <div class="tc-check small"${act ? ` data-action="task-toggle" data-id="${esc(s.id)}"` : ''}></div>
      <div class="tc-text small">${esc(s.text)}</div>
      ${act ? `<div class="hc-edit" style="width:24px;height:24px;font-size:15px" data-action="task-edit" data-id="${esc(s.id)}">···</div>` : ''}
    </div>`;
  });
  return html + `</div>`;
}

export function renderTasks() {
  const el = $('tasks-content');
  const roots = state.tasks.filter(t => !t.parentId);
  if (!roots.length) {
    sortMode = false;
    el.innerHTML = `<div class="empty-card"><div class="ei">✨</div><p>Задач пока нет.<br>Добавь первую!</p></div>`;
    return;
  }
  const secs = mainSections(state.tasks);
  const later = roots.filter(t => !t.done && sectionOf(t) === null).length;

  let html = sortMode ? sortHint('task-sort-done') : '';
  SECTIONS.forEach(({ key, title, empty }) => {
    const items = secs[key];
    const sorting = sortMode && key !== 'done';
    const fkey = 'tasks.' + key;
    html += `<section class="fold tsec${foldClass(fkey)}">
      <button class="fold-head" data-action="fold" data-key="${fkey}" aria-expanded="${!foldClass(fkey)}">
        <span class="fold-title">${title}</span><span class="chev"></span><span class="fold-count">${items.length}</span>
      </button>
      <div class="fold-body"><div class="fold-inner">
        ${items.length
          ? `<div class="tasks-container${sorting ? ' sort-mode' : ''}${sortMode && !sorting ? ' sort-frozen' : ''}" data-sec="${key}">${items.map(t => buildTaskGroup(t, key, sorting)).join('')}</div>`
          : `<div class="fold-empty">${empty}</div>`}
        ${key === 'month' && later ? `<button class="fold-more" data-action="open-all-tasks">+ ${later} ${plural(later,'задача','задачи','задач')} позже — в «Все задачи»</button>` : ''}
      </div></div>
    </section>`;
  });
  el.innerHTML = html;

  el.querySelectorAll('.tasks-container').forEach(container => {
    const sec = container.dataset.sec;
    container.querySelectorAll(':scope > .task-group').forEach(group => {
      const id = group.dataset.id;
      if (sortMode) {
        if (sec === 'done') return;
        attachSortable(group, {
          container, itemSel: '.task-group',
          onTap: exitTaskSort,
          // порядок меняется только внутри раздела — сроки и статус не трогаем
          onDrop: ids => { reassignOrder(state.tasks, ids); saveTasks(); renderTasks(); },
        });
        return;
      }
      const wrap = group.querySelector('.task-swipe-wrap');
      const card = wrap.querySelector('.task-card');
      const delBg = wrap.querySelector('.task-delete-bg');
      attachCardGestures(card, {
        checkSel: '.tc-check',
        onTap: () => toggleTaskDone(id),
        onLong: () => { taskActionsId = id; SM('taskActionsModal'); },
        swipe: {
          width: 84,
          set: x => { card.style.transform = delBg.style.transform = `translateX(${x}px)`; wrap.classList.toggle('open', x === -84); },
          isOpen: () => wrap.classList.contains('open'),
        },
      });
    });
  });
}

// ── статусы: главная задача не выполняется, пока есть открытые подзадачи ──
function reopenParent(parentId) {
  const p = findT(parentId);
  if (p && p.done) { p.done = false; delete p.doneAt; return true; }
  return false;
}

function toggleTaskDone(id) {
  const t = findT(id); if (!t) return;
  if (!t.done && !t.parentId && hasOpenSubtasks(state.tasks, t.id)) {
    showToast('Сначала выполни все подзадачи');
    document.querySelectorAll(`.task-card[data-id="${CSS.escape(t.id)}"]`).forEach(c => { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); });
    return;
  }
  t.done = !t.done;
  if (t.done) t.doneAt = today(); else delete t.doneAt;
  const reopened = !t.done && t.parentId && reopenParent(t.parentId);
  refresh();
  if (reopened) showToast('Задача снова в работе');
  else if (t.done) showToast('Выполнено ✓');
}
onAction('task-toggle', d => toggleTaskDone(d.id));

function deleteTaskById(id) {
  state.tasks = state.tasks.filter(x => x.id !== id && x.parentId !== id);
  refresh(); showToast('Удалено');
}
onAction('task-delete-confirm', d => askConfirm(DELETE_TITLE, DELETE_TEXT, () => deleteTaskById(d.id)));

// ── long-press action sheet ──
onAction('task-edit',    d => { if (!d.id) CM('taskActionsModal'); openTaskModal(d.id || taskActionsId, null); });
onAction('task-addsub',  () => { CM('taskActionsModal'); openTaskModal(null, taskActionsId); });
onAction('task-reorder', () => { CM('taskActionsModal'); enterTaskSort(); });

// ── All tasks / archive modal ──
onAction('open-all-tasks', () => { setAllTasksView('all'); $('all-tasks-content').scrollTop = 0; SM('allTasksModal'); });
onAction('all-tasks-view', d => setAllTasksView(d.view));
registerModal('allTasksModal', { refresh: () => keepScroll($('all-tasks-content'), renderAllTasksList) });

function setAllTasksView(v) {
  allTasksView = v;
  document.querySelectorAll('#all-tasks-switch .duropt').forEach(x => x.classList.toggle('sel', x.dataset.view === v));
  renderAllTasksList();
}
const editBtn = (id, extra = '') =>
  `<div class="hc-edit" ${extra} data-action="task-edit" data-id="${esc(id)}">···</div>`;

function buildAllTaskRow(t) {
  return `<div class="task-card" style="cursor:default">
    <div class="tc-check" data-action="task-toggle" data-id="${esc(t.id)}"></div>
    <div class="tc-info">
      <div class="tc-text">${esc(t.text)}</div>
      <div class="tc-meta">${badges(t, sectionOf(t))}</div>
    </div>
    ${editBtn(t.id)}
  </div>`;
}
function buildAllSubRow(s) {
  return `<div class="subtask-row">
    <div class="sub-connector"></div>
    <div class="tc-check small" data-action="task-toggle" data-id="${esc(s.id)}"></div>
    <div class="tc-text small">${esc(s.text)}</div>
    ${editBtn(s.id, 'style="width:24px;height:24px;font-size:15px"')}
  </div>`;
}
function buildArchiveRow(t) {
  const dateLbl = t.doneAt ? fmtShortDate(t.doneAt) : '';
  const parent = t.parentId ? findT(t.parentId) : null;
  return `<div class="task-card done" style="cursor:default">
    <div class="tc-check" data-action="task-toggle" data-id="${esc(t.id)}"></div>
    <div class="tc-info">
      <div class="tc-text">${esc(t.text)}</div>
      <div class="tc-meta">
        ${parent ? `<span class="hc-badge">↳ ${esc(parent.text)}</span>` : ''}
        ${dateLbl?`<span class="hc-badge">Выполнено: ${dateLbl}</span>`:''}
      </div>
    </div>
    ${editBtn(t.id)}
  </div>`;
}
function renderAllTasksList() {
  const el = $('all-tasks-content');
  if (allTasksView === 'all') {
    const rank = t => ({ week: 0, month: 1 })[sectionOf(t)] ?? 2;
    const roots = state.tasks.filter(t => !t.parentId && !t.done)
      .sort((a, b) => rank(a) - rank(b) || (a.dueDate || '').localeCompare(b.dueDate || '') || byOrder(a, b));
    if (!roots.length) { el.innerHTML = `<div class="empty-card" style="padding:28px 16px"><div class="ei">✨</div><p>Нет активных задач</p></div>`; return; }
    let html = '<div class="tasks-container">';
    roots.forEach(r => {
      html += buildAllTaskRow(r);
      subtasksOf(state.tasks, r.id).filter(s => !s.done).sort(byOrder).forEach(s => html += buildAllSubRow(s));
    });
    el.innerHTML = html + '</div>';
  } else {
    const done = state.tasks.filter(t => t.done).sort((a,b) => (b.doneAt||'').localeCompare(a.doneAt||''));
    if (!done.length) { el.innerHTML = `<div class="empty-card" style="padding:28px 16px"><div class="ei">📦</div><p>Архив пуст</p></div>`; return; }
    el.innerHTML = '<div class="tasks-container">' + done.map(buildArchiveRow).join('') + '</div>';
  }
}

// ── task create/edit modal (открывается поверх текущего экрана) ──
function buildTMScope() {
  $('tm-scope-row').innerHTML = TSCOPES.map(o=>`<div class="duropt${tmScope===o.v?' sel':''}" data-action="tm-scope" data-scope="${o.v}">${o.l}</div>`).join('');
}
onAction('tm-scope', d => { tmScope = d.scope; buildTMScope(); });

function buildTMUrgent() {
  $('tm-urgent-toggle').innerHTML = `<div class="urgent-toggle${tmUrgent?' on':''}" data-action="tm-urgent">🔥 Срочно</div>`;
}
onAction('tm-urgent', () => { tmUrgent = !tmUrgent; buildTMUrgent(); });

function renderTaskCal() {
  $('tm-cal-mlbl').textContent = `${MO_RU[taskCalM]} ${taskCalY}`;
  const first = new Date(taskCalY, taskCalM, 1).getDay();
  const off = first===0?6:first-1;
  const dim = new Date(taskCalY, taskCalM+1, 0).getDate();
  const t = today();
  let g=''; for (let i=0;i<off;i++) g+='<div></div>';
  for (let d=1; d<=dim; d++) {
    const dk = `${taskCalY}-${pad(taskCalM+1)}-${pad(d)}`;
    g += `<div class="cal-day${tmDue===dk?' has':''}${dk===t?' today':''}" data-action="tm-day" data-day="${dk}">${d}</div>`;
  }
  $('tm-cal-grid').innerHTML = g;
}
onAction('tm-day', d => { tmDue = (tmDue===d.day) ? null : d.day; renderTaskCal(); });
$('tm-cal-prev').onclick = () => { taskCalM--; if (taskCalM<0) { taskCalM=11; taskCalY--; } renderTaskCal(); };
$('tm-cal-next').onclick = () => { taskCalM++; if (taskCalM>11) { taskCalM=0; taskCalY++; } renderTaskCal(); };

export function openTaskModal(editingId, parentId) {
  taskEditId = editingId || null;
  taskParentId = parentId || null;
  const base = taskEditId ? findT(taskEditId) : null;
  if (taskEditId && !base) return;

  tmScope = base ? (base.scope||'week') : 'week';
  tmDue = base ? (base.dueDate||null) : null;
  tmUrgent = base ? !!base.urgent : false;

  const now = new Date();
  if (tmDue) { const [y,m] = tmDue.split('-'); taskCalY=+y; taskCalM=+m-1; }
  else { taskCalY=now.getFullYear(); taskCalM=now.getMonth(); }

  const isSub = taskParentId || (base && base.parentId);
  $('tm-title').textContent = taskParentId ? 'Новая подзадача' : (base ? (isSub ? 'Редактировать подзадачу' : 'Редактировать задачу') : 'Новая задача');
  $('tm-name').value = base ? base.text : '';

  buildTMScope(); renderTaskCal(); buildTMUrgent();

  $('tm-actions').innerHTML = base ? `
    <button class="mbtn danger" data-action="task-delete-from-modal">Удалить</button>
    <button class="mbtn secondary" data-action="close" data-modal="tmodal">Отмена</button>
    <button class="mbtn primary" data-action="task-save">Готово</button>` : `
    <button class="mbtn secondary" data-action="close" data-modal="tmodal">Отмена</button>
    <button class="mbtn primary" data-action="task-save">Готово</button>`;

  $('tmodal').querySelector('.mscroll').scrollTop = 0;
  SM('tmodal');
  if (!base) setTimeout(() => $('tm-name').focus(), 280);
}

onAction('task-save', () => {
  const name = $('tm-name').value.trim();
  if (!name) { flashInvalid($('tm-name')); return; }
  const base = taskEditId ? findT(taskEditId) : null;
  const weekStart = tmDue ? mondayOf(tmDue) : (base ? base.weekStart : currentWeekStartStr());

  let reopened = false;
  if (base) {
    Object.assign(base, { text:name, scope:tmScope, dueDate:tmDue, urgent:tmUrgent, weekStart });
  } else {
    state.tasks.push({ id:Date.now().toString(), text:name, done:false, urgent:tmUrgent, scope:tmScope, dueDate:tmDue, weekStart, parentId: taskParentId||null, createdAt: today(), order: Date.now() });
    // новая открытая подзадача возвращает выполненную главную задачу в активные
    if (taskParentId) reopened = reopenParent(taskParentId);
  }
  CM('tmodal'); refresh();
  showToast(reopened ? 'Задача снова в работе' : base ? 'Сохранено ✓' : taskParentId ? '➕ Подзадача добавлена' : '✅ Задача добавлена');
});

onAction('task-delete-from-modal', () => {
  const id = taskEditId; if (!id) return;
  const isParent = state.tasks.some(s => s.parentId === id);
  askConfirm(isParent ? DELETE_TITLE : 'Удалить?', isParent ? DELETE_TEXT : 'Это действие нельзя отменить.', () => { CM('tmodal'); deleteTaskById(id); });
});
