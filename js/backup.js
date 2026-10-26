// ══════════════════════════════════════════
//  BACKUP — экспорт / импорт JSON и проверка истории
// ══════════════════════════════════════════
import { state, saveHabits, saveTasks, saveMarathon, normalizeHabit, normalizeTask, normalizeMarathonTask, normalizeHistory, fixParentStatus } from './state.js';
import { LH, LT, LM, LUI, LTHEME, lsGetString } from './storage.js';
import { today, fmtShortDate } from './dates.js';
import { $, esc, onAction, showToast, askConfirm } from './ui.js';

// Обновление экрана после изменения данных — назначается в main.js
let afterChange = () => {};
export function onDataChange(fn) { afterChange = fn; }

// v4: + задачи марафона и тема. Старые копии (v3 и без версии) читаются как раньше.
const BACKUP_VERSION = 4;

$('export-btn').addEventListener('click', () => {
  const data = {
    version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
    habits: state.habits, tasks: state.tasks, marathon: state.marathon,
    settings: { theme: lsGetString(LTHEME, 'pink') },
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `bloom-backup-${today()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('💾 Экспортировано!');
});

$('import-trigger').addEventListener('click', () => $('import-file').click());

const validItems = list => (Array.isArray(list) ? list : []).filter(x => x && typeof x === 'object' && x.id != null);
const nameKey = s => String(s || '').trim().toLowerCase();

// Объединение истории: отметка из любого источника сохраняется (ничего не теряем)
function mergeHistory(target, src) {
  const add = normalizeHistory(src);
  let n = 0;
  for (const k in add) if (!target.history[k]) { target.history[k] = true; n++; }
  return n;
}

// Привычки сопоставляются по id, а если id другой — по названию (иначе после
// пересоздания привычки импорт добавил бы её дубликат со старой историей).
export function mergeHabits(list, { updateFields = true } = {}) {
  const byId = new Map(state.habits.map(h => [h.id, h]));
  const byName = new Map(state.habits.map(h => [nameKey(h.name), h]));
  let added = 0, marks = 0;
  validItems(list).forEach(raw => {
    const cur = byId.get(String(raw.id)) || byName.get(nameKey(raw.name));
    if (cur) {
      marks += mergeHistory(cur, raw.history);
      if (updateFields && cur.id === String(raw.id)) {
        ['name','emoji','days','priority','duration'].forEach(k => { if (raw[k] !== undefined) cur[k] = raw[k]; });
        Object.assign(cur, normalizeHabit(cur));
      }
    } else if (raw.name) {
      const imp = normalizeHabit(raw);
      state.habits.push(imp); byId.set(imp.id, imp); byName.set(nameKey(imp.name), imp);
      added++;
    }
  });
  return { added, marks };
}

function mergeById(target, list, normalize) {
  const ids = new Set(target.map(t => t.id));
  let added = 0;
  validItems(list).map(normalize).forEach(imp => { if (!ids.has(imp.id)) { target.push(imp); ids.add(imp.id); added++; } });
  return added;
}

$('import-file').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data || typeof data !== 'object') throw new Error('bad file');
    mergeHabits(data.habits);
    mergeById(state.tasks, data.tasks, normalizeTask);
    fixParentStatus(state.tasks);
    // в старых копиях марафона нет — текущие задачи марафона не трогаем
    if (Array.isArray(data.marathon)) mergeById(state.marathon, data.marathon, normalizeMarathonTask);
    saveHabits(); saveTasks(); saveMarathon();
    afterChange(); renderDataScreen();
    showToast('✅ Данные объединены!');
  } catch { showToast('❌ Ошибка импорта'); }
  e.target.value = '';
});

// ── Проверка истории и поиск старых данных ──
// Ищем в localStorage другие ключи с привычками (например, от прежней версии
// приложения). Берём только реально сохранённые отметки — ничего не придумываем.
function findLegacyHabits() {
  const known = new Set([LH, LT, LM, LUI, LTHEME]);
  const found = [];
  let keys = [];
  try { keys = Object.keys(localStorage); } catch { return found; }
  keys.filter(k => !known.has(k) && /bloom|habit|привыч/i.test(k)).forEach(k => {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      const list = Array.isArray(v) ? v : (v && Array.isArray(v.habits) ? v.habits : null);
      if (!list) return;
      const habits = list.filter(h => h && typeof h === 'object' && h.name && h.history);
      const marks = habits.reduce((s, h) => s + Object.keys(normalizeHistory(h.history)).length, 0);
      if (marks) found.push({ key: k, habits, marks });
    } catch {}
  });
  return found;
}

export function renderDataScreen() {
  const rows = state.habits.map(h => {
    const keys = Object.keys(h.history).filter(k => h.history[k]).sort();
    const range = keys.length ? `${fmtShortDate(keys[0])} ${keys[0].slice(0,4)} — ${fmtShortDate(keys[keys.length-1])} ${keys[keys.length-1].slice(0,4)}` : 'нет отметок';
    return `<div class="diag-row"><span class="diag-name">${esc(h.emoji || '🌸')} ${esc(h.name)}</span><span class="diag-val">${keys.length} · ${range}</span></div>`;
  }).join('') || `<div class="diag-row"><span class="diag-name">Привычек пока нет</span></div>`;

  const legacy = findLegacyHabits();
  const legacyHTML = legacy.length ? `
    <div class="diag-legacy">
      <b>Найдены данные прежней версии</b>
      ${legacy.map(l => `<div>«${esc(l.key)}»: ${l.habits.length} привыч., ${l.marks} отметок</div>`).join('')}
      <button class="mbtn secondary" data-action="merge-legacy">Объединить историю</button>
    </div>` : '';

  $('data-diag').innerHTML = `
    <div class="mlbl">История привычек на этом устройстве</div>
    <div class="diag-list">${rows}</div>
    ${legacyHTML}
    <p class="diag-note">Данные хранятся отдельно в Safari и в приложении на экране «Домой». Если отметок не хватает — открой Bloom там, где отмечала, сделай экспорт и импортируй файл здесь.</p>`;
}

onAction('merge-legacy', () => {
  const legacy = findLegacyHabits();
  const total = legacy.reduce((s, l) => s + l.marks, 0);
  askConfirm('Объединить историю?', `Отметки из старых данных (${total}) добавятся к привычкам с тем же названием. Текущие отметки не удаляются.`, () => {
    let marks = 0, added = 0;
    legacy.forEach(l => { const r = mergeHabits(l.habits, { updateFields: false }); marks += r.marks; added += r.added; });
    saveHabits(); afterChange(); renderDataScreen();
    showToast(marks || added ? `Добавлено отметок: ${marks}` : 'Новых отметок не найдено');
  }, 'Объединить');
});
