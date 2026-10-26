// ══════════════════════════════════════════
//  HABITS
// ══════════════════════════════════════════
import { state, saveHabits } from './state.js';
import { today, weekDates, pad, MO_RU, addDays, fmtShortDate } from './dates.js';
import { calcStreak, wkPct, moPct, avgPct, isPlannedOn, isActiveOn, isEnded, habitEnd } from './stats.js';
import { $, esc, SM, CM, onAction, askConfirm, showToast, flashInvalid, attachCardGestures } from './ui.js';
import { attachSortable } from './sortable.js';
import { updateTopCard } from './topcard.js';

const EMOJIS = ['🌸','🌿','✨','💧','🌙','☀️','📚','🏃','💪','🎨','🧘','❤️','🍎','😴','🎯','🫧'];
const DL = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const DV = [1,2,3,4,5,6,0];
const DURS = [{v:'week',l:'7 дней'},{v:'month',l:'Месяц'},{v:'3months',l:'3 мес.'},{v:'forever',l:'∞'}];

const UNITS = [{v:'day',l:'дней'},{v:'week',l:'недель'},{v:'month',l:'месяцев'}];

let editId = null, hmEmoji = '🌸', hmDays = DV.slice(), hmDur = 'forever', hmPri = 3;
let hmCount = 21, hmUnit = 'day';   // своя продолжительность
let calHId = null, calY = 0, calM = 0;
let sortMode = false;

const findH = id => state.habits.find(x => x.id === id);
function refresh() { saveHabits(); renderHabits(); updateTopCard(); }

// Отметка дня. Снятая отметка удаляет ключ — формат { 'YYYY-MM-DD': true } не меняется.
function setMark(h, dk, on) {
  if (!h.history || typeof h.history !== 'object') h.history = {};
  if (on) h.history[dk] = true; else delete h.history[dk];
}

// ── sort mode ──
export function exitHabitSort() { if (sortMode) { sortMode = false; renderHabits(); } }
function enterHabitSort() { sortMode = true; renderHabits(); showToast('Удерживай и перетаскивай'); }
onAction('habit-sort-done', exitHabitSort);

// ── list ──
export function renderHabits() {
  const el = $('habits-content');
  const { habits } = state;
  const t = today(), wk = weekDates();
  const todayIdx = (new Date().getDay() + 6) % 7;

  if (!habits.length) {
    sortMode = false;
    el.innerHTML = `<div class="empty-card"><div class="ei">🌸</div><p>Пока нет привычек. Создайте первую —<br>маленький ежедневный ритуал.</p></div>`;
    return;
  }

  const avgWk = avgPct(habits.map(wkPct));
  const avgMo = avgPct(habits.map(moPct));

  const barData = wk.map((dk,i) => {
    const plan = habits.filter(h => isPlannedOn(h, dk));
    if (!plan.length) return {lbl:DL[i], pct:0};
    const score = plan.reduce((s,h)=>s+(h.history[dk]?(h.priority||3):0),0);
    const max   = plan.reduce((s,h)=>s+(h.priority||3),0);
    return {lbl:DL[i], pct: max?Math.round(score/max*100):0};
  });

  let html = `<div class="stats-strip">
    <div class="stat-card"><div class="sv">${avgWk}%</div><div class="sl">Неделя</div></div>
    <div class="stat-card"><div class="sv">${avgMo}%</div><div class="sl">Месяц</div></div>
    <div class="stat-card"><div class="sv">${habits.length}</div><div class="sl">Привычек</div></div>
  </div>`;

  html += `<div class="chart-card">
    <div class="chart-title">Эффективность недели</div>
    <div class="bars">${barData.map((b,i)=>`
      <div class="bwrap${i===todayIdx?' today':''}">
        <div class="btrack" style="height:52px"><div class="bfill" style="height:${b.pct}%"></div></div>
        <div class="blbl">${b.lbl}</div>
      </div>`).join('')}
    </div>
  </div>`;

  html += sortMode ? sortHint('habit-sort-done') : `<div class="slabel">Привычки</div>`;
  html += `<div class="habits-container${sortMode?' sort-mode':''}">`;
  habits.forEach(h => {
    const ended = isEnded(h);
    const planned = isPlannedOn(h, t);
    const done = !!h.history[t];
    const streak = calcStreak(h);
    const dots = wk.map(dk => {
      if (!isPlannedOn(h, dk)) return `<div class="wd skip"></div>`;
      return `<div class="wd${h.history[dk]?' done':''}"></div>`;
    }).join('');

    html += `<div class="habit-card sort-item${done?' done':''}${ended?' ended':''}" data-id="${esc(h.id)}">
      <div class="hc-check"></div>
      <div class="hc-info">
        <div class="hc-name">${esc(h.emoji||'🌸')} ${esc(h.name)}</div>
        <div class="hc-meta">
          ${streak>0?`<span class="hc-badge">🔥 ${streak} дн.</span>`:''}
          <span class="hc-badge pri">★ ${h.priority||3}</span>
          ${ended?`<span class="hc-badge ended">завершена</span>`:(!planned && isActiveOn(h, t)?`<span class="hc-badge nottoday">не сегодня</span>`:'')}
          <div class="wdots">${dots}</div>
        </div>
      </div>
      ${sortMode ? `<div class="sort-grip" aria-hidden="true"></div>` : `<div class="hc-edit" data-action="habit-edit" data-id="${esc(h.id)}">···</div>`}
    </div>`;
  });
  html += `</div>`;
  el.innerHTML = html;

  const container = el.querySelector('.habits-container');
  container.querySelectorAll('.habit-card').forEach(card => {
    if (sortMode) {
      attachSortable(card, {
        container, itemSel: '.habit-card',
        onTap: exitHabitSort,
        onDrop: ids => {
          const byId = new Map(state.habits.map(h => [h.id, h]));
          const sorted = ids.map(id => byId.get(id)).filter(Boolean);
          state.habits = [...sorted, ...state.habits.filter(h => !ids.includes(h.id))];
          refresh();
        },
      });
    } else {
      // tap checkbox only toggles; long-press включает сортировку
      attachCardGestures(card, {
        checkSel: '.hc-check',
        ignoreSel: '.hc-edit',
        onTap: () => toggleH(card.dataset.id),
        onLong: enterHabitSort,
      });
    }
  });
}

export function sortHint(doneAction) {
  return `<div class="sort-hint">
    <span class="sort-hint-ic">↕</span>
    <span class="sort-hint-txt">Удерживай и перетаскивай.<br>Коснись карточки, чтобы закончить</span>
    <button class="sort-hint-btn" data-action="${doneAction}">Готово</button>
  </div>`;
}

function toggleH(id) {
  const h = findH(id); if (!h) return;
  const t = today(); setMark(h, t, !h.history[t]);
  refresh();
  if (h.history[t]) showToast('Отмечено ✓');
}

// ── habit modal ──
function buildHM() {
  // только одна строка эмодзи — столько, сколько помещается по ширине
  const row = $('emoji-row');
  const fit = Math.max(5, Math.floor(((row.clientWidth || 360) + 6) / 40));
  const shown = EMOJIS.slice(0, fit);
  row.innerHTML = shown.map(e=>`<div class="eopt${e===hmEmoji?' sel':''}" data-action="hm-emoji" data-emoji="${e}">${e}</div>`).join('');
  // эмодзи не из строки (свой) — показываем его в поле ввода
  const ce = $('custom-emoji');
  if (!shown.includes(hmEmoji) && document.activeElement !== ce) ce.value = hmEmoji;
  const allOn = hmDays.length===7;
  const ac = $('all-ack'); ac.classList.toggle('on', allOn); ac.textContent = allOn?'✓':'';
  $('day-row').innerHTML = DV.map((v,i)=>`<div class="dopt${hmDays.includes(v)?' sel':''}" data-action="hm-day" data-day="${v}">${DL[i]}</div>`).join('');
  // ✎ — своя продолжительность; число и единица — в блоке под кнопками
  $('dur-row').innerHTML = DURS.map(d=>`<div class="duropt${hmDur===d.v?' sel':''}" data-action="hm-dur" data-dur="${d.v}">${d.l}</div>`).join('') +
    `<div class="duropt dur-edit${hmDur==='custom'?' sel':''}" data-action="hm-dur" data-dur="custom" aria-label="Своя продолжительность">✎</div>`;
  buildCustomDur();
  $('pri-row').innerHTML = [1,2,3,4,5].map(p=>`<div class="priopt${hmPri===p?' sel':''}" data-action="hm-pri" data-pri="${p}">${p}</div>`).join('');
}
onAction('hm-emoji', d => { hmEmoji = d.emoji; $('custom-emoji').value = ''; buildHM(); });
onAction('hm-day',   d => { const v = +d.day; hmDays = hmDays.includes(v) ? hmDays.filter(x=>x!==v) : [...hmDays, v]; buildHM(); });
onAction('hm-dur',   d => {
  hmDur = d.dur; buildHM();
  if (hmDur === 'custom') setTimeout(() => { const n = $('dur-num'); n.focus(); n.select(); }, 50);
});
onAction('hm-unit',  d => { hmUnit = d.unit; buildHM(); });

// Своя продолжительность: число + единица (дни / недели / месяцы) и дата окончания
function buildCustomDur() {
  const box = $('dur-custom');
  box.hidden = hmDur !== 'custom';
  if (box.hidden) return;
  const num = $('dur-num');
  if (document.activeElement !== num) num.value = hmCount;
  $('dur-units').innerHTML = UNITS.map(u => `<div class="duropt${hmUnit===u.v?' sel':''}" data-action="hm-unit" data-unit="${u.v}">${u.l}</div>`).join('');
  const h = editId && findH(editId);
  const end = habitEnd({ duration: 'custom', durationCount: hmCount, durationUnit: hmUnit }, (h && h.createdAt) || today());
  const last = addDays(end, -1);
  $('dur-end').textContent = `Последний день: ${fmtShortDate(last)} ${last.slice(0, 4)}${end <= today() ? ' — уже прошёл' : ''}`;
}
$('dur-num').addEventListener('input', function () {
  const n = parseInt(this.value);
  if (n >= 1 && n <= 999) { hmCount = n; buildHM(); }
});
onAction('hm-pri',   d => { hmPri = +d.pri; buildHM(); });
onAction('hm-all',   () => { hmDays = hmDays.length===7 ? [] : DV.slice(); buildHM(); });

// Составные эмодзи (👨‍💻, флаги) длиннее 2 символов — берём первую графему целиком
function firstGrapheme(s) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)) return segment;
    return '';
  }
  return Array.from(s)[0] || '';
}
$('custom-emoji').addEventListener('input', function() {
  const e = firstGrapheme(this.value.trim());
  if (e) { hmEmoji = e; buildHM(); }
});

export function openAdd() {
  editId=null; hmEmoji='🌸'; hmDays=DV.slice(); hmDur='forever'; hmPri=3; hmCount=21; hmUnit='day';
  $('hm-title').textContent = 'Новая привычка';
  $('hm-name').value = '';
  $('custom-emoji').value = '';
  $('hm-actions').innerHTML = `<button class="mbtn secondary" data-action="close" data-modal="hmodal">Отмена</button><button class="mbtn primary" data-action="habit-save">Сохранить</button>`;
  buildHM(); SM('hmodal');
  setTimeout(() => $('hm-name').focus(), 280);
}
onAction('habit-edit', d => {
  const h = findH(d.id); if (!h) return;
  editId=h.id; hmEmoji=h.emoji||'🌸'; hmDays=(h.days||DV).slice(); hmDur=h.duration||'forever'; hmPri=h.priority||3;
  hmCount=parseInt(h.durationCount)||21; hmUnit=h.durationUnit||'day';
  $('hm-title').textContent = 'Редактировать';
  $('hm-name').value = h.name;
  $('custom-emoji').value = '';
  $('hm-actions').innerHTML = `<button class="mbtn danger" data-action="habit-delete">Удалить</button><button class="mbtn secondary" data-action="habit-history">История</button><button class="mbtn primary" data-action="habit-save">OK</button>`;
  buildHM(); SM('hmodal');
});
onAction('habit-save', () => {
  const name = $('hm-name').value.trim();
  if (!name) { flashInvalid($('hm-name')); return; }
  if (!hmDays.length) { showToast('Выбери хотя бы один день'); return; }
  if (hmDur === 'custom' && !(hmCount >= 1 && hmCount <= 999)) { showToast('Укажи продолжительность от 1 до 999'); return; }
  const dur = hmDur === 'custom' ? { duration: 'custom', durationCount: hmCount, durationUnit: hmUnit } : { duration: hmDur };
  const h = editId && findH(editId);
  if (h) {
    // меняем только настройки — history и createdAt остаются как были
    Object.assign(h, {name, emoji:hmEmoji, days:hmDays.slice(), priority:hmPri}, dur);
    if (hmDur !== 'custom') { delete h.durationCount; delete h.durationUnit; }
    showToast('Сохранено ✓');
  } else {
    state.habits.push({id:Date.now().toString(), name, emoji:hmEmoji, days:hmDays.slice(), priority:hmPri, ...dur, history:{}, createdAt:today()});
    showToast('🌸 Привычка добавлена!');
  }
  CM('hmodal'); refresh();
});
onAction('habit-delete', () => {
  const id = editId;
  askConfirm('Удалить привычку?', 'Вся история отметок тоже будет удалена.', () => {
    state.habits = state.habits.filter(x => x.id !== id);
    CM('hmodal'); refresh(); showToast('Удалено');
  });
});

// ── habit calendar (открывается поверх окна редактирования) ──
onAction('habit-history', () => {
  calHId = editId;
  const now = new Date(); calY = now.getFullYear(); calM = now.getMonth();
  renderCal(); SM('calmodal');
});
function renderCal() {
  const h = findH(calHId); if (!h) return;
  $('cal-title').textContent = `${h.emoji||'🌸'} ${h.name}`;
  $('cal-mlbl').textContent = `${MO_RU[calM]} ${calY}`;
  const prefix = `${calY}-${pad(calM+1)}-`;
  const marks = Object.keys(h.history).filter(k => k.startsWith(prefix) && h.history[k]).length;
  $('cal-count').textContent = marks ? `Отмечено дней: ${marks}` : 'В этом месяце отметок нет';
  const first = new Date(calY,calM,1).getDay(); const off = first===0?6:first-1;
  const dim = new Date(calY,calM+1,0).getDate(); const t = today();
  let g = ''; for (let i=0;i<off;i++) g += `<div></div>`;
  for (let d=1; d<=dim; d++) {
    const dk = prefix + pad(d);
    if (dk > t) { g += `<div class="cal-day future">${d}</div>`; continue; }
    g += `<div class="cal-day${h.history[dk]?' has':''}${dk===t?' today':''}" data-action="habit-cal-day" data-day="${dk}">${d}</div>`;
  }
  $('cal-grid').innerHTML = g;
}
$('cal-prev').onclick = () => { calM--; if (calM<0) { calM=11; calY--; } renderCal(); };
$('cal-next').onclick = () => { calM++; if (calM>11) { calM=0; calY++; } renderCal(); };
onAction('habit-cal-day', d => {
  const h = findH(calHId); if (!h) return;
  setMark(h, d.day, !h.history[d.day]);
  refresh(); renderCal();
});
export function refreshHabitCalendar() { if ($('calmodal').classList.contains('show')) renderCal(); }
