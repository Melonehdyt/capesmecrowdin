import type { Project, Progress, TranslationStatus, User } from "./types.js";
import { ROLES, can } from "./rbac.js";
import type { Permission } from "./rbac.js";
import { currentUser, hasPermission, requireAuth, signOut } from "./auth.js";
import { getState, project as findProject, progressFor, overallProgress, resetData } from "./store.js";

declare global {
  interface Window {
    capesLocalize?: { resetDemo: () => void };
  }
}

window.capesLocalize = {
  resetDemo: () => {
    resetData();
    location.reload();
  },
};

export function must<T>(v: T | null | undefined, msg: string): T {
  if (v == null) throw new Error(msg);
  return v;
}

export function $<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T {
  const node = root.querySelector<T>(sel);
  if (!node) throw new Error(`Missing element: ${sel}`);
  return node;
}

export function $all<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll(sel)) as T[];
}

export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export function formatNumber(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function relTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export const SVG: Record<string, string> = {
  logo: '<img class="brand-mark" src="public/img/logo.png" alt="" aria-hidden="true">',
  globe: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2c1.7 0 3.2 2.2 3.9 6H8.1C8.8 6.2 10.3 4 12 4zM4 12c0-.7.1-1.4.2-2h3.1a20 20 0 000 4H4.2c-.1-.6-.2-1.3-.2-2zm8 8c-1.7 0-3.2-2.2-3.9-6h7.8c-.7 3.8-2.2 6-3.9 6zm4.5-2.1c.3-.6.6-1.3.8-2.1h2.5a8 8 0 01-3.3 2.1zM20 10h-2.7a20 20 0 000 4H20c.1-.6.2-1.3.2-2s-.1-1.4-.2-2zm-.7-4h-2.4c-.2-.8-.5-1.5-.8-2.1A8 8 0 0119.3 6zM7.1 6H4.7a8 8 0 013.2-2.1c-.3.6-.6 1.3-.8 2.1z"/></svg>',
  monitor: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 4h18v11H3V4zm2 2v7h14V6H5zm5 11h4v2h-4v-2zm-5 2h14v2H5v-2z"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 2h10v20H7V2zm2 2v14h6V4H9zm2 16h2v1h-2v-1z"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 3h13a3 3 0 013 3v15H7a3 3 0 01-3-3V3zm2 2v13a1 1 0 001 1h11V6a1 1 0 00-1-1H6z"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l9 5v10l-9 5-9-5V7l9-5zm0 2.3L6 7.6l6 3.3 6-3.3-6-3.3zM5 9.2v6.4l6 3.3v-6.4L5 9.2zm8 9.7l6-3.3V9.2l-6 3.3v6.4z"/></svg>',
  life: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 018 8 8 8 0 01-8 8 8 8 0 01-8-8 8 8 0 018-8zm0 3a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 20V4h2v16H4zm5 0V9h2v11H9zm5 0V6h2v14h-2zm5 0v-8h2v8h-2z"/></svg>',
  users: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 11a4 4 0 100-8 4 4 0 000 8zm0-2a2 2 0 110-4 2 2 0 010 4zm8 3a3 3 0 100-6 3 3 0 000 6zm0-2a1 1 0 110-2 1 1 0 010 2zM2 20v-2a4 4 0 014-4h4a4 4 0 014 4v2H2zm2-2h8a2 2 0 00-2-2H6a2 2 0 00-2 2zm14 2v-2a5 5 0 00-2-4 5 5 0 014 4v2h-2z"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 3h2v9h3l-4 4-4-4h3V3zM5 19h14v2H5v-2z"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 3h2v9h3l-4 4-4-4h3V3zM5 19h14v2H5v-2z" transform="rotate(180 12 12)"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 3h6v2H9V3zM4 6h16v2H4V6zm2 3h12v11a1 1 0 01-1 1H7a1 1 0 01-1-1V9zm3 2v8h2v-8H9zm4 0v8h2v-8h-2z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.2l-3.5-3.5-1.4 1.4L9 19 20 8l-1.4-1.4z"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a5 5 0 00-5 5v3H5v12h14V10h-2V7a5 5 0 00-5-5zm-3 5a3 3 0 116 0v3H9V7zM7 12h10v8H7v-8z"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 3H5v18h5v-2H7V5h3V3zm4.6 3.6L13.2 8l3 3H9v2h7.2l-3 3 1.4 1.4L20.6 12l-6-6z"/></svg>',
  discord: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.3 5.3A16 16 0 0015.4 4l-.2.4a13 13 0 013.5 1.7 12 12 0 00-10.4 0A13 13 0 018.8 4.4L8.6 4A16 16 0 004.7 5.3C2.2 9 1.5 12.6 1.9 16.1a16 16 0 004.9 2.5l.9-1.6a10 10 0 01-1.6-.8l.4-.3a11 11 0 009.2 0l.4.3a10 10 0 01-1.6.8l.9 1.6a16 16 0 004.9-2.5c.4-4.1-.7-7.7-3.1-10.8zM8.9 14c-.9 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.6 2c0 1.1-.7 2-1.6 2zm6.2 0c-.9 0-1.7-.9-1.6-2 0-1.1.7-2 1.6-2s1.7.9 1.6 2c0 1.1-.7 2-1.6 2z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 2a8 8 0 105.3 14l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z"/></svg>',
  sun: '<svg class="sun" viewBox="0 0 24 24"><path fill="currentColor" d="M11 2h2v3h-2V2zm0 17h2v3h-2v-3zM2 11h3v2H2v-2zm17 0h3v2h-3v-2zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zm12.1 12.1l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zM5.6 19.8l-1.4-1.4 2.1-2.1 1.4 1.4-2.1 2.1zM17.7 7.7l-1.4-1.4 2.1-2.1 1.4 1.4-2.1 2.1zM12 7a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z"/></svg>',
  moon: '<svg class="moon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a9 9 0 109 9 7 7 0 01-9-9z"/></svg>',
  key: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14 2a6 6 0 00-5.7 8L2 16.3V22h5.7l6.3-6.3A6 6 0 1014 2zm0 2a4 4 0 110 8 4 4 0 010-8zm0 2a2 2 0 100 4 2 2 0 000-4z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 5V2L7 6l5 4V7a5 5 0 11-5 5H5a7 7 0 107-7z"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 2h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm7 1.5V7h3.5L13 3.5z"/></svg>',
};

export function icon(name: string): string {
  return SVG[name] || SVG.file;
}

export function avatar(name: string, size = 32): string {
  const initial = esc((name.trim()[0] || "?").toUpperCase());
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `<span class="avatar" style="--avatar-h:${hue};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px">${initial}</span>`;
}

export function roleBadge(role: keyof typeof ROLES): string {
  return `<span class="role-badge role-${role}">${esc(ROLES[role].name)}</span>`;
}

export function progressBar(p: Progress, showMeta = false): string {
  const approved = p.approvedPct || 0;
  const translated = p.translatedPct || 0;
  const review = Math.max(0, translated - approved);
  const bar = `<div class="progress"><span class="seg-approved" style="width:${approved}%"></span><span class="seg-translated" style="width:${review}%"></span></div>`;
  if (!showMeta) return bar;
  return `${bar}<div class="progress-meta"><span>${approved}% approved</span><span>${translated}% translated</span></div>`;
}

export function statusTag(status: TranslationStatus): string {
  if (status === "approved") return '<span class="tag ok">Approved</span>';
  if (status === "translated") return '<span class="tag info">Translated</span>';
  return '<span class="tag bad">Untranslated</span>';
}

export function toast(message: string, type: "ok" | "warn" | "bad" | "info" = "info"): void {
  let host = document.querySelector<HTMLElement>(".toasts");
  if (!host) {
    host = el('<div class="toasts" aria-live="polite"></div>');
    document.body.append(host);
  }
  const node = el(`<div class="toast ${type}">${message}</div>`);
  host.append(node);
  setTimeout(() => {
    node.style.opacity = "0";
    node.style.transform = "translateY(10px)";
    setTimeout(() => node.remove(), 220);
  }, 3200);
}

export interface ModalAction {
  label: string;
  variant?: "primary" | "ghost" | "danger";
  onClick: (close: () => void) => void;
}

export function openModal(opts: {
  title: string;
  body: string;
  actions?: ModalAction[];
  wide?: boolean;
  onMount?: (root: HTMLElement) => void;
}): () => void {
  const backdrop = el<HTMLDivElement>(`<div class="modal-backdrop show"></div>`);
  const modal = el<HTMLDivElement>(`<div class="modal ${opts.wide ? "wide" : ""}">
    <div class="modal-head"><h2>${esc(opts.title)}</h2><button class="icon-btn modal-x" aria-label="Close">&times;</button></div>
    <div class="modal-body">${opts.body}</div>
  </div>`);

  const actions = el<HTMLDivElement>(`<div class="modal-actions"></div>`);
  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKey);
  };
  (opts.actions || []).forEach((a) => {
    const btn = el<HTMLButtonElement>(`<button class="btn-${a.variant || "primary"}">${esc(a.label)}</button>`);
    btn.addEventListener("click", () => a.onClick(close));
    actions.append(btn);
  });
  if (actions.childElementCount) modal.append(actions);
  backdrop.append(modal);
  document.body.append(backdrop);

  modal.querySelector(".modal-x")?.addEventListener("click", close);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  if (opts.onMount) opts.onMount(modal);
  return close;
}

export function confirmDialog(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}): void {
  openModal({
    title: opts.title,
    body: `<p class="modal-text">${opts.message}</p>`,
    actions: [
      { label: "Cancel", variant: "ghost", onClick: (close) => close() },
      {
        label: opts.confirmLabel || "Confirm",
        variant: opts.danger ? "danger" : "primary",
        onClick: (close) => {
          close();
          opts.onConfirm();
        },
      },
    ],
  });
}

export function projectById(id: string): Project | undefined {
  return findProject(id);
}

export function projectProgress(projectId: string): Progress {
  const p = findProject(projectId);
  return p ? overallProgress(p) : { total: 0, approved: 0, translated: 0, untranslated: 0, approvedPct: 0, translatedPct: 0 };
}

export function targetProgress(projectId: string, code: string): Progress {
  const p = findProject(projectId);
  return p ? progressFor(p, code) : { total: 0, approved: 0, translated: 0, untranslated: 0, approvedPct: 0, translatedPct: 0 };
}

export function gate(perm: Permission): boolean {
  return can(currentUser()?.role ?? null, perm);
}

export function applyPermissionGates(root: ParentNode = document): void {
  $all<HTMLElement>("[data-perm]", root).forEach((node) => {
    const perm = node.dataset.perm as Permission;
    if (!hasPermission(perm)) {
      node.classList.add("perm-locked");
      node.setAttribute("aria-disabled", "true");
      if (node instanceof HTMLButtonElement) node.disabled = true;
      if (!node.title) node.title = `Requires ${perm} permission`;
    }
  });
}

export function initThemeButton(): void {
  const btn = document.getElementById("themeBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const light = document.documentElement.classList.toggle("theme-light");
    try {
      localStorage.setItem("capes.theme", light ? "light" : "dark");
    } catch {
      /* ignore */
    }
  });
}

function renderNav(host: HTMLElement, user: User): void {
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const link = (href: string, label: string, perm?: Permission) => {
    if (perm && !hasPermission(perm)) return "";
    const active = current === href ? " active" : "";
    return `<a class="nav-link${active}" href="${href}">${label}</a>`;
  };
  const nav = el<HTMLElement>(`
    <nav class="topbar">
      <div class="topbar-left">
        <a class="brand" href="index.html">${SVG.logo}<span>capes<b>localize</b></span></a>
        <div class="nav-links">
          ${link("index.html", "Dashboard")}
          ${link("projects.html", "Projects")}
          ${link("languages.html", "Languages")}
          ${link("reports.html", "Reports")}
          ${link("team.html", "Team", "team.manage")}
        </div>
      </div>
      <div class="topbar-right">
        <button class="icon-btn" id="themeBtn" title="Toggle light / dark">${SVG.sun}${SVG.moon}</button>
        <a class="user-chip" href="team.html" title="Your account">
          ${avatar(user.displayName, 30)}
          <span class="user-meta"><strong>${esc(user.displayName)}</strong><small>@${esc(user.username)}</small></span>
          ${roleBadge(user.role)}
        </a>
        <button class="icon-btn" id="logoutBtn" title="Sign out">${SVG.logout}</button>
      </div>
    </nav>`);
  host.replaceWith(nav);
  nav.querySelector("#logoutBtn")?.addEventListener("click", () => {
    signOut();
    location.href = "login.html";
  });
  initThemeButton();
}

function renderFooter(host: HTMLElement): void {
  const year = new Date().getFullYear();
  host.replaceWith(el(`
    <footer>
      <div class="footer-inner">
        <div class="footer-brand">
          <a class="brand small" href="index.html">${SVG.logo}<span>capes<b>localize</b></span></a>
          <p>Community localization platform for capes.me — manage translations in 300+ languages.</p>
        </div>
        <div class="footer-cols">
          <div class="footer-col"><h4>Platform</h4><a href="projects.html">Projects</a><a href="editor.html">Translation editor</a><a href="languages.html">Languages</a><a href="reports.html">Reports</a></div>
          <div class="footer-col"><h4>Manage</h4><a href="project.html">Import / export</a><a href="languages.html">Language catalog</a><a href="team.html">Team &amp; roles</a></div>
          <div class="footer-col"><h4>Account</h4><a href="team.html">Profile</a><a href="login.html" data-logout>Sign out</a></div>
        </div>
      </div>
      <p class="footer-legal">© ${year} capes.localize — Owned by capes.me for translations</p>
    </footer>`));
  host.querySelector("[data-logout]")?.addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
    location.href = "login.html";
  });
}

export interface BootOptions {
  requireAuth?: boolean;
  permission?: Permission;
}

export function boot(opts: BootOptions = {}): User | null {
  const requireAuthPage = opts.requireAuth !== false;
  let user: User | null = currentUser();

  if (requireAuthPage && !user) {
    requireAuth();
    return null;
  }
  if (opts.permission && user && !hasPermission(opts.permission)) {
    location.replace(`index.html?denied=${encodeURIComponent(opts.permission)}`);
    return null;
  }

  const navHost = document.querySelector("[data-nav]");
  const footHost = document.querySelector("[data-footer]");
  if (navHost && user) renderNav(navHost as HTMLElement, user);
  if (footHost) renderFooter(footHost as HTMLElement);

  document.body.classList.remove("preload");

  const denied = new URLSearchParams(location.search).get("denied");
  if (denied) {
    setTimeout(() => toast(`Your role cannot perform: <b>${esc(denied)}</b>`, "warn"), 300);
    history.replaceState(null, "", location.pathname);
  }

  return user;
}

export function kpiCard(label: string, value: string, hint = ""): string {
  return `<div class="stat-card"><b>${esc(value)}</b><span>${esc(label)}</span>${hint ? `<em>${esc(hint)}</em>` : ""}</div>`;
}

export function allProjects(): Project[] {
  return getState().projects;
}
