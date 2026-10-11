import { can } from "../rbac.js";
import type { TranslationStatus } from "../types.js";
import { boot, $, $all, el, esc, progressBar, statusTag, toast, SVG, applyPermissionGates, must } from "../ui.js";
import { commit, project as findProject, fileList, fileCount, progressFor, targetLanguages, languageName, getState } from "../store.js";
import { presetSuggestions, machineTranslation } from "../seed.js";
import { buildExport, download } from "../json-tools.js";
import type { Project, StringEntry } from "../types.js";

const user = must(boot(), "authentication required");

const params = new URLSearchParams(location.search);
const p = must(findProject(params.get("project") || "") || findProject("capes-site"), "No project");

const PERM = {
  edit: can(user.role, "translation.edit"),
  approve: can(user.role, "translation.approve"),
  exportJson: can(user.role, "project.export"),
  upload: can(user.role, "project.upload"),
};

const langs = targetLanguages(p);
const state = {
  lang: params.get("lang") || p.languages[0] || "es-ES",
  file: "all",
  status: "all",
  query: "",
  activeId: "",
  ctxTab: "suggestions" as "suggestions" | "comments" | "glossary",
};

if (!langs.some((l) => l.code === state.lang)) state.lang = langs[0]?.code || "es-ES";

document.title = `Translate ${p.name} — capes.localize`;
$("#docTitle").replaceChildren(document.createTextNode(`Translate: ${p.name}`));

const GLOSSARY = [
  { term: "cape", note: "A cosmetic item worn on the back - keep as is" },
  { term: "ranking", note: "Ordered list of accounts" },
  { term: "profile", note: "Public account page" },
  { term: "UUID", note: "Never translate — keep as-is" },
  { term: "Minecon", note: "Proper noun — keep as-is" },
];

const COMMENTS_KEY = () => `capes.localize.comments.${p.id}`;
const comments: Record<string, { author: string; text: string; time: string }[]> = loadComments();

function loadComments(): Record<string, { author: string; text: string; time: string }[]> {
  try {
    return JSON.parse(localStorage.getItem(COMMENTS_KEY()) || "{}");
  } catch {
    return {};
  }
}
function persistComments(): void {
  try {
    localStorage.setItem(COMMENTS_KEY(), JSON.stringify(comments));
  } catch {
    /* ignore */
  }
}

// ---------- toolbar ----------
function buildToolbar(): void {
  const projectSelect = $<HTMLSelectElement>("#projectSelect");
  projectSelect.innerHTML = "";
  getProjectsForSelect().forEach((proj) => {
    const o = document.createElement("option");
    o.value = proj.id;
    o.textContent = proj.name;
    o.selected = proj.id === p.id;
    projectSelect.append(o);
  });
  projectSelect.addEventListener("change", () => {
    location.href = `editor.html?project=${encodeURIComponent(projectSelect.value)}&lang=${encodeURIComponent(state.lang)}`;
  });

  const langSelect = $<HTMLSelectElement>("#langSelect");
  langSelect.innerHTML = "";
  langs.forEach((l) => {
    const o = document.createElement("option");
    o.value = l.code;
    o.textContent = `${l.native} · ${l.name}`;
    o.selected = l.code === state.lang;
    langSelect.append(o);
  });
  langSelect.addEventListener("change", (e) => {
    state.lang = (e.target as HTMLSelectElement).value;
    state.activeId = "";
    renderFileTree();
    renderStrings();
    renderProgress();
    toast(`Target language: ${languageName(state.lang)}`);
  });

  $<HTMLInputElement>("#search").addEventListener("input", (e) => {
    state.query = (e.target as HTMLInputElement).value;
    renderStrings();
  });
  $<HTMLSelectElement>("#statusFilter").addEventListener("change", (e) => {
    state.status = (e.target as HTMLSelectElement).value;
    renderStrings();
  });

  const pre = $<HTMLButtonElement>("#preTranslate");
  pre.classList.toggle("perm-locked", !PERM.edit);
  (pre as HTMLButtonElement).disabled = !PERM.edit;
  pre.addEventListener("click", () => {
    if (!PERM.edit) return;
    preTranslate();
  });

  if (PERM.upload) {
    const importBtn = el<HTMLButtonElement>(`<button class="btn-ghost btn-sm" id="importBtn" type="button">${SVG.upload} Import</button>`);
    importBtn.addEventListener("click", () => location.href = `project.html?id=${p.id}&import=1`);
    $("#statusFilter").after(importBtn);
  }
  if (PERM.exportJson) {
    const exportBtn = el<HTMLButtonElement>(`<button class="btn-ghost btn-sm" id="exportBtn" type="button">${SVG.download} Export</button>`);
    exportBtn.addEventListener("click", () => {
      download(`${p.id}.${state.lang}.json`, buildExport(p, state.lang, false));
      toast("Exported translation JSON.", "ok");
    });
    $("#saveFile").after(exportBtn);
  }

  $("#saveFile").addEventListener("click", () => {
    renderStrings();
    toast(`All visible edits for ${languageName(state.lang)} saved.`, "ok");
  });

  $("#ctxTabs").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    $all<HTMLButtonElement>("#ctxTabs button").forEach((x) => x.classList.toggle("active", x === b));
    state.ctxTab = b.dataset.tab as typeof state.ctxTab;
    renderContext();
  });
}

function getProjectsForSelect(): Project[] {
  return getState().projects;
}

// ---------- helpers ----------
function textOf(s: StringEntry): string {
  const t = s.translations[state.lang];
  return (t && t.text) || "";
}
function statusOf(s: StringEntry): TranslationStatus {
  const t = s.translations[state.lang];
  if (!t || !t.text) return "untranslated";
  return t.status;
}
function setTranslationText(s: StringEntry, text: string, status?: TranslationStatus): void {
  commit((data) => {
    const proj = data.projects.find((x) => x.id === p.id);
    const entry = proj?.strings.find((e) => e.key === s.key);
    if (!proj || !entry) return;
    const t = entry.translations[state.lang] || (entry.translations[state.lang] = { text: "", status: "untranslated" });
    t.text = text;
    t.updatedAt = Date.now();
    t.updatedBy = user.displayName;
    if (status) t.status = status;
    else t.status = text ? "translated" : "untranslated";
  });
}

function placeholders(t: string): Set<string> {
  const set = new Set<string>();
  (t.match(/\{[^}]+\}/g) || []).forEach((m) => set.add(m));
  (t.match(/%[sd]/g) || []).forEach((m) => set.add(m));
  return set;
}

interface QaIssue {
  level: "bad" | "warn";
  text: string;
}

function qa(s: StringEntry): QaIssue[] {
  const src = s.source;
  const tr = textOf(s);
  const out: QaIssue[] = [];
  if (!tr) return out;
  const sp = placeholders(src);
  const tp = placeholders(tr);
  sp.forEach((ph) => {
    if (!tp.has(ph)) out.push({ level: "bad", text: `Missing placeholder ${ph}` });
  });
  tp.forEach((ph) => {
    if (!sp.has(ph)) out.push({ level: "bad", text: `Extra placeholder ${ph}` });
  });
  if (s.max && tr.length > s.max) out.push({ level: "warn", text: `Exceeds max length (${tr.length}/${s.max})` });
  if (/^\s|\s$/.test(tr)) out.push({ level: "warn", text: "Leading or trailing whitespace" });
  if (tr.toLowerCase() === src.toLowerCase() && /[A-Za-z]/.test(src)) out.push({ level: "warn", text: "Identical to source" });
  return out;
}

function visibleStrings(): StringEntry[] {
  const q = state.query.toLowerCase();
  return p.strings.filter((s) => {
    if (state.file !== "all" && s.file !== state.file) return false;
    if (q && !(s.source.toLowerCase().includes(q) || s.key.toLowerCase().includes(q))) return false;
    const st = statusOf(s);
    if (state.status === "qa") return qa(s).length > 0;
    if (state.status !== "all" && st !== state.status) return false;
    return true;
  });
}

function renderProgress(): void {
  const prog = progressFor(p, state.lang);
  $("#progressWrap").innerHTML = progressBar(prog, true);
}

// ---------- files ----------
function renderFileTree(): void {
  const host = $("#fileTree");
  host.innerHTML = "";
  const all = el(`<li><button data-file="all" class="${state.file === "all" ? "active" : ""}"><span>All files</span><span class="count">${p.strings.length}</span></button></li>`);
  host.append(all);
  fileList(p).forEach((f) => {
    host.append(el(`<li><button data-file="${esc(f)}" class="${state.file === f ? "active" : ""}"><span>${esc(f)}</span><span class="count">${fileCount(p, f)}</span></button></li>`));
  });
  host.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      state.file = b.dataset.file || "all";
      renderFileTree();
      renderStrings();
    })
  );
}

// ---------- strings ----------
function renderStrings(): void {
  const host = $("#strings");
  host.innerHTML = "";
  const list = visibleStrings();
  if (!list.length) {
    host.append(el('<div class="panel empty">No strings match the current filter.</div>'));
    renderContext();
    return;
  }
  list.forEach((s) => {
    const st = statusOf(s);
    const checks = qa(s);
    const card = el<HTMLElement>(`
      <article class="string-card ${state.activeId === s.key ? "active" : ""}" data-id="${esc(s.key)}">
        <div class="sc-head">
          <span class="sc-id">${esc(s.file)} · ${esc(s.key)}</span>
          <span class="st-tag">${statusTag(st)}</span>
        </div>
        <div class="string-source"><span class="ctx">${esc(s.context || "")}</span>${esc(s.source)}</div>
        <textarea class="string-trans" data-id="${esc(s.key)}" placeholder="Enter translation…" aria-label="Translation for ${esc(s.key)}" ${PERM.edit ? "" : "readonly disabled"}></textarea>
        ${checks.length ? `<div class="qa-list">${checks.map((c) => `<span class="qa ${c.level}">${SVG_lamp()}${esc(c.text)}</span>`).join("")}</div>` : ""}
        <div class="sc-actions">
          <span class="sc-char muted small"></span>
          <span class="spacer"></span>
          <button class="btn-ghost btn-sm" data-act="copy" type="button">Copy source</button>
          <button class="btn-ghost btn-sm" data-act="skip" type="button">Skip</button>
          ${PERM.edit ? `<button class="btn-primary btn-sm btn-save" data-act="save" type="button">Save</button>` : ""}
          ${PERM.approve ? `<button class="btn-primary btn-sm btn-approve" data-act="approve" type="button">Approve</button>` : ""}
        </div>
        ${PERM.edit ? "" : `<p class="lock-hint">${SVG.lock} Read-only — your role can't edit translations.</p>`}
      </article>`);

    const ta = card.querySelector("textarea") as HTMLTextAreaElement;
    ta.value = textOf(s);
    const char = card.querySelector(".sc-char") as HTMLElement;
    const updateChar = () => {
      char.textContent = s.max ? `${ta.value.length}/${s.max}` : `${ta.value.length} chars`;
    };
    updateChar();

    ta.addEventListener("focus", () => {
      state.activeId = s.key;
      markActive();
      renderContext();
    });
    if (PERM.edit) {
      ta.addEventListener("input", () => {
        setTranslationText(s, ta.value);
        updateChar();
        card.querySelector(".st-tag")!.innerHTML = statusTag(statusOf(s));
        renderProgress();
        const checksNow = qa(s);
        card.querySelector(".qa-list")?.remove();
        if (checksNow.length) {
          card.querySelector(".sc-actions")!.insertAdjacentHTML(
            "beforebegin",
            `<div class="qa-list">${checksNow.map((c) => `<span class="qa ${c.level}">${SVG_lamp()}${esc(c.text)}</span>`).join("")}</div>`
          );
        }
      });
    }
    card.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => doAction(s, btn.dataset.act || "", ta));
    });
    host.append(card);
  });

  const first = list.find((s) => s.key === state.activeId) ? state.activeId : list[0].key;
  state.activeId = first;
  markActive();
  renderContext();
}

function markActive(): void {
  document.querySelectorAll(".string-card").forEach((c) => c.classList.toggle("active", (c as HTMLElement).dataset.id === state.activeId));
}

function SVG_lamp(): string {
  return '<svg viewBox="0 0 24 24"><path d="M12 2l1.5 5.5L20 9l-5 4 1.5 5.5L12 15l-4.5 3.5L9 13l-5-4 6.5-1.5L12 2z"/></svg>';
}

function doAction(s: StringEntry, act: string, ta: HTMLTextAreaElement): void {
  if (act === "copy") {
    ta.value = s.source;
    setTranslationText(s, s.source, "translated");
    ta.dispatchEvent(new Event("input"));
    ta.focus();
    return;
  }
  if (act === "skip") {
    nav(1);
    return;
  }
  if (act === "save") {
    if (!ta.value) {
      toast("Nothing to save — the translation is empty.", "warn");
      return;
    }
    setTranslationText(s, ta.value, "translated");
    toast(`Saved <b>${esc(s.key)}</b>`, "ok");
    renderStrings();
    renderProgress();
    return;
  }
  if (act === "approve") {
    if (!ta.value) {
      toast("Add a translation before approving.", "bad");
      return;
    }
    const issues = qa(s);
    if (issues.some((c) => c.level === "bad")) {
      toast("Fix QA issues before approving.", "bad");
      return;
    }
    setTranslationText(s, ta.value, "approved");
    toast(`Approved <b>${esc(s.key)}</b>`, "ok");
    renderStrings();
    renderProgress();
  }
}

function nav(dir: number): void {
  const cards = document.querySelectorAll<HTMLElement>(".string-card");
  const idx = Array.from(cards).findIndex((c) => c.dataset.id === state.activeId);
  const next = cards[idx + dir];
  if (!next) return;
  state.activeId = next.dataset.id || "";
  markActive();
  next.scrollIntoView({ block: "center", behavior: "smooth" });
  next.querySelector("textarea")?.focus();
  renderContext();
}

// ---------- context panel ----------
function renderContext(): void {
  const host = $("#ctxBody");
  const s = p.strings.find((x) => x.key === state.activeId);
  if (!s) {
    host.innerHTML = '<p class="empty">Select a string to see context.</p>';
    return;
  }
  if (state.ctxTab === "suggestions") renderSuggestions(host, s);
  else if (state.ctxTab === "comments") renderComments(host, s);
  else renderGlossary(host, s);
}

function renderSuggestions(host: HTMLElement, s: StringEntry): void {
  const sugs: { text: string; match: number; provider: string; ai?: boolean }[] = [];
  presetSuggestions(state.lang).forEach((t) => {
    if (t.toLowerCase() !== s.source.toLowerCase()) {
      sugs.push({ text: t, match: 62 + Math.floor(Math.random() * 20), provider: "Translation Memory" });
    }
  });
  const mt = machineTranslation(state.lang, s.source);
  if (mt) sugs.push({ text: mt, match: 88, provider: "Neural Machine Translation" });
  sugs.push({ text: `[${state.lang}] ${s.source}`, match: 74, provider: "AI Assistant", ai: true });

  const editLocked = !PERM.edit;
  host.innerHTML = `<h4>Suggestions for ${esc(languageName(state.lang))}</h4>${editLocked ? `<p class="lock-hint">${SVG.lock} Read-only view.</p>` : ""}`;
  if (!sugs.length) {
    host.append(el('<p class="empty">No suggestions available.</p>'));
    return;
  }
  sugs.forEach((sug) => {
    const node = el(`<div class="suggestion">
      <div class="sug-meta"><span>${esc(sug.provider)}${sug.ai ? " · AI" : ""}</span><span class="match">${sug.match}%</span></div>
      <div>${esc(sug.text)}</div>
    </div>`);
    if (editLocked) node.classList.add("muted");
    node.addEventListener("click", () => {
      if (!PERM.edit) {
        toast("Your role can't apply suggestions.", "warn");
        return;
      }
      const ta = document.querySelector<HTMLTextAreaElement>(`.string-trans[data-id="${CSS.escape(s.key)}"]`);
      applySuggestion(ta, s, sug.text, sug.provider);
    });
    host.append(node);
  });

  const useBest = el(`<button class="btn-ghost btn-sm btn-block" id="useBest" type="button" style="margin-top:.4rem">Use best match</button>`);
  useBest.addEventListener("click", () => {
    if (!PERM.edit) {
      toast("Your role can't apply suggestions.", "warn");
      return;
    }
    const best = sugs.slice().sort((a, b) => b.match - a.match)[0];
    const ta = document.querySelector<HTMLTextAreaElement>(`.string-trans[data-id="${CSS.escape(s.key)}"]`);
    if (ta && best) applySuggestion(ta, s, best.text, best.provider);
  });
  host.append(useBest);
}

function applySuggestion(ta: HTMLTextAreaElement | null, s: StringEntry, text: string, provider: string): void {
  if (!ta) return;
  ta.value = text;
  ta.dispatchEvent(new Event("input"));
  ta.focus();
  toast(`Applied ${esc(provider)} suggestion.`, "ok");
  void s;
}

function renderComments(host: HTMLElement, s: StringEntry): void {
  const list = comments[s.key] || [];
  host.innerHTML = "<h4>Comments</h4>";
  if (!list.length) host.append(el('<p class="empty">No comments yet.</p>'));
  list.forEach((c) =>
    host.append(el(`<div class="comment">${avatarLetter(c.author)}<div><span class="who">${esc(c.author)}</span><time>${esc(c.time)}</time><p>${esc(c.text)}</p></div></div>`))
  );
  const form = el(`<div class="comment-input"><input type="text" placeholder="Add a comment" /><button class="btn-primary btn-sm" type="button">Post</button></div>`);
  const input = form.querySelector("input") as HTMLInputElement;
  const post = () => {
    const v = input.value.trim();
    if (!v) return;
    (comments[s.key] = comments[s.key] || []).push({ author: user.displayName, text: v, time: "just now" });
    persistComments();
    renderComments(host, s);
  };
  form.querySelector("button")!.addEventListener("click", post);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") post();
  });
  host.append(form);
}

function avatarLetter(name: string): string {
  return `<span class="avatar" style="width:28px;height:28px;font-size:.7rem">${esc((name[0] || "?").toUpperCase())}</span>`;
}

function renderGlossary(host: HTMLElement, s: StringEntry): void {
  host.innerHTML = "<h4>Glossary</h4>";
  GLOSSARY.forEach((g) => {
    const inSource = s.source.toLowerCase().includes(g.term.toLowerCase());
    host.append(el(`<div class="suggestion" style="cursor:default">
      <div class="sug-meta"><span>${esc(g.term)}</span>${inSource ? '<span class="match">in source</span>' : ""}</div>
      <div class="muted">${esc(g.note)}</div>
    </div>`));
  });
}

// ---------- pre-translate ----------
function preTranslate(): void {
  let n = 0;
  const candidates = p.strings.filter((s) => !textOf(s));
  candidates.forEach((s) => {
    const best = bestFor(s);
    if (best) {
      setTranslationText(s, best.text, "translated");
      n++;
    }
  });
  toast(n ? `Pre-translated ${n} strings with AI.` : "Every string already has a translation.", n ? "ok" : "warn");
  renderStrings();
  renderProgress();
}

function bestFor(s: StringEntry): { text: string; match: number } | null {
  const mt = machineTranslation(state.lang, s.source);
  const pool = presetSuggestions(state.lang);
  const options: { text: string; match: number }[] = [];
  if (mt) options.push({ text: mt, match: 88 });
  pool.forEach((t) => {
    if (t.toLowerCase() !== s.source.toLowerCase()) options.push({ text: t, match: 70 });
  });
  if (!options.length) return null;
  return options.sort((a, b) => b.match - a.match)[0];
}

// ---------- keyboard ----------
document.addEventListener("keydown", (e) => {
  const card = (document.activeElement as HTMLElement | null)?.closest?.(".string-card") as HTMLElement | null;
  const s = card ? p.strings.find((x) => x.key === (card.dataset.id || "")) : undefined;
  if (!card || !s) return;
  if (e.ctrlKey && e.key === "Enter" && e.shiftKey) {
    e.preventDefault();
    if (PERM.approve) doAction(s, "approve", card.querySelector("textarea") as HTMLTextAreaElement);
  } else if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault();
    if (PERM.edit) doAction(s, "save", card.querySelector("textarea") as HTMLTextAreaElement);
  } else if (e.altKey && e.key === "ArrowDown") {
    e.preventDefault();
    nav(1);
  } else if (e.altKey && e.key === "ArrowUp") {
    e.preventDefault();
    nav(-1);
  }
});

buildToolbar();
applyPermissionGates();
renderFileTree();
renderProgress();
renderStrings();