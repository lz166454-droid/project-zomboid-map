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

export const PyramidLayer = L.Layer.extend({
  initialize: function (meta) {
    this.meta = meta;
    this._imgs = new Map();
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
  _update: function () {
    const map = this._map;
    const zf = map.getZoom();
    const forestFill = evalFill([{ z: 0, a: 255 }, { z: 14.999, a: 255 }, { z: 15, a: 0 }], zf);
    this._el.style.opacity = String(forestFill.a / 255);
    this._el.style.display = forestFill.a < 8 ? "none" : "";
    if (forestFill.a < 8) return;
    const meta = this.meta;
    const level = pyramidLevel(zf, meta.resolution, meta.minZ, meta.maxZ);
    const mpt = metersPerTile(level, meta.resolution);
    const minX = meta.bounds[0];
    const minY = meta.bounds[1];
    const maxX = meta.bounds[2];
    const maxY = meta.bounds[3];
    const b = map.getBounds();
    const x0 = Math.max(0, Math.floor((b.getWest() - minX) / mpt) - 1);
    const y0 = Math.max(0, Math.floor((b.getSouth() - minY) / mpt) - 1);
    const x1 = Math.floor((b.getEast() - minX) / mpt) + 1;
    const y1 = Math.floor((b.getNorth() - minY) / mpt) + 1;
    const maxTx = Math.ceil((maxX - minX) / mpt);
    const maxTy = Math.ceil((maxY - minY) / mpt);
    const keep = new Set();
    for (let ty = y0; ty <= y1; ty++) {
      if (ty < 0 || ty >= maxTy) continue;
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || tx >= maxTx) continue;
        const key = level + "/" + tx + "/" + ty;
        keep.add(key);
        let el = this._imgs.get(key);
        if (!el) {
          el = document.createElement("div");
          el.style.position = "absolute";
          el.style.pointerEvents = "none";
          el.style.backgroundColor = FOREST_TINT;
          el.style.display = "none";
          const src = "/tiles/" + level + "/" + tx + "/" + ty + ".png";
          const probe = new Image();
          probe.onload = function () {
            const url = "url(" + src + ")";
            el.style.webkitMaskImage = url;
            el.style.maskImage = url;
            el.style.webkitMaskRepeat = "no-repeat";
            el.style.maskRepeat = "no-repeat";
            el.style.webkitMaskSize = "100% 100%";
            el.style.maskSize = "100% 100%";
            el.style.display = "";
          };
          probe.onerror = function () {
            el.style.display = "none";
          };
          probe.src = src;
          this._el.appendChild(el);
          this._imgs.set(key, el);
        }
        const wx0 = minX + tx * mpt;
        const wy0 = minY + ty * mpt;
        const p0 = map.latLngToLayerPoint(L.latLng(wy0, wx0));
        const p1 = map.latLngToLayerPoint(L.latLng(wy0 + mpt, wx0 + mpt));
        el.style.left = Math.min(p0.x, p1.x) + "px";
        el.style.top = Math.min(p0.y, p1.y) + "px";
        el.style.width = Math.abs(p1.x - p0.x) + "px";
        el.style.height = Math.abs(p1.y - p0.y) + "px";
      }
    }
    this._imgs.forEach(function (el, key) {
      if (keep.has(key)) return;
      if (el.parentNode) el.parentNode.removeChild(el);
      this._imgs.delete(key);
    }, this);
  },
});
