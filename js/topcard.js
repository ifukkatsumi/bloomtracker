// ══════════════════════════════════════════
//  TOP SUMMARY CARD
// ══════════════════════════════════════════
import { state } from './state.js';
import { today, currentWeekStartStr, plural } from './dates.js';
import { isPlannedOn } from './stats.js';
import { $ } from './ui.js';

export function updateTopCard() {
  if (state.activeTab === 'habits') renderHabitsTopCard();
  else renderTasksTopCard();
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

  $('progress-card').innerHTML = `
    <div class="pc-left"><div class="pc-nums">${doneToday}<span>/${planToday.length}</span></div><div class="pc-today">СЕГОДНЯ</div></div>
    <div class="pc-right">
      <div class="pc-label">ПРОГРЕСС ДНЯ</div>
      <div class="pc-title">${title}</div>
      <div class="pc-track"><div class="pc-fill" style="width:${pct}%"></div></div>
      <div class="pc-pct"><span>✦</span><span>${pct}% выполнено</span></div>
    </div>`;
}

function renderTasksTopCard() {
  const cw = currentWeekStartStr(), t = today();
  const weekRoots = state.tasks.filter(x => !x.parentId && x.weekStart === cw);
  const total = weekRoots.length;
  const doneCount = weekRoots.filter(x => x.done).length;
  const urgentCount = weekRoots.filter(x => x.urgent && !x.done).length;
  const todayCount = weekRoots.filter(x => !x.done && (x.dueDate === t || !x.dueDate)).length;
  const pct = total ? Math.round(doneCount/total*100) : 0;

  let titleTxt = 'Пока нет задач';
  if (total) {
    titleTxt = `${total} ${plural(total,'задача','задачи','задач')} на неделе`;
    if (urgentCount) titleTxt += ` · 🔥 ${urgentCount}`;
  }

  $('progress-card').innerHTML = `
    <div class="pc-left"><div class="pc-nums">${todayCount}</div><div class="pc-today">${plural(todayCount,'ЗАДАЧА','ЗАДАЧИ','ЗАДАЧ')}<br>СЕГОДНЯ</div></div>
    <div class="pc-right">
      <div class="pc-label">НА ЭТОЙ НЕДЕЛЕ</div>
      <div class="pc-title">${titleTxt}</div>
      <div class="pc-track"><div class="pc-fill" style="width:${pct}%"></div></div>
      <div class="pc-pct"><span>✦</span><span>${doneCount}/${total} выполнено</span></div>
      <button class="all-tasks-link" data-action="open-all-tasks">📋 Все задачи</button>
    </div>`;
}
