export function polyRings(raw) {
  return raw.length && Array.isArray(raw[0]) ? raw : [raw];
}

export function pointInRing(x, y, pts) {
  let inside = false;
  const n = pts.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = pts[i];
    const yi = pts[i + 1];
    const xj = pts[j];
    const yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInRings(x, y, rings) {
  let n = 0;
  for (let r = 0; r < rings.length; r++) {
    if (pointInRing(x, y, rings[r])) n++;
  }
  return n % 2 === 1;
}

export function ringCentroid(pts) {
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  const n = pts.length;
  for (let i = 0; i < n; i += 2) {
    const x1 = pts[i];
    const y1 = pts[i + 1];
    const j = (i + 2) % n;
    const x2 = pts[j];
    const y2 = pts[j + 1];
    const cross = x1 * y2 - x2 * y1;
    a2 += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(a2) < 1e-6) {
    let minx = Infinity;
    let miny = Infinity;
    let maxx = -Infinity;
    let maxy = -Infinity;
    for (let i = 0; i < n; i += 2) {
      if (pts[i] < minx) minx = pts[i];
      if (pts[i] > maxx) maxx = pts[i];
      if (pts[i + 1] < miny) miny = pts[i + 1];
      if (pts[i + 1] > maxy) maxy = pts[i + 1];
    }
    return { x: (minx + maxx) / 2, y: (miny + maxy) / 2 };
  }
  return { x: cx / (3 * a2), y: cy / (3 * a2) };
}

export function bldgKey(b) {
  return b ? b.layer + ":" + b.cell + ":" + b.i : "";
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function evalFill(stops, zoom) {
  if (!stops || !stops.length) return { r: 255, g: 255, b: 255, a: 255 };
  if (zoom <= stops[0].z) return stops[0];
  const last = stops[stops.length - 1];
  if (zoom >= last.z) return last;
  for (let i = 1; i < stops.length; i++) {
    if (zoom <= stops[i].z) {
      const t = (zoom - stops[i - 1].z) / (stops[i].z - stops[i - 1].z || 1);
      const p = stops[i - 1];
      const n = stops[i];
      return {
        r: lerp(p.r || 0, n.r || 0, t),
        g: lerp(p.g || 0, n.g || 0, t),
        b: lerp(p.b || 0, n.b || 0, t),
        a: lerp(p.a, n.a, t),
      };
    }
  }
  return last;
}

export function rotatedAabb(cx, cy, w, h, angle) {
  const hw = w / 2;
  const hh = h / 2;
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  const rw = hw * c + hh * s;
  const rh = hw * s + hh * c;
  return { x0: cx - rw, y0: cy - rh, x1: cx + rw, y1: cy + rh };
}

export function boxesOverlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export function claimBox(occupied, box) {
  for (let i = 0; i < occupied.length; i++) {
    if (boxesOverlap(box, occupied[i])) return false;
  }
  occupied.push(box);
  return true;
}
