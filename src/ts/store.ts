import type { AppData, Language, Project, Progress, StringEntry, User, TranslationStatus } from "./types.js";
import { createSeed } from "./seed.js";

const STORAGE_KEY = "capes.localize.data.v2";

let state: AppData = load();
const listeners = new Set<() => void>();

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed && parsed.version === 2 && Array.isArray(parsed.projects)) return parsed;
    }
  } catch {
    /* ignore corrupt storage */
  }
  const seed = createSeed();
  persist(seed);
  return seed;
}

function persist(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage may be unavailable */
  }
}

export function getState(): AppData {
  return state;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function commit(mutator: (data: AppData) => void): void {
  mutator(state);
  persist(state);
  listeners.forEach((fn) => fn());
}

export function resetData(): void {
  state = createSeed();
  persist(state);
  listeners.forEach((fn) => fn());
}

export function project(id: string): Project | undefined {
  return state.projects.find((p) => p.id === id);
}

export function language(code: string): Language | undefined {
  return state.languages.find((l) => l.code === code);
}

export function languageName(code: string): string {
  const l = language(code);
  return l ? l.native : code;
}

export function targetLanguages(p: Project): Language[] {
  return p.languages.map((c) => language(c)).filter((l): l is Language => Boolean(l));
}

export function user(id: string): User | undefined {
  return state.users.find((u) => u.id === id);
}

export function fileList(p: Project): string[] {
  const files: string[] = [];
  p.strings.forEach((s) => {
    if (!files.includes(s.file)) files.push(s.file);
  });
  return files;
}

export function fileCount(p: Project, file: string): number {
  return p.strings.filter((s) => s.file === file).length;
}

export function statusOf(entry: StringEntry, code: string): TranslationStatus {
  const t = entry.translations[code];
  if (!t || !t.text) return "untranslated";
  return t.status;
}

export function progressFor(p: Project, code: string): Progress {
  let approved = 0;
  let translated = 0;
  p.strings.forEach((s) => {
    const st = statusOf(s, code);
    if (st === "approved") {
      approved++;
      translated++;
    } else if (st === "translated") {
      translated++;
    }
  });
  const total = p.strings.length;
  return {
    total,
    approved,
    translated,
    untranslated: total - translated,
    approvedPct: total ? Math.round((approved / total) * 100) : 0,
    translatedPct: total ? Math.round((translated / total) * 100) : 0,
  };
}

export function overallProgress(p: Project): Progress {
  const langs = p.languages;
  let approved = 0;
  let translated = 0;
  langs.forEach((code) => {
    const r = progressFor(p, code);
    approved += r.approved;
    translated += r.translated;
  });
  const denom = langs.length * p.strings.length || 1;
  return {
    total: p.strings.length,
    approved,
    translated,
    untranslated: denom - translated,
    approvedPct: Math.round((approved / denom) * 100),
    translatedPct: Math.round((translated / denom) * 100),
  };
}

export function languageRows(p: Project): { language: Language; progress: Progress }[] {
  return targetLanguages(p)
    .map((language) => ({ language, progress: progressFor(p, language.code) }))
    .sort((a, b) => b.progress.approvedPct - a.progress.approvedPct);
}

export function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}]+/gu) || []).length;
}

export function totalStrings(): number {
  return state.projects.reduce((a, p) => a + p.strings.length, 0);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "project";
}
