import { ROLES, ROLE_PERMISSIONS, can, allPermissions } from "../rbac.js";
import type { Permission } from "../rbac.js";
import { boot, $, el, esc, formatNumber, kpiCard, progressBar, relTime, toast, openModal, roleBadge, SVG, allProjects } from "../ui.js";
import { getState, overallProgress, totalStrings } from "../store.js";
import type { ActivityItem, Project } from "../types.js";

const user = boot();
if (user) {
  const state = getState();
  const projects = allProjects();

  const approvedSum = projects.reduce((acc, p) => acc + overallProgress(p).approvedPct, 0);
  const avgApproved = projects.length ? Math.round(approvedSum / projects.length) : 0;

  $("#welcome").innerHTML = `
    <div>
      <p class="eyebrow">${roleBadge(user.role)} signed in</p>
      <h1 class="page-title">Welcome back, ${esc(user.displayName.split(" ")[0])}</h1>
      <p class="muted">Manage projects, import source JSON and keep every language in sync.</p>
    </div>`;

  $("#kpis").innerHTML = [
    kpiCard("Projects", formatNumber(projects.length)),
    kpiCard("Source strings", formatNumber(totalStrings())),
    kpiCard("Languages", formatNumber(state.languages.length)),
    kpiCard("Avg. approved", `${avgApproved}%`),
  ].join("");

  const actions: { perm: Permission; label: string; desc: string; href: string; icon: string }[] = [
    { perm: "project.create", label: "New project", desc: "Spin up a localization project.", href: "projects.html?new=1", icon: "plus" },
    { perm: "project.upload", label: "Import JSON", desc: "Upload or update a source file.", href: "project.html?import=1", icon: "upload" },
    { perm: "language.manage", label: "Manage languages", desc: "Add target languages to translate into.", href: "languages.html", icon: "globe" },
    { perm: "translation.view", label: "Open editor", desc: "Translate strings with suggestions.", href: "editor.html", icon: "chart" },
  ];

  const grid = $("#quickActions");
  actions.forEach((a) => {
    const allowed = can(user.role, a.perm);
    const card = el<HTMLAnchorElement>(`<a class="card action-card ${allowed ? "" : "locked"}" href="${allowed ? a.href : "#"}">
      <span class="card-icon">${SVG[a.icon]}</span>
      <div><h3>${esc(a.label)}${allowed ? "" : " " + SVG.lock}</h3><p>${esc(a.desc)}</p></div>
    </a>`);
    card.dataset.perm = a.perm;
    if (!allowed) {
      card.addEventListener("click", (e) => {
        e.preventDefault();
        toast(`Your <b>${esc(ROLES[user.role].name)}</b> role cannot access this.`, "warn");
      });
    }
    grid.append(card);
  });

  const projectGrid = $("#projectGrid");
  projects.slice(0, 3).forEach((p) => projectGrid.append(projectCard(p)));

  const feed = $("#activity");
  const recent: (ActivityItem & { project: string })[] = [];
  projects.forEach((p) => p.activity.forEach((a) => recent.push({ ...a, project: p.name })));
  recent.sort((a, b) => b.time - a.time);
  recent.slice(0, 8).forEach((a) => {
    feed.append(el(`<li><span class="dot ${a.kind}"></span><div><p>${a.text}</p><span class="feed-meta">${esc(a.project)} · ${relTime(a.time)}</span></div></li>`));
  });

  const granted = new Set<string>(ROLE_PERMISSIONS[user.role] as string[]);
  const permList = $("#myPerms");
  allPermissions().forEach((perm) => {
    const has = granted.has(perm);
    permList.append(el(`<li class="perm-item ${has ? "granted" : "denied"}">${has ? SVG.check : SVG.lock}<span>${esc(perm)}</span></li>`));
  });

  $("#resetDemo").addEventListener("click", () => {
    openModal({
      title: "Reset demo data",
      body: '<p class="modal-text">This restores all projects, strings and languages to their original demo state. Your session stays active.</p>',
      actions: [
        { label: "Cancel", variant: "ghost", onClick: (close) => close() },
        {
          label: "Reset everything",
          variant: "danger",
          onClick: (close) => {
            close();
            window.capesLocalize?.resetDemo();
          },
        },
      ],
    });
  });
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
    <div class="card-foot"><span>${p.languages.length} languages</span><span>${formatNumber(p.strings.length)} strings</span><span>${relTime(p.updated)}</span></div>
  </a>`);
}
