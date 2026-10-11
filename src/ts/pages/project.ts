import { can } from "../rbac.js";
import { boot, $, el, esc, formatNumber, openModal, progressBar, relTime, toast, SVG, applyPermissionGates, must } from "../ui.js";
import { commit, project as findProject, targetLanguages, languageRows, fileList, fileCount, overallProgress, getState } from "../store.js";
import { buildExport, buildSourceExport, diffAgainstFile, download, importText, readFileAsText, applySync } from "../json-tools.js";
import type { SyncPlan } from "../json-tools.js";
import type { Project } from "../types.js";

const user = must(boot(), "authentication required");

const params = new URLSearchParams(location.search);
let projectId = params.get("id") || "";
const all = getState().projects;
if (!all.some((p) => p.id === projectId)) projectId = all[0]?.id || "";

const p = must(findProject(projectId), "Project not found");

const uPerm = {
  upload: can(user.role, "project.upload"),
  exportJson: can(user.role, "project.export"),
  lang: can(user.role, "language.manage"),
  edit: can(user.role, "translation.view"),
};

document.title = `${p.name} — capes.localize`;
$("#pName").textContent = p.name;
$("#pDesc").textContent = p.desc;
$<HTMLAnchorElement>("#pEditor").href = `editor.html?project=${p.id}&lang=${p.languages[0] || "es-ES"}`;
if (!uPerm.edit) {
  $("#pEditor").classList.add("perm-locked");
  $("#pEditor").setAttribute("aria-disabled", "true");
}

const headerActions = $("#pActions");
if (uPerm.upload) {
  headerActions.insertAdjacentHTML("beforeend", `<button class="btn-primary" id="btnUpload" type="button">${SVG.upload} Import JSON</button>`);
}
if (uPerm.exportJson) {
  headerActions.insertAdjacentHTML("beforeend", `<button class="btn-ghost" id="btnDownload" type="button">${SVG.download} Export</button>`);
}

function renderStats(): void {
  const prog = overallProgress(p);
  const words = p.strings.reduce((a, s) => a + (s.source.trim() ? s.source.split(/\s+/).length : 0), 0);
  $("#pStats").innerHTML = [
    `<div class="stat-card"><b>${formatNumber(p.strings.length)}</b><span>Strings</span></div>`,
    `<div class="stat-card"><b>${formatNumber(words)}</b><span>Words</span></div>`,
    `<div class="stat-card"><b>${formatNumber(p.languages.length)}</b><span>Target languages</span></div>`,
    `<div class="stat-card"><b>${prog.approvedPct}%</b><span>Approved</span></div>`,
  ].join("");
}

// ---------- tabs ----------
const tabs = $("#tabs");
const views: Record<string, string> = {
  languages: "Languages",
  files: "Files",
  import: "Import / Update",
  activity: "Activity",
};

Object.entries(views).forEach(([id, label]) => {
  const isImport = id === "import";
  const b = el<HTMLButtonElement>(`<button type="button" data-view="${id}" ${isImport ? "data-perm=\"project.upload\"" : ""}>${label}</button>`);
  b.addEventListener("click", () => {
    tabs.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    renderView(id);
  });
  tabs.append(b);
});
applyPermissionGates();

let importedOnce = false;
function renderView(view: string): void {
  const host = $("#viewHost");
  host.innerHTML = "";
  if (view === "languages") renderLanguages(host);
  else if (view === "files") renderFiles(host);
  else if (view === "import") {
    renderImport(host);
    if (!importedOnce && params.get("import") === "1") {
      importedOnce = true;
      const input = document.querySelector<HTMLInputElement>("#fileInput");
      input?.click();
    }
  } else renderActivity(host);
}

// ---------- languages ----------
function renderLanguages(host: HTMLElement): void {
  const rows = languageRows(p);
  const head = el(`<div class="view-head"><h2 class="section-title">Target languages for ${esc(p.name)}</h2>
    ${uPerm.lang ? `<button class="btn-ghost btn-sm" id="addLang" type="button">${SVG.plus} Add language</button>` : ""}</div>`);

  const table = el(`<div class="table-wrap"><table>
    <thead><tr><th>Language</th><th style="width:34%">Completion</th><th>Approved</th><th>Translated</th><th></th></tr></thead>
    <tbody id="langBody"></tbody></table></div>`);
  const body = $("tbody", table) as HTMLTableSectionElement;

  rows.forEach(({ language, progress }) => {
    const removeBtn = uPerm.lang
      ? `<button class="icon-btn danger" data-remove="${language.code}" title="Remove language">${SVG.trash}</button>`
      : "";
    const trEl = el(`<tr>
      <td><div class="row-lang"><img class="flag" src="${esc(language.flag)}" alt="" /><span>${esc(language.native)}<br /><span class="muted">${esc(language.name)}</span></span></div></td>
      <td>${progressBar(progress)}</td>
      <td><span class="tag ${progress.approvedPct >= 90 ? "ok" : progress.approvedPct >= 50 ? "info" : "warn"}">${progress.approvedPct}%</span></td>
      <td><span class="tag ${progress.translatedPct >= 90 ? "ok" : "info"}">${progress.translatedPct}%</span></td>
      <td class="row-actions"><a class="btn-ghost btn-sm" href="editor.html?project=${p.id}&lang=${encodeURIComponent(language.code)}">Translate</a>${removeBtn}</td>
    </tr>`);
    body.append(trEl);
  });

  if (uPerm.lang) {
    table.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((b) => {
      b.addEventListener("click", () => removeLanguage(b.dataset.remove || ""));
    });
  }

  if (!rows.length) {
    body.append(el(`<tr><td colspan="5"><p class="empty">No target languages yet. ${uPerm.lang ? "Add one to start translating." : "Ask a manager to add languages."}</p></td></tr>`));
  }

  host.append(head, table);
  if (uPerm.lang) $("#addLang").addEventListener("click", () => addLanguageModal());
}

function addLanguageModal(): void {
  const catalog = getState().languages.filter((l) => !l.source && !p.languages.includes(l.code));
  if (!catalog.length) {
    toast("Every catalog language is already enabled for this project.", "warn");
    return;
  }
  const options = catalog
    .map((l) => `<label class="check-row"><input type="checkbox" value="${l.code}" checked /><span><img class="flag" src="${esc(l.flag)}" alt="" />${esc(l.native)} <small>${esc(l.name)}</small></span></label>`)
    .join("");
  openModal({
    title: "Add target languages",
    body: `<div class="check-list">${options}</div><p class="modal-text">New strings are marked untranslated for the added languages.</p>`,
    actions: [
      { label: "Cancel", variant: "ghost", onClick: (c) => c() },
      {
        label: "Add selected",
        onClick: (c) => {
          const codes = Array.from(document.querySelectorAll<HTMLInputElement>(".check-list input:checked")).map((i) => i.value);
          if (!codes.length) {
            toast("Select at least one language.", "warn");
            return;
          }
          commit((data) => {
            const proj = data.projects.find((x) => x.id === p.id);
            if (!proj) return;
            codes.forEach((code) => {
              if (!proj.languages.includes(code)) {
                proj.languages.push(code);
                proj.strings.forEach((s) => {
                  if (!s.translations[code]) s.translations[code] = { text: "", status: "untranslated" };
                });
                proj.activity.unshift({ kind: "info", text: `<b>${esc(user.displayName)}</b> added <b>${esc(code)}</b> as a target language`, time: Date.now() });
              }
            });
          });
          c();
          toast(`Added ${codes.length} language${codes.length > 1 ? "s" : ""}.`, "ok");
          refresh();
        },
      },
    ],
  });
}

function removeLanguage(code: string): void {
  const l = targetLanguages(p).find((x) => x.code === code);
  openModal({
    title: `Remove ${l ? l.native : code}?`,
    body: '<p class="modal-text">Existing translations for this language will be discarded for this project.</p>',
    actions: [
      { label: "Cancel", variant: "ghost", onClick: (c) => c() },
      {
        label: "Remove language",
        variant: "danger",
        onClick: (c) => {
          commit((data) => {
            const proj = data.projects.find((x) => x.id === p.id);
            if (!proj) return;
            proj.languages = proj.languages.filter((x) => x !== code);
            proj.strings.forEach((s) => delete s.translations[code]);
          });
          c();
          toast("Language removed.", "warn");
          refresh();
        },
      },
    ],
  });
}

// ---------- files ----------
function renderFiles(host: HTMLElement): void {
  const files = fileList(p);
  if (!files.length) {
    host.append(el(`<p class="empty panel">No source files yet. Go to <b>Import / Update</b> to upload your first JSON.</p>`));
    return;
  }
  const rows = files
    .map((f) => {
      const count = fileCount(p, f);
      const translated = p.strings.filter((s) => s.file === f && Object.values(s.translations).some((t) => t.text)).length;
      const pct = count ? Math.round((translated / count) * 100) : 0;
      return `<tr><td><b>${esc(f)}</b></td><td>${count}</td><td><div class="mini-bar"><span style="width:${pct}%"></span></div></td><td>${pct}% translated</td></tr>`;
    })
    .join("");
  host.append(el(`<div class="table-wrap"><table><thead><tr><th>File</th><th>Strings</th><th style="width:34%">Coverage</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`));
}

// ---------- import / update ----------
function renderImport(host: HTMLElement): void {
  if (!uPerm.upload) {
    host.append(el(`<p class="empty panel">${SVG.lock} You need the <b>project.upload</b> permission (manager/admin) to import JSON.</p>`));
    return;
  }
  host.append(el(`
    <div class="import-area" id="dropZone">
      <input type="file" id="fileInput" accept=".json,application/json" hidden />
      <span class="card-icon">${SVG.upload}</span>
      <h3>Drop a JSON source file, or <b>click to browse</b></h3>
      <p class="muted small">Nested keys are flattened to dotted paths (e.g. <code>hero.title</code>). New keys are added, changed sources are updated, removed keys can be pruned.</p>
    </div>`));

  const drop = $("#dropZone");
  const input = $("#fileInput") as HTMLInputElement;
  drop.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).tagName !== "INPUT") input.click();
  });
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    const f = e.dataTransfer?.files?.[0];
    if (f) void handleFile(f);
  });
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (f) void handleFile(f);
    input.value = "";
  });
}

async function handleFile(file: File): Promise<void> {
  if (!file.name.endsWith(".json")) {
    toast("Only .json files are supported.", "bad");
    return;
  }
  try {
    const text = await readFileAsText(file);
    const flat = importText(text);
    const fileAttr = file.name.replace(/\.json$/i, "");
    const plan = diffAgainstFile(p, fileAttr, flat);
    showSyncPreview(file.name, fileAttr, plan);
  } catch (err) {
    toast(`Could not parse JSON: ${err instanceof Error ? err.message : String(err)}`, "bad");
  }
}

function showSyncPreview(fileName: string, fileAttr: string, plan: SyncPlan): void {
  const addedRows = plan.added.map((a) => `<tr><td><code>${esc(a.key)}</code></td><td>${esc(a.source)}</td></tr>`).join("");
  const changedRows = plan.changed.map((a) => `<tr><td><code>${esc(a.key)}</code></td><td><del>${esc(a.from)}</del> <span class="arrow">→</span> <b>${esc(a.to)}</b></td></tr>`).join("");

  const summary = [
    `<div class="stat-card mini"><b>+${plan.added.length}</b><span>New</span></div>`,
    `<div class="stat-card mini"><b>~${plan.changed.length}</b><span>Changed</span></div>`,
    `<div class="stat-card mini"><b>-${plan.removed.length}</b><span>Removed</span></div>`,
    `<div class="stat-card mini"><b>${plan.unchanged}</b><span>Unchanged</span></div>`,
  ].join("");

  const body = `
    <p class="modal-text">Updating <b>${esc(fileName)}</b> against <b>${esc(fileAttr)}</b>. New strings are added as untranslated for every enabled language.</p>
    <div class="sync-kpis">${summary}</div>
    ${plan.added.length ? `<h4 class="diff-head">+ New strings (${plan.added.length})</h4><div class="diff-table">${addedRows ? `<table><tbody>${addedRows}</tbody></table>` : ""}</div>` : ""}
    ${plan.changed.length ? `<h4 class="diff-head">~ Source changed (${plan.changed.length})</h4><div class="diff-table">${changedRows ? `<table><tbody>${changedRows}</tbody></table>` : ""}</div>` : ""}
    ${plan.removed.length ? `<h4 class="diff-head">- Missing keys (${plan.removed.length})</h4><label class="check-row"><input type="checkbox" id="pruneRemoved"><span>Delete these keys from the project (translations would be lost)</span></label>` : ""}
  `;

  openModal({
    title: `Sync preview — ${esc(fileName)}`,
    body,
    actions: [
      { label: "Cancel", variant: "ghost", onClick: (c) => c() },
      {
        label: "Apply update",
        onClick: (c) => {
          const pruneInput = document.querySelector<HTMLInputElement>("#pruneRemoved");
          const prune = pruneInput ? pruneInput.checked : false;
          commit((data) => {
            const proj = data.projects.find((x) => x.id === p.id);
            if (!proj) return;
            applySync(proj, plan, { pruneRemoved: prune, languages: proj.languages, actor: user.displayName });
          });
          c();
          toast(`Synced ${esc(fileAttr)}: ${plan.added.length} added, ${plan.changed.length} updated.`, "ok");
          refresh();
        },
      },
    ],
  });
}

// ---------- activity ----------
function renderActivity(host: HTMLElement): void {
  const feed = el(`<div class="panel"><h2 class="section-title">Recent activity</h2><ul class="activity-feed" id="actFeed"></ul></div>`);
  const list = $("ul", feed) as HTMLUListElement;
  if (!p.activity.length) list.append(el('<li><span class="dot muted"></span><div>No activity yet.<time>Start by importing a source file.</time></div></li>'));
  p.activity.forEach((a) =>
    list.append(el(`<li><span class="dot ${a.kind}"></span><div><p>${a.text}</p><time>${relTime(a.time)}</time></div></li>`))
  );

  const members = el(`<div class="panel"><h2 class="section-title">Members</h2>
    <p class="muted small">${formatNumber(p.members)} contributors on this project. Roles are managed from the <a class="link" href="team.html">Team</a> page.</p>
    <div class="kpi-row mt">${["Translators", "Proofreaders", "Managers", "Admins"].map((r) => `<span class="chip">${r}</span>`).join("")}</div></div>`);

  host.append(feed, members);
}

// ---------- export ----------
function initExport(): void {
  const langs = targetLanguages(p);
  const options = langs.map((l) => `<option value="${l.code}">${esc(l.native)}</option>`).join("") ||
    `<option value="">No target languages yet</option>`;
  openModal({
    title: `Export ${esc(p.name)}`,
    body: `
      <div class="field"><label for="exp-lang">Target language</label><select id="exp-lang">${options}</select></div>
      <label class="check-row"><input type="checkbox" id="exp-translated"><span>Only export strings that have a translation</span></label>`,
    actions: [
      { label: "Cancel", variant: "ghost", onClick: (c) => c() },
      {
        label: "Source JSON",
        onClick: (c) => {
          download(`${p.id}.en.json`, buildSourceExport(p));
          c();
        },
      },
      {
        label: "Translation JSON",
        variant: "primary",
        onClick: (c) => {
          const code = ($("#exp-lang") as HTMLSelectElement).value;
          if (!code) {
            toast("Add a target language first.", "warn");
            return;
          }
          const only = document.querySelector<HTMLInputElement>("#exp-translated")?.checked ?? false;
          download(`${p.id}.${code}.json`, buildExport(p, code, only));
          c();
        },
      },
    ],
  });
}

function refresh(): void {
  renderStats();
  const active = tabs.querySelector("button.active")?.getAttribute("data-view") || "languages";
  renderView(active);
}

document.getElementById("btnUpload")?.addEventListener("click", () => {
  const b = tabs.querySelector('[data-view="import"]') as HTMLButtonElement | null;
  if (b) b.click();
});
document.getElementById("btnDownload")?.addEventListener("click", () => {
  if (uPerm.exportJson) initExport();
});
document.getElementById("pSettings")?.addEventListener("click", () => {
  toast("Project settings are handled by Managers and Admins.", "info");
});

renderStats();
renderView("languages");