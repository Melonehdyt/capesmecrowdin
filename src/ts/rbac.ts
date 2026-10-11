import type { RoleId, Role } from "./types.js";

export type Permission =
  | "translation.view"
  | "translation.edit"
  | "translation.approve"
  | "project.export"
  | "project.upload"
  | "project.create"
  | "project.settings"
  | "language.manage"
  | "team.manage";

export const ROLES: Record<RoleId, Role> = {
  admin: {
    id: "admin",
    name: "Admin",
    description: "Full control over projects, languages, members and settings.",
    rank: 40,
  },
  manager: {
    id: "manager",
    name: "Manager",
    description: "Runs localization: uploads sources, manages languages and projects.",
    rank: 30,
  },
  proofreader: {
    id: "proofreader",
    name: "Proofreader",
    description: "Reviews and approves translations for their languages.",
    rank: 20,
  },
  translator: {
    id: "translator",
    name: "Translator",
    description: "Submits translations for their assigned languages.",
    rank: 10,
  },
};

export const ROLE_ORDER: RoleId[] = ["admin", "manager", "proofreader", "translator"];

export const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  admin: [
    "translation.view",
    "translation.edit",
    "translation.approve",
    "project.export",
    "project.upload",
    "project.create",
    "project.settings",
    "language.manage",
    "team.manage",
  ],
  manager: [
    "translation.view",
    "translation.edit",
    "translation.approve",
    "project.export",
    "project.upload",
    "project.create",
    "project.settings",
    "language.manage",
  ],
  proofreader: ["translation.view", "translation.edit", "translation.approve", "project.export"],
  translator: ["translation.view", "translation.edit", "project.export"],
};

const PERMISSION_LABELS: Record<Permission, string> = {
  "translation.view": "View translations",
  "translation.edit": "Edit translations",
  "translation.approve": "Approve translations",
  "project.export": "Export JSON",
  "project.upload": "Upload / update JSON",
  "project.create": "Create projects",
  "project.settings": "Project settings",
  "language.manage": "Manage languages",
  "team.manage": "Manage team & roles",
};

export function permissionLabel(perm: Permission): string {
  return PERMISSION_LABELS[perm];
}

export function can(role: RoleId | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(perm);
}

export function permissionsFor(role: RoleId): Permission[] {
  return ROLE_PERMISSIONS[role].slice();
}

export function allPermissions(): Permission[] {
  return Object.keys(PERMISSION_LABELS) as Permission[];
}

export function roleName(role: RoleId): string {
  return ROLES[role].name;
}
