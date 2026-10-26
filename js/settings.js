// ══════════════════════════════════════════
//  SETTINGS — экран настроек, темы оформления
// ══════════════════════════════════════════
import { LTHEME, lsGetString, lsSetString } from './storage.js';
import { $, SM, onAction, showToast } from './ui.js';
import { renderDataScreen } from './backup.js';

// color — цвет строки состояния (theme-color) = верхний цвет фона --bg-1 этой темы.
// p — цвета для превью: фон (верх, низ, пятно), стеклянная карточка, текст, акцент
export const THEMES = [
  { id: 'pink',   name: 'Розовая',    color: '#fbd0df', p: { top: '#fac8d8', bot: '#d898be', blob: '#fbd0df', card: 'rgba(255,255,255,.7)',  text: '#3d1a2e', text2: '#c48aaa', a1: '#f472a8', a2: '#e879c8' } },
  { id: 'light',  name: 'Светлая',    color: '#f7f9fd', p: { top: '#eef1f7', bot: '#d6dde9', blob: '#f7f9fd', card: 'rgba(255,255,255,.85)', text: '#1d2333', text2: '#8a93a6', a1: '#6f8cf0', a2: '#8a7cf0' } },
  { id: 'dark',   name: 'Тёмная',     color: '#3a2140', p: { top: '#1d1522', bot: '#120e17', blob: '#3a2140', card: 'rgba(44,35,54,.85)',    text: '#f6ecf3', text2: '#9a8596', a1: '#e86aa8', a2: '#b06ad0' } },
  { id: 'lilac',  name: 'Сиреневая',  color: '#ecdff6', p: { top: '#e8dcf3', bot: '#c0a8da', blob: '#ecdff6', card: 'rgba(255,255,255,.7)',  text: '#2d2040', text2: '#9a86b0', a1: '#a685c2', a2: '#926EAE' } },
  { id: 'violet', name: 'Фиолетовая', color: '#e2d4ea', p: { top: '#ddcfe7', bot: '#ad92c3', blob: '#e2d4ea', card: 'rgba(255,255,255,.66)', text: '#281933', text2: '#8f7a9e', a1: '#8a64a0', a2: '#735184' } },
];

export const currentTheme = () => document.documentElement.dataset.theme || 'pink';

export function applyTheme(id) {
  const th = THEMES.find(t => t.id === id) || THEMES[0];
  document.documentElement.dataset.theme = th.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', th.color);
  // Строку состояния красим только через theme-color. apple-mobile-web-app-status-bar-style
  // не трогаем: в режиме black-translucent iOS в приложении с экрана «Домой» укорачивает
  // экран на высоту строки состояния — нижняя панель поднимается над чёрной полосой.
}
// Существующие пользователи без сохранённой темы остаются на розовой
applyTheme(lsGetString(LTHEME, 'pink'));

// Каждая карточка — миниатюра приложения в цветах своей темы (не зависит от текущей)
function renderThemes() {
  const cur = currentTheme();
  $('theme-grid').innerHTML = THEMES.map(t => {
    const p = t.p, grad = `linear-gradient(135deg, ${p.a1}, ${p.a2})`;
    return `
    <div class="theme-card${t.id === cur ? ' sel' : ''}" role="button" tabindex="0" data-action="pick-theme" data-id="${t.id}" aria-pressed="${t.id === cur}" aria-label="Тема: ${t.name}">
      <div class="tp" style="background-color:${p.bot};background-image:radial-gradient(circle at 25% 0%, ${p.blob} 0%, rgba(0,0,0,0) 65%), linear-gradient(170deg, ${p.top} 0%, ${p.bot} 100%)">
        <div class="tp-head"><span class="tp-title" style="background-color:${p.text}"></span><span class="tp-dot" style="background-color:${p.card}"></span></div>
        <div class="tp-card" style="background-color:${p.card}">
          <span class="tp-check" style="background-image:${grad}"></span>
          <span class="tp-lines"><span style="background-color:${p.text}"></span><span style="background-color:${p.text2}"></span></span>
        </div>
        <div class="tp-bar" style="background-color:${p.card}"><span style="background-image:${grad}"></span></div>
        <div class="tp-name" style="color:${p.text}">${t.name}</div>
      </div>
      <span class="theme-check">✓</span>
    </div>`;
  }).join('');
}

onAction('open-settings', () => SM('settingsModal'));
onAction('open-appearance', () => { renderThemes(); SM('themeModal'); });
onAction('open-data', () => { renderDataScreen(); SM('bmodal'); });
onAction('pick-theme', d => {
  applyTheme(d.id);
  lsSetString(LTHEME, currentTheme());
  renderThemes();
  showToast('Тема применена');
});
