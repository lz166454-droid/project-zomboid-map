export const NOTE_COLORS = [
  { hex: "#c4bfb4", key: "paper" },
  { hex: "#d47a7a", key: "lightRed" },
  { hex: "#7b8fc4", key: "mistBlue" },
  { hex: "#7eaa7a", key: "moss" },
  { hex: "#d4a06c", key: "sand" },
  { hex: "#d4c46e", key: "gold" },
  { hex: "#e8e2d2", key: "ivory" },
  { hex: "#6eb0aa", key: "teal" },
  { hex: "#b08ec4", key: "lilac" },
  { hex: "#7ab8d0", key: "sky" },
  { hex: "#d4927a", key: "clay" },
  { hex: "#c4b07a", key: "tan" },
  { hex: "#9a3b32", key: "brick" },
  { hex: "#c45a24", key: "orange" },
  { hex: "#c48a14", key: "amber" },
  { hex: "#4f7318", key: "olive" },
  { hex: "#157a36", key: "forest" },
  { hex: "#87532c", key: "earth" },
  { hex: "#1e2219", key: "ink" },
  { hex: "#3a3834", key: "charcoal" },
  { hex: "#186878", key: "aqua" },
  { hex: "#143c78", key: "navy" },
  { hex: "#0f7c88", key: "deepTeal" },
  { hex: "#c43c58", key: "rose" },
  { hex: "#5a42c8", key: "violet" },
  { hex: "#5c4a82", key: "dustPurple" },
  { hex: "#2f5a8e", key: "steel" },
  { hex: "#a03c6e", key: "magenta" },
];

export function defaultHex() {
  return NOTE_COLORS[0].hex;
}

export function clampByte(n) {
  n = Math.round(Number(n));
  if (!(n >= 0)) n = 0;
  if (n > 255) n = 255;
  return n;
}

export function parseHexColor(c) {
  if (!c || !/^#[0-9a-fA-F]{6}$/.test(c)) return null;
  return {
    r: parseInt(c.slice(1, 3), 16),
    g: parseInt(c.slice(3, 5), 16),
    b: parseInt(c.slice(5, 7), 16),
  };
}

export function rgbToHex(r, g, b) {
  function pad(n) {
    const s = clampByte(n).toString(16);
    return s.length < 2 ? "0" + s : s;
  }
  return "#" + pad(r) + pad(g) + pad(b);
}

export function colorInPalette(c) {
  const x = (c || "").toLowerCase();
  for (let i = 0; i < NOTE_COLORS.length; i++) {
    if (NOTE_COLORS[i].hex.toLowerCase() === x) return true;
  }
  return false;
}

export function parseRgbInput(s) {
  if (!s) return null;
  s = String(s).trim();
  if (s.charAt(0) !== "#" && /^[0-9a-fA-F]{6}$/.test(s)) s = "#" + s;
  if (parseHexColor(s)) {
    return rgbToHex(
      parseInt(s.slice(1, 3), 16),
      parseInt(s.slice(3, 5), 16),
      parseInt(s.slice(5, 7), 16)
    );
  }
  const m = /^(\d{1,3})\s*[,，]\s*(\d{1,3})\s*[,，]\s*(\d{1,3})$/.exec(s);
  if (!m) return null;
  return rgbToHex(m[1], m[2], m[3]);
}

export function colorAlpha(hex, a) {
  const h = (hex || "#212121").replace("#", "");
  const n = parseInt(h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h, 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}

export function swatchTitle(item, name) {
  return (name || item.key || "") + " " + item.hex;
}
