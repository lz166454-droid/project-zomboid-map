import { DEFAULT_FOLDER_ID, OTHER_TOWN } from "../../../shared/const.js";
import { townFolderId, buildingsFolderId, guideFolderId } from "./store.js";
import { t, getLang } from "../i18n.js";

export function attachFolder(s) {
    s.folderDisplayName = function (f) {
      if (!f) return t("folder.default");
      if (f.id === DEFAULT_FOLDER_ID) return t("folder.default");
      if (f.kind === "buildings") return t("folder.buildings");
      if (f.kind === "guide") return t("folder.guide");
      if (f.kind === "town") return s.townDisplayName(f.town, f.name);
      return f.name;
    }

    s.folderPathName = function (f) {
      if (!f) return t("folder.default");
      if (f.id === DEFAULT_FOLDER_ID || !f.parentId) return s.folderDisplayName(f);
      const p = s.findFolder(f.parentId);
      if (!p) return s.folderDisplayName(f);
      return s.folderPathName(p) + " / " + s.folderDisplayName(f);
    }

    s.findFolder = function (id) {
      for (let i = 0; i < s.store.folders.length; i++) {
        if (s.store.folders[i].id === id) return s.store.folders[i];
      }
      return null;
    }

    s.townLabels = function () {
      const out = [];
      const labels = s.data.labels || [];
      for (let i = 0; i < labels.length; i++) {
        if (labels[i].kind === "text-town") out.push(labels[i]);
      }
      return out;
    }

    s.findLabelByRaw = function (raw) {
      const labels = s.data.labels || [];
      for (let i = 0; i < labels.length; i++) {
        if (labels[i].raw === raw || labels[i].name === raw) return labels[i];
      }
      return null;
    }

    s.townDisplayName = function (raw, fallback) {
      const lab = s.findLabelByRaw(raw);
      if (!lab) return fallback || raw || t("folder.default");
      if (getLang() === "en") return lab.name || fallback || raw;
      if (lab.nameZh) {
        const zh = String(lab.nameZh).replace(/<br>/gi, " ").replace(/\s+/g, " ").trim();
        if (zh) return zh;
      }
      if (lab.lines && lab.lines.length) return lab.lines.join(" ");
      return lab.name || fallback || raw;
    }

    s.ensureTownTree = function (raw, displayName) {
      if (!raw || raw === OTHER_TOWN) return null;
      const tid = townFolderId(raw);
      let town = s.findFolder(tid);
      if (!town) {
        town = {
          id: tid,
          name: displayName || s.townDisplayName(raw, raw),
          parentId: null,
          kind: "town",
          town: raw,
        };
        s.store.folders.push(town);
      } else {
        town.kind = "town";
        town.town = raw;
        town.parentId = null;
        if (displayName) town.name = displayName;
      }
      const bid = buildingsFolderId(raw);
      const b = s.findFolder(bid);
      if (!b) {
        s.store.folders.push({
          id: bid,
          name: t("folder.buildings"),
          parentId: tid,
          kind: "buildings",
          town: raw,
        });
      } else {
        b.parentId = tid;
        b.kind = "buildings";
        b.town = raw;
      }
      const gid = guideFolderId(raw);
      const g = s.findFolder(gid);
      if (!g) {
        s.store.folders.push({
          id: gid,
          name: t("folder.guide"),
          parentId: tid,
          kind: "guide",
          town: raw,
        });
      } else {
        g.parentId = tid;
        g.kind = "guide";
        g.town = raw;
      }
      return town;
    }

    s.townMatchNames = function (lab) {
      const out = [];
      function add(s) {
        const v = String(s || "").toLowerCase().replace(/<br>/g, "").replace(/\s+/g, "");
        if (v && out.indexOf(v) < 0) out.push(v);
      }
      add(lab.name);
      add(lab.nameZh);
      add(lab.raw);
      if (lab.lines) {
        for (let i = 0; i < lab.lines.length; i++) add(lab.lines[i]);
      }
      if (lab.linesEn) {
        for (let i = 0; i < lab.linesEn.length; i++) add(lab.linesEn[i]);
      }
      return out;
    }

    s.migrateNamedTownFolders = function (towns) {
      for (let i = 0; i < towns.length; i++) {
        const lab = towns[i];
        const raw = lab.raw || lab.name;
        if (!raw) continue;
        const names = s.townMatchNames(lab);
        const snapshot = s.store.folders.slice();
        let matched = false;
        for (let j = 0; j < snapshot.length; j++) {
          const f = snapshot[j];
          if (!f || f.id === DEFAULT_FOLDER_ID) continue;
          if (f.kind === "town" || f.kind === "buildings" || f.kind === "guide") continue;
          if (f.parentId) continue;
          const nm = String(f.name || "").toLowerCase().replace(/\s+/g, "");
          if (names.indexOf(nm) >= 0) matched = true;
        }
        if (!matched) continue;
        s.ensureTownTree(raw, lab.name);
        const bid = buildingsFolderId(raw);
        for (let j = 0; j < snapshot.length; j++) {
          const f = snapshot[j];
          if (!f || f.id === DEFAULT_FOLDER_ID) continue;
          if (f.kind === "town" || f.kind === "buildings" || f.kind === "guide") continue;
          if (f.parentId) continue;
          const nm = String(f.name || "").toLowerCase().replace(/\s+/g, "");
          if (names.indexOf(nm) < 0) continue;
          for (let k = 0; k < s.notes.length; k++) {
            if ((s.notes[k].folderId || DEFAULT_FOLDER_ID) === f.id) s.notes[k].folderId = bid;
          }
          const keep = [];
          for (let k = 0; k < s.store.folders.length; k++) {
            if (s.store.folders[k].id !== f.id) keep.push(s.store.folders[k]);
          }
          s.store.folders = keep;
        }
      }
    }

    s.seedTownFolders = function () {
      s.migrateNamedTownFolders(s.townLabels());
    }

    s.childFoldersOf = function (parentId) {
      const out = [];
      for (let i = 0; i < s.store.folders.length; i++) {
        const f = s.store.folders[i];
        if ((f.parentId || null) === parentId) out.push(f);
      }
      return out;
    }

    s.sortFolderKids = function (kids) {
      const rank = { buildings: 0, guide: 1 };
      const copy = kids.slice();
      copy.sort(function (a, b) {
        const ra = rank[a.kind] != null ? rank[a.kind] : 2;
        const rb = rank[b.kind] != null ? rank[b.kind] : 2;
        if (ra !== rb) return ra - rb;
        return 0;
      });
      return copy;
    }

    s.catalogFolderList = function () {
      const out = [];
      const seen = {};
      const def = s.findFolder(DEFAULT_FOLDER_ID);
      if (def) {
        out.push(def);
        seen[def.id] = true;
      }
      for (let i = 0; i < s.store.folders.length; i++) {
        const f = s.store.folders[i];
        if (seen[f.id]) continue;
        if (f.parentId) continue;
        out.push(f);
        seen[f.id] = true;
      }
      return out;
    }

    s.visibleFolderRoots = function () {
      if (!s.activeTownRaw) return [];
      if (s.activeTownRaw !== OTHER_TOWN) {
        const town = s.ensureTownTree(s.activeTownRaw);
        if (!town) return [];
        return s.sortFolderKids(s.childFoldersOf(town.id));
      }
      const out = [];
      for (let i = 0; i < s.store.folders.length; i++) {
        const f = s.store.folders[i];
        if (f.id === DEFAULT_FOLDER_ID) continue;
        if (f.parentId) continue;
        if (f.kind === "town") continue;
        out.push(f);
      }
      return out;
    }

    s.folderTownRaw = function (f) {
      if (!f) return "";
      if (f.town) return f.town;
      if (f.parentId) return s.folderTownRaw(s.findFolder(f.parentId));
      return "";
    }

    s.resolvePlaceFolder = function (id) {
      const f = s.findFolder(id);
      if (!f) return DEFAULT_FOLDER_ID;
      if (f.kind === "town") {
        s.ensureTownTree(f.town, f.name);
        return buildingsFolderId(f.town);
      }
      return f.id;
    }

    s.assignFolderForNewNote = function (n) {
      const sel = s.findFolder(s.selectedFolderId);
      const townRaw = (sel && s.folderTownRaw(sel)) || s.activeTownRaw;
      if (!townRaw || townRaw === OTHER_TOWN) return DEFAULT_FOLDER_ID;
      s.ensureTownTree(townRaw);
      if (sel && sel.kind === "user" && s.folderTownRaw(sel) === townRaw) return sel.id;
      if (n && n.bldg) return buildingsFolderId(townRaw);
      if (sel && (sel.kind === "guide" || sel.kind === "buildings") && s.folderTownRaw(sel) === townRaw) {
        return sel.id;
      }
      return n && n.bldg ? buildingsFolderId(townRaw) : guideFolderId(townRaw);
    }

    s.canDeleteFolder = function (f) {
      if (!f) return false;
      if (f.id === DEFAULT_FOLDER_ID) return false;
      if (f.kind === "town" || f.kind === "buildings" || f.kind === "guide") return false;
      return true;
    }

    s.fallbackFolderId = function (f) {
      if (f && f.town) {
        s.ensureTownTree(f.town);
        return buildingsFolderId(f.town);
      }
      return DEFAULT_FOLDER_ID;
    }

    s.newFolderParentId = function () {
      if (s.activeTownRaw && s.activeTownRaw !== OTHER_TOWN) {
        const town = s.ensureTownTree(s.activeTownRaw);
        return town ? town.id : null;
      }
      return null;
    }

    s.folderCount = function (id) {
      let n = 0;
      for (let i = 0; i < s.notes.length; i++) {
        if ((s.notes[i].folderId || DEFAULT_FOLDER_ID) === id) n++;
      }
      return n;
    }

    s.folderTreeCount = function (id) {
      let n = s.folderCount(id);
      const kids = s.childFoldersOf(id);
      for (let i = 0; i < kids.length; i++) n += s.folderTreeCount(kids[i].id);
      return n;
    }

    s.targetFolderId = function () {
      return s.assignFolderForNewNote(null);
    }

    s.selectFolder = function (id) {
      if (!s.findFolder(id)) id = DEFAULT_FOLDER_ID;
      s.selectedFolderId = id;
      const mains = s.foldersEl.querySelectorAll(".folder-main");
      for (let i = 0; i < mains.length; i++) {
        mains[i].classList.toggle("selected", mains[i].getAttribute("data-id") === id);
      }
      s.syncNoteDock();
    }

    s.parseDragNoteIds = function (raw) {
      if (!raw) return [];
      try {
        const v = JSON.parse(raw);
        if (Array.isArray(v)) {
          const out = [];
          for (let i = 0; i < v.length; i++) {
            if (v[i] && s.findNote(String(v[i]))) out.push(String(v[i]));
          }
          return out;
        }
      } catch (err) {}
      return s.findNote(raw) ? [raw] : [];
    }

    s.selectedNoteList = function () {
      const out = [];
      for (let i = 0; i < s.listedNoteIds.length; i++) {
        if (s.selectedNoteIds[s.listedNoteIds[i]]) out.push(s.listedNoteIds[i]);
      }
      return out;
    }

    s.applyNoteSelection = function () {
      const items = s.foldersEl.querySelectorAll(".folder-notes button");
      for (let i = 0; i < items.length; i++) {
        const id = items[i].getAttribute("data-note-id");
        items[i].classList.toggle("selected", !!s.selectedNoteIds[id]);
      }
    }

    s.rangeSelectNotes = function (toId) {
      const a = s.listedNoteIds.indexOf(s.lastPickNoteId);
      const b = s.listedNoteIds.indexOf(toId);
      if (a < 0 || b < 0) {
        s.selectedNoteIds[toId] = true;
        s.lastPickNoteId = toId;
        s.applyNoteSelection();
        return;
      }
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      s.selectedNoteIds = {};
      for (let i = lo; i <= hi; i++) s.selectedNoteIds[s.listedNoteIds[i]] = true;
      s.applyNoteSelection();
    }

    s.moveNotesToFolder = function (raw, folderId) {
      s.placeNotesInFolder(s.parseDragNoteIds(raw), folderId, null);
    }

    s.placeNoteInFolder = function (noteId, folderId, beforeId) {
      s.placeNotesInFolder([noteId], folderId, beforeId);
    }

    s.placeNotesInFolder = function (ids, folderId, beforeId) {
      const dest = folderId || DEFAULT_FOLDER_ID;
      const batch = [];
      const seen = {};
      for (let i = 0; i < ids.length; i++) {
        const n = s.findNote(ids[i]);
        if (!n || seen[n.id]) continue;
        seen[n.id] = true;
        batch.push(n);
      }
      if (!batch.length) return;
      let before = beforeId;
      if (before && seen[before]) before = null;
      const rest = [];
      for (let i = 0; i < s.notes.length; i++) {
        if (!seen[s.notes[i].id]) rest.push(s.notes[i]);
      }
      let fromOther = false;
      for (let i = 0; i < batch.length; i++) {
        const prev = batch[i].folderId || DEFAULT_FOLDER_ID;
        if (prev !== dest) fromOther = true;
        batch[i].folderId = dest;
      }
      let idx = rest.length;
      if (before) {
        for (let i = 0; i < rest.length; i++) {
          if (rest[i].id === before) {
            idx = i;
            break;
          }
        }
      } else {
        let last = -1;
        for (let i = 0; i < rest.length; i++) {
          if ((rest[i].folderId || DEFAULT_FOLDER_ID) === dest) last = i;
        }
        idx = last < 0 ? rest.length : last + 1;
      }
      const args = [idx, 0];
      for (let i = 0; i < batch.length; i++) args.push(batch[i]);
      rest.splice.apply(rest, args);
      s.notes = rest;
      s.expandedFolders[dest] = true;
      s.expandAncestors(dest);
      s.persistNotes();
      s.renderFolders(s.searchEl.value);
      s.syncNoteDock();
      s.refreshPopFolders();
      if (fromOther) {
        const f = s.findFolder(dest);
        if (batch.length === 1) {
          s.showToast(t("folder.moved", { note: s.noteLabel(batch[0]), folder: s.folderDisplayName(f) }));
        } else {
          s.showToast(t("folder.movedMany", { n: batch.length, folder: s.folderDisplayName(f) }));
        }
      }
    }

    s.clearNoteDropMarks = function () {
      const els = s.foldersEl.querySelectorAll(".drop-before, .drop-after");
      for (let i = 0; i < els.length; i++) els[i].classList.remove("drop-before", "drop-after");
    }

    s.bindFolderDrop = function (block, folderId) {
      block.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        if (!e.target.closest(".folder-notes button")) {
          s.clearNoteDropMarks();
          block.classList.add("drop-over");
        }
      });
      block.addEventListener("dragleave", function (e) {
        if (!block.contains(e.relatedTarget)) block.classList.remove("drop-over");
      });
      block.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
        block.classList.remove("drop-over");
        s.clearNoteDropMarks();
        if (e.target.closest(".folder-notes button")) return;
        s.moveNotesToFolder(e.dataTransfer.getData("text/plain"), folderId);
      });
    }

    s.syncNoteTownLabel = function () {
      const el = document.querySelector("#panel-notes > .panel-head .twist-label");
      if (!el) return;
      el.textContent = s.activeTownRaw === OTHER_TOWN
        ? t("town.other")
        : s.activeTownRaw
          ? s.townDisplayName(s.activeTownRaw, s.activeTownRaw)
          : t("panel.notes");
    }

    s.setActiveTown = function (raw) {
      s.activeTownRaw = raw || "";
      s.syncNoteTownLabel();
      if (s.onTownChange) s.onTownChange(s.activeTownRaw);
    }

    s.syncNoteDock = function () {
      if (!s.activeTownRaw || s.activeTownRaw === OTHER_TOWN) {
        s.noteTargetEl.textContent = t("folder.target", { name: t("folder.default") });
        return;
      }
      const f = s.findFolder(s.selectedFolderId) || s.findFolder(DEFAULT_FOLDER_ID);
      s.noteTargetEl.textContent = t("folder.target", { name: s.folderPathName(f) });
    }

    s.expandAncestors = function (id) {
      let cur = s.findFolder(id);
      while (cur && cur.parentId) {
        s.expandedFolders[cur.parentId] = true;
        cur = s.findFolder(cur.parentId);
      }
    }

    s.expandFolder = function (id) {
      const f = s.findFolder(id) || s.findFolder(DEFAULT_FOLDER_ID);
      const raw = s.folderTownRaw(f);
      if (raw) s.setActiveTown(raw);
      else s.setActiveTown(OTHER_TOWN);
      s.expandedFolders[f.id] = true;
      s.expandAncestors(f.id);
      s.selectedFolderId = f.id;
      s.renderFolders(s.searchEl.value);
      s.syncNoteDock();
    }

    s.enterTown = function (label) {
      if (!label) return;
      const raw = label.raw || label.name;
      const town = s.ensureTownTree(raw, label.name);
      if (!town) return;
      s.persistNotes();
      s.setActiveTown(raw);
      s.selectedFolderId = buildingsFolderId(raw);
      s.expandedFolders[s.selectedFolderId] = true;
      s.expandedFolders[guideFolderId(raw)] = true;
      s.renderFolders(s.searchEl.value);
      s.syncNoteDock();
    }

    s.enterOther = function () {
      s.setActiveTown(OTHER_TOWN);
      s.selectedFolderId = DEFAULT_FOLDER_ID;
      s.expandedFolders[DEFAULT_FOLDER_ID] = true;
      s.renderFolders(s.searchEl.value);
      s.syncNoteDock();
    }

    s.clearTown = function () {
      s.setActiveTown("");
      s.selectedFolderId = DEFAULT_FOLDER_ID;
      s.renderFolders(s.searchEl.value);
      s.syncNoteDock();
    }

    s.leaveTown = function () {
      s.enterOther();
    }

    s.moveNotesToTown = function (raw, townLabel) {
      const ids = s.parseDragNoteIds(raw);
      const name = townLabel && (townLabel.raw || townLabel.name);
      if (!ids.length || !name || name === OTHER_TOWN) return;
      if (!s.ensureTownTree(name, townLabel.name)) return;
      const bldgDest = buildingsFolderId(name);
      const guideDest = guideFolderId(name);
      const batch = [];
      for (let i = 0; i < ids.length; i++) {
        const n = s.findNote(ids[i]);
        if (!n) continue;
        n.folderId = n.bldg ? bldgDest : guideDest;
        batch.push(n);
      }
      if (!batch.length) return;
      s.expandedFolders[bldgDest] = true;
      s.expandedFolders[guideDest] = true;
      s.persistNotes();
      s.renderFolders(s.searchEl.value);
      s.syncNoteDock();
      s.refreshPopFolders();
      if (batch.length === 1) {
        const f = s.findFolder(batch[0].folderId);
        s.showToast(t("folder.moved", { note: s.noteLabel(batch[0]), folder: s.folderDisplayName(f) }));
      } else {
        s.showToast(t("folder.movedMany", { n: batch.length, folder: s.townDisplayName(name, name) }));
      }
    }

    s.folderNotes = function (id, query) {
      const out = [];
      for (let i = 0; i < s.notes.length; i++) {
        const n = s.notes[i];
        if ((n.folderId || DEFAULT_FOLDER_ID) !== id) continue;
        if (query) {
          const title = s.noteLabel(n);
          const a = s.noteAnchor(n);
          const hay = (title + " " + (n.text || "") + " " + a.x + "," + a.y).toLowerCase();
          if (hay.indexOf(query) < 0) continue;
        }
        out.push(n);
      }
      return out;
    }

    s.folderQueryHit = function (f, query) {
      if (!query) return true;
      if (f.kind === "buildings" || f.kind === "guide") return true;
      if (s.folderDisplayName(f).toLowerCase().indexOf(query) >= 0) return true;
      if (s.folderNotes(f.id, query).length) return true;
      const kids = s.childFoldersOf(f.id);
      for (let i = 0; i < kids.length; i++) {
        if (s.folderQueryHit(kids[i], query)) return true;
      }
      return false;
    }

    s.appendNoteButtons = function (list, f, kids) {
      for (let i = 0; i < kids.length; i++) {
        const n = kids[i];
        const title = s.noteLabel(n);
        const a = s.noteAnchor(n);
        const item = document.createElement("button");
        item.type = "button";
        item.draggable = true;
        item.setAttribute("data-note-id", n.id);
        item.classList.toggle("selected", !!s.selectedNoteIds[n.id]);
        item.textContent = title;
        item.title = t("folder.dragHint");
        s.listedNoteIds.push(n.id);
        item.addEventListener("click", function (e) {
          if (s.folderDragged) return;
          if (e.ctrlKey || e.metaKey) {
            if (s.selectedNoteIds[n.id]) delete s.selectedNoteIds[n.id];
            else s.selectedNoteIds[n.id] = true;
            s.lastPickNoteId = n.id;
            s.applyNoteSelection();
            return;
          }
          if (e.shiftKey && s.lastPickNoteId) {
            s.rangeSelectNotes(n.id);
            return;
          }
          s.selectedNoteIds = {};
          s.selectedNoteIds[n.id] = true;
          s.lastPickNoteId = n.id;
          s.applyNoteSelection();
          s.map.setView(s.xy(a.x, a.y), Math.max(s.map.getZoom(), 16));
          s.openNote(n.id);
        });
        item.addEventListener("dragstart", function (e) {
          s.folderDragged = true;
          if (!s.selectedNoteIds[n.id]) {
            s.selectedNoteIds = {};
            s.selectedNoteIds[n.id] = true;
            s.lastPickNoteId = n.id;
            s.applyNoteSelection();
          }
          const ids = s.selectedNoteList();
          e.dataTransfer.setData("text/plain", JSON.stringify(ids.length ? ids : [n.id]));
          e.dataTransfer.effectAllowed = "move";
          const dragging = s.foldersEl.querySelectorAll(".folder-notes button.selected");
          for (let d = 0; d < dragging.length; d++) dragging[d].classList.add("dragging");
          if (!item.classList.contains("dragging")) item.classList.add("dragging");
        });
        item.addEventListener("dragend", function () {
          const dragging = s.foldersEl.querySelectorAll(".folder-notes button.dragging");
          for (let d = 0; d < dragging.length; d++) dragging[d].classList.remove("dragging");
          s.clearNoteDropMarks();
          setTimeout(function () {
            s.folderDragged = false;
          }, 0);
        });
        item.addEventListener("dragover", function (e) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          const rect = item.getBoundingClientRect();
          const before = e.clientY < rect.top + rect.height / 2;
          s.clearNoteDropMarks();
          item.classList.add(before ? "drop-before" : "drop-after");
        });
        item.addEventListener("drop", function (e) {
          e.preventDefault();
          e.stopPropagation();
          const ids = s.parseDragNoteIds(e.dataTransfer.getData("text/plain"));
          const before = item.classList.contains("drop-before");
          s.clearNoteDropMarks();
          if (!ids.length) return;
          if (ids.length === 1 && ids[0] === n.id) return;
          if (before) s.placeNotesInFolder(ids, f.id, n.id);
          else {
            const next = item.nextElementSibling;
            const afterId = next ? next.getAttribute("data-note-id") : "";
            s.placeNotesInFolder(ids, f.id, afterId || null);
          }
        });
        list.appendChild(item);
      }
    }

    s.renderFolderTree = function (f, query, depth) {
      if (query && !s.folderQueryHit(f, query)) return null;
      const nameHit = !query || s.folderDisplayName(f).toLowerCase().indexOf(query) >= 0;
      const kids = s.folderNotes(f.id, nameHit ? "" : query);
      const childFs = s.sortFolderKids(s.childFoldersOf(f.id));
      const expanded = query ? true : !!s.expandedFolders[f.id];
      const block = document.createElement("div");
      block.className = "folder-block";
      if (depth) block.classList.add("nested");
      const row = document.createElement("div");
      row.className = "twist-row folder-row";
      if (expanded) row.classList.add("expanded");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "twist-label folder-main";
      btn.setAttribute("data-id", f.id);
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = s.folderDisplayName(f);
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = String(f.kind === "town" ? s.folderTreeCount(f.id) : s.folderCount(f.id));
      btn.classList.toggle("selected", f.id === s.selectedFolderId);
      btn.title = t("folder.pickHint");
      btn.appendChild(name);
      btn.appendChild(count);
      btn.addEventListener("click", function () {
        s.selectFolder(f.id);
      });
      btn.addEventListener("dblclick", function () {
        s.expandedFolders[f.id] = !s.expandedFolders[f.id];
        s.renderFolders(s.searchEl.value);
      });
      const caret = document.createElement("button");
      caret.type = "button";
      caret.className = "twist-caret";
      caret.title = expanded ? t("panel.collapse") : t("panel.expand");
      caret.addEventListener("click", function (ev) {
        ev.stopPropagation();
        s.expandedFolders[f.id] = !expanded;
        s.renderFolders(s.searchEl.value);
      });
      row.appendChild(btn);
      row.appendChild(caret);
      if (s.canDeleteFolder(f)) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "folder-del";
        del.title = t("folder.delete");
        del.textContent = "×";
        del.addEventListener("click", function (ev) {
          ev.stopPropagation();
          s.deleteFolder(f.id);
        });
        row.appendChild(del);
      }
      block.appendChild(row);
      s.bindFolderDrop(block, s.resolvePlaceFolder(f.id));
      if (expanded) {
        const wrap = document.createElement("div");
        wrap.className = "folder-kids";
        for (let i = 0; i < childFs.length; i++) {
          const childBlock = s.renderFolderTree(childFs[i], query, depth + 1);
          if (childBlock) wrap.appendChild(childBlock);
        }
        if (kids.length) {
          const list = document.createElement("div");
          list.className = "folder-notes";
          s.appendNoteButtons(list, f, kids);
          wrap.appendChild(list);
        }
        if (wrap.childNodes.length) block.appendChild(wrap);
      }
      return block;
    }

    s.renderFolders = function (q) {
      const query = (q || "").trim().toLowerCase();
      s.foldersEl.innerHTML = "";
      s.listedNoteIds = [];
      if (!s.activeTownRaw) {
        const empty = document.createElement("p");
        empty.className = "folder-empty";
        empty.textContent = t("folder.empty");
        s.foldersEl.appendChild(empty);
        return;
      }
      if (s.activeTownRaw === OTHER_TOWN) {
        const loose = s.folderNotes(DEFAULT_FOLDER_ID, query);
        if (loose.length) {
          const list = document.createElement("div");
          list.className = "folder-notes folder-loose";
          s.appendNoteButtons(list, s.findFolder(DEFAULT_FOLDER_ID), loose);
          s.bindFolderDrop(list, DEFAULT_FOLDER_ID);
          s.foldersEl.appendChild(list);
        }
      }
      const roots = s.visibleFolderRoots();
      for (let i = 0; i < roots.length; i++) {
        const block = s.renderFolderTree(roots[i], query, 0);
        if (block) s.foldersEl.appendChild(block);
      }
      if (!s.foldersEl.childNodes.length && !query) {
        const empty = document.createElement("p");
        empty.className = "folder-empty";
        empty.textContent = s.activeTownRaw === OTHER_TOWN ? t("folder.emptyOther") : t("folder.empty");
        s.foldersEl.appendChild(empty);
      }
    }

    s.renderNotePins = function () {
      s.drawNotes();
    }

    s.refreshNotesUi = function () {
      s.persistNotes();
      s.renderNotePins();
      s.renderFolders(s.searchEl.value);
    }

    s.deleteFolder = function (id) {
      const f = s.findFolder(id);
      if (!s.canDeleteFolder(f)) return;
      const n = s.folderCount(id);
      const destId = s.fallbackFolderId(f);
      const destName = s.folderDisplayName(s.findFolder(destId));
      const msg = n
        ? t("folder.deleteBodyNotesDest", { name: s.folderDisplayName(f), n: n, dest: destName })
        : t("folder.deleteBody", { name: s.folderDisplayName(f) });
      s.openModal({ title: t("folder.deleteTitle"), body: msg }).then(function (ok) {
        if (!ok) return;
        for (let i = 0; i < s.notes.length; i++) {
          if ((s.notes[i].folderId || DEFAULT_FOLDER_ID) === id) {
            s.notes[i].folderId = destId;
          }
        }
        const keep = [];
        for (let i = 0; i < s.store.folders.length; i++) {
          if (s.store.folders[i].id !== id) keep.push(s.store.folders[i]);
        }
        s.store.folders = keep;
        if (s.selectedFolderId === id) s.selectedFolderId = destId;
        delete s.expandedFolders[id];
        s.persistNotes();
        s.renderFolders(s.searchEl.value);
        s.syncNoteDock();
        s.refreshPopFolders();
        s.showToast(t("folder.deleted"));
      });
    }
}
