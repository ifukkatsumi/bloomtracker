// ══════════════════════════════════════════
//  MARATHON PLAN — «60 дней до Нового года» (без DOM)
// ══════════════════════════════════════════
import { today, addDays, daysBetween, fmtRange } from './dates.js';

export const M_START = '2026-11-02';
export const M_END   = '2026-12-31';                       // последний день, включительно
export const M_TOTAL = daysBetween(M_START, M_END) + 1;    // 60

// Девять блоков по 7 дней от старта; последний обрезается по 31 декабря (4 дня)
export const M_WEEKS = Array.from({ length: 9 }, (_, i) => {
  const start = addDays(M_START, i * 7);
  const end = i === 8 ? M_END : addDays(start, 6);
  return { n: i + 1, start, end, days: daysBetween(start, end) + 1, label: fmtRange(start, end) };
});

// { phase: 'before' | 'running' | 'after', day, daysLeft, daysToStart }
export function marathonPhase(t0 = today()) {
  if (t0 < M_START) return { phase: 'before', day: 0, daysToStart: daysBetween(t0, M_START), daysLeft: M_TOTAL };
  if (t0 > M_END)   return { phase: 'after', day: M_TOTAL, daysToStart: 0, daysLeft: 0 };
  const day = daysBetween(M_START, t0) + 1;
  return { phase: 'running', day, daysToStart: 0, daysLeft: M_TOTAL - day };
}

export const currentWeekN = (t0 = today()) => (M_WEEKS.find(w => t0 >= w.start && t0 <= w.end) || {}).n || null;

export function marathonStats(list) {
  const total = list.length, done = list.filter(t => t.done).length;
  return { total, done, inbox: list.filter(t => !t.week && !t.done).length, pct: total ? Math.round(done / total * 100) : 0 };
}
