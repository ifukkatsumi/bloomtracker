// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
import { LH, LT, LM, LUI, lsLoad, lsSave, lsChanged } from './storage.js';

export const DV_ALL = [1,2,3,4,5,6,0];

// История: { 'YYYY-MM-DD': true }. Старые варианты приводим к этому виду:
// массив дат, ключи без ведущих нулей ('2026-9-5'), с временем ('2026-09-05T…'),
// '05.09.2026', метки времени и строки вида 'Sat Sep 05 2026'.
// Ключ, который не удалось распознать, НЕ отбрасывается — сохраняется как есть.
const pad2 = n => String(n).padStart(2, '0');
const ymdLocal = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
function historyKey(key) {
  const k = String(key).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(k);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(k);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  if (/^\d{10,13}$/.test(k)) { const d = new Date(k.length === 10 ? +k * 1000 : +k); if (!isNaN(d)) return ymdLocal(d); }
  if (/[a-z]/i.test(k)) { const d = new Date(k); if (!isNaN(d) && d.getFullYear() > 2000) return ymdLocal(d); }
  return null;
}
const isMarked = v => !(v === false || v === 0 || v == null || v === '' || v === 'false' || v === '0');
export function normalizeHistory(src) {
  const out = {};
  const put = (key, val) => {
    if (!isMarked(val)) return;
    const k = historyKey(key);
    if (k) out[k] = true;
    else out[String(key)] = val;      // неизвестный формат — бережно сохраняем
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

// Выполненная главная задача не может содержать невыполненные подзадачи.
// Старая версия позволяла отметить главную задачу, не закрыв подзадачи. Такую
// задачу пользователь уже выполнил — сохраняем это и закрываем её подзадачи,
// а не возвращаем задачу в активные.
export function fixParentStatus(tasks) {
  let changed = false;
  tasks.forEach(p => {
    if (p.parentId || !p.done) return;
    tasks.forEach(s => {
      if (s.parentId === p.id && !s.done) { s.done = true; s.doneAt = p.doneAt || s.doneAt; changed = true; }
    });
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
