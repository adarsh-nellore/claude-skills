#!/usr/bin/env node
// scripts/generate-manifest.mjs
//
// Pre-extracts the design-system manifest for /build-hifi.
//
// Walks src/components/<group>/*.tsx, regex-extracts exports + prop
// signatures, reads globals.css for color tokens + animation utilities,
// pulls headline rules from each docs/*.md, and writes docs/MANIFEST.md.
//
// Run: npm run manifest
// Wired into prebuild so the manifest can't drift from source.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, basename, relative } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const OUT = join(ROOT, "docs", "MANIFEST.md");

const COMPONENT_GROUPS = ["typography", "layout", "ui", "patterns", "charts", "agent"];
const DOCS = ["COMPOSITION.md", "NAVIGATION.md", "LAYOUT.md", "COMPONENTS.md", "SPACING.md"];

/** Read a file with utf8 encoding; return null if missing. */
async function readMaybe(path) {
  try { return await readFile(path, "utf8"); } catch { return null; }
}

/** List .tsx files in a component group, excluding index.ts and barrels. */
async function listGroup(group) {
  const dir = join(ROOT, "src", "components", group);
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".tsx") && e.name !== "index.tsx")
    .map((e) => join(dir, e.name));
}

/**
 * Extract exported component names + their props interface/type from a
 * .tsx file via regex. Good enough for the manifest; agents don't need
 * full AST fidelity.
 *
 * Looks for:
 *   export function <Name>(props: <Props>)
 *   export function <Name>({ ... }: <Props>)
 *   export const <Name>: React.FC<<Props>>
 *   export interface <Props> { <fields> }
 *   export type <Props> = { <fields> }
 */
function extractExports(src) {
  const components = [];

  // export function Name(...) or export const Name = (...) => ...
  const fnRe = /export\s+(?:async\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*[<(]/g;
  const constRe = /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*[:=]/g;
  let m;
  while ((m = fnRe.exec(src))) components.push(m[1]);
  while ((m = constRe.exec(src))) components.push(m[1]);

  // Props interface/type for each component. The regex deliberately stops
  // at the name; we then scan forward to find the FIRST opening brace
  // (handling both `interface NameProps {` and `type NameProps = {`).
  const propsByName = {};
  const ifRe = /export\s+(?:interface|type)\s+([A-Z][A-Za-z0-9_]*Props)\b/g;
  while ((m = ifRe.exec(src))) {
    const propsName = m[1];
    // Skip whitespace and `=` (type alias case) until we hit `{` or a terminator.
    let i = m.index + m[0].length;
    while (i < src.length && src[i] !== "{" && src[i] !== ";" && src[i] !== "\n") {
      if (!/[\s=]/.test(src[i])) break;
      i++;
    }
    // Sometimes `type NameProps =\n  { ... }` puts the `{` on the next line.
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] !== "{") continue;
    // Brace-balance from the opening `{`.
    let depth = 0;
    let firstBrace = i;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
    }
    if (depth !== 0) continue;
    const body = src.slice(firstBrace + 1, i - 1);

    // Field-only extraction: keep lines that look like `name?: type` or
    // `name: type` — drop anything else (constants, computed properties,
    // function bodies that shouldn't be here in the first place).
    const fields = body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .split(/[;\n,]/)
      .map((l) => l.trim())
      .filter((l) => /^[a-zA-Z_$][\w$]*\??\s*:/.test(l) || /^"[^"]*"\??\s*:/.test(l) || /^\[[^\]]+\]\s*:/.test(l))
      .map((l) => l.replace(/\s+/g, " ").slice(0, 120));

    if (fields.length > 0) {
      // Cap at 12 fields per primitive to keep the manifest scannable.
      propsByName[propsName] = fields.slice(0, 12).join("; ");
    }
  }

  // Dedupe components, keep first appearance order.
  const seen = new Set();
  const dedup = components.filter((c) => (seen.has(c) ? false : (seen.add(c), true)));

  return dedup.map((name) => {
    const propsName = `${name}Props`;
    const propsBody = propsByName[propsName];
    return { name, propsName, propsBody };
  });
}

/** Pull color/semantic CSS variable names + animation utility classes from globals.css. */
function extractCss(css) {
  const colorTokens = Array.from(css.matchAll(/--color-([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g))
    .map((m) => `--color-${m[1]}: ${m[2].trim()}`);

  const semanticAliases = Array.from(css.matchAll(/--(?!color-)([a-zA-Z][a-zA-Z0-9-]*?)\s*:\s*var\(--color-([a-zA-Z0-9-]+)\)/g))
    .map((m) => `--${m[1]} → --color-${m[2]}`);

  const keyframes = Array.from(css.matchAll(/@keyframes\s+([a-zA-Z][a-zA-Z0-9-]*)\s*\{/g))
    .map((m) => m[1]);

  // Animation utility classes the subagents attach to elements.
  const animClasses = Array.from(css.matchAll(/^\.((anim|card|tab|subtle|chart)[a-zA-Z0-9-]*)\b/gm))
    .map((m) => m[1])
    .filter((cls, i, arr) => arr.indexOf(cls) === i);

  return { colorTokens, semanticAliases, keyframes, animClasses };
}

/** Extract the first heading + first paragraph from a docs/*.md, as a headline summary. */
function docHeadline(md) {
  const lines = md.split("\n");
  let title = lines.find((l) => l.startsWith("# "))?.replace(/^#\s+/, "") ?? "";
  const firstParaStart = lines.findIndex((l) => l && !l.startsWith("#"));
  const firstPara = firstParaStart >= 0
    ? lines.slice(firstParaStart).filter((l) => l && !l.startsWith("#")).slice(0, 3).join(" ")
    : "";
  return { title, firstPara: firstPara.slice(0, 400) };
}

async function main() {
  const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));

  // Components
  const componentSections = [];
  for (const group of COMPONENT_GROUPS) {
    const files = await listGroup(group);
    if (files.length === 0) continue;
    const items = [];
    for (const file of files.sort()) {
      const src = await readMaybe(file);
      if (!src) continue;
      const exports = extractExports(src);
      for (const e of exports) {
        const propsStr = e.propsBody ? `${e.propsName} { ${e.propsBody} }` : "(no Props type)";
        items.push(`- **${e.name}** — ${basename(file)} — \`${propsStr}\``);
      }
    }
    componentSections.push({ group, items });
  }

  // CSS
  const css = await readFile(join(ROOT, "src", "app", "globals.css"), "utf8");
  const { colorTokens, semanticAliases, keyframes, animClasses } = extractCss(css);

  // Docs headlines
  const docHeadlines = [];
  for (const docName of DOCS) {
    const md = await readMaybe(join(ROOT, "docs", docName));
    if (!md) continue;
    docHeadlines.push({ name: docName, ...docHeadline(md) });
  }

  // Assemble
  const lines = [];
  lines.push(`# Design-system manifest (generated)`);
  lines.push("");
  lines.push(`> Generated by \`scripts/generate-manifest.mjs\` — do not edit by hand.`);
  lines.push(`> Source: ${pkg.name}@${pkg.version}.`);
  lines.push(`> Re-runs on \`npm run manifest\` and \`npm run build\` (via prebuild).`);
  lines.push("");
  lines.push(`This file is the canonical input to \`/build-hifi\` Beat 1. The skill Reads this single file instead of re-deriving the same information from \`src/components/**\` + \`docs/*.md\` on every prototype run.`);
  lines.push("");

  // Section 1: docs headlines
  lines.push(`## Contract docs (headline summaries)`);
  lines.push("");
  for (const d of docHeadlines) {
    lines.push(`### ${d.name}`);
    lines.push(`> ${d.firstPara}`);
    lines.push(``);
  }

  // Section 2: primitives
  lines.push(`## Available primitives`);
  lines.push(``);
  for (const section of componentSections) {
    lines.push(`### @/components/${section.group}`);
    lines.push("");
    for (const item of section.items) lines.push(item);
    lines.push("");
  }

  // Section 3: color tokens
  lines.push(`## Color tokens (\`globals.css\`)`);
  lines.push("");
  lines.push("```");
  for (const t of colorTokens) lines.push(t);
  lines.push("```");
  lines.push("");

  if (semanticAliases.length > 0) {
    lines.push(`### Semantic aliases`);
    lines.push("```");
    for (const a of semanticAliases) lines.push(a);
    lines.push("```");
    lines.push("");
  }

  // Section 4: animation utilities
  lines.push(`## Animation utilities`);
  lines.push("");
  lines.push(`Keyframes: ${keyframes.map((k) => `\`${k}\``).join(", ") || "(none)"}`);
  lines.push("");
  lines.push(`Utility classes (apply to elements; do NOT invent new ones):`);
  lines.push("```");
  for (const c of animClasses) lines.push(`.${c}`);
  lines.push("```");
  lines.push("");

  // Section 5: where to read the rest
  lines.push(`## Where to read the full rules`);
  lines.push("");
  lines.push(`- Composition contract (audit-enforced): [\`docs/COMPOSITION.md\`](./COMPOSITION.md)`);
  lines.push(`- Layout shells + Desktop resilience: [\`docs/LAYOUT.md\`](./LAYOUT.md)`);
  lines.push(`- Navigation (\`<Button>\` vs \`<LinkButton>\` vs \`<Link>\`): [\`docs/NAVIGATION.md\`](./NAVIGATION.md)`);
  lines.push(`- Spacing scale (\`<Stack>\`/\`<Cluster>\` gap buckets): [\`docs/SPACING.md\`](./SPACING.md)`);
  lines.push("");

  const out = lines.join("\n") + "\n";
  await writeFile(OUT, out, "utf8");

  // Print a one-line summary
  const totalPrimitives = componentSections.reduce((n, s) => n + s.items.length, 0);
  console.log(`✓ MANIFEST.md written: ${totalPrimitives} primitives across ${componentSections.length} groups, ${colorTokens.length} color tokens, ${animClasses.length} animation utilities (${relative(ROOT, OUT)})`);
}

main().catch((err) => {
  console.error("✗ generate-manifest failed:", err);
  process.exit(1);
});
