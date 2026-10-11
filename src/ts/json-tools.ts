import type { Project, StringEntry, TranslationStatus } from "./types.js";

export type FlatMap = Record<string, string>;

export function flatten(input: unknown, prefix = "", out: FlatMap = {}): FlatMap {
  if (input !== null && typeof input === "object") {
    const entries = Array.isArray(input)
      ? input.map((v, i) => [String(i), v] as const)
      : Object.entries(input as Record<string, unknown>);
    if (entries.length === 0) out[prefix] = "";
    for (const [k, v] of entries) {
      const next = prefix ? `${prefix}.${k}` : k;
      flatten(v, next, out);
    }
    return out;
  }
  out[prefix] = input === null || input === undefined ? "" : String(input);
  return out;
}

export function unflatten(flat: FlatMap): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const key of Object.keys(flat).sort()) {
    const parts = key.split(".");
    let node = root as Record<string, unknown>;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        node[part] = flat[key];
      } else {
        if (typeof node[part] !== "object" || node[part] === null) node[part] = {};
        node = node[part] as Record<string, unknown>;
      }
    });
  }
  return root;
}

export interface SyncPlan {
  file: string;
  added: { key: string; source: string }[];
  changed: { key: string; from: string; to: string }[];
  removed: { key: string; source: string }[];
  unchanged: number;
}

export function diffAgainstFile(p: Project, file: string, incoming: FlatMap): SyncPlan {
  const existing = p.strings.filter((s) => s.file === file);
  const existingByKey = new Map(existing.map((s) => [s.key, s]));
  const plan: SyncPlan = { file, added: [], changed: [], removed: [], unchanged: 0 };

  for (const key of Object.keys(incoming)) {
    const nextSource = incoming[key];
    const current = existingByKey.get(key);
    if (!current) {
      plan.added.push({ key, source: nextSource });
    } else if (current.source !== nextSource) {
      plan.changed.push({ key, from: current.source, to: nextSource });
    } else {
      plan.unchanged++;
    }
    existingByKey.delete(key);
  }

  existingByKey.forEach((s) => plan.removed.push({ key: s.key, source: s.source }));
  plan.added.sort((a, b) => a.key.localeCompare(b.key));
  plan.changed.sort((a, b) => a.key.localeCompare(b.key));
  plan.removed.sort((a, b) => a.key.localeCompare(b.key));
  return plan;
}

export interface ApplyOptions {
  pruneRemoved: boolean;
  languages: string[];
  actor: string;
}

export interface ApplyResult {
  added: number;
  changed: number;
  removed: number;
}

export function applySync(p: Project, plan: SyncPlan, opts: ApplyOptions): ApplyResult {
  const byKey = new Map(p.strings.map((s) => [s.key, s]));
  const now = Date.now();

  plan.added.forEach(({ key, source }) => {
    const translations: StringEntry["translations"] = {};
    opts.languages.forEach((code) => {
      translations[code] = { text: "", status: "untranslated" };
    });
    p.strings.push({
      key,
      file: plan.file,
      context: `Imported from ${plan.file}`,
      source,
      translations,
    });
  });

  plan.changed.forEach(({ key, to }) => {
    const s = byKey.get(key);
    if (s) {
      s.source = to;
      Object.values(s.translations).forEach((t) => {
        if (t.text && t.status === "approved") t.status = "translated";
      });
    }
  });

  let removed = 0;
  if (opts.pruneRemoved) {
    plan.removed.forEach(({ key }) => {
      const idx = p.strings.findIndex((s) => s.key === key);
      if (idx >= 0) {
        p.strings.splice(idx, 1);
        removed++;
      }
    });
  }

  p.updated = now;
  p.activity.unshift({
    kind: "info",
    text: `<b>${escapeHtml(opts.actor)}</b> synced <b>${plan.file}</b> (+${plan.added.length} / ~${plan.changed.length}${opts.pruneRemoved ? ` / -${removed}` : ""})`,
    time: now,
  });

  return { added: plan.added.length, changed: plan.changed.length, removed };
}

export function buildExport(p: Project, code: string, onlyTranslated: boolean): string {
  const flat: FlatMap = {};
  p.strings.forEach((s) => {
    const t = s.translations[code];
    if (onlyTranslated && (!t || !t.text)) return;
    flat[s.key] = t ? t.text || s.source : s.source;
  });
  return JSON.stringify(unflatten(flat), null, 2);
}

export function buildSourceExport(p: Project): string {
  const flat: FlatMap = {};
  p.strings.forEach((s) => {
    flat[s.key] = s.source;
  });
  return JSON.stringify(unflatten(flat), null, 2);
}

export function importText(text: string): FlatMap {
  const parsed = JSON.parse(text) as unknown;
  return flatten(parsed);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function download(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function statusIcon(status: TranslationStatus): string {
  return status === "approved" ? "ok" : status === "translated" ? "info" : "muted";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
