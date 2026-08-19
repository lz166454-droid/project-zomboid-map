import { DEFAULT_FOLDER_ID, BLDG_MIN_Z } from "../../../shared/const.js";
import { loadJson } from "../../../shared/ui.js";
import { bldgKey } from "../geom.js";
import { t } from "../i18n.js";
import { loadNoteStore, parseImportedNotes } from "./store.js";
import { attachDraw } from "./draw.js";
import { attachHit } from "./hit.js";
import { attachPop } from "./pop.js";
import { attachFolder } from "./folder.js";
import { attachInput } from "./input.js";

export function installNotes(ctx) {
  const s = Object.assign({}, ctx);
  s.noteTools = document.getElementById("note-tools");
  s.noteTargetEl = document.getElementById("note-target");
  s.notePopTpl = document.getElementById("note-pop-tpl");
  s.notePopsEl = document.getElementById("note-pops");
  s.noteTip = document.getElementById("note-tip");
  s.foldersEl = document.getElementById("folders");
  s.folderNew = document.getElementById("folder-new");
  s.noteExport = document.getElementById("note-export");
  s.noteImport = document.getElementById("note-import");
  s.noteFile = document.getElementById("note-file");
  s.layerStreets = document.getElementById("layer-streets");
  s.layerNotesEl = document.getElementById("layer-notes");
  s.noteCtxEl = document.getElementById("note-ctx");
  s.dockSymPanel = document.getElementById("note-sym-panel");

  s.notesReady = false;
  s.activeTool = "pan";
  s.hoverBldg = null;
  s.hoverNote = null;
  s.pressBldg = null;
  s.clipNote = null;
  s.lastWorld = { x: 0, y: 0 };
  s.openPops = {};
  s.popZ = 1;
  s.symbolIds = [];
  s.symbolItems = [];
  s.symbolImgs = {};
  s.symbolTint = {};
  s.SYM_TABS = ["Locations", "Loot", "Symbols"];
  s.symTab = "Locations";
  s.pickSymbol = "";

  s.colors.mountPalettes(document.getElementById("note-draw-colors"), s.notePopTpl);

  s.store = loadNoteStore();
  s.notes = s.store.notes;
  s.lastSaved = JSON.parse(JSON.stringify(s.notes));
  s.undoStack = [];
  s.applyingUndo = false;
  s.drawing = false;
  s.moving = null;
  s.draft = null;
  s.skipClick = false;
  s.expandedFolders = {};
  s.selectedFolderId = DEFAULT_FOLDER_ID;
  s.selectedNoteIds = {};
  s.lastPickNoteId = "";
  s.listedNoteIds = [];
  s.folderDragged = false;
  s.activeTownRaw = "";
  s.mapKeyScope = false;
  s.ctxWorld = null;
  s.ctxNote = null;

  attachDraw(s);
  attachHit(s);
  attachPop(s);
  attachFolder(s);
  attachInput(s);
  bindNoteEvents(s);

  s.seedTownFolders();
  s.lastSaved = JSON.parse(JSON.stringify(s.notes));
  s.persistNotes();
  s.renderFolders("");
  s.syncNoteDock();
  s.syncNoteTownLabel();
  s.notesReady = true;
  if (s.dockSymPanel) {
    s.dockSymPanel.addEventListener("click", function (e) {
      const tab = e.target.closest("button[data-tab]");
      if (tab) {
        s.setSymTab(tab.getAttribute("data-tab"));
        return;
      }
      const btn = e.target.closest("button[data-symbol]");
      if (!btn) return;
      s.setPickSymbol(btn.getAttribute("data-symbol") || "");
    });
  }
  loadJson("/symbols/index.json")
    .then(function (raw) {
      s.ingestSymbols(raw);
    })
    .catch(function () {});
  s.drawNotes();
  return {
    drawNotes: function () { s.drawNotes(); },
    setTool: function (tool) { s.setTool(tool); },
    renderFolders: function (q) { s.renderFolders(q); },
    enterTown: function (label) { s.enterTown(label); },
    enterOther: function () { s.enterOther(); },
    clearTown: function () { s.clearTown(); },
    leaveTown: function () { s.leaveTown(); },
    moveNotesToTown: function (raw, town) { s.moveNotesToTown(raw, town); },
    moveNotesToOther: function (raw) { s.moveNotesToFolder(raw, DEFAULT_FOLDER_ID); },
    onLang: function () { s.onLang(); },
    canEnableDrag: function () {
      return s.activeTool === "pan" && !s.moving && !s.drawing;
    },
  };
}

function bindNoteEvents(s) {
  s.noteCtxEl.addEventListener("pointerdown", function (e) {
    e.stopPropagation();
  });
  s.noteCtxEl.addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-act]");
    if (!btn || btn.disabled) return;
    const act = btn.getAttribute("data-act");
    const wx = s.ctxWorld && s.ctxWorld.x;
    const wy = s.ctxWorld && s.ctxWorld.y;
    if (act === "copy" && s.ctxNote) {
      s.clipNote = s.cloneNoteData(s.ctxNote);
      s.showToast(t("toast.copied"));
    } else if (act === "cut" && s.ctxNote) {
      s.clipNote = s.cloneNoteData(s.ctxNote);
      s.deleteNoteById(s.ctxNote.id);
      s.showToast(t("toast.cut"));
    } else if (act === "paste" && s.clipNote && wx != null) {
      s.pasteNoteAt(wx, wy);
      s.showToast(t("toast.pasted"));
    } else if (act === "delete" && s.ctxNote) {
      s.deleteNoteById(s.ctxNote.id);
    } else if (act === "add-pin" && wx != null) {
      s.placeDropNote("pin", wx, wy);
    } else if (act === "add-stamp" && wx != null) {
      s.placeDropNote("stamp", wx, wy);
    } else if (act === "add-text" && wx != null) {
      s.placeDropNote("text", wx, wy);
    } else if (act === "add-rect") {
      s.setTool("rect");
    } else if (act === "add-circle") {
      s.setTool("circle");
    } else if (act === "add-arrow") {
      s.setTool("arrow");
    } else if (act === "add-brush") {
      s.setTool("brush");
    }
    s.hideNoteCtx();
  });

  s.noteTools.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-tool]");
    if (!btn) return;
    s.setTool(btn.getAttribute("data-tool"));
  });
  s.colors.bindDock();

  s.folderNew.addEventListener("click", function () {
    const parentId = s.newFolderParentId();
    const parent = parentId ? s.findFolder(parentId) : null;
    const title = parent && parent.kind === "town"
      ? t("folder.newTitleTown", { town: s.folderDisplayName(parent) })
      : t("folder.newTitle");
    s.openModal({ title: title, input: true, value: t("folder.newValue") }).then(function (name) {
      if (!name || !String(name).trim()) return;
      const id = String(Date.now());
      const trimmed = String(name).trim();
      const rec = { id: id, name: trimmed, parentId: parentId, kind: "user", town: "" };
      if (parent && parent.kind === "town") rec.town = parent.town;
      else if (parent && parent.town) rec.town = parent.town;
      s.store.folders.push(rec);
      s.persistNotes();
      s.selectedFolderId = id;
      s.expandedFolders[id] = true;
      if (parentId) s.expandedFolders[parentId] = true;
      s.renderFolders(s.searchEl.value);
      s.syncNoteDock();
      s.refreshPopFolders();
      s.showToast(t("folder.created", { name: trimmed }));
    });
  });
  s.noteExport.addEventListener("click", function () {
    const blob = new Blob([JSON.stringify(s.store, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mapweb-notes.json";
    a.click();
    URL.revokeObjectURL(a.href);
    s.showToast(t("folder.exported"));
  });
  s.noteImport.addEventListener("click", function () {
    s.noteFile.click();
  });
  s.noteFile.addEventListener("change", function () {
    const file = s.noteFile.files && s.noteFile.files[0];
    s.noteFile.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const dataIn = JSON.parse(String(reader.result || ""));
        const parsed = parseImportedNotes(dataIn);
        if (!parsed) {
          s.showToast(t("folder.importBad"));
          return;
        }
        s.store = parsed;
        s.notes = s.store.notes;
        s.seedTownFolders();
        s.lastSaved = JSON.parse(JSON.stringify(s.notes));
        s.closeAllPops();
        s.persistNotes();
        s.expandedFolders = {};
        s.selectedFolderId = DEFAULT_FOLDER_ID;
        s.setActiveTown("");
        s.renderFolders(s.searchEl.value);
        s.syncNoteDock();
        s.renderNotePins();
        s.showToast(t("folder.imported"));
      } catch (err) {
        s.showToast(t("folder.importFail"));
      }
    };
    reader.readAsText(file);
  });

  s.map.on("mousedown", function (e) {
    if (!e.originalEvent || e.originalEvent.button !== 0) return;
    if (s.colors.onMapMouseDown(e)) {
      s.skipClick = true;
      return;
    }
    if (!s.layerNotesEl.checked) return;
    if (s.isDrawTool(s.activeTool)) {
      L.DomEvent.preventDefault(e.originalEvent);
      s.drawing = true;
      const w = s.worldOf(e);
      const base = {
        id: String(Date.now()),
        folderId: s.assignFolderForNewNote(null),
        title: "",
        text: "",
        scale: 1,
        size: 12,
        color: s.colors.hex,
        z: s.nextNoteZ(),
        x: w.x,
        y: w.y,
      };
      if (s.activeTool === "brush") {
        s.draft = Object.assign(base, { type: "brush", pts: [[w.x, w.y]] });
      } else if (s.activeTool === "rect" || s.activeTool === "arrow") {
        s.draft = Object.assign(base, { type: s.activeTool, x2: w.x, y2: w.y });
      } else {
        s.draft = Object.assign(base, { type: "circle", r: 0 });
      }
      s.drawNotes();
      return;
    }
    if (s.activeTool !== "pan" && s.activeTool !== "pin" && s.activeTool !== "stamp") return;
    const hit = s.hitNote(e);
    if (!hit) return;
    L.DomEvent.preventDefault(e.originalEvent);
    s.map.dragging.disable();
    const w = s.worldOf(e);
    const handle = s.hitShapeHandle(e.containerPoint, hit) || "move";
    s.hoverNote = hit;
    s.moving = {
      n: hit,
      grabX: w.x,
      grabY: w.y,
      orig: s.snapshotNote(hit),
      sx: e.containerPoint.x,
      sy: e.containerPoint.y,
      handle: handle,
    };
    s.setHandleCursor(handle, true);
    s.drawNotes();
  });

  s.map.on("mouseup", function () {
    s.endDraw();
    s.endMove();
    s.endBldgPress();
  });
  document.addEventListener("mouseup", function () {
    s.endDraw();
    s.endMove();
    s.endBldgPress();
  });

  s.map.on("click", function (e) {
    if (s.skipClick) {
      s.skipClick = false;
      return;
    }
    if (s.activeTool === "pin" || s.activeTool === "text" || s.activeTool === "stamp") {
      const hit = s.activeTool === "text" ? null : s.hitNote(e);
      if (hit) {
        s.expandFolder(hit.folderId || DEFAULT_FOLDER_ID);
        s.openNote(hit.id);
        return;
      }
      s.placeDropNote(s.activeTool, e.latlng.lng, e.latlng.lat);
      return;
    }
    if (s.isDrawTool(s.activeTool)) {
      s.setTool("pan");
      return;
    }
    if (s.activeTool !== "pan") return;
    const n = s.hitNote(e);
    if (n) {
      s.expandFolder(n.folderId || DEFAULT_FOLDER_ID);
      s.openNote(n.id);
      return;
    }
    if (s.layerNotesEl.checked && s.map.getZoom() >= BLDG_MIN_Z) {
      const bhit = s.hitBuildingAt(e.latlng.lng, e.latlng.lat);
      if (bhit && s.findNoteByBldg(bhit.layer, bhit.cell, bhit.i)) {
        s.openBuildingNote(bhit);
        return;
      }
    }
    s.closeAllPops();
  });
  s.map.on("contextmenu", function (e) {
    L.DomEvent.preventDefault(e);
    if (s.colors.onContextMenu(e)) return;
    if (s.drawing || s.moving) {
      s.setTool("pan");
      return;
    }
    s.showNoteCtx(e);
  });
  document.addEventListener("pointerdown", function (e) {
    const t = e.target;
    if (t && t.closest) {
      s.mapKeyScope = !!(t.closest("#map-wrap") || t.closest("#note-stack") || t.closest("#note-pops") || t.closest("#note-ctx"));
    }
    if (e.button !== 0) return;
    if (s.noteCtxEl.contains(t)) return;
    s.hideNoteCtx();
    if (s.map.getContainer().contains(t)) return;
    if (t.closest("#note-dock")) return;
    if (t.closest(".note-pop")) return;
    if (t.closest("#ui-modal")) return;
    if (t.closest("#pick-hud")) return;
    if (s.activeTool !== "pan") s.setTool("pan");
  });
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        if (s.typingInField() || !s.ui.modal.hidden || s.colors.picking || s.drawing || s.moving) return;
        e.preventDefault();
        s.undoNotes();
        return;
      }
      if (k === "c" || k === "x" || k === "v") {
        if (s.typingInField() || !s.ui.modal.hidden || s.colors.picking || s.drawing || s.moving) return;
        if (!s.mapKeyScope) return;
        e.preventDefault();
        if (k === "c") s.copyActiveNote();
        else if (k === "x") s.cutActiveNote();
        else s.pasteAtCursor();
        return;
      }
    }
    if (e.key === "Delete") {
      if (s.typingInField() || !s.ui.modal.hidden || s.colors.picking || s.drawing || s.moving) return;
      const n = s.activeNote();
      if (!n) return;
      e.preventDefault();
      s.deleteNoteById(n.id);
      return;
    }
    if (e.key !== "Escape") return;
    if (!s.noteCtxEl.hidden) {
      s.hideNoteCtx();
      return;
    }
    if (!s.ui.modal.hidden) {
      s.ui.finishModal(s.ui.modalInput.hidden ? false : null);
      return;
    }
    if (s.colors.picking) {
      s.colors.endPick();
      return;
    }
    if (s.moving) {
      s.restoreNote(s.moving.n, s.moving.orig);
      s.moving = null;
      s.clearHandleCursor();
      s.map.dragging.enable();
      s.drawNotes();
      return;
    }
    if (s.drawing) {
      s.setTool("pan");
      return;
    }
    if (s.closeTopPop()) return;
    if (s.activeTool !== "pan") s.setTool("pan");
  });
  s.layerStreets.addEventListener("change", s.drawAll);
  s.layerNotesEl.addEventListener("change", function () {
    if (!s.layerNotesEl.checked) {
      s.hoverBldg = null;
      s.hoverNote = null;
      s.pressBldg = null;
      s.clearHandleCursor();
      s.map.getContainer().classList.remove("bldg-hover", "bldg-press");
    }
    s.drawAll();
  });

  s.map.on("mousemove", function (e) {
    const x = Math.floor(e.latlng.lng);
    const y = Math.floor(e.latlng.lat);
    s.setCoordXy({ x: x, y: y });
    s.lastWorld = { x: x, y: y };
    s.coordsEl.setAttribute("data-xy", x + ", " + y);
    s.coordsEl.textContent =
      "x " + x + ", y " + y + " · cell " + Math.floor(x / 300) + "," + Math.floor(y / 300) +
      " · zoom " + s.zoomHudText();
    if (s.colors.onMapMouseMove(e)) {
      s.noteTip.hidden = true;
      return;
    }
    if (s.moving) {
      if (s.moving.handle && s.moving.handle !== "move") {
        s.applyResize(s.moving.n, s.moving.orig, s.moving.handle, e);
      } else {
        const w = s.worldOf(e);
        s.translateNote(s.moving.n, s.moving.orig, w.x - s.moving.grabX, w.y - s.moving.grabY);
      }
      if (Math.hypot(e.containerPoint.x - s.moving.sx, e.containerPoint.y - s.moving.sy) >= 5) {
        s.moving.dragged = true;
      }
      s.drawNotes();
      s.noteTip.hidden = true;
      return;
    }
    if (s.drawing && s.draft) {
      const w = s.worldOf(e);
      if (s.draft.type === "brush") {
        const last = s.draft.pts[s.draft.pts.length - 1];
        const p = s.toPt(w.x, w.y);
        const q = s.toPt(last[0], last[1]);
        if (s.dist2(p.x, p.y, q.x, q.y) >= 9) s.draft.pts.push([w.x, w.y]);
      } else if (s.draft.type === "rect" || s.draft.type === "arrow") {
        s.draft.x2 = w.x;
        s.draft.y2 = w.y;
      } else if (s.draft.type === "circle") {
        const dx = w.x - s.draft.x;
        const dy = w.y - s.draft.y;
        s.draft.r = Math.sqrt(dx * dx + dy * dy);
      }
      s.drawNotes();
      s.noteTip.hidden = true;
      return;
    }
    if (s.layerNotesEl.checked && !s.isDrawTool(s.activeTool) && s.activeTool !== "text") {
      const w = s.worldOf(e);
      const hit = s.map.getZoom() >= BLDG_MIN_Z ? s.hitBuildingAt(w.x, w.y) : null;
      const prev = bldgKey(s.hoverBldg);
      s.hoverBldg = hit;
      s.map.getContainer().classList.toggle("bldg-hover", !!hit);
      if (bldgKey(hit) !== prev) s.drawNotes();
    }
    const n = (s.activeTool === "pan" || s.activeTool === "pin" || s.activeTool === "stamp") && s.layerNotesEl.checked ? s.hitNote(e) : null;
    if (s.activeTool === "pan" || s.activeTool === "pin" || s.activeTool === "stamp") {
      const handle = n ? (s.hitShapeHandle(e.containerPoint, n) || "move") : null;
      const prev = s.hoverNote;
      s.hoverNote = n;
      s.setHandleCursor(handle, false);
      if (prev !== n) s.drawNotes();
    } else {
      if (s.hoverNote) {
        s.hoverNote = null;
        s.drawNotes();
      }
      s.map.getContainer().classList.toggle("note-hover", !!n);
    }
    if (!n) {
      s.noteTip.hidden = true;
      return;
    }
    const body = ((n.text || "") + "").trim();
    if (!body) {
      s.noteTip.hidden = true;
      return;
    }
    s.noteTip.hidden = false;
    s.noteTip.textContent = body;
    s.noteTip.style.left = e.originalEvent.clientX + 12 + "px";
    s.noteTip.style.top = e.originalEvent.clientY + 12 + "px";
  });
  s.map.getContainer().addEventListener("mouseleave", function () {
    s.noteTip.hidden = true;
    s.colors.onMapMouseLeave();
    if (!s.moving) {
      s.clearHandleCursor();
      s.hoverNote = null;
    }
    s.map.getContainer().classList.remove("bldg-hover");
    s.hoverBldg = null;
    if (s.pressBldg || !s.moving) s.drawNotes();
  });
}
