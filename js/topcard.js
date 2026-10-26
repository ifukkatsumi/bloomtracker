// ══════════════════════════════════════════
//  TOP SUMMARY CARD — своя статистика для каждой вкладки
// ══════════════════════════════════════════
import { state } from './state.js';
import { today, mondayOf, plural, fmtRange } from './dates.js';
import { isPlannedOn } from './stats.js';
import { mainSections } from './tasklogic.js';
import { M_START, M_END, M_TOTAL, marathonPhase, marathonStats } from './marathonplan.js';
import { $ } from './ui.js';

export function updateTopCard() {
  if (state.activeTab === 'habits') renderHabitsTopCard();
  else if (state.activeTab === 'tasks') renderTasksTopCard();
  else renderMarathonTopCard();
}

function card(left, label, title, pct, footer, extra = '') {
  $('progress-card').innerHTML = `
    <div class="pc-left">${left}</div>
    <div class="pc-right">
      <div class="pc-label">${label}</div>
      <div class="pc-title">${title}</div>
      <div class="pc-track"><div class="pc-fill" style="width:${pct}%"></div></div>
      <div class="pc-pct">${footer}</div>
      ${extra}
    </div>`;
}

function renderHabitsTopCard() {
  const t = today();
  const planToday = state.habits.filter(h => isPlannedOn(h, t));
  const doneToday = planToday.filter(h => h.history[t]).length;
  const pct = planToday.length ? Math.round(doneToday/planToday.length*100) : 0;
  let title;
  if (!planToday.length) title = 'Нет привычек на сегодня';
  else if (pct === 100) title = 'Всё выполнено! ✨';
  else if (doneToday > 0) title = 'Отлично, продолжай!';
  else title = `${planToday.length} ${plural(planToday.length,'привычка','привычки','привычек')} на сегодня`;

  card(`<div class="pc-nums">${doneToday}<span>/${planToday.length}</span></div><div class="pc-today">СЕГОДНЯ</div>`,
    'ПРОГРЕСС ДНЯ', title, pct, `<span>✦</span><span>${pct}% выполнено</span>`);
}

function renderTasksTopCard() {
  const t = today(), mon = mondayOf(t);
  const { week, month } = mainSections(state.tasks, t);
  const doneWeek = state.tasks.filter(x => !x.parentId && x.done && (x.doneAt || '') >= mon).length;
  const total = week.length + doneWeek;
  const urgentCount = week.filter(x => x.urgent).length;
  const todayCount = week.filter(x => !x.dueDate || x.dueDate <= t).length;
  const pct = total ? Math.round(doneWeek/total*100) : 0;

  let titleTxt = 'Пока нет задач';
  if (total) {
    titleTxt = `${total} ${plural(total,'задача','задачи','задач')} на неделе`;
    if (urgentCount) titleTxt += ` · 🔥 ${urgentCount}`;
  }
  const monthTxt = month.length ? ` · ещё ${month.length} в месяце` : '';

  card(`<div class="pc-nums">${todayCount}</div><div class="pc-today">${plural(todayCount,'ЗАДАЧА','ЗАДАЧИ','ЗАДАЧ')}<br>СЕГОДНЯ</div>`,
    'НА ЭТОЙ НЕДЕЛЕ', titleTxt, pct, `<span>✦</span><span>${doneWeek}/${total} выполнено${monthTxt}</span>`,
    `<button class="all-tasks-link" data-action="open-all-tasks">📋 Все задачи</button>`);
}

function renderMarathonTopCard() {
  const ph = marathonPhase();
  const s = marathonStats(state.marathon);
  let left;
  if (ph.phase === 'before') left = `<div class="pc-nums">${ph.daysToStart}</div><div class="pc-today">${plural(ph.daysToStart,'ДЕНЬ','ДНЯ','ДНЕЙ')}<br>ДО СТАРТА</div>`;
  else if (ph.phase === 'running') left = `<div class="pc-nums">${ph.day}<span>/${M_TOTAL}</span></div><div class="pc-today">ДЕНЬ</div>`;
  else left = `<div class="pc-nums">🎉</div><div class="pc-today">ФИНИШ</div>`;

  const footer = s.total
    ? `<span>✦</span><span>${s.done}/${s.total} выполнено</span>`
    : `<span>✦</span><span>Собери сюда все зависшие дела</span>`;

  card(left, `МАРАФОН · ${fmtRange(M_START, M_END).toUpperCase()}`, '60 дней до Нового года', s.pct, footer);
}
