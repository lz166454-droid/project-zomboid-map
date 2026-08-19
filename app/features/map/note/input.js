import { DEFAULT_FOLDER_ID, BLDG_MIN_Z } from "../../../shared/const.js";
import { saveNoteStore } from "./store.js";
import { t } from "../i18n.js";

export function attachInput(s) {
    s.typingInField = function () {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return true;
      return tag === "SELECT" || !!el.isContentEditable;
    }

    s.activeNote = function () {
      const id = s.topPopId();
      if (id) {
        const n = s.findNote(id);
        if (n) return n;
      }
      if (s.hoverNote) return s.hoverNote;
      if (s.hoverBldg) return s.findNoteByBldg(s.hoverBldg.layer, s.hoverBldg.cell, s.hoverBldg.i);
      return null;
    }

    s.copyActiveNote = function () {
      const n = s.activeNote();
      if (!n) return;
      s.clipNote = s.cloneNoteData(n);
      s.showToast(t("toast.copied"));
    }

    s.cutActiveNote = function () {
      const n = s.activeNote();
      if (!n) return;
      s.clipNote = s.cloneNoteData(n);
      s.deleteNoteById(n.id);
      s.showToast(t("toast.cut"));
    }

    s.pasteAtCursor = function () {
      if (!s.clipNote) return;
      s.pasteNoteAt(s.lastWorld.x, s.lastWorld.y);
      s.showToast(t("toast.pasted"));
    }

    s.deleteNoteById = function (id) {
      if (!id || !s.findNote(id)) return false;
      s.notes = s.notes.filter(function (n) { return n.id !== id; });
      if (s.hoverNote && s.hoverNote.id === id) s.hoverNote = null;
      s.refreshNotesUi();
      s.closePop(id);
      s.drawNotes();
      return true;
    }

    s.hideNoteCtx = function () {
      s.noteCtxEl.hidden = true;
      s.ctxNote = null;
      s.ctxWorld = null;
    }

    s.cloneNoteData = function (n) {
      const c = {
        type: s.noteKind(n),
        folderId: n.folderId || DEFAULT_FOLDER_ID,
        title: n.title || "",
        text: n.text || "",
        scale: n.scale,
        size: n.size,
        color: n.color,
        symbol: n.symbol || "",
        x: n.x,
        y: n.y,
      };
      if (n.x2 != null) {
        c.x2 = n.x2;
        c.y2 = n.y2;
      }
      if (n.r != null) c.r = n.r;
      if (n.pts) {
        c.pts = [];
        for (let i = 0; i < n.pts.length; i++) c.pts.push([n.pts[i][0], n.pts[i][1]]);
      }
      return c;
    }

    s.noteAtMapEvent = function (e) {
      if (!s.layerNotesEl.checked) return null;
      const hit = s.hitNote(e);
      if (hit) return hit;
      if (s.map.getZoom() < BLDG_MIN_Z) return null;
      const b = s.hitBuildingAt(e.latlng.lng, e.latlng.lat);
      if (!b) return null;
      return s.findNoteByBldg(b.layer, b.cell, b.i);
    }

    s.pasteNoteAt = function (wx, wy) {
      if (!s.clipNote) return null;
      const n = s.cloneNoteData(s.clipNote);
      n.id = String(Date.now());
      n.z = s.nextNoteZ();
      const from = s.noteAnchor(n);
      s.translateNote(n, s.snapshotNote(n), wx - from.x, wy - from.y);
      if (s.noteKind(n) === "pin") s.bindPinToBuilding(n);
      s.notes.push(n);
      s.persistNotes();
      s.expandedFolders[n.folderId || DEFAULT_FOLDER_ID] = true;
      s.expandAncestors(n.folderId || DEFAULT_FOLDER_ID);
      s.renderFolders(s.searchEl.value);
      s.drawNotes();
      return n;
    }

    s.placeDropNote = function (type, wx, wy) {
      const n = {
        id: String(Date.now()),
        type: type,
        x: wx,
        y: wy,
        title: type === "text" ? t("kind.text") : "",
        text: "",
        scale: 1,
        size: type === "stamp" ? 20 : 12,
        color: s.colors.hex,
        z: s.nextNoteZ(),
      };
      if (type === "stamp") {
        if (!s.pickSymbol) {
          const first = s.itemsInTab(s.symTab)[0];
          if (first) s.pickSymbol = first.id;
        }
        if (!s.pickSymbol) return null;
        n.symbol = s.pickSymbol;
      }
      if (type === "pin") s.bindPinToBuilding(n);
      n.folderId = s.assignFolderForNewNote(n);
      s.notes.push(n);
      s.persistNotes();
      s.drawNotes();
      s.expandedFolders[n.folderId] = true;
      s.expandAncestors(n.folderId);
      s.renderFolders(s.searchEl.value);
      if (type !== "stamp") s.openNote(n.id, true);
      return n;
    }

    s.showNoteCtx = function (e) {
      s.ctxWorld = s.worldOf(e);
      s.ctxNote = s.noteAtMapEvent(e);
      const has = !!s.ctxNote;
      s.noteCtxEl.querySelector("[data-act=\"copy\"]").disabled = !has;
      s.noteCtxEl.querySelector("[data-act=\"cut\"]").disabled = !has;
      s.noteCtxEl.querySelector("[data-act=\"delete\"]").disabled = !has;
      s.noteCtxEl.querySelector("[data-act=\"paste\"]").disabled = !s.clipNote;
      s.noteCtxEl.hidden = false;
      const ev = e.originalEvent;
      let x = ev.clientX;
      let y = ev.clientY;
      const w = s.noteCtxEl.offsetWidth;
      const h = s.noteCtxEl.offsetHeight;
      if (x + w > window.innerWidth - 8) x = window.innerWidth - w - 8;
      if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
      if (x < 8) x = 8;
      if (y < 8) y = 8;
      s.noteCtxEl.style.left = x + "px";
      s.noteCtxEl.style.top = y + "px";
    }

    s.persistNotes = function () {
      if (!s.applyingUndo) {
        const cur = JSON.stringify(s.notes);
        if (cur !== JSON.stringify(s.lastSaved)) {
          s.undoStack.push(s.lastSaved);
          if (s.undoStack.length > 40) s.undoStack.shift();
          s.lastSaved = JSON.parse(cur);
        }
      } else {
        s.lastSaved = JSON.parse(JSON.stringify(s.notes));
      }
      s.store.notes = s.notes;
      try {
        saveNoteStore(s.store);
      } catch (err) {}
    }

    s.undoNotes = function () {
      if (!s.undoStack.length) return;
      s.applyingUndo = true;
      s.notes = s.undoStack.pop();
      s.lastSaved = JSON.parse(JSON.stringify(s.notes));
      s.store.notes = s.notes;
      try {
        saveNoteStore(s.store);
      } catch (err) {}
      s.applyingUndo = false;
      s.hoverNote = null;
      s.closeAllPops();
      s.renderFolders(s.searchEl.value);
      s.drawNotes();
    }

    s.findNote = function (id) {
      for (let i = 0; i < s.notes.length; i++) {
        if (s.notes[i].id === id) return s.notes[i];
      }
      return null;
    }

    s.clearHandleCursor = function () {
      const el = s.map.getContainer();
      el.classList.remove(
        "note-hover", "moving-note",
        "resize-n", "resize-s", "resize-e", "resize-w",
        "resize-ne", "resize-nw", "resize-se", "resize-sw"
      );
    }

    s.setHandleCursor = function (handle, dragging) {
      s.clearHandleCursor();
      if (!handle) return;
      if (handle === "move" || handle === "start" || handle === "end") {
        s.map.getContainer().classList.add(dragging ? "moving-note" : "note-hover");
        return;
      }
      s.map.getContainer().classList.add("resize-" + handle);
    }

    s.setTool = function (tool) {
      if (!tool) tool = "pan";
      if (tool === "building") tool = "pan";
      if (tool === s.activeTool && tool !== "pan") tool = "pan";
      if (s.drawing) {
        s.drawing = false;
        s.draft = null;
      }
      if (s.moving) {
        s.restoreNote(s.moving.n, s.moving.orig);
        s.moving = null;
        s.clearHandleCursor();
      }
      s.colors.endPick();
      s.hoverNote = null;
      s.activeTool = tool;
      const btns = s.noteTools.querySelectorAll("[data-tool]");
      for (let i = 0; i < btns.length; i++) {
        btns[i].classList.toggle("active", btns[i].getAttribute("data-tool") === s.activeTool);
      }
      const drawingTool = s.isDrawTool(s.activeTool);
      const editing = s.activeTool !== "pan";
      s.map.getContainer().classList.toggle("adding-note", s.activeTool === "text" || s.activeTool === "stamp" || drawingTool);
      s.map.getContainer().classList.toggle("drawing-note", drawingTool);
      if (s.dockSymPanel) s.dockSymPanel.hidden = s.activeTool !== "stamp";
      if (drawingTool) {
        s.hoverBldg = null;
        s.pressBldg = null;
        s.map.getContainer().classList.remove("bldg-hover", "bldg-press");
      }
      if (drawingTool) {
        s.map.dragging.disable();
        s.map.doubleClickZoom.disable();
      } else {
        s.map.dragging.enable();
        if (s.activeTool === "text" || s.activeTool === "stamp") s.map.doubleClickZoom.disable();
        else s.map.doubleClickZoom.enable();
      }
      if (!editing) s.map.getContainer().classList.remove("adding-note", "drawing-note");
      s.drawNotes();
    }

    s.openBuildingNote = function (hit) {
      const exist = s.findNoteByBldg(hit.layer, hit.cell, hit.i);
      if (!exist) return;
      s.expandFolder(exist.folderId || DEFAULT_FOLDER_ID);
      s.openNote(exist.id, true);
    }

    s.endBldgPress = function () {
      if (!s.pressBldg) return;
      s.pressBldg = null;
      s.map.getContainer().classList.remove("bldg-press");
      s.drawNotes();
    }

    s.endDraw = function () {
      if (!s.drawing) return;
      s.drawing = false;
      const d = s.draft;
      s.draft = null;
      function cancelDraw() {
        if (s.isDrawTool(s.activeTool)) s.setTool("pan");
        else s.drawNotes();
      }
      if (!d) {
        cancelDraw();
        return;
      }
      if (d.type === "brush") {
        if (!d.pts || d.pts.length < 2) {
          cancelDraw();
          return;
        }
        let sx = 0;
        let sy = 0;
        for (let i = 0; i < d.pts.length; i++) {
          sx += d.pts[i][0];
          sy += d.pts[i][1];
        }
        d.x = sx / d.pts.length;
        d.y = sy / d.pts.length;
      } else if (d.type === "rect" || d.type === "arrow") {
        const p0 = s.toPt(d.x, d.y);
        const p1 = s.toPt(d.x2, d.y2);
        if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 8) {
          cancelDraw();
          return;
        }
      } else if (d.type === "circle") {
        const c = s.toPt(d.x, d.y);
        const edge = s.toPt(d.x + d.r, d.y);
        if (Math.abs(edge.x - c.x) < 8) {
          cancelDraw();
          return;
        }
      }
      s.skipClick = true;
      s.notes.push(d);
      s.persistNotes();
      s.drawNotes();
      s.expandedFolders[d.folderId || DEFAULT_FOLDER_ID] = true;
      s.expandAncestors(d.folderId || DEFAULT_FOLDER_ID);
      s.renderFolders(s.searchEl.value);
      s.openNote(d.id, true);
    }

    s.endMove = function () {
      if (!s.moving) return;
      const n = s.moving.n;
      const handle = s.moving.handle;
      const moved = !!s.moving.dragged;
      s.map.dragging.enable();
      s.moving = null;
      if (s.hoverNote === n) s.setHandleCursor(handle || "move", false);
      else s.clearHandleCursor();
      if (!moved) {
        s.drawNotes();
        return;
      }
      s.skipClick = true;
      s.bindPinToBuilding(n);
      s.persistNotes();
      s.drawNotes();
      s.updateOpenPopXy(n.id);
    }
}
