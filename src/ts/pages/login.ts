import { isAuthenticated, signIn } from "../auth.js";
import { ROLES } from "../rbac.js";
import type { RoleId } from "../types.js";
import { $, esc, initThemeButton, SVG } from "../ui.js";

if (isAuthenticated()) {
  location.replace("index.html");
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.remove("preload");
  const themeButton = $<HTMLButtonElement>("#themeBtn");
  themeButton.innerHTML = `${SVG.sun}${SVG.moon}`;
  initThemeButton();
  const next = new URLSearchParams(location.search).get("next") || "index.html";

  const button = $<HTMLButtonElement>("#discordBtn");
  const status = $("#authStatus");
  const query = new URLSearchParams(location.search);
  const authError = query.get("auth_error");
  if (authError) {
    const messages: Record<string, string> = {
      not_configured: "Discord OAuth is not configured yet. Add the values from .env.example to your local .env file.",
      not_in_server: "This Discord account is not a member of the localization server.",
      no_role: "Your Discord account does not have a configured localization role.",
      oauth_failed: "Discord sign-in could not be completed. Please try again.",
      cancelled: "Discord sign-in was cancelled.",
    };
    status.textContent = messages[authError] || messages.oauth_failed;
    status.classList.add("auth-error");
  }

  button.addEventListener("click", () => {
    button.disabled = true;
    status.textContent = "Connecting to Discord…";
    location.assign(`/auth/discord?next=${encodeURIComponent(next)}`);
  });

  fetch("/api/auth/session", { credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { user: { id: string; username: string; displayName: string; role: RoleId } | null };
      if (!payload.user) return;
      const session = signIn(payload.user.id, payload.user);
      if (session) location.replace(next);
    })
    .catch(() => {
      status.textContent = "The app server is unavailable. Start it with npm start to sign in.";
      status.classList.add("auth-error");
    });

  const preview = $("#rolePreview");
  preview.innerHTML = Object.values(ROLES)
    .map(
      (r) => `<li>
        <span class="rp-dot role-${r.id}"></span>
        <div><strong>${esc(r.name)}</strong><small>${esc(r.description)}</small></div>
      </li>`
    )
    .join("");
});
