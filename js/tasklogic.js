// ══════════════════════════════════════════
//  TASK LOGIC — распределение по разделам и правила подзадач (без DOM)
// ══════════════════════════════════════════
import { today, mondayOf, addDays, monthOf } from './dates.js';

export const subtasksOf = (tasks, id) => tasks.filter(s => s.parentId === id);
export const hasOpenSubtasks = (tasks, id) => tasks.some(s => s.parentId === id && !s.done);

// Раздел главной для незавершённой главной задачи:
// 'week' — дата в текущей неделе (Пн–Вс) или уже прошла; 'month' — дата позже,
// но в текущем месяце; null — дата за пределами месяца (видна в «Все задачи»).
// Задачи без даты — по полю scope. weekStart для показа не используется.
export function sectionOf(t, t0 = today()) {
  if (t.dueDate) {
    const sunday = addDays(mondayOf(t0), 6);
    if (t.dueDate <= sunday) return 'week';
    if (monthOf(t.dueDate) === monthOf(t0)) return 'month';
    return null;
  }
  return t.scope === 'month' ? 'month' : 'week';
}

export const isOverdue = (t, t0 = today()) => !t.done && !!t.dueDate && t.dueDate < t0;

// В разделе «Выполнено» на главной — то, что выполнено в этом месяце или на этой неделе
export function doneOnMain(t, t0 = today()) {
  if (!t.done) return false;
  const mon = mondayOf(t0), first = monthOf(t0) + '-01';
  const from = mon < first ? mon : first;
  return (t.doneAt || t.weekStart || '') >= from;
}

export const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

export function mainSections(tasks, t0 = today()) {
  const roots = tasks.filter(t => !t.parentId);
  const active = roots.filter(t => !t.done);
  return {
    week:  active.filter(t => sectionOf(t, t0) === 'week').sort(byOrder),
    month: active.filter(t => sectionOf(t, t0) === 'month').sort(byOrder),
    done:  roots.filter(t => doneOnMain(t, t0)).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '') || byOrder(a, b)),
  };
}
