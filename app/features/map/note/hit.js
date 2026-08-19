import { POLY, BLDG_MIN_Z, NOTE_MIN_Z } from "../../../shared/const.js";
import { polyRings, pointInRings, ringCentroid } from "../geom.js";
import { noteFont, t } from "../i18n.js";

export function attachHit(s) {
    s.noteRings = function (n) {
      if (!n || !n.bldg) return null;
      const list = ((s.data.features || {})[n.bldg.layer] || {})[n.bldg.cell];
      if (!list || n.bldg.i < 0 || n.bldg.i >= list.length) return null;
      return polyRings(list[n.bldg.i]);
    }

    s.bldgScreenBox = function (n) {
      const rings = s.noteRings(n);
      if (!rings || !rings[0] || rings[0].length < 6) return null;
      let minx = Infinity;
      let miny = Infinity;
      let maxx = -Infinity;
      let maxy = -Infinity;
      const pts = rings[0];
      for (let j = 0; j < pts.length; j += 2) {
        const p = s.toPt(pts[j], pts[j + 1]);
        if (p.x < minx) minx = p.x;
        if (p.x > maxx) maxx = p.x;
        if (p.y < miny) miny = p.y;
        if (p.y > maxy) maxy = p.y;
      }
      return { w: maxx - minx, h: maxy - miny };
    }

    s.hitBuildingAt = function (wx, wy) {
      if (s.map.getZoom() < BLDG_MIN_Z) return null;
      const cx = Math.floor(wx / 300);
      const cy = Math.floor(wy / 300);
      const feats = s.data.features || {};
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const key = (cx + dx) + "," + (cy + dy);
          for (let p = 0; p < POLY.length; p++) {
            const id = POLY[p].id;
            if (id.indexOf("building-") !== 0) continue;
            const list = (feats[id] || {})[key];
            if (!list) continue;
            for (let i = 0; i < list.length; i++) {
              const rings = polyRings(list[i]);
              if (!pointInRings(wx, wy, rings)) continue;
              const c = ringCentroid(rings[0]);
              return { layer: id, cell: key, i: i, rings: rings, x: c.x, y: c.y };
            }
          }
        }
      }
      return null;
    }

    s.bindPinToBuilding = function (n) {
      if (!n || s.noteKind(n) !== "pin") {
        if (n && n.bldg) delete n.bldg;
        return;
      }
      const hit = s.hitBuildingAt(n.x, n.y);
      if (hit) n.bldg = { layer: hit.layer, cell: hit.cell, i: hit.i };
      else if (n.bldg) delete n.bldg;
    }

    s.centerPinOnBuilding = function (n) {
      if (!n || s.noteKind(n) !== "pin" || !n.bldg) return false;
      const rings = s.noteRings(n);
      if (!rings || !rings[0] || rings[0].length < 6) return false;
      const c = ringCentroid(rings[0]);
      n.x = c.x;
      n.y = c.y;
      return true;
    }

    s.findNoteByBldg = function (layer, cell, i) {
      const order = s.notesDrawOrder();
      for (let k = order.length - 1; k >= 0; k--) {
        const n = order[k];
        if (!n.bldg) continue;
        if (n.bldg.layer === layer && n.bldg.cell === cell && n.bldg.i === i) return n;
      }
      return null;
    }

    s.hitNote = function (e) {
      if (!s.layerNotesEl.checked) return null;
      if (s.map.getZoom() < NOTE_MIN_Z) return null;
      const pt = e.containerPoint;
      const wx = e.latlng.lng;
      const wy = e.latlng.lat;
      const order = s.notesDrawOrder();
      for (let i = order.length - 1; i >= 0; i--) {
        const n = order[i];
        const k = s.noteKind(n);
        if (k === "building") {
          const rings = s.noteRings(n);
          if (rings && pointInRings(wx, wy, rings)) return n;
          if (s.hitCaption(pt, n)) return n;
          continue;
        }
        if (k === "rect") {
          if (s.hitRectHandle(pt, n)) return n;
        } else if (k === "circle") {
          if (s.hitCircleHandle(pt, n)) return n;
        } else if (k === "arrow") {
          if (s.hitArrowHandle(pt, n)) return n;
        } else if (k === "brush") {
          const pts = n.pts;
          if (!pts || pts.length < 2) continue;
          const lim = (s.brushPx(n) / 2 + 4);
          const lim2 = lim * lim;
          let prev = s.toPt(pts[0][0], pts[0][1]);
          for (let j = 1; j < pts.length; j++) {
            const cur = s.toPt(pts[j][0], pts[j][1]);
            if (s.distToSeg2(pt.x, pt.y, prev.x, prev.y, cur.x, cur.y) <= lim2) return n;
            prev = cur;
          }
        } else if (k === "text") {
          const a = s.noteTitleAlphaFor(n);
          if (a >= 0.2) {
            const p = s.toPt(n.x, n.y);
            const px = s.textPx(n);
            const label = n.title || t("kind.text");
            s.noteCtx.font = noteFont(px);
            const w = Math.max(24, s.noteCtx.measureText(label).width / 2 + 4);
            const h = px / 2 + 4;
            if (Math.abs(pt.x - p.x) <= w && Math.abs(pt.y - p.y) <= h) return n;
          }
          const p = s.toPt(n.x, n.y);
          const r = s.notePx(n) / 2 + 2;
          if (s.dist2(pt.x, pt.y, p.x, p.y) <= r * r) return n;
        } else if (k === "stamp") {
          const p = s.toPt(n.x, n.y);
          const r = s.stampPx(n) / 2 + 2;
          if (Math.abs(pt.x - p.x) <= r && Math.abs(pt.y - p.y) <= r) return n;
        } else {
          const p = s.toPt(n.x, n.y);
          const r = s.notePx(n) / 2 + 2;
          if (s.noteSymbol(n)) {
            if (Math.abs(pt.x - p.x) <= r && Math.abs(pt.y - p.y) <= r) return n;
          } else if (s.dist2(pt.x, pt.y, p.x, p.y) <= r * r) return n;
        }
        if (k !== "text" && s.hitCaption(pt, n)) return n;
      }
      return null;
    }
}
