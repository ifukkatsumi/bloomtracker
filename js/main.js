// ══════════════════════════════════════════
//  ENTRY POINT
// ══════════════════════════════════════════
import { state } from './state.js';
import { today, fmtHeader } from './dates.js';
import { $, SM } from './ui.js';
import { updateTopCard } from './topcard.js';
import { renderHabits, openAdd } from './habits.js';
import { renderTasks, rolloverTasks, openTaskModal } from './tasks.js';
import './reorder.js';
import './backup.js';

function renderDate() { $('date-str').textContent = fmtHeader(); }

function switchTab(t) {
  state.activeTab = t;
  document.querySelectorAll('.bar-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === t));
  document.querySelectorAll('.sec').forEach(x => x.classList.toggle('active', x.id === 'sec-' + t));
  updateTopCard();
}
document.querySelectorAll('.bar-tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

$('fab').addEventListener('click', () => { if (state.activeTab === 'habits') openAdd(); else openTaskModal(null, null); });
$('backup-btn').addEventListener('click', () => SM('bmodal'));

function renderAll() { renderDate(); renderHabits(); renderTasks(); updateTopCard(); }
renderAll();

// Раз в минуту: перенос задач, а после полуночи — полная перерисовка
let lastDay = today();
setInterval(() => {
  if (today() !== lastDay) { lastDay = today(); renderAll(); return; }
  rolloverTasks();
  if (state.activeTab === 'tasks') { renderTasks(); updateTopCard(); }
}, 60000);
