import { boot, $, el, esc, avatar, relTime, toast, SVG, applyPermissionGates, must } from "../ui.js";
import { allPermissions, can, permissionLabel, ROLES, ROLE_ORDER } from "../rbac.js";
import type { RoleId } from "../types.js";
import { commit, getState } from "../store.js";
import { currentUser, updateSessionRole } from "../auth.js";

const user = must(boot({ permission: "team.manage" }), "authentication required");

const state = getState();

function renderUsers(): void {
  const body = $("#membersBody");
  body.innerHTML = "";
  state.users
    .slice()
    .sort((a, b) => ROLES[a.role].rank - ROLES[b.role].rank || a.username.localeCompare(b.username))
    .forEach((u) => {
      const options = ROLE_ORDER.map(
        (r) => `<option value="${r}" ${u.role === r ? "selected" : ""}>${esc(ROLES[r].name)}</option>`
      ).join("");
      const me = currentUser()?.id === u.id;
      const tr = el(`<tr>
        <td><div class="row-lang">${avatar(u.displayName, 34)}<span><strong>${esc(u.displayName)}</strong>${me ? ' <span class="tag info">you</span>' : ""}<br /><span class="muted">@${esc(u.username)}</span></span></div></td>
        <td>${u.languages.length ? esc(u.languages.join(", ")) : "All languages"}</td>
        <td>${relTime(u.joinedAt)}</td>
        <td><select class="role-select" data-user="${u.id}">${options}</select></td>
      </tr>`);
      body.append(tr);
    });

  document.querySelectorAll<HTMLSelectElement>("select.role-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const target = sel.dataset.user || "";
      const role = sel.value as RoleId;
      commit((data) => {
        const u = data.users.find((x) => x.id === target);
        if (u) u.role = role;
      });
      if (currentUser()?.id === target) updateSessionRole(role);
      toast(`${esc(target)} is now a <b>${esc(ROLES[role].name)}</b>.`, "ok");
      renderUsers();
    });
  });
}

function renderMatrix(): void {
  const perms = allPermissions();
  const head = `<thead><tr><th>Permission</th>${ROLE_ORDER.map((r) => `<th>${esc(ROLES[r].name)}</th>`).join("")}</tr></thead>`;
  const rows = perms
    .map((perm) => `<tr>
        <td title="${esc(permissionLabel(perm))}"><code>${esc(perm)}</code> <span class="muted small">${esc(permissionLabel(perm))}</span></td>
        ${ROLE_ORDER.map((r) => `<td class="matrix-cell ${can(r, perm) ? "yes" : "no"}">${can(r, perm) ? SVG.check : SVG.lock}</td>`).join("")}
      </tr>`)
    .join("");
  $("#matrixBody").innerHTML = rows;
  const headEl = el(`<thead>${head}</thead>`);
  $("#permTable").prepend(headEl.children[0]);
}

renderUsers();
renderMatrix();

$("#permHint").textContent = `Only the Admin role can manage team & roles.`;
applyPermissionGates();