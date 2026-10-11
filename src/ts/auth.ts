import type { RoleId, Session, User } from "./types.js";
import { can as roleCan, type Permission } from "./rbac.js";
import { commit, user as findUser } from "./store.js";

const SESSION_KEY = "capes.localize.session";
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

export interface DiscordAccount {
  userId: string;
  username: string;
  displayName: string;
  role: RoleId;
  languageSummary: string;
}

export function demoAccounts(): DiscordAccount[] {
  const ids = ["u_admin", "u_manager", "u_proof", "u_trans", "u_kael", "u_lucas"];
  return ids
    .map((id) => findUser(id))
    .filter((u): u is User => Boolean(u))
    .map((u) => ({
      userId: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      languageSummary: u.languages.length ? u.languages.join(", ") : "All languages",
    }));
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s || !s.expiresAt || s.expiresAt < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function currentUser(): User | null {
  const s = getSession();
  if (!s) return null;
  return findUser(s.userId) || null;
}

export function hasPermission(perm: Permission): boolean {
  const s = getSession();
  return roleCan(s ? s.role : null, perm);
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function signIn(userId: string, discordProfile?: { username: string; displayName: string; role: RoleId }): Session | null {
  let u = findUser(userId);
  if (!u && discordProfile) {
    u = {
      id: userId,
      username: discordProfile.username,
      displayName: discordProfile.displayName,
      role: discordProfile.role,
      languages: [],
      joinedAt: Date.now(),
    };
    commit((data) => data.users.push(u!));
  } else if (u && discordProfile) {
    commit((data) => {
      const member = data.users.find((candidate) => candidate.id === userId);
      if (member) {
        member.username = discordProfile.username;
        member.displayName = discordProfile.displayName;
        member.role = discordProfile.role;
      }
    });
    u = findUser(userId);
  }
  if (!u) return null;
  const session: Session = {
    userId: u.id,
    role: discordProfile?.role ?? u.role,
    token: randomToken(),
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
  return session;
}

export function signOut(): void {
  void fetch("/auth/logout", { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => undefined);
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function updateSessionRole(role: RoleId): void {
  const s = getSession();
  if (!s) return;
  s.role = role;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function requireAuth(redirect = "login.html"): User | null {
  const u = currentUser();
  if (!u) {
    const next = encodeURIComponent(location.pathname.split("/").pop() || "index.html");
    location.replace(`${redirect}?next=${next}`);
    return null;
  }
  return u;
}

export function requirePermission(perm: Permission, redirect = "index.html"): boolean {
  if (hasPermission(perm)) return true;
  location.replace(`${redirect}?denied=${encodeURIComponent(perm)}`);
  return false;
}

function randomToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
