// ══════════════════════════════════════════
//  BACKUP — экспорт / импорт JSON и проверка истории
// ══════════════════════════════════════════
import { state, saveHabits, saveTasks, saveMarathon, normalizeHabit, normalizeTask, normalizeMarathonTask, normalizeHistory, fixParentStatus } from './state.js';
import { LH, LT, LM, LUI, LTHEME, lsGetString, lsSave, lsLoad } from './storage.js';
import { today, fmtShortDate } from './dates.js';
import { $, esc, SM, CM, onAction, showToast, askConfirm, foldClass } from './ui.js';
import { M_WEEKS } from './marathonplan.js';

// Обновление экрана после изменения данных — назначается в main.js
let afterChange = () => {};
export function onDataChange(fn) { afterChange = fn; }

// v4: + задачи марафона и тема. Старые копии (v3 и без версии) читаются как раньше.
const BACKUP_VERSION = 4;

// Полная копия: все привычки с историей, все задачи и подзадачи (с выполненными),
// весь марафон и настройки. Сводка — в начале файла, привычки с длинной историей —
// в конце, чтобы при просмотре файла на iPhone задачи были видны сразу.
function buildBackup() {
  return {
    app: 'Bloom', version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
    counts: countAll(),
    tasks: state.tasks, marathon: state.marathon, habits: state.habits,
    settings: { theme: lsGetString(LTHEME, 'pink'), ui: state.ui },
  };
}
const backupJSON = () => JSON.stringify(buildBackup(), null, 2);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// На iPhone (особенно в приложении с экрана «Домой») обычное скачивание файла
// ненадёжно — там используем меню «Поделиться» → «Сохранить в Файлы».
$('export-btn').addEventListener('click', async () => {
  const name = `bloom-backup-${today()}.json`;
  const json = backupJSON();
  const file = new File([json], name, { type: 'application/json' });
  if (isIOS() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Bloom — резервная копия' }); showToast('💾 Копия сохранена'); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('💾 Экспортировано!');
});

// Копия текстом — запасной способ, если с файлом что-то не так: текст можно
// вставить в «Заметки» или отправить себе, а потом вставить обратно при импорте.
onAction('export-text', () => {
  $('text-title').textContent = 'Копия текстом';
  $('text-hint').textContent = 'Здесь все данные: привычки с историей, задачи и марафон. Скопируй и сохрани, например, в «Заметки».';
  const ta = $('backup-text'); ta.value = backupJSON(); ta.readOnly = true;
  $('text-actions').innerHTML = `<button class="mbtn secondary" data-action="close" data-modal="textModal">Закрыть</button><button class="mbtn primary" data-action="copy-text">Скопировать</button>`;
  SM('textModal');
});
onAction('copy-text', async () => {
  const ta = $('backup-text');
  try { await navigator.clipboard.writeText(ta.value); showToast('📋 Скопировано'); }
  catch { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); showToast(document.execCommand('copy') ? '📋 Скопировано' : 'Выдели текст и скопируй'); }
});
onAction('import-text', () => {
  $('text-title').textContent = 'Импорт из текста';
  $('text-hint').textContent = 'Вставь сюда текст резервной копии. Данные объединятся с текущими — ничего не удалится.';
  const ta = $('backup-text'); ta.value = ''; ta.readOnly = false;
  $('text-actions').innerHTML = `<button class="mbtn secondary" data-action="close" data-modal="textModal">Отмена</button><button class="mbtn primary" data-action="import-text-go">Импортировать</button>`;
  SM('textModal');
  setTimeout(() => ta.focus(), 280);
});
onAction('import-text-go', () => {
  try {
    importBackup(JSON.parse($('backup-text').value), 'текст');
    CM('textModal');
  } catch { showToast('❌ Не похоже на копию Bloom'); }
});

$('import-trigger').addEventListener('click', () => $('import-file').click());

const validItems = list => (Array.isArray(list) ? list : []).filter(x => x && typeof x === 'object' && x.id != null);
const nameKey = s => String(s || '').trim().toLowerCase();

// Сколько всего данных — пишется в копию, чтобы было с чем сверить после восстановления
function countAll() {
  const marks = state.habits.reduce((s, h) => s + Object.keys(h.history).length, 0);
  return {
    habits: state.habits.length, marks,
    tasks: state.tasks.length, tasksDone: state.tasks.filter(t => t.done).length,
    marathon: state.marathon.length, marathonDone: state.marathon.filter(t => t.done).length,
  };
}

// Объединение истории: отметка из любого источника сохраняется (ничего не теряем)
function mergeHistory(target, src) {
  const add = normalizeHistory(src);
  let n = 0;
  for (const k in add) if (!target.history[k]) { target.history[k] = add[k]; n++; }
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
      added++; marks += Object.keys(imp.history).length;
    }
  });
  return { added, marks };
}

// Задачи сопоставляются по id. Новые добавляются; у существующих восстанавливается
// отметка «выполнено», если в копии задача выполнена (иначе повторный импорт
// не вернул бы потерянные отметки).
function mergeById(target, list, normalize) {
  const byId = new Map(target.map(t => [t.id, t]));
  let added = 0, restored = 0;
  validItems(list).map(normalize).forEach(imp => {
    const cur = byId.get(imp.id);
    if (!cur) { target.push(imp); byId.set(imp.id, imp); added++; return; }
    if (imp.done && !cur.done) { cur.done = true; if (imp.doneAt) cur.doneAt = imp.doneAt; restored++; }
  });
  return { added, restored };
}

// Снимок данных перед импортом — чтобы импорт можно было отменить
const LSNAP = 'bloom_snapshot_before_import';
let lastReport = null;

function importBackup(data, sourceName) {
  if (!data || typeof data !== 'object' || (!Array.isArray(data.habits) && !Array.isArray(data.tasks) && !Array.isArray(data.marathon))) throw new Error('bad backup');
  lsSave(LSNAP, { at: new Date().toISOString(), habits: state.habits, tasks: state.tasks, marathon: state.marathon });
  const h = mergeHabits(data.habits);
  const t = mergeById(state.tasks, data.tasks, normalizeTask);
  fixParentStatus(state.tasks);
  // в старых копиях марафона нет — текущие задачи марафона не трогаем
  const m = Array.isArray(data.marathon) ? mergeById(state.marathon, data.marathon, normalizeMarathonTask) : { added: 0, restored: 0 };
  saveHabits(); saveTasks(); saveMarathon();
  const inFile = {
    habits: validItems(data.habits).length,
    marks: validItems(data.habits).reduce((s, x) => s + Object.keys(normalizeHistory(x.history)).length, 0),
    tasks: validItems(data.tasks).length,
    tasksDone: validItems(data.tasks).filter(x => x.done).length,
    marathon: validItems(data.marathon).length,
    date: data.exportedAt ? fmtShortDate(data.exportedAt.slice(0, 10)) + ' ' + data.exportedAt.slice(0, 4) : null,
  };
  lastReport = { file: sourceName, inFile, h, t, m, now: countAll() };
  afterChange(); renderDataScreen();
  showToast('✅ Данные объединены!');
}

$('import-file').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { importBackup(JSON.parse(await f.text()), f.name); }
  catch { showToast('❌ Ошибка импорта'); }
  e.target.value = '';
});

onAction('undo-import', () => {
  const snap = lsLoad(LSNAP, null); if (!snap) return;
  askConfirm('Отменить импорт?', 'Данные вернутся к состоянию до последнего импорта.', () => {
    state.habits = (snap.habits || []).map(normalizeHabit);
    state.tasks = (snap.tasks || []).map(normalizeTask);
    state.marathon = (snap.marathon || []).map(normalizeMarathonTask);
    saveHabits(); saveTasks(); saveMarathon();
    try { localStorage.removeItem(LSNAP); } catch {}
    lastReport = null;
    afterChange(); renderDataScreen(); showToast('Импорт отменён');
  }, 'Отменить импорт');
});

function reportHTML() {
  const r = lastReport;
  const snap = lsLoad(LSNAP, null);
  if (!r) return snap ? `<button class="mbtn secondary diag-undo" data-action="undo-import">↩︎ Отменить последний импорт</button>` : '';
  return `<div class="import-report">
    <b>Импорт: ${esc(r.file)}${r.inFile.date ? ` (копия от ${r.inFile.date})` : ''}</b>
    <div>В копии: привычек ${r.inFile.habits}, отметок ${r.inFile.marks}, задач ${r.inFile.tasks} (выполнено ${r.inFile.tasksDone}), марафон ${r.inFile.marathon}</div>
    <div>Добавлено: привычек ${r.h.added}, отметок ${r.h.marks}, задач ${r.t.added}${r.m.added ? `, задач марафона ${r.m.added}` : ''}</div>
    ${r.t.restored || r.m.restored ? `<div>Восстановлено выполненных задач: ${r.t.restored + r.m.restored}</div>` : ''}
    <div>Теперь в приложении: привычек ${r.now.habits}, отметок ${r.now.marks}, задач ${r.now.tasks} (выполнено ${r.now.tasksDone}), марафон ${r.now.marathon}</div>
    <button class="mbtn secondary diag-undo" data-action="undo-import">↩︎ Отменить этот импорт</button>
  </div>`;
}

// ── Проверка истории и поиск старых данных ──
// Ищем в localStorage другие ключи с привычками (например, от прежней версии
// приложения). Берём только реально сохранённые отметки — ничего не придумываем.
function findLegacyHabits() {
  const known = new Set([LH, LT, LM, LUI, LTHEME, LSNAP]);
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

// Сворачиваемый список на экране «Мои данные»
function dataFold(key, title, count, body) {
  return `<section class="fold data-fold${foldClass(key)}">
    <button class="fold-head" data-action="fold" data-key="${key}"><span class="fold-title">${title}</span><span class="chev"></span><span class="fold-count">${count}</span></button>
    <div class="fold-body"><div class="fold-inner"><div class="diag-list">${body}</div></div></div>
  </section>`;
}
const status = t => t.done ? `<span class="diag-st done">✓</span>` : `<span class="diag-st">○</span>`;

export function renderDataScreen() {
  const empty = txt => `<div class="diag-row"><span class="diag-name">${txt}</span></div>`;
  const habitRows = state.habits.map(h => {
    const keys = Object.keys(h.history).filter(k => h.history[k]).sort();
    const range = keys.length ? `${fmtShortDate(keys[0])} ${keys[0].slice(0,4)} — ${fmtShortDate(keys[keys.length-1])} ${keys[keys.length-1].slice(0,4)}` : 'нет отметок';
    return `<div class="diag-row"><span class="diag-name">${esc(h.emoji || '🌸')} ${esc(h.name)}</span><span class="diag-val">${keys.length} · ${range}</span></div>`;
  }).join('') || empty('Привычек пока нет');

  const roots = state.tasks.filter(t => !t.parentId);
  const orphans = state.tasks.filter(t => t.parentId && !state.tasks.some(p => p.id === t.parentId));
  const taskRow = (t, sub) => `<div class="diag-row${sub ? ' sub' : ''}">${status(t)}<span class="diag-name">${sub ? '↳ ' : ''}${esc(t.text)}</span><span class="diag-val">${t.done && t.doneAt ? fmtShortDate(t.doneAt) : t.dueDate ? fmtShortDate(t.dueDate) : ''}</span></div>`;
  const taskRows = [...roots.map(r => taskRow(r, false) + state.tasks.filter(s => s.parentId === r.id).map(s => taskRow(s, true)).join('')), ...orphans.map(s => taskRow(s, true))].join('') || empty('Задач пока нет');

  const mRows = state.marathon.map(t => `<div class="diag-row">${status(t)}<span class="diag-name">${esc(t.text)}</span><span class="diag-val">${t.week ? `неделя ${t.week} · ${M_WEEKS[t.week-1].label}` : 'входящие'}</span></div>`).join('') || empty('Задач марафона пока нет');

  const legacy = findLegacyHabits();
  const legacyHTML = legacy.length ? `
    <div class="diag-legacy">
      <b>Найдены данные прежней версии</b>
      ${legacy.map(l => `<div>«${esc(l.key)}»: ${l.habits.length} привыч., ${l.marks} отметок</div>`).join('')}
      <button class="mbtn secondary" data-action="merge-legacy">Объединить историю</button>
    </div>` : '';

  const c = countAll();
  $('data-diag').innerHTML = `
    ${reportHTML()}
    <div class="mlbl">Что войдёт в резервную копию</div>
    <div class="diag-sum">Привычек ${c.habits} · отметок ${c.marks}<br>Задач и подзадач ${c.tasks} · выполнено ${c.tasksDone}<br>Марафон ${c.marathon} · выполнено ${c.marathonDone}</div>
    ${dataFold('data.habits', 'Привычки и отметки', c.marks, habitRows)}
    ${dataFold('data.tasks', 'Задачи', `${c.tasksDone}/${c.tasks}`, taskRows)}
    ${dataFold('data.marathon', 'Марафон', `${c.marathonDone}/${c.marathon}`, mRows)}
    ${legacyHTML}
    <p class="diag-note">⚠️ На iPhone у Safari и у каждой иконки на экране «Домой» отдельные данные, а при удалении иконки её данные стираются. Если отметок не хватает — открой Bloom там, где отмечала (например, со старой иконки), сделай экспорт и импортируй файл здесь.</p>`;
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
