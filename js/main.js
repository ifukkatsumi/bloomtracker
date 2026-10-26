// ══════════════════════════════════════════
//  ENTRY POINT
// ══════════════════════════════════════════
import './iosfix.js';
import { state, syncFromStorage } from './state.js';
import { today, fmtHeader } from './dates.js';
import { $, onAction, topModal } from './ui.js';
import { updateTopCard } from './topcard.js';
import { renderHabits, openAdd, exitHabitSort, refreshHabitCalendar } from './habits.js';
import { renderTasks, openTaskModal, exitTaskSort } from './tasks.js';
import { renderMarathon, openMarathonModal, exitMarathonSort, focusCurrentWeek } from './marathon.js';
import { onDataChange, renderDataScreen } from './backup.js';
import './settings.js';

const TABS = ['habits', 'tasks', 'marathon'];
const scrollPos = {};   // позиция прокрутки каждой вкладки
const visited = new Set(['habits']);

function renderDate() { $('date-str').textContent = fmtHeader(); }

function switchTab(t) {
  if (!TABS.includes(t) || t === state.activeTab) return;
  const scroller = document.querySelector('.scroll');
  scrollPos[state.activeTab] = scroller.scrollTop;
  exitHabitSort(); exitTaskSort(); exitMarathonSort();
  state.activeTab = t;
  document.querySelectorAll('.bar-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === t));
  document.querySelectorAll('.sec').forEach(x => x.classList.toggle('active', x.id === 'sec-' + t));
  updateTopCard();
  // марафон при первом открытии — сразу к текущей неделе, потом — где остановились
  if (t === 'marathon' && !visited.has(t)) focusCurrentWeek();
  else scroller.scrollTop = scrollPos[t] || 0;
  visited.add(t);
}
document.querySelectorAll('.bar-tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

// «+» зависит от вкладки
$('fab').addEventListener('click', () => {
  if (state.activeTab === 'habits') openAdd();
  else if (state.activeTab === 'tasks') openTaskModal(null, null);
  else openMarathonModal(null, null);
});

function renderAll() { renderDate(); renderHabits(); renderTasks(); renderMarathon(); updateTopCard(); }
onDataChange(renderAll);
renderAll();

// Данные изменились в другом экземпляре приложения — перечитываем, чтобы
// устаревшая копия в памяти не затёрла свежие отметки при следующем сохранении.
function resync() {
  if (syncFromStorage()) {
    renderAll(); refreshHabitCalendar();
    if (topModal() === 'bmodal') renderDataScreen();
  }
}
window.addEventListener('storage', resync);
window.addEventListener('pageshow', resync);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { resync(); tickDay(); } });

// Раз в минуту: после полуночи — полная перерисовка
let lastDay = today();
function tickDay() { if (today() !== lastDay) { lastDay = today(); renderAll(); } }
setInterval(tickDay, 60000);
