// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
import { LH, LT, LM, LUI, lsLoad, lsSave, lsChanged } from './storage.js';

export const DV_ALL = [1,2,3,4,5,6,0];

// История: { 'YYYY-MM-DD': true }. Приводим к этому виду и старые варианты —
// массив дат, ключи без ведущих нулей ('2026-9-5') или с временем ('2026-09-05T…').
export function normalizeHistory(src) {
  const out = {};
  const put = (key, val) => {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(key));
    if (!m || !val) return;
    out[`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`] = true;
  };
  if (Array.isArray(src)) src.forEach(k => put(k, true));
  else if (src && typeof src === 'object') Object.entries(src).forEach(([k, v]) => put(k, v));
  return out;
}

export function normalizeHabit(h) {
  return { days: DV_ALL.slice(), duration: 'forever', priority: 3, emoji: '🌸', ...h, id: String(h.id), priority: Number(h.priority) || 3, history: normalizeHistory(h.history) };
}
// {id,text,done,urgent,scope,dueDate,weekStart,parentId,createdAt,order,doneAt}
export function normalizeTask(t) {
  return { order: parseInt(t.id)||0, ...t, id: String(t.id), parentId: t.parentId != null ? String(t.parentId) : null };
}
// {id,text,week: null|1..9,done,doneAt,createdAt,order}
export function normalizeMarathonTask(t) {
  const w = Number(t.week);
  return { order: parseInt(t.id)||0, done: false, createdAt: null, ...t, id: String(t.id), text: String(t.text ?? ''), week: w >= 1 && w <= 9 ? w : null };
}

// Выполненная главная задача не может содержать невыполненные подзадачи
export function fixParentStatus(tasks) {
  let changed = false;
  tasks.forEach(p => {
    if (p.parentId || !p.done) return;
    if (tasks.some(s => s.parentId === p.id && !s.done)) { p.done = false; delete p.doneAt; changed = true; }
  });
  return changed;
}

const DEFAULT_UI = { collapsed: {} };

export const state = {
  habits: [], tasks: [], marathon: [],
  ui: { ...DEFAULT_UI },
  activeTab: 'habits',
};

function loadHabits()   { state.habits = lsLoad(LH, []).filter(Boolean).map(normalizeHabit); }
function loadTasks()    { state.tasks = lsLoad(LT, []).filter(Boolean).map(normalizeTask); if (fixParentStatus(state.tasks)) saveTasks(); }
function loadMarathon() { state.marathon = lsLoad(LM, []).filter(Boolean).map(normalizeMarathonTask); }

export const saveHabits   = () => lsSave(LH, state.habits);
export const saveTasks    = () => lsSave(LT, state.tasks);
export const saveMarathon = () => lsSave(LM, state.marathon);
export const saveUI       = () => lsSave(LUI, state.ui);

export function isCollapsed(key) { return !!state.ui.collapsed[key]; }
export function setCollapsed(key, v) { state.ui.collapsed[key] = v; saveUI(); }

loadHabits(); loadTasks(); loadMarathon();
state.ui = { ...DEFAULT_UI, ...lsLoad(LUI, {}) };
state.ui.collapsed = state.ui.collapsed || {};

// Приложение держит все данные в памяти и сохраняет массив целиком. Если открыто
// несколько экземпляров (две вкладки Safari, вкладка, вернувшаяся из фона через
// несколько дней), устаревшая копия при следующем сохранении перезаписала бы более
// свежие отметки. Поэтому перечитываем хранилище, если его изменил кто-то другой.
export function syncFromStorage() {
  let changed = false;
  if (lsChanged(LH)) { loadHabits(); changed = true; }
  if (lsChanged(LT)) { loadTasks(); changed = true; }
  if (lsChanged(LM)) { loadMarathon(); changed = true; }
  return changed;
}
