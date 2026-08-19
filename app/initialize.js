import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZipReader } from "./server/zip.js";
import { MIME, send, sendFile, resolveStatic } from "./server/http.js";
import {
  loadMapLabelZh,
  loadPyramidMeta,
  loadLabels,
  loadStreets,
  parseWorldMapXml,
  forestSlice,
} from "./server/map-data.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(HERE, "data");
const STATIC_DIR = path.join(HERE, "static");
const FOREST_ZIP = path.join(DATA_DIR, "forest.pyramid.zip");
const WORLD_XML = path.join(DATA_DIR, "worldmap.xml");
const FOREST_XML = path.join(DATA_DIR, "worldmap-forest.xml");
const STREETS_XML = path.join(DATA_DIR, "streets.xml");
const ANNOTATIONS = path.join(DATA_DIR, "worldmap-annotations.lua");
const PAPER_PNG = path.join(STATIC_DIR, "paper.png");
const MAPLABEL_FILES = [path.join(STATIC_DIR, "i18n", "zh", "MapLabel.json")];

export default class Initialize {
  constructor() {
    this.server = null;
    this.zip = null;
    this.stats = null;
  }

  init() {
    if (!fs.existsSync(FOREST_ZIP) || !fs.existsSync(WORLD_XML) || !fs.existsSync(FOREST_XML)) {
      console.error("缺少 app/data/ 地图数据");
      process.exit(1);
    }
    this.zip = new ZipReader(FOREST_ZIP);
    const zhLower = loadMapLabelZh(MAPLABEL_FILES);
    const labels = loadLabels(zhLower, ANNOTATIONS);
    const streets = loadStreets(STREETS_XML);
    console.log("解析 worldmap.xml …");
    const world = parseWorldMapXml(WORLD_XML);
    console.log("解析 worldmap-forest.xml …");
    const forest = parseWorldMapXml(FOREST_XML);
    const meta = loadPyramidMeta(this.zip);
    meta.worldBounds = [0, 0, 19800, 16085];
    const payload = {
      meta,
      labels,
      streets,
      features: world.store,
    };
    const dataJson = Buffer.from(JSON.stringify(payload), "utf8");
    let missingZh = 0;
    for (let i = 0; i < labels.length; i++) {
      if (!labels[i].nameZh) missingZh++;
    }
    this.stats = {
      labels: labels.length,
      missingZh,
      streets: streets.length,
      world: world.n,
      forest: forest.n,
    };

    const zip = this.zip;
    this.server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const urlPath = decodeURIComponent(url.pathname);
      if (urlPath === "/" || urlPath === "/index.html") {
        return sendFile(res, path.join(HERE, "index.html"));
      }
      if (urlPath === "/api/data.json") {
        return send(res, 200, dataJson, MIME[".json"]);
      }
      if (urlPath === "/api/forest.json") {
        const cx0 = Number(url.searchParams.get("cx0") || 0);
        const cy0 = Number(url.searchParams.get("cy0") || 0);
        const cx1 = Number(url.searchParams.get("cx1") || 0);
        const cy1 = Number(url.searchParams.get("cy1") || 0);
        const slice = forestSlice(forest.store, cx0, cy0, cx1, cy1);
        return send(res, 200, Buffer.from(JSON.stringify(slice), "utf8"), MIME[".json"]);
      }
      if (urlPath === "/paper.png" && fs.existsSync(PAPER_PNG)) {
        return send(res, 200, fs.readFileSync(PAPER_PNG), "image/png", true);
      }
      const tile = urlPath.match(/^\/tiles\/(\d+)\/(\d+)\/(\d+)\.png$/);
      if (tile) {
        const name = tile[1] + "/tile" + tile[2] + "x" + tile[3] + ".png";
        const data = zip.read(name);
        if (!data) {
          res.writeHead(404);
          return res.end();
        }
        return send(res, 200, data, "image/png", true);
      }
      const filePath = resolveStatic(HERE, urlPath);
      if (filePath) return sendFile(res, filePath);
      res.writeHead(404);
      res.end("not found");
    });
    return this.server;
  }

  cleanup() {
    if (this.zip) {
      this.zip.close();
      this.zip = null;
    }
  }
}
