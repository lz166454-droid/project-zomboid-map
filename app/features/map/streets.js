import { claimBox, rotatedAabb } from "./geom.js";

export function pathLen(pts) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += pts[i].distanceTo(pts[i - 1]);
  return n;
}

export function pointAt(pts, dist) {
  for (let i = 1; i < pts.length; i++) {
    const seg = pts[i].distanceTo(pts[i - 1]);
    if (seg < 0.001) continue;
    if (dist <= seg) {
      const t = dist / seg;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
        a: Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x),
      };
    }
    dist -= seg;
  }
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2] || last;
  return {
    x: last.x,
    y: last.y,
    a: Math.atan2(last.y - prev.y, last.x - prev.x),
  };
}

function ptKey(x, y) {
  return (Math.round(x * 2) / 2) + ":" + (Math.round(y * 2) / 2);
}

function headingDiff(ax, ay, bx, by, cx, cy) {
  const a0 = Math.atan2(by - ay, bx - ax);
  const a1 = Math.atan2(cy - by, cx - bx);
  let d = Math.abs(a1 - a0);
  while (d > Math.PI) d = Math.abs(d - Math.PI * 2);
  return d;
}

function streetJunctions(streets) {
  const owner = {};
  for (let si = 0; si < streets.length; si++) {
    const pts = streets[si].p;
    for (let i = 0; i < pts.length; i++) {
      const k = ptKey(pts[i][0], pts[i][1]);
      if (owner[k] === undefined) owner[k] = si;
      else if (owner[k] !== si) owner[k] = -1;
    }
  }
  const junc = {};
  Object.keys(owner).forEach(function (k) {
    if (owner[k] === -1) junc[k] = true;
  });
  return junc;
}

function splitStreetPts(pts, junc) {
  const out = [];
  if (!pts || pts.length < 2) return out;
  const corner = (22 * Math.PI) / 180;
  let start = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const k = ptKey(pts[i][0], pts[i][1]);
    const sharp = headingDiff(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) > corner;
    if (sharp || junc[k]) {
      if (i > start) out.push(pts.slice(start, i + 1));
      start = i;
    }
  }
  if (pts.length - 1 > start) out.push(pts.slice(start));
  return out;
}

export function splitAllStreets(streets) {
  const junc = streetJunctions(streets);
  const segs = [];
  for (let i = 0; i < streets.length; i++) {
    const s = streets[i];
    const parts = splitStreetPts(s.p, junc);
    for (let j = 0; j < parts.length; j++) {
      segs.push({ n: s.n, w: s.w || 8, p: parts[j] });
    }
  }
  return segs;
}

export function distToPoly(wx, wy, pts) {
  let best = Infinity;
  if (!pts || pts.length < 2) return best;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1][0];
    const ay = pts[i - 1][1];
    const bx = pts[i][0];
    const by = pts[i][1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let d;
    if (len2 < 1e-8) {
      d = (wx - ax) * (wx - ax) + (wy - ay) * (wy - ay);
    } else {
      let t = ((wx - ax) * dx + (wy - ay) * dy) / len2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const px = ax + t * dx - wx;
      const py = ay + t * dy - wy;
      d = px * px + py * py;
    }
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function hitStreet(segs, wx, wy) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const hitR = (s.w || 8) * 0.55 + 3;
    const d = distToPoly(wx, wy, s.p);
    if (d <= hitR && d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function drawStreetLabel(ctx, pts, lines, fontPx, occupied, stroke, placed) {
  if (pts.length < 2 || !lines || !lines.length) return;
  const len = pathLen(pts);
  let maxW = 0;
  for (let i = 0; i < lines.length; i++) {
    maxW = Math.max(maxW, ctx.measureText(lines[i]).width);
  }
  if (len < maxW + 8) return;
  const mid = pointAt(pts, len / 2);
  const nameKey = lines.join("\n");
  const minD = Math.max(160, fontPx * 12);
  if (placed) {
    for (let i = 0; i < placed.length; i++) {
      if (placed[i].key !== nameKey) continue;
      const dx = placed[i].x - mid.x;
      const dy = placed[i].y - mid.y;
      if (dx * dx + dy * dy < minD * minD) return;
    }
  }
  let a = mid.a;
  if (a > Math.PI / 2 || a < -Math.PI / 2) a += Math.PI;
  const totalH = lines.length * fontPx * 1.15;
  if (!claimBox(occupied, rotatedAabb(mid.x, mid.y, maxW + 6, totalH + 4, a))) return;
  if (placed) placed.push({ key: nameKey, x: mid.x, y: mid.y });
  ctx.save();
  ctx.translate(mid.x, mid.y);
  ctx.rotate(a);
  const y0 = -((lines.length - 1) * fontPx * 1.15) / 2;
  for (let i = 0; i < lines.length; i++) {
    const y = y0 + i * fontPx * 1.15;
    if (stroke) ctx.strokeText(lines[i], 0, y);
    ctx.fillText(lines[i], 0, y);
  }
  ctx.restore();
}
