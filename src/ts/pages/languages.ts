import { can } from "../rbac.js";
import { boot, $, el, esc, openModal, toast, SVG, kpiCard, must } from "../ui.js";
import { commit, getState } from "../store.js";

const user = must(boot(), "authentication required");

const PERM = { manage: can(user.role, "language.manage") };

const state = getState();
const projects = state.projects;
report();

function report(): void {
  const usedCounts = new Map<string, number>();
  projects.forEach((p) => p.languages.forEach((code) => usedCounts.set(code, (usedCounts.get(code) || 0) + 1)));

  const targets = state.languages.filter((l) => !l.source).length;
  const sourceCount = state.languages.filter((l) => l.source).length;
  const totalPairs = projects.reduce((a, p) => a + p.languages.length, 0);

  $("#kpis").innerHTML = [
    kpiCard("Catalog languages", String(state.languages.length)),
    kpiCard("Target languages", String(targets)),
    kpiCard("Source languages", String(sourceCount)),
    kpiCard("Project–language pairs", String(totalPairs)),
  ].join("");

  const body = $("#catalogBody");
  body.innerHTML = "";
  const q = ($("#catalogSearch") as HTMLInputElement).value.trim().toLowerCase();
  state.languages
    .filter((l) => !q || l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code.toLowerCase().includes(q))
    .forEach((l) => {
      const inProjects = usedCounts.get(l.code) || 0;
      const removeBtn = PERM.manage
        ? `<button class="icon-btn danger" data-code="${l.code}" title="Remove from catalog">${SVG.trash}</button>`
        : "";
      const tr = el(`<tr>
        <td><div class="row-lang"><img class="flag" src="${esc(l.flag)}" alt="" /><span>${esc(l.native)}<br /><span class="muted">${esc(l.name)}</span></span></div></td>
        <td><code>${esc(l.code)}</code></td>
        <td><span class="tag ${l.source ? "info" : ""}">${l.source ? "Source" : "Target"}</span></td>
        <td>${inProjects} project${inProjects === 1 ? "" : "s"}</td>
        <td class="row-actions">${removeBtn}</td>
      </tr>`);
      body.append(tr);
    });

  if (PERM.manage) {
    document.querySelectorAll<HTMLButtonElement>("[data-code]").forEach((b) => {
      b.addEventListener("click", () => removeFromCatalog(b.dataset.code || ""));
    });
  }

  const chips = $("#projectChips");
  chips.innerHTML = "";
  projects.forEach((p) => {
    const langs = p.languages.map((code) => {
      const l = state.languages.find((x) => x.code === code);
      return l ? `<span class="chip toggle" data-project="${p.id}" data-code="${code}" title="${esc(l.native)}">${esc(l.name)}${PERM.manage ? " ×" : ""}</span>` : "";
    }).join("");
    chips.append(el(`<div class="project-chip-row"><a class="link" href="project.html?id=${esc(p.id)}"><b>${esc(p.name)}</b></a><span class="chip-wrap">${langs}</span></div>`));
  });

  if (PERM.manage) {
    document.querySelectorAll<HTMLElement>(".chip.toggle").forEach((c) => {
      c.addEventListener("click", () => {
        const projId = c.dataset.project || "";
        const code = c.dataset.code || "";
        removeFromProject(projId, code);
      });
    });
  }

  if (PERM.manage) {
    const btn = document.getElementById("addLang");
    if (btn) btn.style.display = "";
  }
}

function removeFromProject(projectId: string, code: string): void {
  commit((data) => {
    const proj = data.projects.find((p) => p.id === projectId);
    if (!proj) return;
    proj.languages = proj.languages.filter((x) => x !== code);
    proj.strings.forEach((s) => delete s.translations[code]);
    proj.activity.unshift({ kind: "warn", text: `<b>${esc(user.displayName)}</b> removed <b>${esc(code)}</b> from this project`, time: Date.now() });
  });
  toast(`Removed ${esc(code)} from the project.`, "warn");
  report();
}

function removeFromCatalog(code: string): void {
  const used = projects.some((p) => p.languages.includes(code));
  if (used) {
    toast(`Cannot remove <b>${esc(code)}</b> — it is in use by at least one project.`, "bad");
    return;
  }
  const l = state.languages.find((x) => x.code === code);
  openModal({
    title: `Remove ${l ? l.native : code} from catalog?`,
    body: '<p class="modal-text">This permanently removes the language entry. No project is currently using it.</p>',
    actions: [
      { label: "Cancel", variant: "ghost", onClick: (c) => c() },
      {
        label: "Remove",
        variant: "danger",
        onClick: (c) => {
          commit((data) => {
            data.languages = data.languages.filter((x) => x.code !== code);
          });
          c();
          toast("Language removed from catalog.", "warn");
          report();
        },
      },
    ],
  });
}

function openAddLanguage(): void {
  const fm = el(`
    <div class="lang-form">
      <div class="grid-2">
        <div class="field"><label for="nl-code">Locale code</label><input id="nl-code" placeholder="fi, sv, pt-AO…" /></div>
        <div class="field"><label for="nl-name">English name</label><input id="nl-name" placeholder="Finnish" /></div>
      </div>
      <div class="field"><label for="nl-native">Native name</label><input id="nl-native" placeholder="Suomi" /></div>
      <div class="field"><label for="nl-flag">Emoji flag (CDN)</label><input id="nl-flag" placeholder="https://cdnjs…/1f1eb-1f1ee.svg" /></div>
      <label class="check-row"><input type="checkbox" id="nl-source"><span>Treat as a source language</span></label>
    </div>`);
  openModal({
    title: "Add a language to the catalog",
    body: fm.outerHTML,
    actions: [
      { label: "Cancel", variant: "ghost", onClick: (c) => c() },
      {
        label: "Add language",
        onClick: (c) => {
          const code = ($("#nl-code") as HTMLInputElement).value.trim().toLowerCase();
          const name = ($("#nl-name") as HTMLInputElement).value.trim();
          const native = ($("#nl-native") as HTMLInputElement).value.trim();
          const flag = ($("#nl-flag") as HTMLInputElement).value.trim();
          if (!code || !name) {
            toast("Locale code and English name are required.", "warn");
            return;
          }
          if (state.languages.some((l) => l.code === code)) {
            toast(`Language <b>${esc(code)}</b> already exists in the catalog.`, "bad");
            return;
          }
          const isSource = ($("#nl-source") as HTMLInputElement).checked;
          commit((data) => {
            data.languages.push({
              code,
              name,
              native: native || name,
              flag: flag || `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f1f5-1f1f1.svg`,
              source: isSource || undefined,
            });
          });
          c();
          toast(`Added <b>${esc(name)}</b> (${esc(code)}) to the catalog.`, "ok");
          report();
        },
      },
    ],
  });
}

$("#catalogSearch").addEventListener("input", report);
document.getElementById("addLang")?.addEventListener("click", openAddLanguage);