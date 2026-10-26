// ══════════════════════════════════════════
//  SETTINGS — экран настроек, темы оформления
// ══════════════════════════════════════════
import { LTHEME, lsGetString, lsSetString } from './storage.js';
import { $, SM, onAction, showToast } from './ui.js';
import { renderDataScreen } from './backup.js';

export const THEMES = [
  { id: 'pink',   name: 'Розовая',    color: '#f9c4d2', sw: ['#fbd0df', '#e8aac8', '#f472a8'] },
  { id: 'light',  name: 'Светлая',    color: '#f4f6fa', sw: ['#ffffff', '#e3e8f0', '#6f8cf0'] },
  { id: 'dark',   name: 'Тёмная',     color: '#18121d', sw: ['#2a1d3c', '#18121d', '#e86aa8'] },
  { id: 'lilac',  name: 'Сиреневая',  color: '#e2d4ef', sw: ['#ecdff6', '#c4acdc', '#926EAE'] },
  { id: 'violet', name: 'Фиолетовая', color: '#d8c8e3', sw: ['#e2d4ea', '#b195c6', '#735184'] },
];

export const currentTheme = () => document.documentElement.dataset.theme || 'pink';

export function applyTheme(id) {
  const th = THEMES.find(t => t.id === id) || THEMES[0];
  document.documentElement.dataset.theme = th.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', th.color);
  // тёмная тема — светлый текст статус-бара в режиме «на экран Домой»
  const sb = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (sb) sb.setAttribute('content', th.id === 'dark' ? 'black-translucent' : 'default');
}
// Существующие пользователи без сохранённой темы остаются на розовой
applyTheme(lsGetString(LTHEME, 'pink'));

function renderThemes() {
  const cur = currentTheme();
  $('theme-grid').innerHTML = THEMES.map(t => `
    <button class="theme-card${t.id === cur ? ' sel' : ''}" data-action="pick-theme" data-id="${t.id}" aria-pressed="${t.id === cur}">
      <span class="theme-sw" style="background:radial-gradient(circle at 30% 20%, ${t.sw[0]} 0%, transparent 60%), linear-gradient(160deg, ${t.sw[0]}, ${t.sw[1]})">
        <span class="theme-sw-card"></span><span class="theme-sw-dot" style="background:${t.sw[2]}"></span>
      </span>
      <span class="theme-name">${t.name}</span>
      <span class="theme-check">✓</span>
    </button>`).join('');
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
