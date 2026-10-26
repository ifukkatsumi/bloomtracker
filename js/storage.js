// ══════════════════════════════════════════
//  LOCAL STORAGE — данные только на устройстве
// ══════════════════════════════════════════
export const LH = 'bloom_habits_v2';
export const LT = 'bloom_tasks_v2';

export function lsSave(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }
export function lsLoad(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e) { return d; } }
