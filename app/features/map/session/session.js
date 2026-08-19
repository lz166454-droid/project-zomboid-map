import {
  MIN_LABEL_PX, STREET_FILL, LAYER, POLY, MAP_LEGEND, MAX_ZOOM,
  LANG_KEY, PANEL_KEY,
} from "../../../shared/const.js";
import { polyRings, evalFill, claimBox, rotatedAabb } from "../geom.js";
import { splitBr, i18nIndex, i18nGet, mapFont, initI18n, setLang, t, applyI18nDom } from "../i18n.js";
import { pathLen, splitAllStreets, drawStreetLabel, hitStreet } from "../streets.js";
import { worldScaleAt, PyramidLayer } from "../pyramid.js";
import { installNotes } from "../note/notes.js";
import { installTowns } from "./towns.js";
import { installSidebarResize, syncPanelSplit } from "./sidebar.js";

const viewH = { px: Math.max(1, document.getElementById("map").clientHeight) };
const coordsEl = document.getElementById("coords");
const townsEl = document.getElementById("towns");
const searchEl = document.getElementById("search");
const langEl = document.getElementById("lang");
const layerStreets = document.getElementById("layer-streets");
const forestCache = {};

export class MapSession {
  constructor(app) {
    this.app = app;
  }

  start(data, mapLabelObj, streetZhObj, i18nPacks) {
    const colors = this.app.colors;
    const ui = this.app.ui;
    const showToast = function (text) { ui.toast(text); };
    const openModal = function (opts) { return ui.openModal(opts); };

    const mapLabel = i18nIndex(mapLabelObj);
    const streetZh = i18nIndex(streetZhObj);
    let lang = "zh";
    try {
      lang = localStorage.getItem(LANG_KEY) || "zh";
    } catch (err) {}
    if (lang !== "zh" && lang !== "en") lang = "zh";
    initI18n(
      i18nPacks && i18nPacks.uiZh,
      i18nPacks && i18nPacks.uiEn,
      i18nPacks && i18nPacks.symZh,
      i18nPacks && i18nPacks.symEn,
      lang
    );
    applyI18nDom(document);
    installSidebarResize();

    function townZh(t) {
      const compact = "MapLabel_" + String(t.name || "").replace(/[^A-Za-z0-9]/g, "");
      return i18nGet(mapLabel, t.raw) || i18nGet(mapLabel, compact) || t.nameZh || "";
    }

    function townLines(t) {
      const en = t.linesEn && t.linesEn.length ? t.linesEn : [t.name];
      if (lang === "en") return en;
      const zh = splitBr(townZh(t));
      return zh.length ? zh : en;
    }

    function streetLines(name) {
      if (lang === "en") return [name];
      return [i18nGet(streetZh, name) || name];
    }

    function syncLegendLang() {
      const labs = document.querySelectorAll("#map-legend .map-legend-label");
      for (let i = 0; i < MAP_LEGEND.length; i++) {
        if (!labs[i]) continue;
        labs[i].textContent = t("legend." + MAP_LEGEND[i].key);
      }
    }

    function mountLegend() {
      const host = document.getElementById("map-legend");
      const stack = map.getContainer().querySelector(".leaflet-top.leaflet-left");
      host.classList.add("leaflet-control");
      if (stack && host.parentNode !== stack) stack.appendChild(host);
      host.innerHTML = "";
      for (let i = 0; i < MAP_LEGEND.length; i++) {
        const item = MAP_LEGEND[i];
        const row = document.createElement("div");
        row.className = "map-legend-row";
        const sw = document.createElement("span");
        sw.className = "map-legend-swatch";
        sw.style.background = "rgb(" + item.r + "," + item.g + "," + item.b + ")";
        const lab = document.createElement("span");
        lab.className = "map-legend-label";
        row.appendChild(sw);
        row.appendChild(lab);
        host.appendChild(row);
      }
      syncLegendLang();
    }

    const streetSegs = splitAllStreets(data.streets);
    let hoverName = "";

    const meta = data.meta;
    const earth = meta.earth;
    const worldB = meta.worldBounds || [0, 0, 19800, 16085];
    const minX = worldB[0];
    const minY = worldB[1];
    const maxX = worldB[2];
    const maxY = worldB[3];
    const worldW = maxX - minX;
    const worldH = maxY - minY;

    function xy(wx, wy) {
      return L.latLng(wy, wx);
    }

    function baseZoom() {
      const size = { x: document.getElementById("map").clientWidth, y: viewH.px };
      const zFitH = Math.log2(earth / worldH);
      const zFitW = Math.log2((earth * size.x) / (worldW * size.y));
      let z = Math.min(zFitH, zFitW);
      z = Math.round(z * 2) / 2;
      return Math.max(12, z);
    }

    const crs = L.extend({}, L.CRS.Simple, {
      transformation: new L.Transformation(1, 0, 1, 0),
      scale: function (zoom) {
        return worldScaleAt(zoom, earth, viewH.px);
      },
      zoom: function (scale) {
        return Math.log2((scale * earth) / viewH.px);
      },
    });

    const minZ = baseZoom();
    const map = L.map("map", {
      crs: crs,
      minZoom: minZ,
      maxZoom: MAX_ZOOM,
      zoomSnap: 0,
      zoomDelta: 1,
      scrollWheelZoom: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
      fadeAnimation: false,
      attributionControl: false,
      zoomControl: true,
    });

    const bounds = L.latLngBounds(xy(minX, minY), xy(maxX, maxY));
    map.setMaxBounds(bounds.pad(0.04));
    map.fitBounds(bounds);
    if (map.getZoom() < minZ) map.setZoom(minZ);

    let dpr = Math.max(1, window.devicePixelRatio || 1);
    let targetZoom = map.getZoom();
    let displayZoom = targetZoom;
    let zoomAnchor = null;
    let zoomRaf = 0;
    let zoomLastMs = 0;
    let applyingZoom = false;

    function clampZ(z) {
      return Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), z));
    }

    const zoomPctEl = L.DomUtil.create("div", "leaflet-control zoom-pct");
    zoomPctEl.title = t("zoom.hint");
    const zoomBar = L.DomUtil.create("input", "zoom-pct-bar", zoomPctEl);
    zoomBar.type = "range";
    zoomBar.step = "0.05";
    const zoomPctNum = L.DomUtil.create("span", "zoom-pct-num", zoomPctEl);
    map.getContainer().querySelector(".leaflet-top.leaflet-left").appendChild(zoomPctEl);
    L.DomEvent.disableClickPropagation(zoomPctEl);
    L.DomEvent.disableScrollPropagation(zoomPctEl);
    let coordXy = null;

    function zoomScalePct() {
      return Math.round(Math.pow(2, map.getZoom() - map.getMinZoom()) * 100);
    }

    function zoomHudText() {
      return map.getZoom().toFixed(2) + " · " + zoomScalePct() + "%";
    }

    function syncZoomHud() {
      zoomBar.min = String(map.getMinZoom());
      zoomBar.max = String(map.getMaxZoom());
      if (document.activeElement !== zoomBar) zoomBar.value = String(map.getZoom());
      zoomPctNum.textContent = zoomScalePct() + "%";
      if (coordXy) {
        coordsEl.setAttribute("data-xy", coordXy.x + ", " + coordXy.y);
        coordsEl.textContent =
          "x " + coordXy.x + ", y " + coordXy.y +
          " · cell " + Math.floor(coordXy.x / 300) + "," + Math.floor(coordXy.y / 300) +
          " · zoom " + zoomHudText();
      } else {
        coordsEl.textContent = "x —, y — · zoom " + zoomHudText();
      }
    }

    function setZoomFromHud(z) {
      const next = clampZ(Number(z));
      if (!isFinite(next)) return;
      targetZoom = next;
      displayZoom = next;
      if (zoomRaf) {
        cancelAnimationFrame(zoomRaf);
        zoomRaf = 0;
      }
      zoomAnchor = null;
      map.setZoom(next, { animate: false });
      syncZoomHud();
    }

    zoomBar.addEventListener("input", function () {
      setZoomFromHud(zoomBar.value);
    });

    function applyDisplayZoom() {
      applyingZoom = true;
      if (zoomAnchor) {
        map.setZoomAround(L.point(zoomAnchor.uiX, zoomAnchor.uiY), displayZoom, { animate: false });
      } else {
        map.setZoom(displayZoom, { animate: false });
      }
      applyingZoom = false;
      syncZoomHud();
    }

    function tickZoom(now) {
      const dt = Math.min(48, now - zoomLastMs);
      zoomLastMs = now;
      const diff = Math.abs(targetZoom - displayZoom);
      if (diff < 0.0008) {
        displayZoom = targetZoom;
        applyDisplayZoom();
        zoomRaf = 0;
        zoomAnchor = null;
        return;
      }
      const speed = dt / 750;
      const factor = diff > 0.25 ? diff / 0.25 : 1;
      const step = speed * factor;
      if (displayZoom < targetZoom) displayZoom = Math.min(targetZoom, displayZoom + step);
      else displayZoom = Math.max(targetZoom, displayZoom - step);
      applyDisplayZoom();
      zoomRaf = requestAnimationFrame(tickZoom);
    }

    function startZoomAnim() {
      if (zoomRaf) return;
      zoomLastMs = performance.now();
      zoomRaf = requestAnimationFrame(tickZoom);
    }

    function zoomBy(delta, uiX, uiY) {
      targetZoom = clampZ(targetZoom + delta);
      if (uiX != null) zoomAnchor = { uiX: uiX, uiY: uiY };
      else {
        const size = map.getSize();
        zoomAnchor = { uiX: size.x / 2, uiY: size.y / 2 };
      }
      startZoomAnim();
    }

    map.zoomIn = function (delta) {
      const d = typeof delta === "number" && delta ? delta : map.options.zoomDelta;
      zoomBy(d);
      return map;
    };
    map.zoomOut = function (delta) {
      const d = typeof delta === "number" && delta ? delta : map.options.zoomDelta;
      zoomBy(-d);
      return map;
    };

    map.getContainer().addEventListener("wheel", function (e) {
      e.preventDefault();
      let notches = e.deltaY;
      if (e.deltaMode === 0) notches = e.deltaY / 100;
      else if (e.deltaMode === 2) notches = e.deltaY * 3;
      const pt = map.mouseEventToContainerPoint(e);
      zoomBy(-notches * 0.5, pt.x, pt.y);
    }, { passive: false });

    const origSetView = map.setView.bind(map);
    map.setView = function (center, zoom, options) {
      if (!applyingZoom && zoom != null && isFinite(zoom)) {
        targetZoom = zoom;
        displayZoom = zoom;
        if (zoomRaf) {
          cancelAnimationFrame(zoomRaf);
          zoomRaf = 0;
        }
        zoomAnchor = null;
      }
      return origSetView(center, zoom, options);
    };

    function ensurePane(name, z, clickable) {
      if (!map.getPane(name)) map.createPane(name);
      const pane = map.getPane(name);
      pane.style.zIndex = String(z);
      pane.style.pointerEvents = clickable ? "auto" : "none";
      return pane;
    }
    ensurePane("vectors", 410, false);
    ensurePane("paper", 430, false);
    ensurePane("labels", 450, false);
    ensurePane("notes", 650, false);

    new PyramidLayer(meta).addTo(map);

    const paper = L.DomUtil.create("div", "paper-overlay");
    paper.style.backgroundImage = "url(/paper.png)";
    map.getPane("paper").appendChild(paper);

    const vecCanvas = L.DomUtil.create("canvas", "vector-canvas");
    const txtCanvas = L.DomUtil.create("canvas", "street-name-canvas");
    const noteCanvas = L.DomUtil.create("canvas", "note-canvas");
    map.getPane("vectors").appendChild(vecCanvas);
    map.getPane("labels").appendChild(txtCanvas);
    map.getPane("notes").appendChild(noteCanvas);
    const vecCtx = vecCanvas.getContext("2d");
    const txtCtx = txtCanvas.getContext("2d");
    const noteCtx = noteCanvas.getContext("2d");
    let notesApi = null;

    function pinOverlay(el, size) {
      L.DomUtil.setPosition(el, map.containerPointToLayerPoint([0, 0]));
      el.style.width = size.x + "px";
      el.style.height = size.y + "px";
    }

    function sizeCanvas(canvas, ctx, size) {
      const w = Math.round(size.x * dpr);
      const h = Math.round(size.y * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, w, h);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function visibleCellKeys(extra) {
      const b = map.getBounds();
      const pad = extra || 0;
      const cx0 = Math.floor((b.getWest() - pad) / 300);
      const cy0 = Math.floor((b.getSouth() - pad) / 300);
      const cx1 = Math.floor((b.getEast() + pad) / 300);
      const cy1 = Math.floor((b.getNorth() + pad) / 300);
      return { cx0: cx0, cy0: cy0, cx1: cx1, cy1: cy1 };
    }

    function fillPolys(ctx, cellMap, fill) {
      if (!cellMap || fill.a < 8) return;
      const box = visibleCellKeys(80);
      ctx.fillStyle = "rgba(" + Math.round(fill.r) + "," + Math.round(fill.g) + "," + Math.round(fill.b) + "," + fill.a / 255 + ")";
      for (let cy = box.cy0; cy <= box.cy1; cy++) {
        for (let cx = box.cx0; cx <= box.cx1; cx++) {
          const list = cellMap[cx + "," + cy];
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const rings = polyRings(list[i]);
            ctx.beginPath();
            for (let r = 0; r < rings.length; r++) {
              const pts = rings[r];
              for (let j = 0; j < pts.length; j += 2) {
                const p = map.latLngToContainerPoint(xy(pts[j], pts[j + 1]));
                if (j === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
              }
              ctx.closePath();
            }
            ctx.fill("evenodd");
          }
        }
      }
    }

    function fetchForest(box) {
      const key = box.cx0 + ":" + box.cy0 + ":" + box.cx1 + ":" + box.cy1;
      if (forestCache._last === key) return;
      forestCache._last = key;
      fetch("/api/forest.json?cx0=" + box.cx0 + "&cy0=" + box.cy0 + "&cx1=" + box.cx1 + "&cy1=" + box.cy1)
        .then(function (r) {
          return r.json();
        })
        .then(function (cells) {
          Object.assign(forestCache, cells);
          drawAll();
        })
        .catch(function () {});
    }

    function drawVectors() {
      const size = map.getSize();
      pinOverlay(vecCanvas, size);
      pinOverlay(paper, size);
      sizeCanvas(vecCanvas, vecCtx, size);
      const zf = map.getZoom();
      const feats = data.features || {};
      if (zf >= 14.9) {
        const box = visibleCellKeys(150);
        fetchForest(box);
        fillPolys(vecCtx, forestCache, evalFill(POLY[0].fills, zf));
      }
      for (let i = 1; i < POLY.length; i++) {
        const spec = POLY[i];
        if (zf < spec.minZ) continue;
        fillPolys(vecCtx, feats[spec.id], evalFill(spec.fills, zf));
      }
      paper.style.opacity = zf >= 15 ? "0.125" : zf > 14 ? String((zf - 14) * 0.125) : "0";
      if (hoverName && layerStreets.checked) {
        const streetFill = evalFill(STREET_FILL, zf);
        if (streetFill.a >= 8) {
          const ws = worldScaleAt(zf, earth, viewH.px);
          const list = streetsInView(40);
          vecCtx.save();
          vecCtx.strokeStyle = "rgba(255, 210, 74, 0.9)";
          vecCtx.lineJoin = "round";
          vecCtx.lineCap = "round";
          for (let i = 0; i < list.length; i++) {
            if (list[i].n !== hoverName) continue;
            const pts = list[i].pts;
            if (pts.length < 2) continue;
            vecCtx.lineWidth = Math.max(5, (list[i].w || 8) * ws + 3);
            vecCtx.beginPath();
            vecCtx.moveTo(pts[0].x, pts[0].y);
            for (let j = 1; j < pts.length; j++) vecCtx.lineTo(pts[j].x, pts[j].y);
            vecCtx.stroke();
          }
          vecCtx.restore();
        }
      }
    }

    function streetsInView(pad) {
      const size = map.getSize();
      const out = [];
      for (let i = 0; i < streetSegs.length; i++) {
        const s = streetSegs[i];
        let visible = false;
        const pts = [];
        for (let j = 0; j < s.p.length; j++) {
          const pt = map.latLngToContainerPoint(xy(s.p[j][0], s.p[j][1]));
          pts.push(pt);
          if (pt.x >= -pad && pt.y >= -pad && pt.x <= size.x + pad && pt.y <= size.y + pad) {
            visible = true;
          }
        }
        if (visible) out.push({ n: s.n, w: s.w, pts: pts, len: pathLen(pts) });
      }
      out.sort(function (a, b) {
        return b.len - a.len;
      });
      return out;
    }

    function drawLabels() {
      const size = map.getSize();
      pinOverlay(txtCanvas, size);
      sizeCanvas(txtCanvas, txtCtx, size);
      const zf = map.getZoom();
      const ws = worldScaleAt(zf, earth, viewH.px);
      const occupied = [];
      txtCtx.textAlign = "center";
      txtCtx.textBaseline = "middle";
      txtCtx.lineJoin = "round";
      txtCtx.lineCap = "round";
      for (let i = 0; i < data.labels.length; i++) {
        const t = data.labels[i];
        const layer = LAYER[t.kind] || LAYER["text-place"];
        const fill = evalFill(layer.fills, zf);
        const heightPx = (t.applyZoom ? ws : 1) * t.scale * layer.lineH;
        if (zf < t.minZ || zf > t.maxZ || fill.a < 8 || heightPx < MIN_LABEL_PX) continue;
        const pt = map.latLngToContainerPoint(xy(t.x, t.y));
        if (pt.x < -80 || pt.y < -80 || pt.x > size.x + 80 || pt.y > size.y + 80) continue;
        const lines = townLines(t);
        const rot = ((t.rot || 0) * Math.PI) / 180;
        txtCtx.font = mapFont(heightPx);
        let maxW = 0;
        for (let li = 0; li < lines.length; li++) {
          maxW = Math.max(maxW, txtCtx.measureText(lines[li]).width);
        }
        const lh = heightPx * 1.05;
        if (!claimBox(occupied, rotatedAabb(pt.x, pt.y, maxW + 4, lines.length * lh, rot))) continue;
        const light = fill.r + fill.g + fill.b > 500;
        txtCtx.save();
        txtCtx.translate(pt.x, pt.y);
        txtCtx.rotate(rot);
        txtCtx.fillStyle = "rgba(" + Math.round(fill.r) + "," + Math.round(fill.g) + "," + Math.round(fill.b) + "," + fill.a / 255 + ")";
        if (light) {
          txtCtx.lineWidth = Math.max(1, heightPx * 0.08);
          txtCtx.strokeStyle = "rgba(0,0,0,0.75)";
        }
        const y0 = -((lines.length - 1) * lh) / 2;
        for (let li = 0; li < lines.length; li++) {
          if (light) txtCtx.strokeText(lines[li], 0, y0 + li * lh);
          txtCtx.fillText(lines[li], 0, y0 + li * lh);
        }
        txtCtx.restore();
      }
      const streetFill = evalFill(STREET_FILL, zf);
      if (layerStreets.checked && streetFill.a >= 8) {
        const gameFont = Math.max(1.9804999828338623, Math.min(3.6600000858306885, ws)) * 48 * 0.2;
        txtCtx.fillStyle = "rgba(255,255,255," + streetFill.a / 255 + ")";
        txtCtx.strokeStyle = "rgba(0,0,0,0.9)";
        const list = streetsInView(80);
        const strokeEn = lang === "en";
        const placed = [];
        for (let i = 0; i < list.length; i++) {
          const roadPx = (list[i].w || 8) * ws;
          const fontPx = roadPx > gameFont ? Math.min(gameFont, roadPx * 0.78) : gameFont;
          txtCtx.font = mapFont(fontPx);
          txtCtx.lineWidth = Math.max(1, fontPx * 0.05);
          drawStreetLabel(txtCtx, list[i].pts, streetLines(list[i].n), fontPx, occupied, strokeEn, placed);
        }
      }
    }

    function drawAll() {
      drawVectors();
      drawLabels();
      if (notesApi) notesApi.drawNotes();
    }

    function onResize() {
      dpr = Math.max(1, window.devicePixelRatio || 1);
      viewH.px = Math.max(1, map.getSize().y);
      const nextMin = baseZoom();
      map.setMinZoom(nextMin);
      if (map.getZoom() < nextMin) map.setZoom(nextMin);
      map.invalidateSize();
      syncZoomHud();
      drawAll();
    }

    map.on("move zoom viewreset resize", drawAll);
    map.on("resize", onResize);
    map.whenReady(function () {
      syncZoomHud();
      drawAll();
    });

    colors.attach({
      map: function () { return map; },
      canvases: function () { return { vec: vecCanvas, txt: txtCanvas, note: noteCanvas }; },
      canEnableDrag: function () { return notesApi ? notesApi.canEnableDrag() : true; },
    });
    let panelState = {};
    try {
      const raw = JSON.parse(localStorage.getItem(PANEL_KEY) || "{}");
      if (raw && typeof raw === "object") panelState = raw;
    } catch (err) {}
    const towns = installTowns({
      data: data,
      map: map,
      xy: xy,
      searchEl: searchEl,
      townsEl: townsEl,
      townLines: townLines,
      townZh: townZh,
      streetLines: streetLines,
      streetZh: streetZh,
      getNotesApi: function () { return notesApi; },
      getPanelState: function () { return panelState; },
    });
    notesApi = installNotes({
      map: map,
      data: data,
      earth: earth,
      colors: colors,
      ui: ui,
      showToast: showToast,
      openModal: openModal,
      xy: xy,
      viewH: viewH,
      pinOverlay: pinOverlay,
      sizeCanvas: sizeCanvas,
      noteCanvas: noteCanvas,
      noteCtx: noteCtx,
      searchEl: searchEl,
      coordsEl: coordsEl,
      zoomHudText: zoomHudText,
      setCoordXy: function (v) { coordXy = v; },
      drawAll: drawAll,
      onTownChange: function (raw) {
        towns.setSelectedTown(raw);
        towns.renderList(searchEl.value);
      },
    });

    function setStreetHover(name) {
      const next = name || "";
      if (next === hoverName) return;
      hoverName = next;
      map.getContainer().classList.toggle("street-hover", !!hoverName);
      drawAll();
    }

    map.on("mousemove", function (e) {
      if (!layerStreets.checked || colors.picking || (notesApi && !notesApi.canEnableDrag())) {
        setStreetHover("");
        return;
      }
      const zf = map.getZoom();
      if (evalFill(STREET_FILL, zf).a < 8) {
        setStreetHover("");
        return;
      }
      const hit = hitStreet(streetSegs, e.latlng.lng, e.latlng.lat);
      setStreetHover(hit ? hit.n : "");
    });
    map.on("mouseout", function () {
      setStreetHover("");
    });

    function syncLangButtons() {
      const buttons = langEl.querySelectorAll("button");
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle("active", buttons[i].getAttribute("data-lang") === lang);
      }
    }

    langEl.addEventListener("click", function (e) {
      const btn = e.target.closest("button[data-lang]");
      if (!btn) return;
      lang = btn.getAttribute("data-lang");
      try {
        localStorage.setItem(LANG_KEY, lang);
      } catch (err) {}
      setLang(lang);
      applyI18nDom(document);
      zoomPctEl.title = t("zoom.hint");
      colors.onLang();
      if (notesApi && notesApi.onLang) notesApi.onLang();
      syncLangButtons();
      syncLegendLang();
      drawAll();
      towns.renderList(searchEl.value);
    });
    syncLangButtons();
    mountLegend();

    searchEl.addEventListener("input", function () {
      towns.renderList(searchEl.value);
      notesApi.renderFolders(searchEl.value);
    });
    coordsEl.addEventListener("click", function () {
      const t = coordsEl.getAttribute("data-xy");
      if (!t) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t);
      }
    });
    const panelBtns = document.querySelectorAll(".panel-head [data-panel]");
    const panelInited = {};
    for (let i = 0; i < panelBtns.length; i++) {
      const btn = panelBtns[i];
      const id = btn.getAttribute("data-panel");
      const panel = document.getElementById("panel-" + id);
      if (!panelInited[id]) {
        panelInited[id] = true;
        if (panel && panelState[id] === false) panel.classList.add("collapsed");
      }
      btn.addEventListener("click", function () {
        const open = panelState[id] !== false;
        panelState[id] = !open;
        if (panel) panel.classList.toggle("collapsed", open);
        try {
          localStorage.setItem(PANEL_KEY, JSON.stringify(panelState));
        } catch (err) {}
        syncPanelSplit();
      });
    }
    syncPanelSplit();
    colors.syncDock();
    towns.renderList("");
  }
}
