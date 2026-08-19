import { MAP_FONT, NOTE_FONT } from "../../shared/const.js";

export function mapFont(px) {
  return "600 " + px + "px " + MAP_FONT;
}

export function noteFont(px) {
  return px + "px " + NOTE_FONT;
}

export function splitBr(text) {
  return String(text || "")
    .replace(/<BR>/g, "<br>")
    .split(/<br>/i)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

export function i18nIndex(obj) {
  const m = {};
  if (!obj) return m;
  Object.keys(obj).forEach(function (k) {
    m[k.toLowerCase()] = obj[k];
  });
  return m;
}

export function i18nGet(index, key) {
  if (!key) return "";
  return index[String(key).toLowerCase()] || "";
}

const packs = { zh: {}, en: {} };
const symbols = { zh: {}, en: {} };
let lang = "zh";

export function initI18n(uiZh, uiEn, symZh, symEn, initialLang) {
  packs.zh = uiZh && typeof uiZh === "object" ? uiZh : {};
  packs.en = uiEn && typeof uiEn === "object" ? uiEn : {};
  symbols.zh = symZh && typeof symZh === "object" ? symZh : {};
  symbols.en = symEn && typeof symEn === "object" ? symEn : {};
  setLang(initialLang);
}

export function setLang(next) {
  lang = next === "en" ? "en" : "zh";
}

export function getLang() {
  return lang;
}

export function t(key, vars) {
  const pack = packs[lang] || {};
  let s = pack[key];
  if (s == null) s = packs.zh[key];
  if (s == null) s = packs.en[key];
  if (s == null) s = key;
  if (vars) {
    s = String(s).replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] != null ? String(vars[k]) : "";
    });
  }
  return s;
}

export function symbolName(sym) {
  if (!sym) return "";
  const pack = symbols[lang] || {};
  if (pack[sym]) return pack[sym];
  if (symbols.en[sym]) return symbols.en[sym];
  if (symbols.zh[sym]) return symbols.zh[sym];
  return sym;
}

export function applyI18nDom(root) {
  const scope = root || document;
  const texts = scope.querySelectorAll("[data-i18n]");
  for (let i = 0; i < texts.length; i++) {
    texts[i].textContent = t(texts[i].getAttribute("data-i18n"));
  }
  const titles = scope.querySelectorAll("[data-i18n-title]");
  for (let i = 0; i < titles.length; i++) {
    titles[i].title = t(titles[i].getAttribute("data-i18n-title"));
  }
  const ph = scope.querySelectorAll("[data-i18n-placeholder]");
  for (let i = 0; i < ph.length; i++) {
    ph[i].placeholder = t(ph[i].getAttribute("data-i18n-placeholder"));
  }
  const htmlLang = lang === "en" ? "en" : "zh-CN";
  if (scope === document || scope === document.documentElement) {
    document.documentElement.lang = htmlLang;
    document.title = t("app.title");
  }
}
