import { NOTES_KEY, DEFAULT_FOLDER_ID } from "../../../shared/const.js";

export function townFolderId(raw) {
  return "town:" + encodeURIComponent(String(raw || ""));
}

export function buildingsFolderId(raw) {
  return townFolderId(raw) + "/buildings";
}

export function guideFolderId(raw) {
  return townFolderId(raw) + "/guide";
}

export function emptyNoteStore() {
  return { folders: [defaultFolder()], notes: [] };
}

function defaultFolder() {
  return { id: DEFAULT_FOLDER_ID, name: "未分类", parentId: null, kind: "user", town: "" };
}

export function normalizeFolder(f) {
  if (!f || typeof f !== "object") return f;
  f.parentId = f.parentId || null;
  f.kind = f.kind || "user";
  f.town = f.town || "";
  if (f.id === DEFAULT_FOLDER_ID) {
    f.parentId = null;
    f.kind = "user";
    f.town = "";
  }
  return f;
}

export function normalizeNote(n) {
  if (!n || typeof n !== "object") return n;
  n.folderId = n.folderId || DEFAULT_FOLDER_ID;
  if (n.type === "building") n.type = "pin";
  const z = Number(n.z);
  n.z = Number.isFinite(z) ? z : 0;
  return n;
}

function normalizeStore(store) {
  if (!store || !Array.isArray(store.notes)) return emptyNoteStore();
  if (!store.folders || !store.folders.length) {
    store.folders = [defaultFolder()];
  }
  let hasDefault = false;
  for (let i = 0; i < store.folders.length; i++) {
    normalizeFolder(store.folders[i]);
    if (store.folders[i].id === DEFAULT_FOLDER_ID) hasDefault = true;
  }
  if (!hasDefault) store.folders.unshift(defaultFolder());
  for (let i = 0; i < store.notes.length; i++) normalizeNote(store.notes[i]);
  return store;
}

export function loadNoteStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
    if (Array.isArray(raw)) {
      return normalizeStore({
        folders: [defaultFolder()],
        notes: raw,
      });
    }
    if (raw && Array.isArray(raw.notes)) return normalizeStore(raw);
  } catch (err) {}
  return emptyNoteStore();
}

export function saveNoteStore(store) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(store));
  } catch (err) {}
}

export function parseImportedNotes(dataIn) {
  if (Array.isArray(dataIn)) {
    return normalizeStore({
      folders: [defaultFolder()],
      notes: dataIn,
    });
  }
  if (dataIn && Array.isArray(dataIn.notes)) return normalizeStore(dataIn);
  return null;
}
