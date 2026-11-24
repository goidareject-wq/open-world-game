import { CFG } from './config.js';

const memFallback = {};

function storage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (e) { /* ignore */ }
  return null;
}

export class SaveSystem {
  get store() {
    const s = storage();
    return s || { getItem: (k) => (k in memFallback ? memFallback[k] : null), setItem: (k, v) => { memFallback[k] = String(v); }, removeItem: (k) => { delete memFallback[k]; } };
  }

  hasSave() {
    return !!this.store.getItem(CFG.saveKey);
  }

  writeSave(data) {
    try {
      this.store.setItem(CFG.saveKey, JSON.stringify({ v: 1, savedAt: Date.now(), ...data }));
      return true;
    } catch (e) {
      return false;
    }
  }

  readSave() {
    try {
      const raw = this.store.getItem(CFG.saveKey);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return d && d.v === 1 ? d : null;
    } catch (e) {
      return null;
    }
  }

  deleteSave() {
    try { this.store.removeItem(CFG.saveKey); } catch (e) { /* ignore */ }
  }

  writeSettings(s) {
    try { this.store.setItem(CFG.settingsKey, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  readSettings() {
    try {
      const raw = this.store.getItem(CFG.settingsKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
}
