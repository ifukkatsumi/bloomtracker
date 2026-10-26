// ══════════════════════════════════════════
//  BACKUP — экспорт / импорт JSON
// ══════════════════════════════════════════
import { state, saveHabits, saveTasks, normalizeHabit, normalizeTask } from './state.js';
import { today } from './dates.js';
import { $, CM, showToast } from './ui.js';
import { renderHabits } from './habits.js';
import { renderTasks } from './tasks.js';
import { updateTopCard } from './topcard.js';

$('export-btn').addEventListener('click', () => {
  const data = { version: 3, exportedAt: new Date().toISOString(), habits: state.habits, tasks: state.tasks };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `bloom-backup-${today()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('💾 Экспортировано!');
});

$('import-trigger').addEventListener('click', () => $('import-file').click());

const validItems = list => (Array.isArray(list) ? list : []).filter(x => x && typeof x === 'object' && x.id != null);

$('import-file').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const hmap = {}; state.habits.forEach(h => hmap[h.id] = h);
    validItems(data.habits).forEach(raw => {
      const cur = hmap[String(raw.id)];
      if (cur) {
        // локальные отметки важнее импортированных
        cur.history = {...raw.history, ...cur.history};
        ['name','emoji','days','priority','duration'].forEach(k => { if (raw[k] !== undefined) cur[k] = raw[k]; });
        Object.assign(cur, normalizeHabit(cur));
      } else { const imp = normalizeHabit(raw); state.habits.push(imp); hmap[imp.id] = imp; }
    });
    const tids = new Set(state.tasks.map(t => t.id));
    validItems(data.tasks).map(normalizeTask).forEach(imp => { if (!tids.has(imp.id)) { state.tasks.push(imp); tids.add(imp.id); } });
    saveHabits(); saveTasks();
    renderHabits(); renderTasks(); updateTopCard(); CM('bmodal');
    showToast('✅ Данные объединены!');
  } catch { showToast('❌ Ошибка импорта'); }
  e.target.value = '';
});
