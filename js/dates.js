// ══════════════════════════════════════════
//  DATE UTILS
//  Все даты — строки 'YYYY-MM-DD' в локальном часовом поясе.
// ══════════════════════════════════════════
export const MO_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

export const pad = n => String(n).padStart(2,'0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export function dminus(n) { const d = new Date(); d.setDate(d.getDate()-n); return ymd(d); }

// new Date('YYYY-MM-DD') парсится как полночь UTC — западнее UTC это уже
// предыдущий день. Добавляем время, чтобы получить локальную полночь.
export const parseYmd = dk => new Date(dk + 'T00:00:00');
export const dowOf = dk => parseYmd(dk).getDay();

export function fmtHeader() {
  const d = new Date();
  const dows = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  const mons = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${dows[d.getDay()].toUpperCase()}, ${d.getDate()} ${mons[d.getMonth()].toUpperCase()}`;
}

export function weekDates() {
  const now = new Date(), dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow-1));
  return Array.from({length:7}, (_,i) => { const d2=new Date(mon); d2.setDate(mon.getDate()+i); return ymd(d2); });
}
export function currentWeekStartStr() { return weekDates()[0]; }

export function mondayOf(dateStr) {
  const dt = parseYmd(dateStr);
  const dow = dt.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(dt); mon.setDate(dt.getDate() + diff);
  return ymd(mon);
}

export function fmtShortDate(dk) {
  const [, m, d] = dk.split('-');
  const M = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  return `${+d} ${M[+m-1]}`;
}

export function taskDayLabel(dk) {
  const d = parseYmd(dk);
  const wd = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
  return `${wd}, ${d.getDate()}`;
}

// plural(3, 'задача', 'задачи', 'задач') → 'задачи'
export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// Сдвиг даты на n дней и разница в днях — через компоненты даты, без влияния
// часового пояса и перехода на летнее время.
export function addDays(dk, n) { const d = parseYmd(dk); d.setDate(d.getDate() + n); return ymd(d); }
export function daysBetween(a, b) {
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb-1, db) - Date.UTC(ya, ma-1, da)) / 864e5);
}
export const monthOf = dk => dk.slice(0, 7);

const MON_GEN = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
// '2026-11-02', '2026-11-08' → '2–8 ноя';  '2026-11-30', '2026-12-06' → '30 ноя – 6 дек'
export function fmtRange(a, b) {
  const [, ma, da] = a.split('-').map(Number), [, mb, db] = b.split('-').map(Number);
  return ma === mb ? `${da}–${db} ${MON_GEN[mb-1]}` : `${da} ${MON_GEN[ma-1]} – ${db} ${MON_GEN[mb-1]}`;
}
