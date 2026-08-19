import fs from "node:fs";

export const EARTH = 40075016.68557849;
export const TILE = 256;

function loadJsonObject(filePath) {
  let text = fs.readFileSync(filePath, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = text.replace(/,\s*}/g, "}");
  const data = JSON.parse(text);
  return data && typeof data === "object" ? data : {};
}

export function loadMapLabelZh(filePaths) {
  const merged = {};
  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) Object.assign(merged, loadJsonObject(filePath));
  }
  const lower = new Map();
  for (const [key, value] of Object.entries(merged)) {
    lower.set(key.toLowerCase(), String(value));
  }
  return lower;
}

function stripTags(raw) {
  return raw.replace(/<br>/gi, " ").replace(/\s+/g, " ").trim();
}

function prettyLabel(raw) {
  let text = stripTags(raw);
  if (text.startsWith("MapLabel_")) {
    text = text.slice("MapLabel_".length).replace(/([a-z])([A-Z])/g, "$1 $2");
  }
  return text;
}

function lookupZh(raw, zhLower) {
  const noBr = stripTags(raw);
  const compact = "MapLabel_" + noBr.replace(/[^A-Za-z0-9]/g, "");
  const keys = [raw, noBr, compact];
  if (!raw.startsWith("MapLabel_")) keys.push("MapLabel_" + raw, "MapLabel_" + noBr);
  for (let i = 0; i < keys.length; i++) {
    const hit = zhLower.get(keys[i].toLowerCase());
    if (hit) return hit;
  }
  return "";
}

export function loadPyramidMeta(zip) {
  const meta = {
    bounds: [0, 0, 19800, 16085],
    imageSize: [19800, 15900],
    minZ: 0,
    maxZ: 4,
    tileSize: TILE,
    earth: EARTH,
  };
  const buf = zip.read("pyramid.txt");
  if (buf) {
    for (const line of buf.toString("utf8").split(/\r?\n/)) {
      if (line.startsWith("bounds=")) meta.bounds = line.split("=")[1].trim().split(/\s+/).map(Number);
      else if (line.startsWith("imageSize=")) meta.imageSize = line.split("=")[1].trim().split(/\s+/).map(Number);
    }
  }
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const name of zip.entries.keys()) {
    const m = name.match(/^(\d+)\/tile/);
    if (!m) continue;
    const z = Number(m[1]);
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  if (Number.isFinite(minZ)) {
    meta.minZ = minZ;
    meta.maxZ = maxZ;
  }
  meta.resolution = (meta.bounds[2] - meta.bounds[0]) / meta.imageSize[0];
  return meta;
}

function lineCommented(text, index) {
  const lineStart = text.lastIndexOf("\n", index) + 1;
  return text.slice(lineStart, index).includes("--");
}

function nextChunk(text, from) {
  const a = text.indexOf("addUntranslatedText", from);
  const b = text.indexOf("addTranslatedText", from);
  let next = -1;
  if (a >= 0 && b >= 0) next = Math.min(a, b);
  else next = a >= 0 ? a : b;
  return text.slice(from, next < 0 ? from + 800 : next);
}

function numAfter(chunk, fn) {
  const m = chunk.match(new RegExp(fn + "\\(([\\d.-]+)\\)"));
  return m ? Number(m[1]) : null;
}

function boolAfter(chunk, fn) {
  const m = chunk.match(new RegExp(fn + "\\((true|false)\\)"));
  return m ? m[1] === "true" : null;
}

export function loadLabels(zhLower, annotationsPath) {
  const labels = [];
  if (!fs.existsSync(annotationsPath)) return labels;
  const text = fs.readFileSync(annotationsPath, "utf8");
  const addRe = /add(?:Untranslated|Translated)Text\("([^"]+)", "([^"]+)",\s*([\d.]+),\s*([\d.]+)\)/g;
  let m;
  while ((m = addRe.exec(text))) {
    if (lineCommented(text, m.index)) continue;
    const raw = m[1];
    const kind = m[2];
    const chunk = nextChunk(text, m.index + m[0].length);
    const zh = lookupZh(raw, zhLower);
    const display = zh || raw.replace(/<BR>/g, "<br>").replace(/<Br>/g, "<br>");
    const enLines = raw.replace(/<BR>/g, "<br>").replace(/<Br>/g, "<br>").split(/<br>/i).map((s) => s.trim()).filter(Boolean);
    labels.push({
      raw,
      name: prettyLabel(raw),
      nameZh: zh,
      lines: display.split(/<br>/i).map((s) => s.trim()).filter(Boolean),
      linesEn: enLines,
      x: Number(m[3]),
      y: Number(m[4]),
      kind,
      scale: numAfter(chunk, "setScale") ?? 1,
      rot: numAfter(chunk, "setRotation") ?? 0,
      minZ: numAfter(chunk, "setMinZoom") ?? 0,
      maxZ: numAfter(chunk, "setMaxZoom") ?? 24,
      applyZoom: boolAfter(chunk, "setApplyZoom") !== false,
    });
  }
  return labels;
}

function attr(src, key) {
  const m = src.match(new RegExp(key + '="([^"]*)"'));
  return m ? m[1] : "";
}

export function loadStreets(streetsPath) {
  const streets = [];
  if (!fs.existsSync(streetsPath)) return streets;
  const xml = fs.readFileSync(streetsPath, "utf8");
  const streetRe = /<street\s+([^>]*)>([\s\S]*?)<\/street>/g;
  let sm;
  while ((sm = streetRe.exec(xml))) {
    const name = attr(sm[1], "name") || "";
    const width = Number(attr(sm[1], "width") || 8);
    const pts = [];
    const ptRe = /<point\s+x="([\d.-]+)"\s+y="([\d.-]+)"/g;
    let pm;
    while ((pm = ptRe.exec(sm[2]))) pts.push([Number(pm[1]), Number(pm[2])]);
    if (name && pts.length >= 2) streets.push({ n: name, w: width, p: pts });
  }
  return streets;
}

function featureLayer(body) {
  const building = body.match(/<property name="building" value="([^"]+)"/);
  if (building) return "building-" + building[1];
  const highway = body.match(/<property name="highway" value="([^"]+)"/);
  if (highway) return "road-" + highway[1];
  const water = body.match(/<property name="water" value="/);
  if (water) return "water";
  const railway = body.match(/<property name="railway"/);
  if (railway) return "railway";
  const forest = body.match(/<property name="natural" value="forest"/);
  if (forest) return "forest";
  return "";
}

function addPoly(store, layer, cx, cy, pts) {
  if (!store[layer]) store[layer] = {};
  const key = cx + "," + cy;
  if (!store[layer][key]) store[layer][key] = [];
  store[layer][key].push(pts);
}

export function parseWorldMapXml(filePath) {
  const xml = fs.readFileSync(filePath, "utf8");
  const store = {};
  let n = 0;
  let i = 0;
  while (true) {
    const cellStart = xml.indexOf("<cell ", i);
    if (cellStart < 0) break;
    const tagEnd = xml.indexOf(">", cellStart);
    const tag = xml.slice(cellStart, tagEnd);
    const xm = tag.match(/x="(-?\d+)"/);
    const ym = tag.match(/y="(-?\d+)"/);
    const cellEnd = xml.indexOf("</cell>", tagEnd);
    if (!xm || !ym || cellEnd < 0) {
      i = tagEnd + 1;
      continue;
    }
    const cx = Number(xm[1]);
    const cy = Number(ym[1]);
    const ox = cx * 300;
    const oy = cy * 300;
    const body = xml.slice(tagEnd + 1, cellEnd);
    i = cellEnd + 7;
    let f = 0;
    while (true) {
      const fs = body.indexOf("<feature>", f);
      if (fs < 0) break;
      const fe = body.indexOf("</feature>", fs);
      if (fe < 0) break;
      const feat = body.slice(fs, fe);
      f = fe + 10;
      if (!feat.includes('<geometry type="Polygon"')) continue;
      const layer = featureLayer(feat);
      if (!layer) continue;
      const rings = [];
      const coordRe = /<coordinates>([\s\S]*?)<\/coordinates>/g;
      let cm;
      while ((cm = coordRe.exec(feat))) {
        const pts = [];
        const ptRe = /<point x="([\d.-]+)" y="([\d.-]+)"/g;
        let pm;
        while ((pm = ptRe.exec(cm[1]))) {
          pts.push(Math.round(ox + Number(pm[1])), Math.round(oy + Number(pm[2])));
        }
        if (pts.length >= 6) rings.push(pts);
      }
      if (rings.length) {
        addPoly(store, layer, cx, cy, rings);
        n++;
      }
    }
  }
  return { store, n };
}

export function forestSlice(forestStore, cx0, cy0, cx1, cy1) {
  const out = {};
  const cells = forestStore.forest || {};
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const key = cx + "," + cy;
      if (cells[key]) out[key] = cells[key];
    }
  }
  return out;
}
