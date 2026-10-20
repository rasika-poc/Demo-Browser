'use strict';

const COLORS = ['#7c9cff', '#3ddc97', '#ff8a5b', '#f472b6', '#facc15', '#22d3ee', '#a78bfa', '#fb7185'];
const LAYOUTS = ['columns', 'grid', 'focus', 'stack', 'single'];
const MAX_PANES = 6;
const TOPBAR_H = 52;
const PANEL_W = 380;
const PANE_BAR_H = 40;
const SITE_WIDTHS = [0, 1024, 1280, 1440, 1920]; // 0 = responsive (site reflows to the pane)
const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

const site = (label, url) => ({ label, url, zoom: 1 });
const DEFAULTS = {
  panes: [
    site('WSO2', 'https://wso2.com'),
    site('GitHub', 'https://github.com'),
    site('Example', 'https://example.com'),
  ],
  layout: 'columns',
  focus: 0,
  speed: 650,
  gap: 12,
  siteWidth: 1280,
  dim: true,
  clean: false,
  panelOpen: false,
  sceneIndex: -1,
  scenes: [
    {
      name: 'Overview',
      layout: 'columns',
      focus: 0,
      panes: [site('WSO2', 'https://wso2.com'), site('GitHub', 'https://github.com'), site('Example', 'https://example.com')],
    },
    {
      name: 'Side by side',
      layout: 'columns',
      focus: 0,
      panes: [site('WSO2', 'https://wso2.com'), site('GitHub', 'https://github.com')],
    },
    {
      name: 'Spotlight on GitHub',
      layout: 'focus',
      focus: 1,
      panes: [site('WSO2', 'https://wso2.com'), site('GitHub', 'https://github.com'), site('Example', 'https://example.com')],
    },
  ],
};

const ICONS = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  forward: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
  reload: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.34-5.66L20 8.5"/><path d="M20 3.5v5h-5"/></svg>',
  expand: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>',
};

const LAYOUT_ICONS = {
  columns: '<rect x="1" y="1" width="6.3" height="14" rx="1.5"/><rect x="8.85" y="1" width="6.3" height="14" rx="1.5"/><rect x="16.7" y="1" width="6.3" height="14" rx="1.5"/>',
  grid: '<rect x="1" y="1" width="10.25" height="6.25" rx="1.5"/><rect x="12.75" y="1" width="10.25" height="6.25" rx="1.5"/><rect x="1" y="8.75" width="10.25" height="6.25" rx="1.5"/><rect x="12.75" y="8.75" width="10.25" height="6.25" rx="1.5"/>',
  focus: '<rect x="1" y="1" width="14" height="14" rx="1.5"/><rect x="16.5" y="1" width="6.5" height="6.25" rx="1.5"/><rect x="16.5" y="8.75" width="6.5" height="6.25" rx="1.5"/>',
  stack: '<rect x="1" y="1" width="22" height="8.5" rx="1.5"/><rect x="1" y="11" width="10.25" height="4" rx="1.2"/><rect x="12.75" y="11" width="10.25" height="4" rx="1.2"/>',
  single: '<rect x="1" y="1" width="22" height="14" rx="1.5"/>',
};

const $ = (sel, root = document) => root.querySelector(sel);
const stage = $('#stage');
// Runtime pane objects; panes[i] always renders state.panes[i].
const panes = [];
let state;
let layoutBeforeSingle = 'columns';

// ---------- state ----------

const clampIndex = (i, n) => (Number.isInteger(i) ? Math.min(Math.max(i, 0), n - 1) : 0);

function fixPanes(list, { keepColors = false } = {}) {
  const src = Array.isArray(list) && list.length ? list.slice(0, MAX_PANES) : DEFAULTS.panes;
  const used = new Set();
  return src.map((p, i) => {
    let color = keepColors && Number.isInteger(p?.color) && !used.has(p.color) ? p.color : -1;
    if (color < 0) color = COLORS.findIndex((_, c) => !used.has(c));
    used.add(color);
    const out = {
      label: String(p?.label ?? `Site ${i + 1}`),
      url: String(p?.url || 'about:blank'),
      zoom: ZOOM_STEPS.includes(p?.zoom) ? p.zoom : 1,
    };
    if (keepColors) {
      out.color = color;
      out.scroll = Array.isArray(p?.scroll) ? p.scroll.map((v) => Number(v) || 0).slice(0, 2) : [0, 0];
    }
    return out;
  });
}

function normalizeState(raw) {
  const s = { ...structuredClone(DEFAULTS), ...(raw || {}) };
  s.panes = fixPanes(s.panes, { keepColors: true });
  if (!LAYOUTS.includes(s.layout)) s.layout = 'columns';
  s.focus = clampIndex(s.focus, s.panes.length);
  if (!SITE_WIDTHS.includes(s.siteWidth)) s.siteWidth = DEFAULTS.siteWidth;
  s.panelOpen = !!s.panelOpen;
  s.scenes = (Array.isArray(s.scenes) ? s.scenes : []).map((sc, i) => {
    const scenePanes = fixPanes(sc?.panes);
    return {
      name: String(sc?.name || `Scene ${i + 1}`),
      layout: LAYOUTS.includes(sc?.layout) ? sc.layout : 'columns',
      focus: clampIndex(sc?.focus, scenePanes.length),
      panes: scenePanes,
    };
  });
  if (!Number.isInteger(s.sceneIndex) || s.sceneIndex >= s.scenes.length) s.sceneIndex = -1;
  return s;
}

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.demo.saveConfig(state), 300);
}

// Flush synchronously on quit so the last sites and positions are never lost.
window.addEventListener('beforeunload', () => window.demo.saveConfigSync(state));

function normalizeUrl(raw) {
  const s = raw.trim();
  if (!s) return 'about:blank';
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(s)) return `http://${s}`;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^(about|data|file):/i.test(s)) return s;
  if (!/\s/.test(s) && /\.[a-z]{2,}(:\d+)?(\/|$)/i.test(s)) return `https://${s}`;
  return `https://www.google.com/search?q=${encodeURIComponent(s)}`;
}

const hostOf = (url) => {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
};

// "https://a.com" and "https://a.com/" are the same page; don't reload for that.
const sameUrl = (a, b) => {
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return a === b;
  }
};

const freeColor = () => {
  const used = new Set(state.panes.map((p) => p.color));
  const c = COLORS.findIndex((_, i) => !used.has(i));
  return c < 0 ? state.panes.length % COLORS.length : c;
};

// ---------- panes ----------

function createPane(data, { stagger = 0 } = {}) {
  const el = document.createElement('section');
  el.className = 'pane veiled fresh';
  el.style.setProperty('--accent', COLORS[data.color]);
  el.style.setProperty('--n', stagger);
  el.innerHTML = `
    <div class="pane-bar">
      <span class="badge"></span>
      <span class="label"></span>
      <button class="icon-btn" data-act="back" title="Back">${ICONS.back}</button>
      <button class="icon-btn" data-act="forward" title="Forward">${ICONS.forward}</button>
      <button class="icon-btn" data-act="reload" title="Reload">${ICONS.reload}</button>
      <input class="url" spellcheck="false" placeholder="Type a URL or search">
      <div class="zoom">
        <button class="icon-btn" data-act="zoomOut" title="Zoom out (⌘−)">${ICONS.minus}</button>
        <button class="zoom-level" data-act="zoomReset" title="Reset zoom"></button>
        <button class="icon-btn" data-act="zoomIn" title="Zoom in (⌘=)">${ICONS.plus}</button>
      </div>
      <button class="icon-btn" data-act="single" title="Toggle fullscreen pane">${ICONS.expand}</button>
      <button class="icon-btn close" data-act="close" title="Remove site (⌘W)">${ICONS.close}</button>
    </div>
    <div class="pane-body">
      <div class="progress"></div>
      <webview partition="persist:demo" allowpopups></webview>
      <div class="curtain"><div class="spinner"></div><div class="curtain-host"></div><div class="curtain-text"></div></div>
      <div class="shield"><span>Click to focus</span></div>
    </div>`;
  stage.appendChild(el);

  const p = {
    el,
    wv: $('webview', el),
    bar: $('.pane-bar', el),
    url: $('.url', el),
    label: $('.label', el),
    badge: $('.badge', el),
    zoomLevel: $('.zoom-level', el),
    ready: false,
    current: data.url,
    error: false,
    veilTimer: 0,
    // Scroll offset to restore once the saved page has loaded again.
    restoreScroll: data.scroll?.[0] || data.scroll?.[1] ? data.scroll : null,
  };
  const idx = () => panes.indexOf(p);

  const { wv } = p;
  wv.addEventListener('dom-ready', () => {
    p.ready = true;
    setTimeout(() => unveil(p), 120);
  });
  wv.addEventListener('did-start-loading', () => el.classList.add('loading'));
  wv.addEventListener('did-stop-loading', () => {
    el.classList.remove('loading');
    unveil(p);
    if (p.restoreScroll) {
      const [x, y] = p.restoreScroll;
      p.restoreScroll = null;
      // Twice: lazy-loaded pages often grow after the first paint.
      const go = () => wv.executeJavaScript(`scrollTo(${x}, ${y})`).catch(() => {});
      go();
      setTimeout(go, 800);
    }
  });
  wv.addEventListener('did-navigate', (e) => syncUrl(p, e.url));
  wv.addEventListener('did-navigate-in-page', (e) => e.isMainFrame && syncUrl(p, e.url));
  wv.addEventListener('page-title-updated', (e) => (p.bar.title = e.title));
  wv.addEventListener('did-fail-load', (e) => {
    // -3 is ERR_ABORTED: a navigation superseded by another one, not a real failure.
    if (!e.isMainFrame || e.errorCode === -3) return;
    p.error = true;
    el.classList.add('veiled', 'error');
    $('.curtain-host', el).textContent = hostOf(e.validatedURL);
    $('.curtain-text', el).textContent = `${e.errorDescription || 'Failed to load'} — click to retry`;
  });

  $('.curtain', el).addEventListener('click', () => p.error && reload(p));
  $('.shield', el).addEventListener('click', () => focusPane(idx()));

  el.querySelectorAll('[data-act]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      const i = idx();
      if (act === 'close') return closePane(i);
      if (act === 'single') return toggleSingle(i);
      if (act === 'reload') return reload(p);
      if (act === 'zoomIn') return zoomPane(i, 1);
      if (act === 'zoomOut') return zoomPane(i, -1);
      if (act === 'zoomReset') return zoomPane(i, 0);
      if (!p.ready) return;
      if (act === 'back' && wv.canGoBack()) wv.goBack();
      if (act === 'forward' && wv.canGoForward()) wv.goForward();
    }),
  );

  p.url.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      navigate(idx(), p.url.value, { autoLabel: true });
      p.url.blur();
    } else if (e.key === 'Escape') {
      p.url.value = state.panes[idx()].url;
      p.url.blur();
    }
  });
  p.url.addEventListener('focus', () => p.url.select());

  p.bar.addEventListener('click', (e) => {
    if (e.target.closest('button, input') || state.focus === idx()) return;
    focusPane(idx(), { keepLayout: true });
  });
  p.bar.addEventListener('dblclick', (e) => {
    if (!e.target.closest('button, input')) toggleSingle(idx());
  });

  p.url.value = data.url;
  $('.curtain-host', el).textContent = hostOf(data.url);
  wv.src = data.url;
  // Let the first layout land without animating the webview's scale from 1.
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('fresh')));
  return p;
}

function addPane(spec = {}) {
  const data = {
    label: spec.label ?? `Site ${state.panes.length + 1}`,
    url: spec.url ?? 'about:blank',
    zoom: spec.zoom ?? 1,
    color: freeColor(),
    scroll: [0, 0],
  };
  state.panes.push(data);
  const p = createPane(data);
  panes.push(p);
  return p;
}

function removePane(i) {
  const [p] = panes.splice(i, 1);
  state.panes.splice(i, 1);
  if (state.focus > i || state.focus >= panes.length) state.focus = Math.max(state.focus - 1, 0);
  // Fade out where it stands while the others slide into the freed space.
  p.el.classList.add('closing');
  setTimeout(() => p.el.remove(), state.speed);
}

function newPane() {
  if (panes.length >= MAX_PANES) return toast(`Up to ${MAX_PANES} sites`);
  const p = addPane();
  state.focus = panes.length - 1;
  if (state.clean) state.clean = false;
  render();
  setTimeout(() => p.url.focus(), 50);
}

function closePane(i) {
  if (panes.length <= 1) return toast('At least one site stays open');
  removePane(i);
  render();
}

// Make the open panes match a list of {label, url, zoom}, reusing panes where possible.
function syncPanesTo(list) {
  while (panes.length > list.length) removePane(panes.length - 1);
  list.forEach((sp, i) => {
    if (i >= panes.length) return addPane(sp);
    Object.assign(state.panes[i], { label: sp.label, zoom: sp.zoom });
    navigate(i, sp.url);
  });
}

function syncUrl(p, url) {
  const i = panes.indexOf(p);
  if (i < 0) return;
  p.current = url;
  state.panes[i].url = url;
  if (document.activeElement !== p.url) p.url.value = url;
  const field = document.querySelectorAll('.site-field .url-input')[i];
  if (field && document.activeElement !== field) field.value = url;
  save();
}

function veil(p, url) {
  p.error = false;
  p.el.classList.remove('error');
  p.el.classList.add('veiled');
  $('.curtain-host', p.el).textContent = hostOf(url);
  $('.curtain-text', p.el).textContent = 'Loading…';
  clearTimeout(p.veilTimer);
  p.veilTimer = setTimeout(() => unveil(p), 10000);
}

function unveil(p) {
  if (p.error) return;
  clearTimeout(p.veilTimer);
  p.el.classList.remove('veiled');
}

function navigate(i, raw, { autoLabel = false } = {}) {
  const p = panes[i];
  const data = state.panes[i];
  const url = normalizeUrl(raw);
  data.url = url;
  // A pane still carrying its placeholder name takes the site's name.
  if (autoLabel && /^(Site \d+)?$/.test(data.label.trim()) && /^https?:/.test(url)) {
    data.label = hostOf(url).replace(/^www\./, '');
    render();
  }
  p.url.value = url;
  save();
  if (sameUrl(url, p.current) && !p.error) return;
  p.current = url;
  p.restoreScroll = null;
  data.scroll = [0, 0];
  veil(p, url);
  if (p.ready) p.wv.loadURL(url).catch(() => {});
  else p.wv.src = url;
}

function reload(p) {
  if (!p.ready) return;
  veil(p, p.current);
  p.wv.reload();
}

// Remember where each site is scrolled to, so a restart opens at the same spot.
setInterval(async () => {
  for (const p of panes) {
    if (!p.ready || p.restoreScroll) continue;
    try {
      const pos = await p.wv.executeJavaScript('[scrollX | 0, scrollY | 0]');
      const data = state.panes[panes.indexOf(p)];
      if (data && (data.scroll[0] !== pos[0] || data.scroll[1] !== pos[1])) {
        data.scroll = pos;
        save();
      }
    } catch {
      // Page mid-navigation; try again next tick.
    }
  }
}, 2000);

// ---------- layout ----------

function computeRects(layout, focus, n, W, H, g) {
  const all = [...Array(n).keys()];
  const others = all.filter((i) => i !== focus);
  const r = [];
  const set = (i, x, y, w, h, parked = false) => (r[i] = { x, y, w, h, parked });
  const row = (ids, x, y, w, h) => {
    const cw = (w - (ids.length - 1) * g) / ids.length;
    ids.forEach((id, k) => set(id, x + k * (cw + g), y, cw, h));
  };
  const column = (ids, x, y, w, h) => {
    const ch = (h - (ids.length - 1) * g) / ids.length;
    ids.forEach((id, k) => set(id, x, y + k * (ch + g), w, ch));
  };
  const innerW = W - 2 * g;
  const innerH = H - 2 * g;

  if (n === 1) layout = 'columns';
  switch (layout) {
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const ch = (innerH - (rows - 1) * g) / rows;
      for (let k = 0; k < rows; k++) row(all.slice(k * cols, (k + 1) * cols), g, g + k * (ch + g), innerW, ch);
      break;
    }
    case 'focus': {
      const bigW = Math.round((innerW - g) * 0.68);
      set(focus, g, g, bigW, innerH);
      column(others, 2 * g + bigW, g, innerW - g - bigW, innerH);
      break;
    }
    case 'stack': {
      const bigH = Math.round((innerH - g) * 0.64);
      set(focus, g, g, innerW, bigH);
      row(others, g, 2 * g + bigH, innerW, innerH - g - bigH);
      break;
    }
    case 'single': {
      set(focus, g, g, innerW, innerH);
      // The others slide out past the edge on their own side.
      const parkW = (W - 4 * g) / 3;
      for (const i of others) set(i, i < focus ? -parkW - g : W + g, g, parkW, innerH, true);
      break;
    }
    default:
      row(all, g, g, innerW, innerH);
  }
  return r;
}

function applyLayout() {
  const top = state.clean ? 0 : Math.max(TOPBAR_H - state.gap, 0);
  const W = window.innerWidth - (state.panelOpen ? PANEL_W : 0);
  const H = window.innerHeight - top;
  const rects = computeRects(state.layout, state.focus, panes.length, W, H, state.gap);
  const spotlight = panes.length > 1 && (state.layout === 'focus' || state.layout === 'stack');
  const barH = state.clean ? 0 : PANE_BAR_H;

  panes.forEach((p, i) => {
    const r = rects[i];
    Object.assign(p.el.style, {
      left: `${r.x}px`,
      top: `${r.y + top}px`,
      width: `${r.w}px`,
      height: `${r.h}px`,
    });
    fitSite(p, i, r.w - 2, r.h - 2 - barH); // 2 = pane border
    p.el.classList.toggle('parked', r.parked);
    p.el.classList.toggle('focused', i === state.focus);
    p.el.classList.toggle('dimmed', spotlight && i !== state.focus);
  });
  document.body.dataset.layout = state.layout;
}

// The site renders at a fixed virtual width and is scaled to the pane, so resizing the
// pane zooms the page instead of reflowing it. Pane size and scale share the same
// easing, so they stay in lockstep during layout animations.
function fitSite(p, i, w, h) {
  const { zoom } = state.panes[i];
  p.zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
  if (!state.siteWidth) {
    Object.assign(p.wv.style, { width: '100%', height: '100%', transform: 'none' });
    return;
  }
  const vw = Math.round(state.siteWidth / zoom);
  const scale = w / vw;
  Object.assign(p.wv.style, {
    width: `${vw}px`,
    height: `${Math.ceil(h / scale)}px`,
    transform: `scale(${scale})`,
  });
}

// Window resizes should snap, not animate.
let resizeTimer;
window.addEventListener('resize', () => {
  stage.classList.add('instant');
  applyLayout();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => stage.classList.remove('instant'), 100);
});

// ---------- actions ----------

function render() {
  document.documentElement.style.setProperty('--dur', `${state.speed}ms`);
  document.body.classList.toggle('clean', state.clean);
  document.body.classList.toggle('no-dim', !state.dim);
  document.body.classList.toggle('panel-open', state.panelOpen);
  applyLayout();
  renderTopbar();
  renderPanel();
  save();
}

function setLayout(layout) {
  if (layout === state.layout) return;
  state.layout = layout;
  render();
}

function focusPane(i, { keepLayout = false } = {}) {
  if (i < 0 || i >= panes.length) return;
  state.focus = i;
  if (!keepLayout && (state.layout === 'columns' || state.layout === 'grid')) state.layout = 'focus';
  render();
}

function toggleSingle(i) {
  if (state.layout === 'single' && state.focus === i) {
    state.layout = layoutBeforeSingle;
  } else {
    if (state.layout !== 'single') layoutBeforeSingle = state.layout;
    state.layout = 'single';
    state.focus = i;
  }
  render();
}

function zoomPane(i, dir) {
  const pane = state.panes[i];
  const at = ZOOM_STEPS.indexOf(pane.zoom);
  pane.zoom = dir === 0 ? 1 : ZOOM_STEPS[Math.min(Math.max(at + dir, 0), ZOOM_STEPS.length - 1)];
  render();
}

function applyScene(idx) {
  const sc = state.scenes[idx];
  if (!sc) return;
  state.sceneIndex = idx;
  syncPanesTo(sc.panes);
  state.layout = sc.layout;
  state.focus = clampIndex(sc.focus, panes.length);
  render();
  bumpSceneText();
  toast(`Scene <b>${idx + 1}</b>/${state.scenes.length} · ${escapeHtml(sc.name)}`);
}

function stepScene(dir) {
  const n = state.scenes.length;
  if (!n) return toast('No scenes yet — save one from the control panel (⌘K)');
  const base = state.sceneIndex < 0 ? (dir > 0 ? -1 : 0) : state.sceneIndex;
  applyScene((base + dir + n) % n);
}

function snapshot(name) {
  return {
    name,
    layout: state.layout,
    focus: state.focus,
    panes: state.panes.map(({ label, url, zoom }) => ({ label, url, zoom })),
  };
}

function togglePanel() {
  state.panelOpen = !state.panelOpen;
  render();
}

function toggleClean() {
  state.clean = !state.clean;
  render();
}

const COMMANDS = {
  showAll: () => setLayout('columns'),
  cycleLayout: () => setLayout(LAYOUTS[(LAYOUTS.indexOf(state.layout) + 1) % LAYOUTS.length]),
  nextScene: () => stepScene(1),
  prevScene: () => stepScene(-1),
  newPane,
  closePane: () => closePane(state.focus),
  togglePanel,
  toggleClean,
  reloadFocused: () => reload(panes[state.focus]),
  reloadAll: () => panes.forEach(reload),
  zoomIn: () => zoomPane(state.focus, 1),
  zoomOut: () => zoomPane(state.focus, -1),
  editUrl: () => {
    if (state.clean) toggleClean();
    panes[state.focus].url.focus();
  },
};

window.demo.onCommand((action) => {
  if (action.startsWith('focus:')) return focusPane(Number(action.slice(6)));
  COMMANDS[action]?.();
});

// ---------- top bar ----------

function buildTopbar() {
  const seg = $('#layout-seg');
  seg.style.setProperty('--count', LAYOUTS.length);
  for (const id of LAYOUTS) {
    const b = document.createElement('button');
    b.dataset.layout = id;
    b.title = `${id[0].toUpperCase()}${id.slice(1)} layout`;
    b.innerHTML = `<svg viewBox="0 0 24 16">${LAYOUT_ICONS[id]}</svg>`;
    b.addEventListener('click', () => setLayout(id));
    seg.appendChild(b);
  }
  $('#prev-scene').addEventListener('click', () => stepScene(-1));
  $('#next-scene').addEventListener('click', () => stepScene(1));
  $('#add-pane').addEventListener('click', newPane);
  $('#toggle-panel').addEventListener('click', togglePanel);
  $('#toggle-clean').addEventListener('click', toggleClean);
  $('#reveal').addEventListener('click', toggleClean);
}

function renderTopbar() {
  const seg = $('#layout-seg');
  seg.style.setProperty('--i', LAYOUTS.indexOf(state.layout));
  seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  $('#toggle-panel').classList.toggle('active', state.panelOpen);
  $('#add-pane').disabled = panes.length >= MAX_PANES;

  const sc = state.scenes[state.sceneIndex];
  $('#scene-text').innerHTML = sc
    ? `Scene <b>${state.sceneIndex + 1}</b>/${state.scenes.length} · <b>${escapeHtml(sc.name)}</b>`
    : state.scenes.length
      ? `${state.scenes.length} scenes · ⌘⌥→ to start`
      : 'No scenes yet';

  document.body.classList.toggle('single-pane', panes.length === 1);
  panes.forEach((p, i) => {
    p.badge.textContent = i + 1;
    p.label.textContent = state.panes[i].label;
  });
}

function bumpSceneText() {
  const t = $('#scene-text');
  t.classList.remove('bump');
  void t.offsetWidth; // restart the animation
  t.classList.add('bump');
}

// ---------- control panel ----------

function buildSiteField() {
  const row = document.createElement('div');
  row.className = 'site-field';
  row.innerHTML = `
    <span class="badge"></span>
    <input class="input name" placeholder="Label" spellcheck="false">
    <button class="icon-btn remove" title="Remove site">${ICONS.close}</button>
    <input class="input url-input" placeholder="URL or search" spellcheck="false">`;
  const idx = () => [...row.parentNode.children].indexOf(row);

  $('.name', row).addEventListener('input', (e) => {
    state.panes[idx()].label = e.target.value;
    panes[idx()].label.textContent = e.target.value;
    save();
  });
  $('.url-input', row).addEventListener('change', (e) => navigate(idx(), e.target.value, { autoLabel: true }));
  $('.remove', row).addEventListener('click', () => closePane(idx()));
  return row;
}

function buildPanel() {
  $('#add-site').addEventListener('click', newPane);

  $('#scene-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#scene-name');
    state.scenes.push(snapshot(input.value.trim() || `Scene ${state.scenes.length + 1}`));
    state.sceneIndex = state.scenes.length - 1;
    input.value = '';
    render();
    toast('Scene saved');
  });

  const widths = $('#site-width');
  for (const w of SITE_WIDTHS) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.dataset.w = w;
    b.textContent = w ? `${w}` : 'Auto';
    b.title = w ? `Render sites ${w}px wide and scale to fit` : 'Sites reflow to the pane size';
    b.addEventListener('click', () => {
      state.siteWidth = w;
      render();
    });
    widths.appendChild(b);
  }

  $('#speed').addEventListener('input', (e) => {
    state.speed = Number(e.target.value);
    render();
  });
  $('#gap').addEventListener('input', (e) => {
    state.gap = Number(e.target.value);
    render();
  });
  $('#dim').addEventListener('change', (e) => {
    state.dim = e.target.checked;
    render();
  });
  $('#clean').addEventListener('change', (e) => {
    state.clean = e.target.checked;
    render();
  });

  $('#export').addEventListener('click', async () => {
    if (await window.demo.exportConfig(state)) toast('Exported');
  });
  $('#import').addEventListener('click', async () => {
    try {
      const imported = await window.demo.importConfig();
      if (!imported) return;
      const incoming = normalizeState(imported);
      state = { ...incoming, panes: state.panes, panelOpen: state.panelOpen };
      syncPanesTo(incoming.panes);
      state.focus = clampIndex(incoming.focus, panes.length);
      render();
      toast('Imported');
    } catch (err) {
      toast(`Import failed: ${escapeHtml(err.message)}`);
    }
  });
}

function renderPanel() {
  const fields = $('#site-fields');
  while (fields.children.length < panes.length) fields.appendChild(buildSiteField());
  while (fields.children.length > panes.length) fields.lastElementChild.remove();
  [...fields.children].forEach((row, i) => {
    const data = state.panes[i];
    row.style.setProperty('--accent', COLORS[data.color]);
    $('.badge', row).textContent = i + 1;
    const name = $('.name', row);
    const url = $('.url-input', row);
    if (document.activeElement !== name) name.value = data.label;
    if (document.activeElement !== url) url.value = data.url;
  });
  $('#site-count').textContent = `${panes.length} / ${MAX_PANES}`;
  $('#add-site').disabled = panes.length >= MAX_PANES;

  const list = $('#scene-list');
  list.innerHTML = '';
  state.scenes.forEach((sc, idx) => {
    const li = document.createElement('li');
    li.className = `scene${idx === state.sceneIndex ? ' active' : ''}`;
    li.innerHTML = `
      <span class="num">${idx + 1}</span>
      <div class="info"><div class="name"></div><div class="meta"></div></div>
      <button class="icon-btn" data-act="update" title="Overwrite with current view">${ICONS.save}</button>
      <button class="icon-btn" data-act="delete" title="Delete scene">${ICONS.close}</button>`;
    $('.name', li).textContent = sc.name;
    $('.meta', li).textContent = `${sc.layout} · ${sc.panes.length} sites · ${sc.panes.map((p) => p.label).join(', ')}`;
    li.style.animationDelay = `${idx * 30}ms`;
    li.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'update') {
        state.scenes[idx] = snapshot(sc.name);
        render();
        toast(`Updated “${escapeHtml(sc.name)}”`);
      } else if (act === 'delete') {
        state.scenes.splice(idx, 1);
        if (state.sceneIndex === idx) state.sceneIndex = -1;
        else if (state.sceneIndex > idx) state.sceneIndex -= 1;
        render();
      } else {
        applyScene(idx);
      }
    });
    list.appendChild(li);
  });

  document.querySelectorAll('#site-width .chip').forEach((b) =>
    b.classList.toggle('active', Number(b.dataset.w) === state.siteWidth),
  );
  $('#speed').value = state.speed;
  $('#speed-out').textContent = `${state.speed} ms`;
  $('#gap').value = state.gap;
  $('#gap-out').textContent = `${state.gap} px`;
  $('#dim').checked = state.dim;
  $('#clean').checked = state.clean;
}

// ---------- misc ----------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

let toastTimer;
function toast(html) {
  const t = $('#toast');
  t.innerHTML = html;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

async function init() {
  state = normalizeState(await window.demo.loadConfig());
  buildTopbar();
  buildPanel();
  state.panes.forEach((data, i) => panes.push(createPane(data, { stagger: i })));
  render();
}

init();
