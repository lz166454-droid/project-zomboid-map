import { PANEL_KEY, OTHER_TOWN } from "../../../shared/const.js";
import { i18nGet, t } from "../i18n.js";
import { syncPanelSplit } from "./sidebar.js";

export function installTowns(ctx) {
  const data = ctx.data;
  const map = ctx.map;
  const xy = ctx.xy;
  const searchEl = ctx.searchEl;
  const townsEl = ctx.townsEl;
  const townLines = ctx.townLines;
  const townZh = ctx.townZh;
  const streetLines = ctx.streetLines;
  const streetZh = ctx.streetZh;
  const getNotesApi = ctx.getNotesApi;
  const getPanelState = ctx.getPanelState;

  let selectedTownRaw = "";
  let selectedJumpRaw = "";
  const expandedTowns = {};

  const jumpItems = data.labels.filter(function (item) {
    return item.kind === "text-town" || item.kind === "text-place" || item.kind === "text-building";
  });
  const townList = [];
  const placeList = [];
  for (let i = 0; i < jumpItems.length; i++) {
    if (jumpItems[i].kind === "text-town") townList.push(jumpItems[i]);
    else placeList.push(jumpItems[i]);
  }
  const kidsByTown = {};
  for (let i = 0; i < placeList.length; i++) {
    const item = placeList[i];
    let best = null;
    let bestD = Infinity;
    for (let j = 0; j < townList.length; j++) {
      const tw = townList[j];
      const dx = item.x - tw.x;
      const dy = item.y - tw.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = tw;
      }
    }
    if (!best) continue;
    const key = best.raw || best.name;
    if (!kidsByTown[key]) kidsByTown[key] = [];
    kidsByTown[key].push(item);
  }

  function streetMid(pts) {
    return pts[Math.floor(pts.length / 2)];
  }

  function labelHay(item) {
    return (item.name + " " + townZh(item)).toLowerCase();
  }

  function openNotesPanel() {
    const notesPanel = document.getElementById("panel-notes");
    if (notesPanel) {
      notesPanel.classList.remove("collapsed");
      const panelState = getPanelState();
      panelState.notes = true;
      try {
        localStorage.setItem(PANEL_KEY, JSON.stringify(panelState));
      } catch (err) {}
      syncPanelSplit();
    }
  }

  function openTownNotes(townLabel) {
    const notesApi = getNotesApi();
    if (!townLabel || !notesApi || !notesApi.enterTown) return;
    notesApi.enterTown(townLabel);
    openNotesPanel();
  }

  function openOtherNotes() {
    const notesApi = getNotesApi();
    if (!notesApi || !notesApi.enterOther) return;
    notesApi.enterOther();
    openNotesPanel();
  }

  function clearTownNotes() {
    const notesApi = getNotesApi();
    if (!notesApi || !notesApi.clearTown) return;
    notesApi.clearTown();
  }

  function bindNoteDrop(el, onDrop) {
    el.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      el.classList.add("drop-over");
    });
    el.addEventListener("dragleave", function (e) {
      if (!el.contains(e.relatedTarget)) el.classList.remove("drop-over");
    });
    el.addEventListener("drop", function (e) {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove("drop-over");
      onDrop(e.dataTransfer.getData("text/plain"));
    });
  }

  function renderList(q) {
    const query = (q || "").trim().toLowerCase();
    townsEl.innerHTML = "";
    for (let i = 0; i < townList.length; i++) {
      const town = townList[i];
      const key = town.raw || town.name;
      const kids = kidsByTown[key] || [];
      const townHit = !query || labelHay(town).indexOf(query) >= 0;
      const shownKids = [];
      for (let k = 0; k < kids.length; k++) {
        if (townHit || !query || labelHay(kids[k]).indexOf(query) >= 0) shownKids.push(kids[k]);
      }
      if (query && !townHit && !shownKids.length) continue;
      const expanded = query ? shownKids.length > 0 : !!expandedTowns[key];
      const block = document.createElement("div");
      block.className = "town-block";
      const row = document.createElement("div");
      row.className = "twist-row town-row";
      if (expanded) row.classList.add("expanded");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "town-main";
      btn.textContent = townLines(town).join(" ");
      if (key === selectedTownRaw) btn.classList.add("selected");
      btn.addEventListener("click", function () {
        if (key === selectedTownRaw) {
          selectedJumpRaw = "";
          clearTownNotes();
          renderList(searchEl.value);
          return;
        }
        selectedJumpRaw = "";
        expandedTowns[key] = true;
        map.setView(xy(town.x, town.y), Math.max(map.getZoom(), 15));
        openTownNotes(town);
      });
      bindNoteDrop(btn, function (raw) {
        const notesApi = getNotesApi();
        if (!notesApi || !notesApi.moveNotesToTown) return;
        notesApi.moveNotesToTown(raw, town);
      });
      row.appendChild(btn);
      if (kids.length) {
        const caret = document.createElement("button");
        caret.type = "button";
        caret.className = "twist-caret";
        caret.title = expanded ? t("panel.collapse") : t("panel.expand");
        caret.addEventListener("click", function (ev) {
          ev.stopPropagation();
          expandedTowns[key] = !expanded;
          renderList(searchEl.value);
        });
        row.appendChild(caret);
      }
      block.appendChild(row);
      if (expanded && shownKids.length) {
        const list = document.createElement("div");
        list.className = "town-kids";
        for (let k = 0; k < shownKids.length; k++) {
          const item = shownKids[k];
          const child = document.createElement("button");
          child.type = "button";
          child.className = "town-place";
          child.textContent = townLines(item).join(" ");
          if ((item.raw || item.name) === selectedJumpRaw) child.classList.add("selected");
          child.addEventListener("click", function () {
            selectedJumpRaw = item.raw || item.name;
            expandedTowns[key] = true;
            map.setView(xy(item.x, item.y), Math.max(map.getZoom(), 16));
            openTownNotes(town);
          });
          bindNoteDrop(child, function (raw) {
            const notesApi = getNotesApi();
            if (!notesApi || !notesApi.moveNotesToTown) return;
            notesApi.moveNotesToTown(raw, town);
          });
          list.appendChild(child);
        }
        block.appendChild(list);
      }
      townsEl.appendChild(block);
    }
    if (!query || t("town.other").toLowerCase().indexOf(query) >= 0) {
      const other = document.createElement("button");
      other.type = "button";
      other.className = "town-main town-other";
      other.textContent = t("town.other");
      if (selectedTownRaw === OTHER_TOWN) other.classList.add("selected");
      other.addEventListener("click", function () {
        selectedJumpRaw = "";
        if (selectedTownRaw === OTHER_TOWN) {
          clearTownNotes();
          renderList(searchEl.value);
          return;
        }
        openOtherNotes();
      });
      bindNoteDrop(other, function (raw) {
        const notesApi = getNotesApi();
        if (!notesApi || !notesApi.moveNotesToOther) return;
        notesApi.moveNotesToOther(raw);
      });
      townsEl.appendChild(other);
    }
    if (query) {
      const best = {};
      for (let i = 0; i < data.streets.length; i++) {
        const s = data.streets[i];
        const zh = i18nGet(streetZh, s.n);
        const hay = (s.n + " " + zh).toLowerCase();
        if (hay.indexOf(query) < 0) continue;
        const prev = best[s.n];
        if (!prev || s.p.length > prev.p.length) best[s.n] = s;
      }
      Object.keys(best).forEach(function (name) {
        const s = best[name];
        const lines = streetLines(s.n);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "town-place";
        btn.textContent = lines.join(" ");
        btn.addEventListener("click", function () {
          const mid = streetMid(s.p);
          map.setView(xy(mid[0], mid[1]), Math.max(map.getZoom(), 16));
        });
        townsEl.appendChild(btn);
      });
    }
  }

  return {
    renderList: renderList,
    setSelectedTown: function (raw) {
      selectedTownRaw = raw || "";
    },
  };
}
