// ══════════════════════════════════════════
//  REORDER — общий список для привычек и задач
// ══════════════════════════════════════════
import { state, saveHabits, saveTasks } from './state.js';
import { currentWeekStartStr } from './dates.js';
import { $, esc, SM, CM, onAction } from './ui.js';
import { renderHabits } from './habits.js';
import { renderTasks } from './tasks.js';
import { updateTopCard } from './topcard.js';

let reorderMode = null;

function activeWeekTasks() {
  const cw = currentWeekStartStr();
  return state.tasks.filter(t => !t.parentId && t.weekStart === cw && !t.done).sort((a,b) => (a.order||0) - (b.order||0));
}

function reorderRowHTML(id, label, isFirst, isLast) {
  return `<div class="reorder-row">
    <span class="reorder-label">${label}</span>
    <div class="reorder-btns">
      <button class="reorder-btn" ${isFirst?'disabled':''} data-action="reorder-move" data-id="${esc(id)}" data-dir="-1">▲</button>
      <button class="reorder-btn" ${isLast?'disabled':''} data-action="reorder-move" data-id="${esc(id)}" data-dir="1">▼</button>
    </div>
  </div>`;
}

function renderReorderList() {
  const el = $('reorder-list');
  const empty = text => `<div class="empty-card" style="padding:24px 16px"><p>${text}</p></div>`;
  if (reorderMode === 'habits') {
    const { habits } = state;
    if (!habits.length) { el.innerHTML = empty('Нет привычек'); return; }
    el.innerHTML = habits.map((h,idx) => reorderRowHTML(h.id, `${esc(h.emoji||'🌸')} ${esc(h.name)}`, idx===0, idx===habits.length-1)).join('');
  } else {
    const list = activeWeekTasks();
    if (!list.length) { el.innerHTML = empty('Нет активных задач на этой неделе'); return; }
    el.innerHTML = list.map((t,idx) => reorderRowHTML(t.id, esc(t.text) + (t.urgent?' 🔥':''), idx===0, idx===list.length-1)).join('');
  }
}

onAction('open-reorder', d => {
  CM(d.from);
  reorderMode = d.kind;
  $('reorder-title').textContent = reorderMode === 'habits' ? 'Порядок привычек' : 'Порядок задач';
  renderReorderList();
  SM('reorderModal');
});

onAction('reorder-move', d => {
  const dir = +d.dir;
  if (reorderMode === 'habits') {
    const { habits } = state;
    const idx = habits.findIndex(x => x.id === d.id), swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= habits.length) return;
    [habits[idx], habits[swap]] = [habits[swap], habits[idx]];
    saveHabits(); renderHabits();
  } else {
    const list = activeWeekTasks();
    const idx = list.findIndex(x => x.id === d.id), swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    [list[idx].order, list[swap].order] = [list[swap].order, list[idx].order];
    saveTasks(); renderTasks();
  }
  updateTopCard(); renderReorderList();
});
