import { MAP_BG } from "../../shared/const.js";
import {
  NOTE_COLORS,
  defaultHex,
  parseHexColor,
  rgbToHex,
  colorInPalette,
  parseRgbInput,
  swatchTitle,
} from "../../shared/color.js";
import { t } from "../map/i18n.js";

export class ColorsFeature {
  constructor(app) {
    this.app = app;
    this.hex = defaultHex();
    this.picking = null;
    this.host = null;
    this.dock = document.getElementById("note-draw-rgb");
    this.pickHud = document.getElementById("pick-hud");
    this.pickLoupe = document.getElementById("pick-loupe");
    this.pickSwatch = document.getElementById("pick-swatch");
    this.pickHex = document.getElementById("pick-hex");
    this.pickXy = document.getElementById("pick-xy");
  }

  attach(host) {
    this.host = host;
  }

  mountPalettes(dockHost, popTpl) {
    const tpl = popTpl.content.querySelector(".note-colors");
    dockHost.innerHTML = "";
    if (tpl) tpl.innerHTML = "";
    for (let i = 0; i < NOTE_COLORS.length; i++) {
      const item = NOTE_COLORS[i];
      this.addSwatch(dockHost, item);
      this.addSwatch(tpl, item);
    }
  }

  addSwatch(host, item) {
    if (!host) return;
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-color", item.hex);
    b.setAttribute("data-color-key", item.key);
    b.title = swatchTitle(item, t("color." + item.key));
    b.style.background = item.hex;
    host.appendChild(b);
  }

  bindDock() {
    const self = this;
    const dockColors = document.getElementById("note-draw-colors");
    dockColors.addEventListener("click", function (e) {
      const btn = e.target.closest("button[data-color]");
      if (!btn) return;
      self.setHex(btn.getAttribute("data-color"));
    });
    this.bindRow(this.dock, function (hex) {
      self.setHex(hex);
    });
    this.syncDock();
  }

  bindRow(row, apply) {
    if (!row) return;
    const self = this;
    const val = row.querySelector(".note-rgb-val");
    const pick = row.querySelector(".note-rgb-pick");
    const drop = row.querySelector(".note-rgb-drop");
    val.addEventListener("change", function () {
      const hex = parseRgbInput(val.value);
      if (hex) apply(hex);
    });
    pick.addEventListener("input", function () {
      apply(pick.value);
    });
    drop.addEventListener("click", function () {
      self.startPick(apply, drop);
    });
  }

  setHex(hex) {
    const parsed = parseHexColor(hex) ? hex.toLowerCase() : parseRgbInput(hex);
    if (!parsed) return;
    this.hex = parsed;
    if (this.host && this.host.onHex) this.host.onHex(parsed);
    this.syncDock();
  }

  syncDock() {
    this.syncRow(this.dock, this.hex);
    const cols = document.getElementById("note-draw-colors").querySelectorAll("button");
    for (let i = 0; i < cols.length; i++) {
      cols[i].classList.toggle(
        "active",
        cols[i].getAttribute("data-color").toLowerCase() === this.hex.toLowerCase()
      );
    }
  }

  syncRow(row, hex) {
    if (!row) return;
    const rgb = parseHexColor(hex) || parseHexColor(defaultHex());
    const h = rgbToHex(rgb.r, rgb.g, rgb.b);
    row.querySelector(".note-rgb-val").value = h;
    row.querySelector(".note-rgb-pick").value = h;
    row.classList.toggle("custom-active", !colorInPalette(h));
  }

  blitMapPatch(ctx, clientX, clientY, cssN, out) {
    const canvases = this.host.canvases();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = MAP_BG;
    ctx.fillRect(0, 0, out, out);
    function blit(canvas) {
      const box = canvas.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const scaleX = canvas.width / box.width;
      const scaleY = canvas.height / box.height;
      const snX = Math.max(1, Math.round(cssN * scaleX));
      const snY = Math.max(1, Math.round(cssN * scaleY));
      const sx = Math.round((clientX - box.left) * scaleX) - Math.floor(snX / 2);
      const sy = Math.round((clientY - box.top) * scaleY) - Math.floor(snY / 2);
      try {
        ctx.drawImage(canvas, sx, sy, snX, snY, 0, 0, out, out);
      } catch (err) {}
    }
    blit(canvases.vec);
    blit(canvases.txt);
    blit(canvases.note);
  }

  sampleHex(clientX, clientY) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const g = c.getContext("2d");
    this.blitMapPatch(g, clientX, clientY, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    return rgbToHex(d[0], d[1], d[2]);
  }

  drawLoupe(clientX, clientY) {
    const ctx = this.pickLoupe.getContext("2d");
    const out = this.pickLoupe.width;
    this.blitMapPatch(ctx, clientX, clientY, 11, out);
    const cell = out / 11;
    const cx = Math.floor(5 * cell) + 0.5;
    ctx.strokeStyle = "#e8e4d4";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, cx, cell, cell);
  }

  hideHud() {
    this.pickHud.hidden = true;
  }

  updateHud(e) {
    const oe = e.originalEvent;
    this.drawLoupe(oe.clientX, oe.clientY);
    const mid = Math.floor(this.pickLoupe.width / 2);
    const d = this.pickLoupe.getContext("2d").getImageData(mid, mid, 1, 1).data;
    const hex = rgbToHex(d[0], d[1], d[2]);
    this.pickSwatch.style.background = hex;
    this.pickHex.textContent = hex;
    this.pickXy.textContent = "x " + Math.floor(e.latlng.lng) + ", y " + Math.floor(e.latlng.lat);
    this.pickHud.hidden = false;
    const pad = 18;
    const w = this.pickHud.offsetWidth;
    const h = this.pickHud.offsetHeight;
    let left = oe.clientX + pad;
    let top = oe.clientY + pad;
    if (left + w > window.innerWidth - 8) left = oe.clientX - w - pad;
    if (top + h > window.innerHeight - 8) top = oe.clientY - h - pad;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    this.pickHud.style.left = left + "px";
    this.pickHud.style.top = top + "px";
  }

  endPick() {
    const was = this.picking;
    this.picking = null;
    const drops = document.querySelectorAll(".note-rgb-drop");
    for (let i = 0; i < drops.length; i++) drops[i].classList.remove("active");
    const map = this.host && this.host.map();
    if (map) map.getContainer().classList.remove("picking-color");
    this.hideHud();
    if (was && map && this.host.canEnableDrag()) map.dragging.enable();
  }

  startPick(apply, btn) {
    this.endPick();
    this.picking = apply;
    if (btn) btn.classList.add("active");
    const map = this.host.map();
    map.getContainer().classList.add("picking-color");
    map.dragging.disable();
  }

  onContextMenu(e) {
    if (!this.picking) return false;
    L.DomEvent.preventDefault(e);
    this.endPick();
    return true;
  }

  onMapMouseDown(e) {
    if (!this.picking) return false;
    L.DomEvent.preventDefault(e.originalEvent);
    const hex = this.sampleHex(e.originalEvent.clientX, e.originalEvent.clientY);
    const apply = this.picking;
    this.endPick();
    if (hex) apply(hex);
    else this.app.ui.toast(t("toast.pickFail"));
    return true;
  }

  onMapMouseMove(e) {
    if (!this.picking) return false;
    this.updateHud(e);
    return true;
  }

  onMapMouseLeave() {
    if (this.picking) this.hideHud();
  }

  browse() {
    this.endPick();
  }

  onLang() {
    const btns = document.querySelectorAll("button[data-color-key]");
    for (let i = 0; i < btns.length; i++) {
      const key = btns[i].getAttribute("data-color-key");
      const hex = btns[i].getAttribute("data-color") || "";
      btns[i].title = t("color." + key) + " " + hex;
    }
  }
}
