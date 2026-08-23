import { TILE, FOREST_TINT } from "../../shared/const.js";
import { evalFill } from "./geom.js";

export function worldScaleAt(zoomF, earth, viewPx) {
  return Math.pow(2, zoomF) * viewPx / earth;
}

export function pyramidLevel(zoomF, resolution, minZ, maxZ) {
  const adjusted = zoomF + Math.log2(2 * resolution);
  let z = 4;
  if (adjusted >= 16) z = 0;
  else if (adjusted >= 15) z = 1;
  else if (adjusted >= 14) z = 2;
  else if (adjusted >= 13) z = 3;
  return Math.max(minZ, Math.min(maxZ, z));
}

export function metersPerTile(level, resolution) {
  return TILE * resolution * Math.pow(2, level);
}

function tileKey(level, tx, ty) {
  return level + "/" + tx + "/" + ty;
}

export const PyramidLayer = L.Layer.extend({
  initialize: function (meta) {
    this.meta = meta;
    this._imgs = new Map();
    this._pending = false;
  },
  onAdd: function (map) {
    this._map = map;
    if (!map.getPane("pyramid")) {
      map.createPane("pyramid");
      map.getPane("pyramid").style.zIndex = 200;
    }
    this._el = L.DomUtil.create("div", "", map.getPane("pyramid"));
    this._el.style.position = "absolute";
    this._el.style.left = "0";
    this._el.style.top = "0";
    map.on("move zoom viewreset resize", this._update, this);
    this._update();
  },
  onRemove: function (map) {
    map.off("move zoom viewreset resize", this._update, this);
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    this._imgs.clear();
  },
  _scheduleUpdate: function () {
    if (this._pending) return;
    this._pending = true;
    const self = this;
    requestAnimationFrame(function () {
      self._pending = false;
      if (self._map) self._update();
    });
  },
  _ensureTile: function (level, tx, ty) {
    const key = tileKey(level, tx, ty);
    let rec = this._imgs.get(key);
    if (rec) return rec;
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.pointerEvents = "none";
    el.style.backgroundColor = FOREST_TINT;
    el.style.display = "none";
    el.style.zIndex = String(100 - level);
    const src = "/tiles/" + level + "/" + tx + "/" + ty + ".png";
    rec = { el: el, ready: false, missing: false, level: level, tx: tx, ty: ty, src: src };
    const probe = new Image();
    const self = this;
    probe.onload = function () {
      rec.ready = true;
      self._scheduleUpdate();
    };
    probe.onerror = function () {
      rec.missing = true;
      self._scheduleUpdate();
    };
    probe.src = src;
    this._el.appendChild(el);
    this._imgs.set(key, rec);
    return rec;
  },
  _layout: function (rec, minX, minY, resolution) {
    const mpt = metersPerTile(rec.level, resolution);
    const wx0 = minX + rec.tx * mpt;
    const wy0 = minY + rec.ty * mpt;
    const p0 = this._map.latLngToLayerPoint(L.latLng(wy0, wx0));
    const p1 = this._map.latLngToLayerPoint(L.latLng(wy0 + mpt, wx0 + mpt));
    rec.el.style.left = Math.min(p0.x, p1.x) + "px";
    rec.el.style.top = Math.min(p0.y, p1.y) + "px";
    rec.el.style.width = Math.abs(p1.x - p0.x) + "px";
    rec.el.style.height = Math.abs(p1.y - p0.y) + "px";
    return { w: Math.abs(p1.x - p0.x), h: Math.abs(p1.y - p0.y) };
  },
  _applyMask: function (el, src, scale, ox, oy, w, h) {
    const url = "url(" + src + ")";
    el.style.webkitMaskImage = url;
    el.style.maskImage = url;
    el.style.webkitMaskRepeat = "no-repeat";
    el.style.maskRepeat = "no-repeat";
    if (scale <= 1) {
      el.style.webkitMaskSize = "100% 100%";
      el.style.maskSize = "100% 100%";
      el.style.webkitMaskPosition = "0 0";
      el.style.maskPosition = "0 0";
      return;
    }
    const size = w * scale + "px " + h * scale + "px";
    const pos = (-ox * w) + "px " + (-oy * h) + "px";
    el.style.webkitMaskSize = size;
    el.style.maskSize = size;
    el.style.webkitMaskPosition = pos;
    el.style.maskPosition = pos;
  },
  _findReadyParent: function (level, tx, ty, keep) {
    const maxZ = this.meta.maxZ;
    let z = level;
    let x = tx;
    let y = ty;
    while (z < maxZ) {
      z += 1;
      x = x >> 1;
      y = y >> 1;
      const rec = this._ensureTile(z, x, y);
      if (keep) keep.add(tileKey(z, x, y));
      if (rec.ready) return rec;
    }
    return null;
  },
  _visibleRange: function (level, west, south, east, north) {
    const meta = this.meta;
    const mpt = metersPerTile(level, meta.resolution);
    const minX = meta.bounds[0];
    const minY = meta.bounds[1];
    const maxX = meta.bounds[2];
    const maxY = meta.bounds[3];
    const x0 = Math.max(0, Math.floor((west - minX) / mpt) - 1);
    const y0 = Math.max(0, Math.floor((south - minY) / mpt) - 1);
    const x1 = Math.floor((east - minX) / mpt) + 1;
    const y1 = Math.floor((north - minY) / mpt) + 1;
    const maxTx = Math.ceil((maxX - minX) / mpt);
    const maxTy = Math.ceil((maxY - minY) / mpt);
    return { x0: x0, y0: y0, x1: x1, y1: y1, maxTx: maxTx, maxTy: maxTy };
  },
  _update: function () {
    const map = this._map;
    const zf = map.getZoom();
    const forestFill = evalFill([{ z: 0, a: 255 }, { z: 14.999, a: 255 }, { z: 15, a: 0 }], zf);
    this._el.style.opacity = String(forestFill.a / 255);
    const meta = this.meta;
    const level = pyramidLevel(zf, meta.resolution, meta.minZ, meta.maxZ);
    const b = map.getBounds();
    const west = b.getWest();
    const south = b.getSouth();
    const east = b.getEast();
    const north = b.getNorth();
    const keep = new Set();
    const show = new Set();
    const minX = meta.bounds[0];
    const minY = meta.bounds[1];
    if (forestFill.a >= 8) {
      const range = this._visibleRange(level, west, south, east, north);
      for (let ty = range.y0; ty <= range.y1; ty++) {
        if (ty < 0 || ty >= range.maxTy) continue;
        for (let tx = range.x0; tx <= range.x1; tx++) {
          if (tx < 0 || tx >= range.maxTx) continue;
          const rec = this._ensureTile(level, tx, ty);
          keep.add(tileKey(level, tx, ty));
          const box = this._layout(rec, minX, minY, meta.resolution);
          if (rec.ready) {
            this._applyMask(rec.el, rec.src, 1, 0, 0, box.w, box.h);
            rec.el.style.display = "";
            show.add(tileKey(level, tx, ty));
            continue;
          }
          const parent = this._findReadyParent(level, tx, ty, keep);
          if (parent) {
            const dz = parent.level - rec.level;
            const scale = 1 << dz;
            const ox = rec.tx - (parent.tx << dz);
            const oy = rec.ty - (parent.ty << dz);
            this._applyMask(rec.el, parent.src, scale, ox, oy, box.w, box.h);
            rec.el.style.display = "";
            show.add(tileKey(level, tx, ty));
          } else {
            rec.el.style.display = "none";
          }
        }
      }
    }
    this._imgs.forEach(function (rec, key) {
      if (rec.level >= level || !rec.ready || forestFill.a < 8) return;
      const dz = level - rec.level;
      const tx = rec.tx >> dz;
      const ty = rec.ty >> dz;
      const target = this._imgs.get(tileKey(level, tx, ty));
      if (target && target.ready) return;
      keep.add(key);
      show.add(key);
      this._layout(rec, minX, minY, meta.resolution);
      this._applyMask(rec.el, rec.src, 1, 0, 0, 0, 0);
      rec.el.style.display = "";
    }, this);
    this._imgs.forEach(function (rec, key) {
      if (show.has(key)) return;
      rec.el.style.display = "none";
      if (keep.has(key)) return;
      if (rec.ready) {
        const mpt = metersPerTile(rec.level, meta.resolution);
        const wx0 = minX + rec.tx * mpt;
        const wy0 = minY + rec.ty * mpt;
        if (wx0 + mpt >= west && wx0 <= east && wy0 + mpt >= south && wy0 <= north) return;
      }
      if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
      this._imgs.delete(key);
    }, this);
  },
});
