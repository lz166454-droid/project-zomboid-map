import {
  SIDEBAR_W_KEY, SIDEBAR_W_MIN, SIDEBAR_W_MAX, SIDEBAR_W_DEFAULT,
  PANEL_SPLIT_KEY, PANEL_TOWNS_H_MIN, PANEL_NOTES_H_MIN,
} from "../../../shared/const.js";

function clampW(w) {
  const n = Number(w);
  if (!Number.isFinite(n)) return SIDEBAR_W_DEFAULT;
  return Math.max(SIDEBAR_W_MIN, Math.min(SIDEBAR_W_MAX, Math.round(n)));
}

function applyW(el, w) {
  const px = clampW(w) + "px";
  el.style.flexBasis = px;
  el.style.width = px;
}

function clampRatio(r) {
  const n = Number(r);
  if (!Number.isFinite(n)) return null;
  return Math.max(0.12, Math.min(0.82, n));
}

function bothPanelsOpen(towns, notes) {
  return towns && notes && !towns.classList.contains("collapsed") && !notes.classList.contains("collapsed");
}

function applySplit(towns, notes, townsH, avail) {
  const maxH = Math.max(PANEL_TOWNS_H_MIN, avail - PANEL_NOTES_H_MIN);
  const h = Math.max(PANEL_TOWNS_H_MIN, Math.min(maxH, Math.round(townsH)));
  towns.style.flex = "0 0 " + h + "px";
  towns.style.height = h + "px";
  notes.style.flex = "1 1 0";
  notes.style.height = "";
  return h;
}

function clearSplit(towns, notes) {
  towns.style.flex = "";
  towns.style.height = "";
  notes.style.flex = "";
  notes.style.height = "";
}

let splitRatio = null;

export function syncPanelSplit() {
  const towns = document.getElementById("panel-towns");
  const notes = document.getElementById("panel-notes");
  if (!towns || !notes) return;
  if (!bothPanelsOpen(towns, notes) || splitRatio == null) {
    clearSplit(towns, notes);
    return;
  }
  const avail = towns.getBoundingClientRect().height + notes.getBoundingClientRect().height;
  if (avail < PANEL_TOWNS_H_MIN + PANEL_NOTES_H_MIN) {
    clearSplit(towns, notes);
    return;
  }
  applySplit(towns, notes, splitRatio * avail, avail);
}

function installSidebarWidth() {
  const el = document.getElementById("sidebar");
  const handle = document.getElementById("sidebar-resizer");
  if (!el || !handle) return;
  let w = SIDEBAR_W_DEFAULT;
  try {
    w = clampW(localStorage.getItem(SIDEBAR_W_KEY) || SIDEBAR_W_DEFAULT);
  } catch (err) {}
  applyW(el, w);
  let dragging = false;
  let startX = 0;
  let startW = w;
  handle.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startW = el.getBoundingClientRect().width;
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add("sidebar-resizing");
    e.preventDefault();
  });
  handle.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    applyW(el, startW + (e.clientX - startX));
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("sidebar-resizing");
    const next = clampW(el.getBoundingClientRect().width);
    applyW(el, next);
    try {
      localStorage.setItem(SIDEBAR_W_KEY, String(next));
    } catch (err) {}
  }
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
}

function installPanelSplit() {
  const handle = document.getElementById("panel-split");
  const towns = document.getElementById("panel-towns");
  const notes = document.getElementById("panel-notes");
  if (!handle || !towns || !notes) return;
  try {
    splitRatio = clampRatio(localStorage.getItem(PANEL_SPLIT_KEY));
  } catch (err) {}
  syncPanelSplit();
  window.addEventListener("resize", syncPanelSplit);
  let dragging = false;
  let startY = 0;
  let startH = 0;
  let avail = 0;
  handle.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    if (!bothPanelsOpen(towns, notes)) return;
    dragging = true;
    startY = e.clientY;
    startH = towns.getBoundingClientRect().height;
    avail = startH + notes.getBoundingClientRect().height;
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add("panel-splitting");
    e.preventDefault();
  });
  handle.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    const h = applySplit(towns, notes, startH + (e.clientY - startY), avail);
    splitRatio = avail ? h / avail : splitRatio;
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("panel-splitting");
    const h = towns.getBoundingClientRect().height;
    const nextAvail = h + notes.getBoundingClientRect().height;
    if (nextAvail > 0) splitRatio = h / nextAvail;
    try {
      if (splitRatio != null) localStorage.setItem(PANEL_SPLIT_KEY, String(splitRatio));
    } catch (err) {}
  }
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
}

export function installSidebarResize() {
  installSidebarWidth();
  installPanelSplit();
}
