// ══════════════════════════════════════════
//  TASKS
// ══════════════════════════════════════════
import { state, saveTasks } from './state.js';
import { today, pad, MO_RU, currentWeekStartStr, mondayOf, fmtShortDate, taskDayLabel } from './dates.js';
import { $, esc, SM, CM, onAction, askConfirm, showToast, flashInvalid, attachCardGestures } from './ui.js';
import { updateTopCard } from './topcard.js';

const TSCOPES = [{v:'week',l:'Эта неделя'},{v:'month',l:'Этот месяц'}];
const URGENT_BADGE = '<span class="hc-badge" style="background:rgba(255,120,60,.12);color:#e05a20;border-color:rgba(255,120,60,.25)">🔥 срочно</span>';
const DELETE_TITLE = 'Удалить задачу?', DELETE_TEXT = 'Подзадачи тоже будут удалены.';

let taskEditId = null, taskParentId = null;
let tmScope = 'week', tmDue = null, tmUrgent = false;
let taskCalY = 0, taskCalM = 0;
let taskActionsId = null;
let allTasksView = 'all';

const findT = id => state.tasks.find(x => x.id === id);
function refresh() { saveTasks(); renderTasks(); updateTopCard(); }

// Невыполненные задачи прошлых недель переезжают на текущую
export function rolloverTasks() {
  const cw = currentWeekStartStr();
  let changed = false;
  state.tasks.forEach(t => { if (!t.done && t.weekStart && t.weekStart < cw) { t.weekStart = cw; changed = true; } });
  if (changed) saveTasks();
}

// ── list ──
function buildTaskRow(task) {
  const id = esc(task.id);
  let html = `
  <div class="task-swipe-wrap" data-id="${id}">
    <div class="task-delete-bg" data-action="task-delete-confirm" data-id="${id}">🗑<span>Удалить</span></div>
    <div class="task-card${task.done?' done':''}${task.urgent?' urgent':''}" data-id="${id}">
      <div class="tc-check"></div>
      <div class="tc-info">
        <div class="tc-text">${esc(task.text)}</div>
        <div class="tc-meta">
          ${task.urgent?URGENT_BADGE:''}
          ${task.dueDate?`<span class="hc-badge">${taskDayLabel(task.dueDate)}</span>`:''}
          ${task.scope==='month'?'<span class="hc-badge">Месяц</span>':''}
        </div>
      </div>
    </div>
  </div>`;
  state.tasks.filter(x => x.parentId === task.id).forEach(s => {
    html += `<div class="subtask-row${s.done?' done':''}" data-id="${esc(s.id)}">
      <div class="sub-connector"></div>
      <div class="tc-check small" data-action="task-toggle" data-id="${esc(s.id)}"></div>
      <div class="tc-text small">${esc(s.text)}</div>
      <div class="hc-edit" style="width:24px;height:24px;font-size:15px" data-action="task-edit" data-id="${esc(s.id)}">···</div>
    </div>`;
  });
  return html;
}

export function renderTasks() {
  rolloverTasks();
  const el = $('tasks-content');
  const cw = currentWeekStartStr();
  const roots = state.tasks.filter(t => !t.parentId && t.weekStart === cw);
  const activeRoots = roots.filter(t=>!t.done).sort((a,b)=> (a.order||0) - (b.order||0));
  const doneRoots = roots.filter(t=>t.done);

  if (!roots.length) {
    el.innerHTML = `<div class="empty-card"><div class="ei">✨</div><p>На этой неделе пока пусто.<br>Добавь первую задачу!</p></div>`;
    return;
  }

  let html = '';
  if (activeRoots.length) {
    html += `<div class="slabel">Задачи на этой неделе</div><div class="tasks-container">` + activeRoots.map(buildTaskRow).join('') + `</div>`;
  }
  if (doneRoots.length) {
    html += `<div class="done-div">Выполнено (${doneRoots.length})</div><div class="tasks-container">` + doneRoots.map(buildTaskRow).join('') + `</div>`;
  }
  el.innerHTML = html;

  // swipe-to-delete + long-press on root task cards
  el.querySelectorAll('.task-swipe-wrap').forEach(wrap => {
    const id = wrap.dataset.id;
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
}

function toggleTaskDone(id) {
  const t = findT(id); if (!t) return;
  t.done = !t.done;
  if (t.done) t.doneAt = today();
  refresh();
  if (t.done) showToast('Выполнено ✓');
}
onAction('task-toggle', d => { toggleTaskDone(d.id); if (d.refreshAll) renderAllTasksList(); });

function deleteTaskById(id) {
  state.tasks = state.tasks.filter(x => x.id !== id && x.parentId !== id);
  refresh(); showToast('Удалено');
}
onAction('task-delete-confirm', d => askConfirm(DELETE_TITLE, DELETE_TEXT, () => deleteTaskById(d.id)));

// ── long-press action sheet ──
onAction('task-edit',   d => { CM(d.from || 'taskActionsModal'); openTaskModal(d.id || taskActionsId, null); });
onAction('task-addsub', () => { CM('taskActionsModal'); openTaskModal(null, taskActionsId); });

// ── All tasks / archive modal ──
onAction('open-all-tasks', () => { setAllTasksView('all'); SM('allTasksModal'); });
onAction('all-tasks-view', d => setAllTasksView(d.view));
function setAllTasksView(v) {
  allTasksView = v;
  document.querySelectorAll('#all-tasks-switch .duropt').forEach(x => x.classList.toggle('sel', x.dataset.view === v));
  renderAllTasksList();
}
const editBtn = (id, extra = '') =>
  `<div class="hc-edit" ${extra} data-action="task-edit" data-from="allTasksModal" data-id="${esc(id)}">···</div>`;

function buildAllTaskRow(t) {
  return `<div class="task-card" style="cursor:default">
    <div class="tc-check" data-action="task-toggle" data-refresh-all="1" data-id="${esc(t.id)}"></div>
    <div class="tc-info">
      <div class="tc-text">${esc(t.text)}</div>
      <div class="tc-meta">
        ${t.urgent?URGENT_BADGE:''}
        ${t.dueDate?`<span class="hc-badge">${fmtShortDate(t.dueDate)}</span>`:''}
        ${t.scope==='month'?'<span class="hc-badge">Месяц</span>':''}
      </div>
    </div>
    ${editBtn(t.id)}
  </div>`;
}
function buildAllSubRow(s) {
  return `<div class="subtask-row">
    <div class="sub-connector"></div>
    <div class="tc-check small" data-action="task-toggle" data-refresh-all="1" data-id="${esc(s.id)}"></div>
    <div class="tc-text small">${esc(s.text)}</div>
    ${editBtn(s.id, 'style="width:24px;height:24px;font-size:15px"')}
  </div>`;
}
function buildArchiveRow(t) {
  const dateLbl = t.doneAt ? fmtShortDate(t.doneAt) : '';
  return `<div class="task-card done" style="cursor:default">
    <div class="tc-check"></div>
    <div class="tc-info">
      <div class="tc-text">${esc(t.text)}</div>
      <div class="tc-meta">
        ${t.urgent?URGENT_BADGE:''}
        ${dateLbl?`<span class="hc-badge">Выполнено: ${dateLbl}</span>`:''}
      </div>
    </div>
    ${editBtn(t.id)}
  </div>`;
}
function renderAllTasksList() {
  const el = $('all-tasks-content');
  if (allTasksView === 'all') {
    const roots = state.tasks.filter(t => !t.parentId && !t.done);
    if (!roots.length) { el.innerHTML = `<div class="empty-card" style="padding:28px 16px"><div class="ei">✨</div><p>Нет активных задач</p></div>`; return; }
    let html = '<div class="tasks-container">';
    roots.forEach(r => {
      html += buildAllTaskRow(r);
      state.tasks.filter(s => s.parentId === r.id && !s.done).forEach(s => html += buildAllSubRow(s));
    });
    el.innerHTML = html + '</div>';
  } else {
    const done = state.tasks.filter(t => t.done).sort((a,b) => (b.doneAt||'').localeCompare(a.doneAt||''));
    if (!done.length) { el.innerHTML = `<div class="empty-card" style="padding:28px 16px"><div class="ei">📦</div><p>Архив пуст</p></div>`; return; }
    el.innerHTML = '<div class="tasks-container">' + done.map(buildArchiveRow).join('') + '</div>';
  }
}

// ── task create/edit modal ──
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

  tmScope = base ? (base.scope||'week') : 'week';
  tmDue = base ? (base.dueDate||null) : null;
  tmUrgent = base ? !!base.urgent : false;

  const now = new Date();
  if (tmDue) { const [y,m] = tmDue.split('-'); taskCalY=+y; taskCalM=+m-1; }
  else { taskCalY=now.getFullYear(); taskCalM=now.getMonth(); }

  $('tm-title').textContent = taskParentId ? 'Новая подзадача' : (taskEditId ? 'Редактировать задачу' : 'Новая задача');
  $('tm-name').value = base ? base.text : '';

  buildTMScope(); renderTaskCal(); buildTMUrgent();

  $('tm-actions').innerHTML = taskEditId ? `
    <button class="mbtn danger" data-action="task-delete-from-modal">Удалить</button>
    <button class="mbtn primary" data-action="task-save">Готово</button>` : `
    <button class="mbtn secondary" data-action="close" data-modal="tmodal">Отмена</button>
    <button class="mbtn primary" data-action="task-save">Готово</button>`;

  SM('tmodal');
  setTimeout(() => $('tm-name').focus(), 280);
}

onAction('task-save', () => {
  const name = $('tm-name').value.trim();
  if (!name) { flashInvalid($('tm-name')); return; }
  const base = taskEditId ? findT(taskEditId) : null;
  const weekStart = tmDue ? mondayOf(tmDue) : (base ? base.weekStart : currentWeekStartStr());

  if (base) {
    Object.assign(base, { text:name, scope:tmScope, dueDate:tmDue, urgent:tmUrgent, weekStart });
    showToast('Сохранено ✓');
  } else {
    state.tasks.push({ id:Date.now().toString(), text:name, done:false, urgent:tmUrgent, scope:tmScope, dueDate:tmDue, weekStart, parentId: taskParentId||null, createdAt: today(), order: Date.now() });
    showToast(taskParentId ? '➕ Подзадача добавлена' : '✅ Задача добавлена');
  }
  CM('tmodal'); refresh();
});

onAction('task-delete-from-modal', () => {
  const id = taskEditId; if (!id) return;
  askConfirm(DELETE_TITLE, DELETE_TEXT, () => { deleteTaskById(id); CM('tmodal'); });
});
