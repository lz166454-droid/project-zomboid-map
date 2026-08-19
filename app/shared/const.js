export const TILE = 256;
export const MIN_LABEL_PX = 10;
export const FOREST_TINT = "rgb(189, 197, 163)";
export const MAP_BG = "rgb(219, 215, 192)";
export const MAP_FONT = "'Noto Sans TC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";
export const NOTE_FONT = "'Ma Shan Zheng', 'KaiTi', 'STKaiti', '楷体', serif";
export const STREET_FILL = [
  { z: 13.0, a: 0 },
  { z: 13.5, a: 255 },
];
export const NOTE_TITLE_FILL = [
  { z: 14.0, a: 0 },
  { z: 15.0, a: 255 },
];
export const BLDG_TITLE_FILL = [
  { z: 13.0, a: 0 },
  { z: 13.5, a: 255 },
];
export const LAYER = {
  "text-town": { lineH: 48, fills: [{ z: 0, r: 0, g: 0, b: 0, a: 255 }, { z: 13.0, r: 0, g: 0, b: 0, a: 255 }, { z: 13.5, r: 0, g: 0, b: 0, a: 0 }] },
  "text-place": { lineH: 48, fills: [{ z: 13.0, r: 255, g: 255, b: 255, a: 0 }, { z: 13.5, r: 255, g: 255, b: 255, a: 255 }, { z: 16.5, r: 255, g: 255, b: 255, a: 255 }, { z: 17.0, r: 255, g: 255, b: 255, a: 0 }] },
  "text-building": { lineH: 48, fills: [{ z: 13.0, r: 255, g: 255, b: 255, a: 0 }, { z: 13.5, r: 255, g: 255, b: 255, a: 255 }, { z: 16.5, r: 255, g: 255, b: 255, a: 255 }, { z: 17.0, r: 255, g: 255, b: 255, a: 0 }] },
  "text-forest": { lineH: 32, fills: [{ z: 0, r: 15, g: 99, b: 43, a: 255 }, { z: 13.0, r: 15, g: 99, b: 43, a: 255 }, { z: 13.5, r: 15, g: 99, b: 43, a: 0 }] },
  "text-water-small": { lineH: 32, fills: [{ z: 0, r: 4, g: 48, b: 125, a: 255 }, { z: 16.0, r: 4, g: 48, b: 125, a: 255 }, { z: 16.5, r: 4, g: 48, b: 125, a: 0 }] },
  "text-water-medium": { lineH: 32, fills: [{ z: 0, r: 4, g: 48, b: 125, a: 255 }, { z: 14.5, r: 4, g: 48, b: 125, a: 255 }, { z: 15.0, r: 4, g: 48, b: 125, a: 0 }] },
  "text-water-nofade": { lineH: 32, fills: [{ z: 0, r: 4, g: 48, b: 125, a: 255 }] },
  "text-street": { lineH: 48, fills: STREET_FILL },
};
export const POLY = [
  { id: "forest", fills: [{ z: 14.5, r: 189, g: 197, b: 163, a: 0 }, { z: 15, r: 189, g: 197, b: 163, a: 255 }, { z: 24, r: 189, g: 197, b: 163, a: 255 }], minZ: 13.5 },
  { id: "water", fills: [{ z: 0, r: 59, g: 141, b: 149, a: 255 }], minZ: 0 },
  { id: "road-trail", fills: [{ z: 12.25, r: 185, g: 122, b: 87, a: 0 }, { z: 13, r: 185, g: 122, b: 87, a: 255 }], minZ: 12 },
  { id: "road-tertiary", fills: [{ z: 11.5, r: 171, g: 158, b: 143, a: 0 }, { z: 13, r: 171, g: 158, b: 143, a: 255 }], minZ: 11 },
  { id: "road-secondary", fills: [{ z: 0, r: 134, g: 125, b: 113, a: 255 }], minZ: 11 },
  { id: "road-primary", fills: [{ z: 0, r: 134, g: 125, b: 113, a: 255 }], minZ: 11 },
  { id: "railway", fills: [{ z: 0, r: 200, g: 191, b: 231, a: 255 }], minZ: 14 },
  { id: "building-yes", fills: [{ z: 13, r: 210, g: 158, b: 105, a: 0 }, { z: 13.5, r: 210, g: 158, b: 105, a: 255 }], minZ: 13 },
  { id: "building-Residential", fills: [{ z: 13, r: 210, g: 158, b: 105, a: 0 }, { z: 13.5, r: 210, g: 158, b: 105, a: 255 }], minZ: 13 },
  { id: "building-CommunityServices", fills: [{ z: 13, r: 139, g: 117, b: 235, a: 0 }, { z: 13.5, r: 139, g: 117, b: 235, a: 255 }], minZ: 13 },
  { id: "building-Hospitality", fills: [{ z: 13, r: 127, g: 206, b: 225, a: 0 }, { z: 13.5, r: 127, g: 206, b: 225, a: 255 }], minZ: 13 },
  { id: "building-Industrial", fills: [{ z: 13, r: 56, g: 54, b: 53, a: 0 }, { z: 13.5, r: 56, g: 54, b: 53, a: 255 }], minZ: 13 },
  { id: "building-Medical", fills: [{ z: 13, r: 229, g: 128, b: 151, a: 0 }, { z: 13.5, r: 229, g: 128, b: 151, a: 255 }], minZ: 13 },
  { id: "building-RestaurantsAndEntertainment", fills: [{ z: 13, r: 245, g: 225, b: 60, a: 0 }, { z: 13.5, r: 245, g: 225, b: 60, a: 255 }], minZ: 13 },
  { id: "building-RetailAndCommercial", fills: [{ z: 13, r: 184, g: 205, b: 84, a: 0 }, { z: 13.5, r: 184, g: 205, b: 84, a: 255 }], minZ: 13 },
];
export const MAP_LEGEND = [
  { r: 139, g: 117, b: 235, key: "community" },
  { r: 184, g: 205, b: 84, key: "retail" },
  { r: 56, g: 54, b: 53, key: "industrial" },
  { r: 210, g: 158, b: 105, key: "residential" },
  { r: 245, g: 225, b: 60, key: "restaurants" },
  { r: 127, g: 206, b: 225, key: "hospitality" },
  { r: 229, g: 128, b: 151, key: "medical" },
  { r: 189, g: 197, b: 163, key: "forest" },
];
export const LANG_KEY = "mapweb-lang";
export const NOTES_KEY = "mapweb-notes";
export const PANEL_KEY = "mapweb-panels";
export const SIDEBAR_W_KEY = "mapweb-sidebar-w";
export const SIDEBAR_W_DEFAULT = 220;
export const SIDEBAR_W_MIN = 180;
export const SIDEBAR_W_MAX = 560;
export const PANEL_SPLIT_KEY = "mapweb-panel-split";
export const PANEL_TOWNS_H_MIN = 80;
export const PANEL_NOTES_H_MIN = 140;
export const DEFAULT_FOLDER_ID = "default";
export const OTHER_TOWN = "__other__";
export const BLDG_MIN_Z = 13.5;
export const NOTE_MIN_Z = 13.5;
export const MAX_ZOOM = 19;
export const HANDLE_PAD = 8;
