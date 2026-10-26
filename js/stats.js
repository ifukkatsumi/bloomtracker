// ══════════════════════════════════════════
//  HABIT STATS
// ══════════════════════════════════════════
import { ymd, today, dminus, parseYmd, dowOf, weekDates } from './dates.js';
import { DV_ALL } from './state.js';

const daysOf = h => h.days || DV_ALL;

// Первый день, когда привычка уже не действует (или null — бессрочно).
// duration: 'week' | 'month' | '3months' | 'forever' | 'custom' (+ durationCount, durationUnit)
export function habitEnd(h, from = h.createdAt) {
  if (!from) return null;
  const d = parseYmd(from);
  switch (h.duration) {
    case 'week':    d.setDate(d.getDate() + 7); break;
    case 'month':   d.setMonth(d.getMonth() + 1); break;
    case '3months': d.setMonth(d.getMonth() + 3); break;
    case 'custom': {
      const n = Math.max(1, parseInt(h.durationCount) || 0);
      if (h.durationUnit === 'month') d.setMonth(d.getMonth() + n);
      else d.setDate(d.getDate() + n * (h.durationUnit === 'week' ? 7 : 1));
      break;
    }
    default: return null;
  }
  return ymd(d);
}
export function isEnded(h) { const end = habitEnd(h); return !!end && today() >= end; }

// Активна ли привычка в этот день — не считаем дни до создания и после окончания
export function isActiveOn(h, dk) {
  if (dk < (h.createdAt || '0000-01-01')) return false;
  const end = habitEnd(h);
  return !end || dk < end;
}
export const isPlannedOn = (h, dk) => isActiveOn(h, dk) && daysOf(h).includes(dowOf(dk));

// Серия: дни, не входящие в расписание привычки, серию не прерывают
export function calcStreak(h) {
  const days = daysOf(h);
  let s = 0; const d = new Date();
  if (!h.history[today()]) d.setDate(d.getDate()-1);
  for (let i=0; i<3660; i++) {
    if (h.history[ymd(d)]) s++;
    else if (days.includes(d.getDay())) break;
    d.setDate(d.getDate()-1);
  }
  return s;
}

// Процент выполнения; null — если в периоде не было запланированных дней
export function wkPct(h) {
  const plan = weekDates().filter(dk => isPlannedOn(h, dk));
  return plan.length ? Math.round(plan.filter(dk=>h.history[dk]).length/plan.length*100) : null;
}
export function moPct(h) {
  let done=0, tot=0;
  for (let i=0; i<30; i++) {
    const dk = dminus(i);
    if (isPlannedOn(h, dk)) { tot++; if (h.history[dk]) done++; }
  }
  return tot ? Math.round(done/tot*100) : null;
}
export function avgPct(values) {
  const v = values.filter(x => x !== null);
  return v.length ? Math.round(v.reduce((a,b)=>a+b,0)/v.length) : 0;
}
