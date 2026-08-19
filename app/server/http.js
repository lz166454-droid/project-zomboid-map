import fs from "node:fs";
import path from "node:path";

export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

const APP_FILES = new Set(["index.html", "main.js"]);
const APP_DIRS = ["features", "shared"];
const STATIC_FILES = new Set(["paper.png"]);
const STATIC_DIRS = ["styles", "i18n", "symbols", "vendor"];

export function send(res, status, data, contentType, cache) {
  const headers = { "Content-Type": contentType, "Content-Length": Buffer.byteLength(data) };
  if (cache) headers["Cache-Control"] = "public, max-age=86400";
  else headers["Cache-Control"] = "no-store";
  res.writeHead(status, headers);
  res.end(data);
}

export function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  send(res, 200, fs.readFileSync(filePath), MIME[ext] || "application/octet-stream");
}

function allowed(norm, files, dirs) {
  if (files.has(norm)) return true;
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    if (norm === dir || norm.startsWith(dir + "/")) return true;
  }
  return false;
}

export function resolveStatic(appDir, urlPath) {
  const safe = path.normalize(urlPath).replace(/^[/\\]+/, "");
  if (safe.startsWith("..") || path.isAbsolute(safe)) return null;
  const norm = safe.replace(/\\/g, "/");
  let root = null;
  if (allowed(norm, APP_FILES, APP_DIRS)) root = appDir;
  else if (allowed(norm, STATIC_FILES, STATIC_DIRS)) root = path.join(appDir, "static");
  if (!root) return null;
  const filePath = path.join(root, safe);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
  return null;
}
