// ══════════════════════════════════════════
//  iOS: ИКОНКА С ЭКРАНА «ДОМОЙ» В РЕЖИМЕ black-translucent
//  Режим строки состояния iOS запоминает при создании иконки. В этом режиме
//  экран приложения доходит до самого низа, но элементы с position:fixed
//  считаются от области, укороченной на высоту строки состояния, — нижняя
//  панель, кнопка «+» и окна «висят» над полосой. Измеряем недостающую высоту
//  и растягиваем каркас (body) до настоящего низа экрана.
// ══════════════════════════════════════════

// Чистая логика — отдельно, чтобы её можно было проверить без iPhone
export function computeGap({ standalone, insetTop, screenH, fixedBottom }) {
  if (!standalone || insetTop <= 0) return 0;
  const missing = Math.round(screenH - fixedBottom);
  // поправляем только ровно этот баг: не хватает высоты строки состояния
  return missing > 0 && Math.abs(missing - insetTop) <= 4 ? missing : 0;
}

function probe(css) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:0;width:0;visibility:hidden;pointer-events:none;' + css;
  document.body.appendChild(el);
  const r = el.getBoundingClientRect();
  el.remove();
  return r;
}

export function applyIosViewportFix() {
  const root = document.documentElement;
  // мерим без поправки, иначе она повлияет на замер
  root.classList.remove('ios-gap');
  const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const portrait = window.innerHeight >= window.innerWidth;
  const gap = computeGap({
    standalone,
    insetTop: probe('top:0;height:env(safe-area-inset-top)').height,
    screenH: portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height),
    fixedBottom: probe('bottom:0;height:0').top,
  });
  root.style.setProperty('--ios-gap', gap + 'px');
  root.classList.toggle('ios-gap', gap > 0);
}

applyIosViewportFix();
window.addEventListener('resize', applyIosViewportFix);
window.addEventListener('orientationchange', () => setTimeout(applyIosViewportFix, 300));
