import {
  NOTE_TITLE_FILL, BLDG_TITLE_FILL, HANDLE_PAD, BLDG_MIN_Z, NOTE_MIN_Z,
} from "../../../shared/const.js";
import { defaultHex, parseHexColor, colorAlpha } from "../../../shared/color.js";
import { evalFill, bldgKey } from "../geom.js";
import { noteFont, t, symbolName } from "../i18n.js";
import { worldScaleAt } from "../pyramid.js";

export function attachDraw(s) {
    s.pathRings = function (ctx, rings) {
      ctx.beginPath();
      for (let r = 0; r < rings.length; r++) {
        const pts = rings[r];
        for (let j = 0; j < pts.length; j += 2) {
          const p = s.map.latLngToContainerPoint(s.xy(pts[j], pts[j + 1]));
          if (j === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
      }
    }

    s.drawBldgHover = function (ctx) {
      if (s.map.getZoom() < BLDG_MIN_Z) return;
      const b = s.pressBldg || s.hoverBldg;
      if (!b || !b.rings) return;
      s.pathRings(ctx, b.rings);
      const pressed = !!(s.pressBldg && s.hoverBldg && bldgKey(s.pressBldg) === bldgKey(s.hoverBldg));
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.fillStyle = pressed ? "rgba(255, 248, 220, 0.5)" : "rgba(255, 210, 74, 0.28)";
      ctx.fill("evenodd");
      ctx.strokeStyle = "#1a1810";
      ctx.lineWidth = pressed ? 6 : 5;
      ctx.stroke();
      ctx.strokeStyle = pressed ? "#ffffff" : "#ffd24a";
      ctx.lineWidth = pressed ? 2.5 : 2;
      ctx.stroke();
    }

    s.noteSizePx = function (n) {
      const sz = Number(n && n.size);
      if (sz >= 6 && sz <= 64) return Math.round(sz);
      const sc = Number(n && n.scale);
      if (sc >= 0.4) return Math.round(Math.max(6, Math.min(48, 12 * sc)));
      return 12;
    }

    s.noteScaleVal = function (n) {
      return Math.max(0.4, Math.min(4, s.noteSizePx(n) / 12));
    }

    s.applyNoteSize = function (n, px) {
      let v = Math.round(Number(px));
      if (!(v >= 6)) v = 6;
      if (v > 64) v = 64;
      n.size = v;
      n.scale = v / 12;
    }

    s.noteColor = function (n) {
      const c = n && n.color;
      if (c && /^#[0-9a-fA-F]{6}$/.test(c)) return c;
      return defaultHex();
    }

    s.noteZ = function (n) {
      const z = Number(n && n.z);
      return Number.isFinite(z) ? z : 0;
    }

    s.nextNoteZ = function () {
      let m = -1;
      for (let i = 0; i < s.notes.length; i++) {
        const z = s.noteZ(s.notes[i]);
        if (z > m) m = z;
      }
      return m + 1;
    }

    s.notesDrawOrder = function () {
      const idx = [];
      for (let i = 0; i < s.notes.length; i++) idx.push(i);
      idx.sort(function (a, b) {
        const d = s.noteZ(s.notes[a]) - s.noteZ(s.notes[b]);
        return d !== 0 ? d : a - b;
      });
      const out = [];
      for (let i = 0; i < idx.length; i++) out.push(s.notes[idx[i]]);
      return out;
    }

    s.moveNoteLayer = function (n, dir) {
      const order = s.notesDrawOrder();
      let i = -1;
      for (let k = 0; k < order.length; k++) {
        if (order[k] === n) {
          i = k;
          break;
        }
      }
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return;
      const other = order[j];
      const za = s.noteZ(n);
      const zb = s.noteZ(other);
      if (za === zb) n.z = za + dir;
      else {
        n.z = zb;
        other.z = za;
      }
      s.persistNotes();
      s.drawNotes();
      Object.keys(s.openPops).forEach(function (id) {
        const note = s.findNote(id);
        const rec = s.openPops[id];
        if (!note || !rec) return;
        s.syncPopLayer(s.popEls(rec.el), note);
      });
    }

    s.noteKind = function (n) {
      return (n && n.type) || "pin";
    }

    s.isDrawTool = function (tool) {
      return tool === "brush" || tool === "rect" || tool === "circle" || tool === "arrow";
    }

    s.noteUsesSymbol = function (n) {
      const k = s.noteKind(n);
      return k === "pin" || k === "building" || k === "rect" || k === "circle" || k === "arrow" || k === "stamp";
    }

    s.noteSymbol = function (n) {
      const id = (n && n.symbol) || "";
      if (!id) return "";
      return s.symbolIds.indexOf(id) >= 0 ? id : "";
    }

    s.noteLabel = function (n) {
      if (n && n.title) return n.title;
      const k = s.noteKind(n);
      if (k === "stamp") {
        const item = s.symbolItemById(s.noteSymbol(n));
        return item ? symbolName(item.sym) : t("kind.stamp");
      }
      if (k === "text") return t("kind.text");
      if (k === "rect") return t("kind.rect");
      if (k === "circle") return t("kind.circle");
      if (k === "arrow") return t("kind.arrow");
      if (k === "brush") return t("kind.brush");
      if (k === "building") return t("kind.building");
      return t("kind.note");
    }

    s.noteAnchor = function (n) {
      const k = s.noteKind(n);
      if (k === "rect" || k === "arrow") {
        return { x: (n.x + n.x2) / 2, y: (n.y + n.y2) / 2 };
      }
      if (k === "brush" && n.pts && n.pts.length) {
        return { x: n.pts[0][0], y: n.pts[0][1] };
      }
      return { x: n.x, y: n.y };
    }

    s.notePx = function (n) {
      return s.noteSizePx(n);
    }

    s.brushPx = function (n) {
      return Math.max(3, Math.min(16, 5 * s.noteScaleVal(n)));
    }

    s.streetFontPx = function () {
      const ws = worldScaleAt(s.map.getZoom(), s.earth, s.viewH.px);
      return Math.max(1.9804999828338623, Math.min(3.6600000858306885, ws)) * 48 * 0.2;
    }

    s.textPx = function (n) {
      return Math.max(16, Math.min(38, s.streetFontPx() * 1.12 * s.noteScaleVal(n)));
    }

    s.captionPx = function (n) {
      return Math.max(16, Math.min(36, s.streetFontPx() * 1.05 * s.noteScaleVal(n)));
    }

    s.noteTitleAlphaFor = function (n) {
      const zf = s.map.getZoom() + (s.noteScaleVal(n) - 1) * 0.8;
      const fills = s.noteKind(n) === "building" ? BLDG_TITLE_FILL : NOTE_TITLE_FILL;
      return evalFill(fills, zf).a / 255;
    }

    s.noteTitleText = function (n) {
      return ((n && n.title) || "").trim();
    }

    s.captionPos = function (n) {
      const k = s.noteKind(n);
      const anc = s.noteAnchor(n);
      const pt = s.toPt(anc.x, anc.y);
      if (k === "rect" || k === "arrow") {
        const p0 = s.toPt(n.x, n.y);
        const p1 = s.toPt(n.x2, n.y2);
        return { x: (p0.x + p1.x) / 2, y: Math.max(p0.y, p1.y) + 4, baseline: "top" };
      }
      if (k === "circle") {
        const edge = s.toPt(n.x + (n.r || 0), n.y);
        const pr = Math.abs(edge.x - pt.x);
        return { x: pt.x, y: pt.y + pr + 4, baseline: "top" };
      }
      if (k === "building") {
        return { x: pt.x, y: pt.y, baseline: "middle" };
      }
      if (k === "brush") {
        return { x: pt.x, y: pt.y + s.brushPx(n) / 2 + 4, baseline: "top" };
      }
      if (k === "stamp") {
        return { x: pt.x, y: pt.y + s.stampPx(n) / 2 + 4, baseline: "top" };
      }
      return { x: pt.x, y: pt.y + s.notePx(n) / 2 + 4, baseline: "top" };
    }

    s.noteOutlineColor = function (color) {
      const rgb = parseHexColor(color);
      const lum = rgb ? rgb.r * 0.3 + rgb.g * 0.5 + rgb.b * 0.2 : 128;
      return lum < 90 ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.82)";
    }

    s.noteLabelIcon = function (n, px, outlined) {
      if (s.noteKind(n) === "stamp") return null;
      const id = s.noteSymbol(n);
      const tint = id ? s.tintedSymbol(id, s.noteColor(n), outlined !== false) : null;
      if (!tint) return null;
      return { tint: tint, px: Math.max(10, px * 0.92), gap: 3 };
    }

    s.fillNoteLabel = function (ctx, n, label, px, pos, a) {
      ctx.font = noteFont(px);
      ctx.textAlign = "center";
      ctx.textBaseline = pos.baseline;
      const w = ctx.measureText(label).width;
      const chip = s.shapeHandlesOn(n);
      const icon = s.noteLabelIcon(n, px, !chip);
      const iconPx = icon ? icon.px : 0;
      const gap = icon ? icon.gap : 0;
      const padX = 5;
      const padY = 2;
      const bw = w + iconPx + gap + padX * 2;
      const bh = px * 1.15 + padY * 2;
      const x = pos.x - bw / 2;
      let y = pos.y - padY;
      if (pos.baseline === "bottom") y = pos.y - bh + padY;
      else if (pos.baseline === "middle") y = pos.y - bh / 2;
      ctx.globalAlpha = a;
      if (chip) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, 3);
        else ctx.rect(x, y, bw, bh);
        ctx.fill();
      }
      if (icon) {
        ctx.drawImage(icon.tint, x + padX, y + (bh - iconPx) / 2, iconPx, iconPx);
      }
      const tx = pos.x + (iconPx + gap) / 2;
      if (!chip) {
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(3, px * 0.22);
        ctx.strokeStyle = s.noteOutlineColor(s.noteColor(n));
        ctx.strokeText(label, tx, pos.y);
      }
      ctx.fillStyle = s.noteColor(n);
      ctx.fillText(label, tx, pos.y);
    }

    s.drawNoteCaption = function (ctx, n, size, a) {
      const label = s.noteTitleText(n);
      if (a < 0.03) return;
      if (!label && (s.noteKind(n) === "stamp" || !s.noteSymbol(n))) return;
      const pos = s.captionPos(n);
      const px = s.captionPx(n);
      if (pos.x < -80 || pos.y < -px || pos.x > size.x + 80 || pos.y > size.y + px) return;
      ctx.save();
      s.fillNoteLabel(ctx, n, label, px, pos, a);
      ctx.restore();
    }

    s.hitCaption = function (pt, n) {
      const label = s.noteTitleText(n);
      if (s.noteKind(n) === "stamp" && !label) return false;
      if ((!label && !s.noteSymbol(n)) || s.noteTitleAlphaFor(n) < 0.2) return false;
      const pos = s.captionPos(n);
      const px = s.captionPx(n);
      s.noteCtx.font = noteFont(px);
      const icon = s.noteLabelIcon(n, px);
      const extra = icon ? icon.px + icon.gap : 0;
      const w = s.noteCtx.measureText(label).width / 2 + extra / 2 + 4;
      const h = px + 4;
      if (Math.abs(pt.x - pos.x) > w) return false;
      if (pos.baseline === "bottom") return pt.y <= pos.y + 2 && pt.y >= pos.y - h;
      if (pos.baseline === "middle") return Math.abs(pt.y - pos.y) <= h / 2;
      return pt.y >= pos.y - 2 && pt.y <= pos.y + h;
    }

    s.snapshotNote = function (n) {
      const s = { x: n.x, y: n.y, x2: n.x2, y2: n.y2, r: n.r };
      if (n.pts) {
        s.pts = [];
        for (let i = 0; i < n.pts.length; i++) s.pts.push([n.pts[i][0], n.pts[i][1]]);
      }
      return s;
    }

    s.restoreNote = function (n, orig) {
      n.x = orig.x;
      n.y = orig.y;
      if (orig.x2 != null) n.x2 = orig.x2;
      if (orig.y2 != null) n.y2 = orig.y2;
      if (orig.r != null) n.r = orig.r;
      if (orig.pts) n.pts = orig.pts;
    }

    s.translateNote = function (n, orig, dx, dy) {
      n.x = orig.x + dx;
      n.y = orig.y + dy;
      if (orig.x2 != null) {
        n.x2 = orig.x2 + dx;
        n.y2 = orig.y2 + dy;
      }
      if (orig.pts) {
        n.pts = [];
        for (let i = 0; i < orig.pts.length; i++) {
          n.pts.push([orig.pts[i][0] + dx, orig.pts[i][1] + dy]);
        }
      }
    }

    s.worldOf = function (e) {
      return { x: e.latlng.lng, y: e.latlng.lat };
    }

    s.toPt = function (wx, wy) {
      return s.map.latLngToContainerPoint(s.xy(wx, wy));
    }

    s.screenBox = function (n) {
      const p0 = s.toPt(n.x, n.y);
      const p1 = s.toPt(n.x2, n.y2);
      return {
        x0: Math.min(p0.x, p1.x),
        y0: Math.min(p0.y, p1.y),
        x1: Math.max(p0.x, p1.x),
        y1: Math.max(p0.y, p1.y),
      };
    }

    s.handleFromAngle = function (dx, dy) {
      const i = Math.round((Math.atan2(dy, dx) + Math.PI * 2) / (Math.PI / 4)) % 8;
      return ["e", "se", "s", "sw", "w", "nw", "n", "ne"][i];
    }

    s.applyResize = function (n, orig, handle, e) {
      const k = s.noteKind(n);
      const w = s.worldOf(e);
      if (k === "circle") {
        const dx = w.x - orig.x;
        const dy = w.y - orig.y;
        n.r = Math.sqrt(dx * dx + dy * dy);
        return;
      }
      if (k === "arrow") {
        if (handle === "start") {
          n.x = w.x;
          n.y = w.y;
        } else if (handle === "end") {
          n.x2 = w.x;
          n.y2 = w.y;
        }
        return;
      }
      if (k !== "rect") return;
      const pt = e.containerPoint;
      const p0 = s.toPt(orig.x, orig.y);
      const p1 = s.toPt(orig.x2, orig.y2);
      let x0 = Math.min(p0.x, p1.x);
      let y0 = Math.min(p0.y, p1.y);
      let x1 = Math.max(p0.x, p1.x);
      let y1 = Math.max(p0.y, p1.y);
      if (handle.indexOf("w") >= 0) x0 = pt.x;
      if (handle.indexOf("e") >= 0) x1 = pt.x;
      if (handle.indexOf("n") >= 0) y0 = pt.y;
      if (handle.indexOf("s") >= 0) y1 = pt.y;
      const a = s.map.containerPointToLatLng([x0, y0]);
      const b = s.map.containerPointToLatLng([x1, y1]);
      n.x = a.lng;
      n.y = a.lat;
      n.x2 = b.lng;
      n.y2 = b.lat;
    }

    s.dist2 = function (ax, ay, bx, by) {
      const dx = ax - bx;
      const dy = ay - by;
      return dx * dx + dy * dy;
    }

    s.distToSeg2 = function (px, py, ax, ay, bx, by) {
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 < 1e-6 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      return s.dist2(px, py, ax + t * dx, ay + t * dy);
    }

    s.drawPin = function (ctx, n, size) {
      const pt = s.toPt(n.x, n.y);
      const r = s.notePx(n) / 2;
      if (pt.x < -r || pt.y < -r || pt.x > size.x + r || pt.y > size.y + r) return;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fillStyle = s.noteColor(n);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000000";
      ctx.stroke();
    }

    s.stampPx = function (n) {
      return Math.max(16, s.noteSizePx(n) * 1.4);
    }

    s.drawStamp = function (ctx, n, size) {
      const id = s.noteSymbol(n);
      const chip = s.shapeHandlesOn(n);
      const tint = id ? s.tintedSymbol(id, s.noteColor(n), !chip) : null;
      if (!tint) {
        s.drawPin(ctx, n, size);
        return;
      }
      const pt = s.toPt(n.x, n.y);
      const px = s.stampPx(n);
      const r = px / 2;
      const pad = 3;
      if (pt.x < -r - pad || pt.y < -r - pad || pt.x > size.x + r + pad || pt.y > size.y + r + pad) return;
      if (chip) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(pt.x - r - pad, pt.y - r - pad, px + pad * 2, px + pad * 2, 3);
        else ctx.rect(pt.x - r - pad, pt.y - r - pad, px + pad * 2, px + pad * 2);
        ctx.fill();
      }
      ctx.drawImage(tint, pt.x - r, pt.y - r, px, px);
    }

    s.symbolSilhouette = function (img, fill) {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = fill;
      g.fillRect(0, 0, c.width, c.height);
      return c;
    }

    s.tintedSymbol = function (id, color, outlined) {
      const img = s.symbolImgs[id];
      if (!img || !img.complete || !img.naturalWidth) return null;
      const outline = outlined ? s.noteOutlineColor(color) : "";
      const key = id + "|" + color + "|" + outline;
      if (s.symbolTint[key]) return s.symbolTint[key];
      const glyph = s.symbolSilhouette(img, color);
      if (!outlined) {
        s.symbolTint[key] = glyph;
        return glyph;
      }
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const pad = Math.max(2, Math.round(Math.min(w, h) * 0.06));
      const sil = s.symbolSilhouette(img, outline);
      const c = document.createElement("canvas");
      c.width = w + pad * 2;
      c.height = h + pad * 2;
      const g = c.getContext("2d");
      const r2 = pad * pad;
      for (let dy = -pad; dy <= pad; dy++) {
        for (let dx = -pad; dx <= pad; dx++) {
          if (!dx && !dy) continue;
          if (dx * dx + dy * dy > r2) continue;
          g.drawImage(sil, pad + dx, pad + dy);
        }
      }
      g.drawImage(glyph, pad, pad);
      s.symbolTint[key] = c;
      return c;
    }

    s.arrowNeckW = function (n) {
      return Math.max(10, Math.min(26, s.notePx(n) * 0.9));
    }

    s.arrowHeadW = function (n) {
      return s.arrowNeckW(n) * 2.35;
    }

    s.arrowHeadL = function (n, len) {
      return Math.min(Math.max(16, s.arrowNeckW(n) * 1.75), len * 0.38);
    }

    s.arrowPoly = function (n) {
      const p0 = s.toPt(n.x, n.y);
      const p1 = s.toPt(n.x2, n.y2);
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return null;
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;
      const nw = s.arrowNeckW(n) / 2;
      const hw = s.arrowHeadW(n) / 2;
      const hl = s.arrowHeadL(n, len);
      const bx = p1.x - ux * hl;
      const by = p1.y - uy * hl;
      return [
        [p0.x, p0.y],
        [bx + px * nw, by + py * nw],
        [bx + px * hw, by + py * hw],
        [p1.x, p1.y],
        [bx - px * hw, by - py * hw],
        [bx - px * nw, by - py * nw],
      ];
    }

    s.pointInPoly = function (px, py, pts) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const yi = pts[i][1];
        const yj = pts[j][1];
        if ((yi > py) === (yj > py)) continue;
        const xi = pts[i][0];
        const xj = pts[j][0];
        if (px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }

    s.drawArrow = function (ctx, n, size) {
      const poly = s.arrowPoly(n);
      if (!poly) return;
      let minx = Infinity;
      let miny = Infinity;
      let maxx = -Infinity;
      let maxy = -Infinity;
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        if (p[0] < minx) minx = p[0];
        if (p[1] < miny) miny = p[1];
        if (p[0] > maxx) maxx = p[0];
        if (p[1] > maxy) maxy = p[1];
        if (i) ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      if (maxx < 0 || maxy < 0 || minx > size.x || miny > size.y) return;
      const col = s.noteColor(n);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineJoin = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = s.noteOutlineColor(col);
      ctx.stroke();
    }

    s.drawBrush = function (ctx, n, size) {
      const pts = n.pts;
      if (!pts || pts.length < 2) return;
      ctx.beginPath();
      const p0 = s.toPt(pts[0][0], pts[0][1]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = s.toPt(pts[i][0], pts[i][1]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.lineWidth = s.brushPx(n);
      ctx.strokeStyle = s.noteColor(n);
      ctx.stroke();
    }

    s.drawRect = function (ctx, n, size) {
      const p0 = s.toPt(n.x, n.y);
      const p1 = s.toPt(n.x2, n.y2);
      const x = Math.min(p0.x, p1.x);
      const y = Math.min(p0.y, p1.y);
      const w = Math.abs(p1.x - p0.x);
      const h = Math.abs(p1.y - p0.y);
      if (x + w < 0 || y + h < 0 || x > size.x || y > size.y) return;
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.fillStyle = colorAlpha(s.noteColor(n), 0.32);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = s.noteColor(n);
      ctx.stroke();
    }

    s.drawCircle = function (ctx, n, size) {
      const c = s.toPt(n.x, n.y);
      const edge = s.toPt(n.x + (n.r || 0), n.y);
      const pr = Math.max(1, Math.abs(edge.x - c.x));
      if (c.x + pr < 0 || c.y + pr < 0 || c.x - pr > size.x || c.y - pr > size.y) return;
      ctx.beginPath();
      ctx.arc(c.x, c.y, pr, 0, Math.PI * 2);
      ctx.fillStyle = colorAlpha(s.noteColor(n), 0.32);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = s.noteColor(n);
      ctx.stroke();
    }

    s.shapeHandlesOn = function (n) {
      if (!n || n === s.draft) return false;
      if (s.moving && s.moving.n === n) return true;
      if (s.hoverNote === n) return true;
      if (n.id && s.openPops[n.id]) return true;
      if (s.hoverBldg && n.bldg && bldgKey(n.bldg) === bldgKey(s.hoverBldg)) return true;
      return false;
    }

    s.drawHandleBox = function (ctx, x, y) {
      const hx = Math.round(x) - 3;
      const hy = Math.round(y) - 3;
      ctx.fillStyle = "#f4f1e8";
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(hx, hy, 7, 7);
      ctx.fill();
      ctx.stroke();
    }

    s.drawRectHandles = function (ctx, n) {
      const b = s.screenBox(n);
      const mx = (b.x0 + b.x1) / 2;
      const my = (b.y0 + b.y1) / 2;
      s.drawHandleBox(ctx, b.x0, b.y0);
      s.drawHandleBox(ctx, mx, b.y0);
      s.drawHandleBox(ctx, b.x1, b.y0);
      s.drawHandleBox(ctx, b.x0, my);
      s.drawHandleBox(ctx, b.x1, my);
      s.drawHandleBox(ctx, b.x0, b.y1);
      s.drawHandleBox(ctx, mx, b.y1);
      s.drawHandleBox(ctx, b.x1, b.y1);
    }

    s.drawCircleHandles = function (ctx, n) {
      const c = s.toPt(n.x, n.y);
      const edge = s.toPt(n.x + (n.r || 0), n.y);
      const pr = Math.max(1, Math.abs(edge.x - c.x));
      s.drawHandleBox(ctx, c.x, c.y - pr);
      s.drawHandleBox(ctx, c.x + pr, c.y);
      s.drawHandleBox(ctx, c.x, c.y + pr);
      s.drawHandleBox(ctx, c.x - pr, c.y);
    }

    s.drawArrowHandles = function (ctx, n) {
      const p0 = s.toPt(n.x, n.y);
      const p1 = s.toPt(n.x2, n.y2);
      s.drawHandleBox(ctx, p0.x, p0.y);
      s.drawHandleBox(ctx, p1.x, p1.y);
    }

    s.hitArrowHandle = function (pt, n) {
      const p0 = s.toPt(n.x, n.y);
      const p1 = s.toPt(n.x2, n.y2);
      const pad = HANDLE_PAD + 2;
      if (Math.abs(pt.x - p0.x) <= pad && Math.abs(pt.y - p0.y) <= pad) return "start";
      if (Math.abs(pt.x - p1.x) <= pad && Math.abs(pt.y - p1.y) <= pad) return "end";
      const poly = s.arrowPoly(n);
      if (poly && s.pointInPoly(pt.x, pt.y, poly)) return "move";
      return null;
    }

    s.hitRectHandle = function (pt, n) {
      const b = s.screenBox(n);
      const nearL = Math.abs(pt.x - b.x0) <= HANDLE_PAD;
      const nearR = Math.abs(pt.x - b.x1) <= HANDLE_PAD;
      const nearT = Math.abs(pt.y - b.y0) <= HANDLE_PAD;
      const nearB = Math.abs(pt.y - b.y1) <= HANDLE_PAD;
      const inX = pt.x >= b.x0 - HANDLE_PAD && pt.x <= b.x1 + HANDLE_PAD;
      const inY = pt.y >= b.y0 - HANDLE_PAD && pt.y <= b.y1 + HANDLE_PAD;
      if (nearT && nearL) return "nw";
      if (nearT && nearR) return "ne";
      if (nearB && nearL) return "sw";
      if (nearB && nearR) return "se";
      if (nearT && inX) return "n";
      if (nearB && inX) return "s";
      if (nearL && inY) return "w";
      if (nearR && inY) return "e";
      if (pt.x >= b.x0 && pt.x <= b.x1 && pt.y >= b.y0 && pt.y <= b.y1) return "move";
      return null;
    }

    s.hitCircleHandle = function (pt, n) {
      const c = s.toPt(n.x, n.y);
      const edge = s.toPt(n.x + (n.r || 0), n.y);
      const pr = Math.abs(edge.x - c.x);
      const d = Math.sqrt(s.dist2(pt.x, pt.y, c.x, c.y));
      if (Math.abs(d - pr) <= HANDLE_PAD) return s.handleFromAngle(pt.x - c.x, pt.y - c.y);
      if (d <= pr) return "move";
      return null;
    }

    s.hitShapeHandle = function (pt, n) {
      const k = s.noteKind(n);
      if (k === "rect") return s.hitRectHandle(pt, n);
      if (k === "circle") return s.hitCircleHandle(pt, n);
      if (k === "arrow") return s.hitArrowHandle(pt, n);
      return "move";
    }

    s.drawText = function (ctx, n, size, a) {
      if (a < 0.03) return;
      const pt = s.toPt(n.x, n.y);
      const px = s.textPx(n);
      const label = n.title || t("kind.text");
      if (pt.x < -80 || pt.y < -px || pt.x > size.x + 80 || pt.y > size.y + px) return;
      ctx.save();
      s.fillNoteLabel(ctx, n, label, px, { x: pt.x, y: pt.y, baseline: "middle" }, a);
      ctx.restore();
    }

    s.drawOneNote = function (ctx, n, size) {
      const k = s.noteKind(n);
      const a = s.noteTitleAlphaFor(n);
      if (k === "building") {
        s.drawPin(ctx, n, size);
        s.drawNoteCaption(ctx, n, size, a);
        return;
      }
      if (k === "brush") s.drawBrush(ctx, n, size);
      else if (k === "rect") {
        s.drawRect(ctx, n, size);
        if (s.shapeHandlesOn(n)) s.drawRectHandles(ctx, n);
      } else if (k === "circle") {
        s.drawCircle(ctx, n, size);
        if (s.shapeHandlesOn(n)) s.drawCircleHandles(ctx, n);
      } else if (k === "arrow") {
        s.drawArrow(ctx, n, size);
        if (s.shapeHandlesOn(n)) s.drawArrowHandles(ctx, n);
      }
      else if (k === "text") {
        if (a < 0.35) s.drawPin(ctx, n, size);
        s.drawText(ctx, n, size, a);
      } else if (k === "stamp") {
        s.drawStamp(ctx, n, size);
      } else {
        s.drawPin(ctx, n, size);
      }
      if (k !== "text") s.drawNoteCaption(ctx, n, size, a);
    }

    s.drawNotes = function () {
      const size = s.map.getSize();
      s.pinOverlay(s.noteCanvas, size);
      s.sizeCanvas(s.noteCanvas, s.noteCtx, size);
      if (!s.layerNotesEl.checked) return;
      s.noteCtx.lineJoin = "round";
      s.noteCtx.lineCap = "round";
      s.drawBldgHover(s.noteCtx);
      if (s.map.getZoom() < NOTE_MIN_Z) return;
      const order = s.notesDrawOrder();
      for (let i = 0; i < order.length; i++) s.drawOneNote(s.noteCtx, order[i], size);
      if (s.draft) s.drawOneNote(s.noteCtx, s.draft, size);
    }
}
