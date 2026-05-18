#!/usr/bin/env node
// inventory-ds.mjs
//
// Pre-flight inventory of a peer-design-system clone for /dress-up Stage 4.
// Extracts: primitive names + props interfaces + tone/variant enums,
// semantic color tokens, Glyph icon roster, audit-script path coverage.
// Caches output keyed by DS clone mtime so re-runs are ~1s.
//
// Why: Stage 4 agents need to know what exists in the DS before translating.
// A summary manifest tells them "what exists"; the actual primitive files
// (which agents must still read per the SKILL.md rule) tell them "what props".
// This script produces the manifest data the orchestrator hands to agents.
//
// Usage:
//   node inventory-ds.mjs <ds-clone-root> [--out <inventory-path>]
//   node inventory-ds.mjs --help
//
// Output JSON shape (written to --out or stdout if no --out):
//
//   {
//     "ran_at": "ISO-8601",
//     "ds_root": "<absolute path>",
//     "cache_key": "<hash of DS src mtimes>",
//     "primitives": {
//       "ui": [{"name": "Card", "file": "src/components/ui/Card.tsx",
//                "props": "interface CardProps { ... }",
//                "tone_enum": ["outlined", "filled"]}],
//       "layout": [...],
//       ...
//     },
//     "color_tokens": ["paper", "ink", "muted", "faint", ...],
//     "semantic_color_tokens": {
//       "warning": "amber",
//       "danger": "coral",
//       ...
//     },
//     "has_semantic_colors": true|false,
//     "glyph_icons": ["arrow-right", "chev", ...] | null,
//     "audit_script": {
//       "exists": true,
//       "path": "scripts/audit-composition.mjs",
//       "covers_src_app": true|false,
//       "covered_globs": ["src/app/templates/**", ...]
//     }
//   }

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const HELP = `inventory-ds — peer-design-system inventory for /dress-up Stage 4

Usage:
  node inventory-ds.mjs <ds-clone-root> [--out <inventory-path>]

Args:
  <ds-clone-root>   Absolute path to the DS clone (e.g. ~/Projects/adarsh-design-system).
  --out <path>      Optional. Write inventory JSON to this path. If omitted, prints to stdout.

Reads:
  <ds>/src/components/{ui,layout,patterns,typography,charts,agent}/*.tsx
  <ds>/src/app/globals.css
  <ds>/tailwind.config.* (if present)
  <ds>/src/components/ui/Glyph.tsx (if present)
  <ds>/scripts/audit-composition.mjs (if present)

Caches output at ~/.claude/skills/dress-up/cache/ds-inventory-<hash>.json.
`;

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.length === 0) {
  console.log(HELP);
  process.exit(argv.length === 0 ? 1 : 0);
}

const dsRoot = argv[0];
const outFlag = argv.indexOf("--out");
const outPath = outFlag !== -1 ? argv[outFlag + 1] : null;

if (!fs.existsSync(dsRoot)) {
  console.error(`DS clone not found at ${dsRoot}`);
  process.exit(1);
}

// ---------- cache key ----------

function hashDir(dir) {
  const h = crypto.createHash("sha1");
  if (!fs.existsSync(dir)) return null;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (/\.(tsx?|css|m?js|json)$/.test(entry.name)) {
        const stat = fs.statSync(p);
        h.update(`${p}\0${stat.size}\0${stat.mtimeMs}\0`);
      }
    }
  };
  walk(dir);
  return h.digest("hex").slice(0, 16);
}

const cacheDir = path.join(os.homedir(), ".claude/skills/dress-up/cache");
const cacheKey = hashDir(path.join(dsRoot, "src"));
const cachePath = path.join(cacheDir, `ds-inventory-${cacheKey}.json`);

if (cacheKey && fs.existsSync(cachePath)) {
  const cached = fs.readFileSync(cachePath, "utf8");
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, cached);
    console.error(`[inventory-ds] cache hit; wrote ${outPath}`);
  } else {
    process.stdout.write(cached);
  }
  process.exit(0);
}

// ---------- primitive scan ----------

const CATEGORIES = ["ui", "layout", "patterns", "typography", "charts", "agent"];

function extractPrimitive(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const name = path.basename(filePath, path.extname(filePath));

  // Props interface (regex tolerates multi-line)
  const propsMatch = src.match(/(?:export\s+)?(?:interface|type)\s+(\w+Props)\s*[=]?\s*\{([\s\S]*?)\n\}/);
  const propsName = propsMatch ? propsMatch[1] : null;
  const propsBody = propsMatch ? propsMatch[2] : null;

  // Tone / variant union types — look for `tone?: "..." | "..."` etc.
  const enumFields = {};
  if (propsBody) {
    const enumRe = /(\w+)\??\s*:\s*((?:"[^"]+"\s*\|\s*)+"[^"]+")\s*;?/g;
    let m;
    while ((m = enumRe.exec(propsBody)) !== null) {
      const field = m[1];
      const values = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
      enumFields[field] = values;
    }
  }

  return {
    name,
    file: path.relative(dsRoot, filePath),
    props_name: propsName,
    props_body: propsBody ? propsBody.trim().slice(0, 600) : null,
    enum_fields: enumFields,
  };
}

function scanPrimitives() {
  const result = {};
  for (const cat of CATEGORIES) {
    const dir = path.join(dsRoot, "src", "components", cat);
    if (!fs.existsSync(dir)) continue;
    result[cat] = [];
    for (const entry of fs.readdirSync(dir)) {
      if (!/\.tsx$/.test(entry)) continue;
      const full = path.join(dir, entry);
      try {
        result[cat].push(extractPrimitive(full));
      } catch (err) {
        result[cat].push({
          name: path.basename(entry, ".tsx"),
          file: path.relative(dsRoot, full),
          error: err.message,
        });
      }
    }
  }
  return result;
}

// ---------- color tokens ----------

const SEMANTIC_HINTS = ["warning", "danger", "success", "info", "critical", "error"];

function scanColorTokens() {
  const cssPath = path.join(dsRoot, "src", "app", "globals.css");
  const tokens = new Set();
  const semantic = {};
  if (!fs.existsSync(cssPath)) return { tokens: [], semantic, has_semantic: false };

  const css = fs.readFileSync(cssPath, "utf8");

  // OKLCH-style or hex tokens declared in @theme or :root
  const tokenRe = /--color-([\w-]+)\s*:/g;
  let m;
  while ((m = tokenRe.exec(css)) !== null) {
    tokens.add(m[1]);
    for (const hint of SEMANTIC_HINTS) {
      if (m[1].includes(hint)) {
        semantic[hint] = m[1];
      }
    }
  }

  return {
    tokens: [...tokens].sort(),
    semantic,
    has_semantic: Object.keys(semantic).length > 0,
  };
}

// ---------- Glyph icons ----------

function scanGlyphRoster() {
  const candidates = [
    path.join(dsRoot, "src", "components", "ui", "Glyph.tsx"),
    path.join(dsRoot, "src", "components", "Glyph.tsx"),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const src = fs.readFileSync(candidate, "utf8");
    // Look for `"name"` keys in a map-like object, or union types
    const nameUnion = src.match(/(?:type|interface)\s+\w*[Gg]lyph\w*\s*(?:Name|name)\s*=\s*((?:"[^"]+"\s*\|\s*)+"[^"]+")/);
    if (nameUnion) {
      return [...nameUnion[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    }
    // Fallback: scan for `name: ` keys in an object literal
    const keys = [...src.matchAll(/['"](?:arrow-right|chev|check|x|plus|minus|menu|info|warning|alert|search|filter|sort|settings|user|users|file|folder|edit|trash|copy|external|download|upload|home|chevron-\w+|message-\w+|history|alert-octagon|alert-triangle)['"]/g)].map((m) => m[0].replace(/['"]/g, ""));
    if (keys.length > 5) return [...new Set(keys)].sort();
  }
  return null;
}

// ---------- audit script coverage ----------

function scanAuditScript() {
  const candidates = [
    path.join(dsRoot, "scripts", "audit-composition.mjs"),
    path.join(dsRoot, "scripts", "audit-composition.js"),
    path.join(dsRoot, "audit-composition.mjs"),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const src = fs.readFileSync(candidate, "utf8");

    // Extract path globs from the script
    const globs = new Set();
    const globRe = /["'`](src\/[^"'`]+)["'`]/g;
    let m;
    while ((m = globRe.exec(src)) !== null) {
      globs.add(m[1]);
    }

    const covered = [...globs];
    const coversSrcAppDirect = covered.some((g) =>
      /^src\/app\/(?!templates)/.test(g) || /^src\/app\/\*\*/.test(g) || g === "src/app",
    );
    const coversTemplatesOnly = covered.some((g) => g.includes("src/app/templates"));

    return {
      exists: true,
      path: path.relative(dsRoot, candidate),
      covers_src_app: coversSrcAppDirect,
      covers_templates_only: coversTemplatesOnly && !coversSrcAppDirect,
      covered_globs: covered,
    };
  }
  return { exists: false, path: null, covers_src_app: false, covers_templates_only: false, covered_globs: [] };
}

// ---------- assemble ----------

const inventory = {
  ran_at: new Date().toISOString(),
  ds_root: dsRoot,
  cache_key: cacheKey,
  primitives: scanPrimitives(),
  ...((c) => ({ color_tokens: c.tokens, semantic_color_tokens: c.semantic, has_semantic_colors: c.has_semantic }))(scanColorTokens()),
  glyph_icons: scanGlyphRoster(),
  audit_script: scanAuditScript(),
};

// Count primitive totals
let totalPrimitives = 0;
for (const cat of Object.keys(inventory.primitives)) {
  totalPrimitives += inventory.primitives[cat].length;
}
inventory.total_primitives = totalPrimitives;

// Write cache + out
fs.mkdirSync(cacheDir, { recursive: true });
fs.writeFileSync(cachePath, JSON.stringify(inventory, null, 2));

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(inventory, null, 2));
  console.error(`[inventory-ds] ${totalPrimitives} primitives across ${Object.keys(inventory.primitives).length} categories. Wrote ${outPath}.`);
  if (inventory.audit_script.exists && !inventory.audit_script.covers_src_app) {
    console.error(`[inventory-ds] WARNING: audit script at ${inventory.audit_script.path} does NOT cover src/app/ directly. Stage 4 should rely on stage4-primitive-check.mjs as the semantic gate.`);
  }
  if (!inventory.has_semantic_colors) {
    console.error(`[inventory-ds] NOTE: no semantic color tokens detected (warning/danger/success/info). Stage 4 agents should keep raw Tailwind semantic colors to preserve visual hierarchy.`);
  }
} else {
  process.stdout.write(JSON.stringify(inventory, null, 2));
}
