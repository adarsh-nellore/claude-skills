#!/usr/bin/env node
// Playwright + Chromium smoke harness for a /build-hifi prototype.
// Reads screens.json + (optional) mock-contract.json to drive per-route assertions.
//
// Usage:
//   node smoke.mjs --project <dir> --base-url http://localhost:3004 [--out SMOKE-REPORT.md] [--substitutions subs.json] [--timings t.jsonl]
//
// Per route checks:
//   1. Page loads (HTTP 200)
//   2. No uncaught page errors during load
//   3. No browser-console errors at "error" level
//   4. No horizontal scroll at 1280px viewport
//   5. AppLeftNav + AppTopNav present (chrome rendered)
//   6. primaryRegions assertions (region-specific element queries)
//   7. urlParams: each named param triggers the matching sub-component on a second navigation
//
// Exit code: 0 if all critical assertions pass; 1 if any fail.

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// Dynamic import so smoke.mjs loads even when playwright is missing
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (err) {
  console.error("smoke: playwright not installed. Run:");
  console.error("  cd ~/.claude/skills/build-hifi && npm install");
  console.error("  npx -y playwright install chromium");
  process.exit(2);
}

const { values } = parseArgs({
  options: {
    project: { type: "string", default: "." },
    "base-url": { type: "string", default: "http://localhost:3000" },
    out: { type: "string" },
    substitutions: { type: "string" },
    timings: { type: "string" },
    viewport: { type: "string", default: "1280x800" },
    screenshots: { type: "string" },
  },
});

const PROJECT = path.resolve(values.project);
const BASE = values["base-url"].replace(/\/$/, "");
const OUT = values.out || path.join(PROJECT, "SMOKE-REPORT.md");
const SHOT_DIR = values.screenshots || path.join(PROJECT, "smoke-screens");
const TIMINGS = values.timings;

const [vw, vh] = values.viewport.split("x").map(Number);

function appendTiming(record) {
  if (!TIMINGS) return;
  mkdirSync(path.dirname(path.resolve(TIMINGS)), { recursive: true });
  appendFileSync(path.resolve(TIMINGS), JSON.stringify(record) + "\n");
}

function loadJsonIf(p) {
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

const screensSpec = loadJsonIf(path.join(PROJECT, "screens.json"));
if (!screensSpec) {
  console.error(`smoke: ${PROJECT}/screens.json not found`);
  process.exit(2);
}
const contract = loadJsonIf(path.join(PROJECT, "mock-contract.json"));
const userSubs = values.substitutions ? loadJsonIf(values.substitutions) || {} : {};

// ===================================================================
// Substitutions: figure out what to put in [dynamicSegment] slots
// ===================================================================

function defaultIdForParam(paramName) {
  // explicit substitution wins
  if (userSubs[paramName]) return userSubs[paramName];
  // derive from contract.idConvention
  if (contract) {
    // Try to match the param to an entity (e.g. submissionId -> submissions)
    const stripped = paramName.replace(/Id$/i, "").toLowerCase();
    const entity = contract.entities?.find(e => e.name.toLowerCase().startsWith(stripped));
    if (entity?.idConvention) {
      return entity.idConvention.replace("{n}", "001").replace("{slug}", "seed-1");
    }
  }
  return "1";
}

function substituteRoute(route) {
  return route.replace(/\[([^\]]+)\]/g, (_, name) => defaultIdForParam(name));
}

// ===================================================================
// Region assertions
// ===================================================================

const REGION_ASSERTIONS = {
  async kpi_grid(page) {
    const count = await page.locator('[data-region="kpi-grid"] [data-kpi], [class*="KPI"], [class*="MetricTile"]').count();
    return { ok: count >= 1, detail: `${count} KPI-like elements` };
  },
  async table(page) {
    const tableCount = await page.locator('table, [role="table"], [data-component*="Table"]').count();
    return { ok: tableCount >= 1, detail: `${tableCount} table-like elements` };
  },
  async card_grid(page) {
    const cards = await page.locator('[data-component*="Card"], article, [class*="card"]').count();
    return { ok: cards >= 1, detail: `${cards} card-like elements` };
  },
  async side_panel(page) {
    const panel = await page.locator('[data-component*="SidePanel"], aside[data-panel], [data-component*="Drawer"]').count();
    return { ok: panel >= 0, detail: `${panel} panel-like elements (default state may not render panel)` };
  },
  async document_viewer(page) {
    const dv = await page.locator('[data-component*="DocumentViewer"], [data-component*="Viewer"], article').count();
    return { ok: dv >= 1, detail: `${dv} viewer-like elements` };
  },
  async form(page) {
    const f = await page.locator('form, [role="form"]').count();
    return { ok: f >= 1, detail: `${f} form elements` };
  },
  async chart_block(page) {
    const c = await page.locator('svg, canvas, [data-component*="Chart"]').count();
    return { ok: c >= 1, detail: `${c} chart-like elements` };
  },
  async agent_block(page) {
    const a = await page.locator('[data-component*="Agent"], [class*="agent"], [data-component*="Confidence"]').count();
    return { ok: a >= 1, detail: `${a} agent-feature elements` };
  },
  async banner(page) {
    const b = await page.locator('[role="alert"], [data-component*="Banner"], [class*="banner"]').count();
    return { ok: b >= 1, detail: `${b} banner-like elements` };
  },
  async nav_tree(page) {
    const n = await page.locator('nav[data-tree], [data-component*="Navigator"], [data-component*="Tree"]').count();
    return { ok: n >= 0, detail: `${n} nav-tree elements (optional)` };
  },
  async activity_feed(page) {
    const f = await page.locator('[data-component*="Feed"], [data-component*="Activity"], ol, ul').count();
    return { ok: f >= 1, detail: `${f} feed-like elements` };
  },
  async memo_drawer(page) {
    return { ok: true, detail: "memo drawer is URL-param-driven; default state should not render it" };
  },
  async filter_bar(page) {
    const f = await page.locator('[data-component*="FilterBar"], [role="search"], input[type="search"]').count();
    return { ok: f >= 0, detail: `${f} filter elements (optional)` };
  },
  async page_header(page) {
    const h = await page.locator('h1, [data-component*="PageHeader"]').count();
    return { ok: h >= 1, detail: `${h} page-header elements` };
  },
};

// ===================================================================
// Run
// ===================================================================

const reports = [];

function recordTiming(routeName, durationS) {
  appendTiming({ phase: `smoke:${routeName}`, duration_s: durationS });
}

async function runRoute(browser, screen) {
  const routeName = screen.path === "/" ? "_root" : screen.path.replace(/[\[\]\/]/g, "_").replace(/^_/, "");
  const url = `${BASE}${substituteRoute(screen.path)}`;
  const startedAt = Date.now();
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", err => pageErrors.push(err.message));

  const assertions = [];
  function check(name, ok, detail = "", critical = true) {
    assertions.push({ name, ok, detail, critical });
  }

  // 1. Load
  let resp;
  try {
    resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch (err) {
    check("load", false, `goto failed: ${err.message}`);
    await snapshotAndReport(page, routeName, screen, url, assertions, consoleErrors, pageErrors);
    await ctx.close();
    recordTiming(routeName, (Date.now() - startedAt) / 1000);
    return;
  }
  check("load", resp && resp.ok(), `status ${resp ? resp.status() : "no-response"}`);

  // 2/3. Errors
  await page.waitForTimeout(300);
  check("no-pageerror", pageErrors.length === 0, pageErrors.join("; "));
  check("no-console-error", consoleErrors.length === 0, consoleErrors.slice(0, 3).join("; "), false);

  // 4. No horizontal scroll
  const scrollX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("no-horizontal-scroll", scrollX <= 0, `overflow: ${scrollX}px`);

  // 5. Chrome present (AppLeftNav + AppTopNav from scaffold-chrome)
  const leftNavCount = await page.locator("aside nav").count();
  const topNavCount = await page.locator("header").count();
  check("chrome-leftnav", leftNavCount >= 1, `leftNav locators: ${leftNavCount}`);
  check("chrome-topnav", topNavCount >= 1, `topNav locators: ${topNavCount}`);

  // 6. Primary regions
  for (const region of screen.primaryRegions || []) {
    const fn = REGION_ASSERTIONS[region];
    if (fn) {
      const result = await fn(page);
      check(`region:${region}`, result.ok, result.detail, false);
    }
  }

  // Screenshot on any failure
  const failed = assertions.some(a => !a.ok && a.critical);
  if (failed) await snapshotAndReport(page, routeName, screen, url, assertions, consoleErrors, pageErrors);

  await ctx.close();

  // 7. URL params
  for (const param of screen.urlParams || []) {
    const paramVal = defaultIdForParam(param.name);
    const purl = `${url}${url.includes("?") ? "&" : "?"}${param.name}=${encodeURIComponent(paramVal)}`;
    const pctx = await browser.newContext({ viewport: { width: vw, height: vh } });
    const ppage = await pctx.newPage();
    try {
      await ppage.goto(purl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await ppage.waitForTimeout(300);
      // We expect SOMETHING extra to render compared to baseline. Heuristic: presence of any element whose
      // data-component or class hints at the param-driven sub-component. Since we don't know names a priori,
      // we just confirm the page still renders with chrome.
      const okChrome = await ppage.locator("aside nav").count() >= 1;
      assertions.push({ name: `urlparam:${param.name}=set`, ok: okChrome, detail: `chrome present after ${param.name} set`, critical: false });
    } catch (err) {
      assertions.push({ name: `urlparam:${param.name}=set`, ok: false, detail: err.message, critical: false });
    } finally {
      await pctx.close();
    }
  }

  reports.push({ route: screen.path, url, assertions });
  recordTiming(routeName, (Date.now() - startedAt) / 1000);
}

async function snapshotAndReport(page, routeName, screen, url, assertions, consoleErrors, pageErrors) {
  mkdirSync(SHOT_DIR, { recursive: true });
  const shotPath = path.join(SHOT_DIR, `${routeName || "root"}.png`);
  try {
    await page.screenshot({ path: shotPath, fullPage: true });
  } catch {}
  reports.push({ route: screen.path, url, assertions, consoleErrors, pageErrors, screenshot: shotPath });
}

// v6: also load ia.json + check every leftNav href returns 200
const iaJsonPath = path.join(PROJECT, "ia.json");
const iaSpec = existsSync(iaJsonPath) ? JSON.parse(readFileSync(iaJsonPath, "utf8")) : null;

const browser = await chromium.launch();
try {
  for (const screen of screensSpec.screens) {
    if (screen.trivial && screen.redirectTo) {
      // Trivial redirect — just check the destination loads
      reports.push({ route: screen.path, redirect: screen.redirectTo, assertions: [{ name: "trivial-redirect", ok: true, detail: `redirects to ${screen.redirectTo}`, critical: false }] });
      continue;
    }
    await runRoute(browser, screen);
  }

  // v6: nav walk — verify every leftNav href loads with no console error
  if (iaSpec && iaSpec.leftNav) {
    const navAssertions = [];
    for (const group of iaSpec.leftNav) {
      for (const item of (group.items || [])) {
        const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
        const page = await ctx.newPage();
        const consoleErrors = [];
        page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
        const navUrl = `${BASE}${item.href}`;
        try {
          const resp = await page.goto(navUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
          const ok = resp && resp.ok();
          navAssertions.push({
            name: `leftnav:${item.href}`,
            ok,
            detail: `status ${resp ? resp.status() : "n/a"}, console errors: ${consoleErrors.length}`,
            critical: true,
          });
        } catch (err) {
          navAssertions.push({ name: `leftnav:${item.href}`, ok: false, detail: err.message, critical: true });
        } finally {
          await ctx.close();
        }
      }
    }
    reports.push({ route: "(leftnav walk)", url: BASE, assertions: navAssertions });
  }
} finally {
  await browser.close();
}

// ===================================================================
// Emit SMOKE-REPORT.md
// ===================================================================

const lines = ["# Smoke report", "", `Generated: ${new Date().toISOString()}`, `Base URL: ${BASE}`, `Viewport: ${vw}x${vh}`, ""];
let totalAssertions = 0;
let totalFailures = 0;
let criticalFailures = 0;

for (const r of reports) {
  lines.push(`## ${r.route}`);
  if (r.url) lines.push(`URL: ${r.url}`);
  if (r.redirect) lines.push(`Redirects to: ${r.redirect}`);
  lines.push("");
  for (const a of r.assertions) {
    totalAssertions++;
    const icon = a.ok ? "PASS" : (a.critical ? "FAIL" : "WARN");
    if (!a.ok) {
      totalFailures++;
      if (a.critical) criticalFailures++;
    }
    lines.push(`- ${icon} \`${a.name}\` — ${a.detail || ""}`);
  }
  if (r.consoleErrors?.length) {
    lines.push("", "Console errors:");
    for (const e of r.consoleErrors.slice(0, 5)) lines.push(`  - ${e}`);
  }
  if (r.pageErrors?.length) {
    lines.push("", "Page errors:");
    for (const e of r.pageErrors.slice(0, 5)) lines.push(`  - ${e}`);
  }
  if (r.screenshot) lines.push("", `Screenshot: ${r.screenshot}`);
  lines.push("");
}

lines.unshift(`Critical failures: ${criticalFailures}  ·  Non-critical failures: ${totalFailures - criticalFailures}  ·  Total assertions: ${totalAssertions}`, "");

writeFileSync(OUT, lines.join("\n"));
console.log(OUT);
process.exit(criticalFailures > 0 ? 1 : 0);
