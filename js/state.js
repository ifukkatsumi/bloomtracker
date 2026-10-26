// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
import { LH, LT, lsLoad, lsSave } from './storage.js';

export const DV_ALL = [1,2,3,4,5,6,0];

export function normalizeHabit(h) {
  return { days: DV_ALL.slice(), duration: 'forever', priority: 3, emoji: '🌸', ...h, id: String(h.id), priority: Number(h.priority) || 3, history: h.history || {} };
}
// {id,text,done,urgent,scope,dueDate,weekStart,parentId,createdAt,order}
export function normalizeTask(t) {
  return { order: parseInt(t.id)||0, ...t, id: String(t.id), parentId: t.parentId != null ? String(t.parentId) : null };
}

export const state = {
  habits: lsLoad(LH, []).map(normalizeHabit),
  tasks:  lsLoad(LT, []).map(normalizeTask),
  activeTab: 'habits',
};

export const saveHabits = () => lsSave(LH, state.habits);
export const saveTasks  = () => lsSave(LT, state.tasks);
