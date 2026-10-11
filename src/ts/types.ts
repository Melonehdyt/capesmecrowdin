export type RoleId = "admin" | "manager" | "proofreader" | "translator";

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  rank: number;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: RoleId;
  languages: string[];
  joinedAt: number;
}

export type TranslationStatus = "untranslated" | "translated" | "approved";

export interface Translation {
  text: string;
  status: TranslationStatus;
  updatedAt?: number;
  updatedBy?: string;
}

export interface StringEntry {
  key: string;
  file: string;
  context: string;
  max?: number;
  source: string;
  translations: Record<string, Translation>;
}

export interface ActivityItem {
  kind: "ok" | "warn" | "info";
  text: string;
  time: number;
}

export interface Project {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  source: string;
  languages: string[];
  strings: StringEntry[];
  members: number;
  updated: number;
  activity: ActivityItem[];
}

export interface Language {
  code: string;
  name: string;
  native: string;
  flag: string;
  source?: boolean;
}

export interface Session {
  userId: string;
  role: RoleId;
  token: string;
  createdAt: number;
  expiresAt: number;
}

export interface AppData {
  version: number;
  languages: Language[];
  projects: Project[];
  users: User[];
}

export interface Progress {
  total: number;
  approved: number;
  translated: number;
  untranslated: number;
  approvedPct: number;
  translatedPct: number;
}
