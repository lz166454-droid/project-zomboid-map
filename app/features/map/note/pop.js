import { DEFAULT_FOLDER_ID } from "../../../shared/const.js";
import { parseHexColor } from "../../../shared/color.js";
import { t, applyI18nDom, symbolName } from "../i18n.js";

export function attachPop(s) {
    s.popEls = function (el) {
      return {
        xy: el.querySelector(".note-xy"),
        title: el.querySelector(".note-title"),
        body: el.querySelector(".note-body"),
        close: el.querySelector(".note-close"),
        del: el.querySelector(".note-del"),
        scale: el.querySelector(".note-scale-range"),
        scaleNum: el.querySelector(".note-scale-num"),
        folder: el.querySelector(".note-folder-select"),
        layerUp: el.querySelector(".note-layer-up"),
        layerDown: el.querySelector(".note-layer-down"),
        center: el.querySelector(".note-center"),
        colors: el.querySelector(".note-colors"),
        rgb: el.querySelector(".note-rgb"),
        syms: el.querySelector(".sym-grid"),
        symTabs: el.querySelector(".sym-tabs"),
        symNone: el.querySelector(".sym-none"),
        symPanel: el.querySelector(".sym-panel"),
        head: el.querySelector(".note-pop-head"),
      };
    }

    s.popNoteId = function (el) {
      return el.getAttribute("data-note-id") || "";
    }

    s.fillPopFolderSelect = function (sel, n) {
      const cur = (n && n.folderId) || DEFAULT_FOLDER_ID;
      sel.innerHTML = "";
      function addOpt(f) {
        if (f.kind === "town") return;
        const opt = document.createElement("option");
        opt.value = f.id;
        opt.textContent = s.folderPathName(f);
        if (f.id === cur) opt.selected = true;
        sel.appendChild(opt);
      }
      function walk(parentId) {
        const list = parentId == null ? s.catalogFolderList() : s.sortFolderKids(s.childFoldersOf(parentId));
        for (let i = 0; i < list.length; i++) {
          addOpt(list[i]);
          walk(list[i].id);
        }
      }
      walk(null);
      if (cur) {
        let found = false;
        const opts = sel.options;
        for (let i = 0; i < opts.length; i++) {
          if (opts[i].value === cur) found = true;
        }
        if (!found) {
          const f = s.findFolder(cur);
          if (f) addOpt(f);
        }
      }
    }

    s.syncPopColors = function (ui, n) {
      const col = s.noteColor(n);
      const cols = ui.colors.querySelectorAll("button");
      for (let i = 0; i < cols.length; i++) {
        cols[i].classList.toggle("active", cols[i].getAttribute("data-color").toLowerCase() === col.toLowerCase());
      }
      s.colors.syncRow(ui.rgb, col);
    }

    s.symbolItemById = function (id) {
      if (!id) return null;
      for (let i = 0; i < s.symbolItems.length; i++) {
        if (s.symbolItems[i].id === id) return s.symbolItems[i];
      }
      return null;
    }

    s.itemsInTab = function (tab) {
      const out = [];
      for (let i = 0; i < s.symbolItems.length; i++) {
        if (s.symbolItems[i].tab === tab) out.push(s.symbolItems[i]);
      }
      return out;
    }

    s.addSymBtn = function (host, id, title) {
      if (!host) return;
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-symbol", id);
      b.title = title;
      if (id) {
        const img = document.createElement("img");
        img.src = "/symbols/" + id + ".png";
        img.alt = "";
        b.appendChild(img);
      } else {
        b.textContent = t("note.none");
      }
      host.appendChild(b);
    }

    s.fillSymTabs = function (host) {
      if (!host) return;
      host.innerHTML = "";
      for (let i = 0; i < s.SYM_TABS.length; i++) {
        const id = s.SYM_TABS[i];
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("data-tab", id);
        b.textContent = t("tab." + id);
        if (id === s.symTab) b.classList.add("active");
        host.appendChild(b);
      }
    }

    s.fillSymGrid = function (host) {
      if (!host) return;
      host.innerHTML = "";
      const items = s.itemsInTab(s.symTab);
      for (let i = 0; i < items.length; i++) {
        s.addSymBtn(host, items[i].id, symbolName(items[i].sym));
      }
    }

    s.syncSymSelection = function (host, cur) {
      if (!host) return;
      const btns = host.querySelectorAll("button[data-symbol]");
      for (let i = 0; i < btns.length; i++) {
        btns[i].classList.toggle("active", (btns[i].getAttribute("data-symbol") || "") === (cur || ""));
      }
    }

    s.refreshSymUi = function () {
      if (s.dockSymPanel) {
        s.fillSymTabs(s.dockSymPanel.querySelector(".sym-tabs"));
        s.fillSymGrid(s.dockSymPanel.querySelector(".sym-grid"));
        s.syncSymSelection(s.dockSymPanel.querySelector(".sym-grid"), s.pickSymbol);
      }
      Object.keys(s.openPops).forEach(function (nid) {
        const rec = s.openPops[nid];
        const n = s.findNote(nid);
        if (!rec || !n) return;
        s.syncPopSymbols(s.popEls(rec.el), n);
      });
    }

    s.setSymTab = function (tab) {
      if (s.SYM_TABS.indexOf(tab) < 0) return;
      s.symTab = tab;
      s.refreshSymUi();
    }

    s.setPickSymbol = function (id) {
      if (id && s.symbolIds.indexOf(id) < 0) return;
      s.pickSymbol = id || "";
      const item = s.symbolItemById(s.pickSymbol);
      if (item) s.symTab = item.tab;
      s.refreshSymUi();
    }

    s.syncPopSymbols = function (ui, n) {
      if (!ui.symPanel) return;
      const allow = s.noteUsesSymbol(n);
      ui.symPanel.hidden = !allow;
      if (!allow) return;
      if (ui.symNone) {
        ui.symNone.hidden = s.noteKind(n) === "stamp";
        ui.symNone.classList.toggle("active", !s.noteSymbol(n));
        ui.symNone.textContent = t("note.none");
      }
      const cur = s.noteSymbol(n);
      s.fillSymTabs(ui.symTabs);
      s.fillSymGrid(ui.syms);
      s.syncSymSelection(ui.syms, cur);
    }

    s.fillPop = function (el, n) {
      const ui = s.popEls(el);
      ui.xy.textContent = s.noteXyText(n);
      ui.title.value = n.title || "";
      ui.body.value = n.text || "";
      ui.scale.value = String(s.noteSizePx(n));
      ui.scaleNum.value = String(s.noteSizePx(n));
      s.syncPopColors(ui, n);
      s.fillPopFolderSelect(ui.folder, n);
      s.syncPopLayer(ui, n);
      const item = s.symbolItemById(s.noteSymbol(n));
      if (item) s.symTab = item.tab;
      s.syncPopSymbols(ui, n);
      s.syncPopCenter(ui, n);
    }

    s.syncPopLayer = function (ui, n) {
      if (!ui.layerUp || !ui.layerDown) return;
      const order = s.notesDrawOrder();
      let i = -1;
      for (let k = 0; k < order.length; k++) {
        if (order[k] === n) {
          i = k;
          break;
        }
      }
      ui.layerDown.disabled = i <= 0;
      ui.layerUp.disabled = i < 0 || i >= order.length - 1;
    }

    s.syncPopCenter = function (ui, n) {
      if (!ui.center) return;
      ui.center.hidden = !(s.noteKind(n) === "pin" && n.bldg);
    }

    s.refreshPopFolders = function () {
      Object.keys(s.openPops).forEach(function (id) {
        const n = s.findNote(id);
        const rec = s.openPops[id];
        if (!n || !rec) return;
        s.fillPopFolderSelect(s.popEls(rec.el).folder, n);
      });
    }

    s.updateOpenPopXy = function (id) {
      const rec = s.openPops[id];
      const n = s.findNote(id);
      if (!rec || !n) return;
      const ui = s.popEls(rec.el);
      ui.xy.textContent = s.noteXyText(n);
      s.syncPopCenter(ui, n);
    }

    s.defaultPopPos = function (offset) {
      const dock = document.getElementById("note-dock").getBoundingClientRect();
      const w = 300;
      const n = offset || 0;
      let left = dock.right - w - n * 24;
      let top = dock.bottom + 8 + n * 24;
      if (left < 232) left = 232;
      if (top < 16) top = 16;
      if (top > window.innerHeight - 120) top = 16 + n * 24;
      return { left: left, top: top };
    }

    s.raisePop = function (el) {
      s.popZ += 1;
      el.style.zIndex = String(s.popZ);
    }

    s.flushPop = function (id) {
      const rec = s.openPops[id];
      const n = s.findNote(id);
      if (!rec || !n) return;
      const ui = s.popEls(rec.el);
      if (ui.title) n.title = ui.title.value.trim();
      if (ui.body) n.text = ui.body.value.trim();
      if (ui.folder) n.folderId = ui.folder.value || DEFAULT_FOLDER_ID;
      s.persistNotes();
      s.renderFolders(s.searchEl.value);
    }

    s.closePop = function (id) {
      s.flushPop(id);
      const rec = s.openPops[id];
      if (!rec) return;
      rec.el.remove();
      delete s.openPops[id];
      s.drawNotes();
    }

    s.closeAllPops = function () {
      const ids = Object.keys(s.openPops);
      for (let i = 0; i < ids.length; i++) s.closePop(ids[i]);
    }

    s.closeTopPop = function () {
      const best = s.topPopId();
      if (best) s.closePop(best);
      return !!best;
    }

    s.topPopId = function () {
      let best = "";
      let z = -1;
      Object.keys(s.openPops).forEach(function (id) {
        const zz = Number(s.openPops[id].el.style.zIndex) || 0;
        if (zz >= z) {
          z = zz;
          best = id;
        }
      });
      return best;
    }

    s.bindPop = function (el) {
      const ui = s.popEls(el);
      el.addEventListener("mousedown", function () {
        s.raisePop(el);
      });
      ui.head.addEventListener("pointerdown", function (e) {
        if (e.button !== 0) return;
        if (e.target.closest("button")) return;
        e.preventDefault();
        s.raisePop(el);
        el.classList.add("dragging");
        const r = el.getBoundingClientRect();
        const dx = e.clientX - r.left;
        const dy = e.clientY - r.top;
        function move(ev) {
          el.style.left = ev.clientX - dx + "px";
          el.style.top = ev.clientY - dy + "px";
        }
        function up() {
          el.classList.remove("dragging");
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
        }
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      });
      ui.close.addEventListener("click", function () {
        s.closePop(s.popNoteId(el));
      });
      ui.colors.addEventListener("click", function (e) {
        const btn = e.target.closest("button[data-color]");
        const n = s.findNote(s.popNoteId(el));
        if (!btn || !n) return;
        n.color = btn.getAttribute("data-color");
        s.refreshNotesUi();
        s.syncPopColors(ui, n);
      });
      s.colors.bindRow(ui.rgb, function (hex) {
        const n = s.findNote(s.popNoteId(el));
        if (!n || !parseHexColor(hex)) return;
        n.color = hex.toLowerCase();
        s.refreshNotesUi();
        s.syncPopColors(ui, n);
      });
      if (ui.symTabs) {
        ui.symTabs.addEventListener("click", function (e) {
          const btn = e.target.closest("button[data-tab]");
          if (!btn) return;
          s.setSymTab(btn.getAttribute("data-tab"));
        });
      }
      if (ui.symNone) {
        ui.symNone.addEventListener("click", function () {
          const n = s.findNote(s.popNoteId(el));
          if (!n || !s.noteUsesSymbol(n) || s.noteKind(n) === "stamp") return;
          n.symbol = "";
          s.pickSymbol = "";
          s.refreshNotesUi();
          s.syncPopSymbols(ui, n);
        });
      }
      if (ui.syms) {
        ui.syms.addEventListener("click", function (e) {
          const btn = e.target.closest("button[data-symbol]");
          const n = s.findNote(s.popNoteId(el));
          if (!btn || !n || !s.noteUsesSymbol(n)) return;
          const id = btn.getAttribute("data-symbol") || "";
          n.symbol = id;
          if (id) s.setPickSymbol(id);
          else s.pickSymbol = "";
          s.refreshNotesUi();
          s.syncPopSymbols(ui, n);
        });
      }
      function setPopSize(px) {
        const n = s.findNote(s.popNoteId(el));
        if (!n) return;
        s.applyNoteSize(n, px);
        ui.scale.value = String(s.noteSizePx(n));
        ui.scaleNum.value = String(s.noteSizePx(n));
        s.refreshNotesUi();
      }
      ui.scale.addEventListener("input", function () {
        setPopSize(ui.scale.value);
      });
      ui.scaleNum.addEventListener("change", function () {
        setPopSize(ui.scaleNum.value);
      });
      ui.folder.addEventListener("change", function () {
        const n = s.findNote(s.popNoteId(el));
        if (!n) return;
        n.folderId = ui.folder.value || DEFAULT_FOLDER_ID;
        s.refreshNotesUi();
      });
      if (ui.layerUp) {
        ui.layerUp.addEventListener("click", function () {
          const n = s.findNote(s.popNoteId(el));
          if (!n) return;
          s.moveNoteLayer(n, 1);
          s.syncPopLayer(ui, n);
        });
      }
      if (ui.layerDown) {
        ui.layerDown.addEventListener("click", function () {
          const n = s.findNote(s.popNoteId(el));
          if (!n) return;
          s.moveNoteLayer(n, -1);
          s.syncPopLayer(ui, n);
        });
      }
      if (ui.center) {
        ui.center.addEventListener("click", function () {
          const n = s.findNote(s.popNoteId(el));
          if (!n || !s.centerPinOnBuilding(n)) return;
          s.refreshNotesUi();
          ui.xy.textContent = s.noteXyText(n);
        });
      }
      ui.title.addEventListener("input", function () {
        const n = s.findNote(s.popNoteId(el));
        if (!n) return;
        n.title = ui.title.value;
        s.drawNotes();
        s.renderFolders(s.searchEl.value);
      });
      ui.body.addEventListener("input", function () {
        const n = s.findNote(s.popNoteId(el));
        if (!n) return;
        n.text = ui.body.value;
      });
      ui.del.addEventListener("click", function () {
        s.deleteNoteById(s.popNoteId(el));
      });
    }

    s.openNote = function (id, focusTitle) {
      const n = s.findNote(id);
      if (!n) return;
      let rec = s.openPops[id];
      if (rec) {
        s.fillPop(rec.el, n);
        s.raisePop(rec.el);
        if (focusTitle) s.focusPopTitle(rec.el);
        return;
      }
      const el = s.notePopTpl.content.firstElementChild.cloneNode(true);
      el.setAttribute("data-note-id", id);
      applyI18nDom(el);
      const pos = s.defaultPopPos(Object.keys(s.openPops).length);
      el.style.left = pos.left + "px";
      el.style.top = pos.top + "px";
      s.bindPop(el);
      s.notePopsEl.appendChild(el);
      s.openPops[id] = { el: el };
      s.fillPop(el, n);
      s.raisePop(el);
      if (focusTitle) s.focusPopTitle(el);
      s.drawNotes();
    }

    s.focusPopTitle = function (el) {
      const input = el.querySelector(".note-title");
      if (!input) return;
      setTimeout(function () {
        input.focus();
      }, 0);
    }

    s.ingestSymbols = function (raw) {
      s.symbolIds.length = 0;
      s.symbolItems.length = 0;
      let items = [];
      if (Array.isArray(raw)) {
        for (let i = 0; i < raw.length; i++) {
          if (typeof raw[i] !== "string") continue;
          items.push({ id: raw[i], sym: raw[i].replace(/^map_/, ""), tab: "Symbols" });
        }
      } else if (raw && Array.isArray(raw.items)) {
        items = raw.items;
      }
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const id = it && it.id;
        if (!id || typeof id !== "string") continue;
        const tab = it.tab && s.SYM_TABS.indexOf(it.tab) >= 0 ? it.tab : "Symbols";
        const sym = it.sym || id.replace(/^map_/, "");
        s.symbolItems.push({ id: id, sym: sym, tab: tab });
        s.symbolIds.push(id);
        const img = new Image();
        img.onload = function () {
          if (s.notesReady) s.drawNotes();
        };
        img.src = "/symbols/" + id + ".png";
        s.symbolImgs[id] = img;
      }
      if (!s.pickSymbol && s.symbolItems.length) s.pickSymbol = s.symbolItems[0].id;
      s.refreshSymUi();
    }

    s.onLang = function () {
      applyI18nDom(s.notePopTpl.content);
      s.refreshSymUi();
      s.renderFolders(s.searchEl.value);
      s.syncNoteDock();
      s.syncNoteTownLabel();
      Object.keys(s.openPops).forEach(function (id) {
        const rec = s.openPops[id];
        const n = s.findNote(id);
        if (!rec || !n) return;
        applyI18nDom(rec.el);
        s.fillPop(rec.el, n);
      });
    }

    s.noteXyText = function (n) {
      const k = s.noteKind(n);
      if (k === "rect") {
        return Math.round(n.x) + "," + Math.round(n.y) + " → " + Math.round(n.x2) + "," + Math.round(n.y2);
      }
      if (k === "circle") {
        return "x " + Math.round(n.x) + ", y " + Math.round(n.y) + " · r " + Math.round(n.r);
      }
      if (k === "arrow") {
        return Math.round(n.x) + "," + Math.round(n.y) + " → " + Math.round(n.x2) + "," + Math.round(n.y2);
      }
      if (k === "brush") {
        return t("kind.brushXy", { n: (n.pts && n.pts.length) || 0 });
      }
      return "x " + Math.round(n.x) + ", y " + Math.round(n.y);
    }
}
