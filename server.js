import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);
const oauthStates = new Map();
const sessions = new Map();
const sessionTtl = 7 * 24 * 60 * 60 * 1000;
const roleEnv = [
  ["admin", "DISCORD_ROLE_ADMIN"],
  ["manager", "DISCORD_ROLE_MANAGER"],
  ["proofreader", "DISCORD_ROLE_PROOFREADER"],
  ["translator", "DISCORD_ROLE_TRANSLATOR"],
];

function cookieMap(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? ["", ""] : [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
  }).filter(([key]) => key));
}

function cookie(name, value, maxAge = 600) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function loginRedirect(response, reason) {
  response.writeHead(303, { Location: `/login.html?auth_error=${encodeURIComponent(reason)}` });
  response.end();
}

function safeNext(value) {
  const allowed = new Set(["index.html", "projects.html", "project.html", "languages.html", "reports.html", "team.html", "editor.html"]);
  return allowed.has(value) ? value : "index.html";
}

function configReady() {
  return ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_REDIRECT_URI", "DISCORD_GUILD_ID", "DISCORD_BOT_TOKEN"]
    .every((key) => Boolean(process.env[key]));
}

async function handleOAuthCallback(request, response, url) {
  const cookies = cookieMap(request);
  const state = url.searchParams.get("state") || "";
  const next = oauthStates.get(state);
  oauthStates.delete(state);
  response.setHeader("Set-Cookie", cookie("discord_oauth_state", "", 0));

  if (!state || !next || cookies.discord_oauth_state !== state) return loginRedirect(response, "oauth_failed");
  if (url.searchParams.has("error") || !url.searchParams.has("code")) return loginRedirect(response, "cancelled");

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: url.searchParams.get("code"),
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    });
    if (!tokenResponse.ok) throw new Error("Discord token exchange failed");
    const token = await tokenResponse.json();

    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) throw new Error("Discord profile request failed");
    const profile = await profileResponse.json();

    const memberResponse = await fetch(`https://discord.com/api/guilds/${encodeURIComponent(process.env.DISCORD_GUILD_ID)}/members/${encodeURIComponent(profile.id)}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    });
    if (memberResponse.status === 404) return loginRedirect(response, "not_in_server");
    if (!memberResponse.ok) throw new Error("Discord guild role lookup failed");
    const member = await memberResponse.json();
    const memberRoles = new Set(member.roles || []);
    const matchedRole = roleEnv.find(([, envKey]) => process.env[envKey] && memberRoles.has(process.env[envKey]));
    if (!matchedRole) return loginRedirect(response, "no_role");

    const role = matchedRole[0];
    const username = profile.username || profile.global_name || "discord-user";
    const displayName = profile.global_name || profile.username || "Discord user";
    const sessionId = crypto.randomBytes(32).toString("hex");
    sessions.set(sessionId, {
      expiresAt: Date.now() + sessionTtl,
      user: { id: `discord_${profile.id}`, username, displayName, role },
    });
    response.setHeader("Set-Cookie", [cookie("discord_oauth_state", "", 0), cookie("capes_session", sessionId, sessionTtl / 1000)]);
    response.writeHead(303, { Location: `/${safeNext(next)}` });
    response.end();
  } catch (error) {
    console.error("Discord OAuth callback failed:", error.message);
    loginRedirect(response, "oauth_failed");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/auth/discord") {
    if (!configReady()) return loginRedirect(response, "not_configured");
    const state = crypto.randomBytes(24).toString("hex");
    oauthStates.set(state, safeNext(url.searchParams.get("next") || "index.html"));
    setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000).unref();
    const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
    authorizeUrl.search = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
      response_type: "code",
      scope: "identify",
      state,
    }).toString();
    response.writeHead(302, { Location: authorizeUrl.toString(), "Set-Cookie": cookie("discord_oauth_state", state) });
    return response.end();
  }

  if (request.method === "GET" && url.pathname === "/auth/discord/callback") return handleOAuthCallback(request, response, url);

  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    const session = sessions.get(cookieMap(request).capes_session);
    if (!session || session.expiresAt < Date.now()) {
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return response.end(JSON.stringify({ user: null }));
    }
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return response.end(JSON.stringify({ user: session.user }));
  }

  if (request.method === "POST" && url.pathname === "/auth/logout") {
    const sessionId = cookieMap(request).capes_session;
    sessions.delete(sessionId);
    response.writeHead(204, { "Set-Cookie": cookie("capes_session", "", 0) });
    return response.end();
  }

  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.resolve(root, `.${pathname}`);
  const relativePath = path.relative(root, filePath).replaceAll("\\", "/");
  const isPublicAsset = relativePath.startsWith("public/") || relativePath.startsWith("dist/");
  const isRootPage = path.dirname(relativePath) === "." && relativePath.endsWith(".html");
  if (!filePath.startsWith(`${root}${path.sep}`) || (!isPublicAsset && !isRootPage)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return response.end("Not found");
    }
    const contentType = filePath.endsWith(".html") ? "text/html; charset=utf-8"
      : filePath.endsWith(".js") ? "text/javascript; charset=utf-8"
      : filePath.endsWith(".css") ? "text/css; charset=utf-8"
      : filePath.endsWith(".json") ? "application/json; charset=utf-8"
      : filePath.endsWith(".svg") ? "image/svg+xml"
      : filePath.endsWith(".ttf") ? "font/ttf"
      : "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "X-Content-Type-Options": "nosniff" });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`capes.localize running at http://localhost:${port}`);
});