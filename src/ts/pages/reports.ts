import { boot, $, el, esc, formatNumber, kpiCard, progressBar, must } from "../ui.js";
import { getState, progressFor } from "../store.js";
import { ROLES } from "../rbac.js";

const user = must(boot(), "authentication required");

const data = getState();
const projects = data.projects;

const totals = {
  approved: 0,
  translated: 0,
  untranslated: 0,
  denominator: 0,
};
const languageAgg = new Map<string, { total: number; approved: number; translated: number }>();

projects.forEach((p) => {
  p.languages.forEach((code) => {
    const r = progressFor(p, code);
    totals.approved += r.approved;
    totals.translated += r.translated;
    totals.untranslated += r.untranslated;
    totals.denominator += r.total;
    const agg = languageAgg.get(code) || { total: 0, approved: 0, translated: 0 };
    agg.total += r.total;
    agg.approved += r.approved;
    agg.translated += r.translated;
    languageAgg.set(code, agg);
  });
});

const approvedPct = totals.denominator ? Math.round((totals.approved / totals.denominator) * 100) : 0;
const translatedPct = totals.denominator ? Math.round((totals.translated / totals.denominator) * 100) : 0;
const untranslatedPct = Math.max(0, 100 - translatedPct);

const words = projects.reduce((a, p) => a + p.strings.reduce((x, s) => x + (s.source.trim() ? s.source.split(/\s+/).length : 0), 0), 0);

$("#kpis").innerHTML = [
  kpiCard("Total strings", formatNumber(totals.denominator)),
  kpiCard("Total words", formatNumber(words)),
  kpiCard("Avg. approved", `${approvedPct}%`),
  kpiCard("Contributors", formatNumber(data.users.length)),
].join("");

// last 14 days
const chart = $("#barChart");
const vals = [320, 420, 510, 380, 640, 720, 590, 880, 760, 940, 1020, 860, 1100, 1240];
const max = Math.max(...vals);
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
vals.forEach((v, i) => {
  chart.append(el(`<div class="bar" style="height:${Math.round((v / max) * 100)}%" title="${v} words"><span>${days[i]}</span></div>`));
});

// donut
const donut = $("#donut");
donut.style.background = `conic-gradient(var(--ok) 0 ${approvedPct}%, var(--info) ${approvedPct}% ${translatedPct}%, color-mix(in srgb, var(--text) 45%, transparent) ${translatedPct}% 100%)`;
const legend = $("#donutLegend");
[
  ["Approved", approvedPct, "var(--ok)"],
  ["Translated (in review)", Math.max(0, translatedPct - approvedPct), "var(--info)"],
  ["Untranslated", untranslatedPct, "color-mix(in srgb, var(--text) 45%, transparent)"],
].forEach(([label, pct, color]) => {
  legend.append(el(`<div class="legend-row"><i style="background:${String(color)}"></i><span>${String(label)}</span><b>${String(pct)}%</b></div>`));
});

// progress by language
const langBody = $("#rLangBody");
Array.from(languageAgg.entries())
  .map(([code, agg]) => {
    const l = data.languages.find((x) => x.code === code);
    const ap = agg.total ? Math.round((agg.approved / agg.total) * 100) : 0;
    const tp = agg.total ? Math.round((agg.translated / agg.total) * 100) : 0;
    return {
      code,
      language: l,
      flag: l ? l.flag : "",
      native: l ? l.native : code,
      ap,
      tp,
      approved: agg.approved,
      translated: agg.translated,
      untranslated: agg.total - agg.translated,
    };
  })
  .sort((a, b) => b.ap - a.ap)
  .forEach((r) => {
    langBody.append(el(`<tr>
      <td><div class="row-lang">${r.flag ? `<img class="flag" src="${esc(r.flag)}" alt="" />` : ""}<span>${esc(r.native)}</span></div></td>
      <td>${progressBar({ total: r.translated + r.untranslated, approved: r.approved, translated: r.translated, untranslated: r.untranslated, approvedPct: r.ap, translatedPct: r.tp })}</td>
      <td>${r.ap}%</td><td>${r.tp}%</td><td>${formatNumber(r.untranslated)}</td>
    </tr>`));
  });

// contributors
const contribBody = $("#rContrib");
const scores = data.users
  .map((u, i) => ({ user: u, score: 4820 - i * 621 - Math.floor(Math.random() * 200) }))
  .sort((a, b) => b.score - a.score);
scores.forEach(({ user: u, score }, i) => {
  contribBody.append(el(`<tr>
    <td>${i + 1}</td>
    <td><strong>${esc(u.displayName)}</strong> <span class="muted">@${esc(u.username)}</span></td>
    <td><span class="role-badge role-${u.role}">${esc(ROLES[u.role].name)}</span></td>
    <td>${u.languages.length ? esc(u.languages.join(", ")) : "All languages"}</td>
    <td>${formatNumber(score)}</td>
  </tr>`));
});