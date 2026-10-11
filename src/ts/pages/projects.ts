import { can } from "../rbac.js";
import { boot, $, el, esc, formatNumber, kpiCard, openModal, progressBar, relTime, toast, SVG, allProjects } from "../ui.js";
import { getState, commit, overallProgress, slugify, totalStrings } from "../store.js";
import { LANGUAGES } from "../seed.js";
import type { Project } from "../types.js";

const user = boot();
if (user) {
  const projects = allProjects();

  const totalMembers = projects.reduce((a, p) => a + p.members, 0);
  $("#kpis").innerHTML = [
    kpiCard("Projects", formatNumber(projects.length)),
    kpiCard("Strings", formatNumber(totalStrings())),
    kpiCard("Languages", formatNumber(getState().languages.length)),
    kpiCard("Members", formatNumber(totalMembers)),
  ].join("");

  const grid = $("#projectGrid");
  const render = (list: Project[]) => {
    grid.innerHTML = "";
    if (!list.length) {
      grid.append(el('<p class="empty panel">No projects match your filter.</p>'));
      return;
    }
    list.forEach((p) => grid.append(projectCard(p)));
  };

  $("#newProject").addEventListener("click", () => openNewProject());
  const params = new URLSearchParams(location.search);
  if (params.get("new") === "1") openNewProject();

  const search = $<HTMLInputElement>("#projectSearch");
  const tabs = $("#tabRow");

  function match(list: Project[]): Project[] {
    const q = search.value.trim().toLowerCase();
    let out = list;
    if (q) out = out.filter((p) => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
    const filter = document.querySelector<HTMLButtonElement>("#tabRow button.active")?.dataset.filter || "all";
    if (filter === "fresh") out = out.slice().sort((a, b) => b.updated - a.updated).slice(0, 3);
    if (filter === "large") out = out.slice().sort((a, b) => b.strings.length - a.strings.length);
    return out;
  }
  search.addEventListener("input", () => render(match(projects)));
  tabs.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    tabs.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    render(match(projects));
  });

  if (params.get("q")) {
    search.value = params.get("q") || "";
    render(match(projects));
  } else {
    render(projects);
  }
}

function projectCard(p: Project): HTMLElement {
  const prog = overallProgress(p);
  return el<HTMLAnchorElement>(`<a class="card project-card" href="project.html?id=${p.id}">
    <div class="card-top">
      <span class="card-icon ${p.color}">${SVG[p.icon] || SVG.globe}</span>
      <h3>${esc(p.name)}</h3>
    </div>
    <p>${esc(p.desc)}</p>
    ${progressBar(prog, true)}
    <div class="card-foot">
      <span>${p.languages.length} target languages</span>
      <span>${formatNumber(p.strings.length)} strings</span>
      <span>${formatNumber(p.members)} members</span>
    </div>
    <div class="card-foot"><span>${relTime(p.updated)}</span><span class="tag">Open →</span></div>
  </a>`);
}

function openNewProject(): void {
  const sourceLangs = LANGUAGES.filter((l) => l.source).map(
    (l) => `<option value="${l.code}">${esc(l.native)}</option>`
  );
  const close = openModal({
    title: "Create a project",
    body: `
      <div class="field"><label for="np-name">Name</label><input id="np-name" type="text" placeholder="Cape Viewer (Desktop)" /></div>
      <div class="field"><label for="np-desc">Description</label><textarea id="np-desc" rows="3" placeholder="What does this project localize?"></textarea></div>
      <div class="field"><label for="np-source">Source language</label><select id="np-source">${sourceLangs}</select></div>
      <div class="field"><label for="np-langs">Initial target languages</label><select id="np-langs" multiple size="4">
        ${LANGUAGES.filter((l) => !l.source).slice(0, 12).map((l) => `<option value="${l.code}" selected>${esc(l.native)}</option>`).join("")}
      </select></div>`,
    actions: [
      { label: "Cancel", variant: "ghost", onClick: (c) => c() },
      {
        label: "Create project",
        onClick: (c) => {
          const name = ($("#np-name") as HTMLInputElement).value.trim();
          if (!name) {
            toast("Give the project a name.", "warn");
            return;
          }
          const langs = Array.from(($("#np-langs") as HTMLSelectElement).selectedOptions).map((o) => o.value);
          const id = slugify(name);
          commit((data) => {
            if (data.projects.some((p) => p.id === id)) {
              toast("A project with that name already exists.", "bad");
              return;
            }
            const colorPool = ["blue", "teal", "violet", "amber"];
            data.projects.push({
              id,
              name,
              desc: ($("#np-desc") as HTMLTextAreaElement).value.trim() || "New localization project.",
              icon: "globe",
              color: colorPool[data.projects.length % colorPool.length],
              source: ($("#np-source") as HTMLSelectElement).value,
              languages: langs,
              strings: [],
              members: 1,
              updated: Date.now(),
              activity: [{ kind: "ok", text: `<b>${esc(user?.displayName || "")}</b> created this project`, time: Date.now() }],
            });
          });
          c();
          toast("Project created.", "ok");
          setTimeout(() => location.href = `project.html?id=${encodeURIComponent(id)}`, 400);
        },
      },
    ],
  });

  const enter = document.getElementById("np-name");
  if (enter) {
    enter.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const submit = document.querySelector<HTMLButtonElement>(".modal-actions .btn-primary");
        submit?.click();
      }
    });
  }
  void close;
}