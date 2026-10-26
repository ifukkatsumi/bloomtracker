// ══════════════════════════════════════════
//  LOCAL STORAGE — данные только на устройстве
// ══════════════════════════════════════════
export const LH = 'bloom_habits_v2';
export const LT = 'bloom_tasks_v2';
export const LM = 'bloom_marathon_v1';   // задачи марафона — отдельно от обычных
export const LUI = 'bloom_ui_v1';        // свёрнутые разделы и прочие настройки интерфейса
export const LTHEME = 'bloom_theme';

// Последнее записанное/прочитанное значение каждого ключа — чтобы понять,
// изменил ли хранилище другой экземпляр приложения (вкладка, PWA).
const lastRaw = {};

export function lsSave(k, v) {
  try { const raw = JSON.stringify(v); localStorage.setItem(k, raw); lastRaw[k] = raw; } catch(e) {}
}
export function lsLoad(k, d) {
  try { const raw = localStorage.getItem(k); lastRaw[k] = raw; return raw ? JSON.parse(raw) : d; } catch(e) { return d; }
}
export function lsChanged(k) {
  try { return localStorage.getItem(k) !== lastRaw[k]; } catch(e) { return false; }
}
export function lsGetString(k, d) { try { return localStorage.getItem(k) ?? d; } catch(e) { return d; } }
export function lsSetString(k, v) { try { localStorage.setItem(k, v); } catch(e) {} }
