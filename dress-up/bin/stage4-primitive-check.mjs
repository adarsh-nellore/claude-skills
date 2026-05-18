#!/usr/bin/env node
// stage4-primitive-check.mjs
//
// Semantic enforcement gate for /dress-up Stage 4. Runs after the build
// passes; catches the "agent rolled its own Card-like div using token
// classes" class of failure that the mechanical audit doesn't catch.
//
// Patterns flagged:
// - Raw <h1>-<h6>            should be <Heading>
// - Raw <p className=...>    should be <Body> or <Prose>
// - <div> with border+rounded+p-N    probably a Card; should be <Card>
// - <div> with flex flex-col gap-N    should be <Stack>
// - <div> with flex items-* gap-N    should be <Cluster> (when not flex-col)
// - Hex codes in className or style
// - text-[Npx] arbitrary font sizes
// - External UI kit imports (radix, shadcn, headlessui, mantine, react-aria)
//
// Reports violations as a markdown table to stdout. Default mode is
// reporting-only (exit 0 regardless of findings). --strict exits non-zero
// when findings exist.
//
// Usage:
//   node stage4-primitive-check.mjs <out-root> [--strict] [--json]
//   node stage4-primitive-check.mjs --help

import fs from "node:fs";
import path from "node:path";

const HELP = `stage4-primitive-check — semantic enforcement gate for /dress-up Stage 4

Usage:
  node stage4-primitive-check.mjs <out-root> [--strict] [--json]

Args:
  <out-root>   Absolute path to the dressed-up app folder.
  --strict     Exit non-zero if any violations found. Default: exit 0.
  --json       Output JSON instead of markdown. Default: markdown table.

Scans <out-root>/src/app/ and <out-root>/src/components/peer/ for raw
HTML patterns that should be DS primitives.
`;

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.length === 0) {
  console.log(HELP);
  process.exit(argv.length === 0 ? 1 : 0);
}

const outRoot = argv[0];
const strict = argv.includes("--strict");
const asJson = argv.includes("--json");

if (!fs.existsSync(outRoot)) {
  console.error(`out folder not found at ${outRoot}`);
  process.exit(1);
}

// ---------- scan ----------

const SCAN_ROOTS = [
  path.join(outRoot, "src", "app"),
  path.join(outRoot, "src", "components", "peer"),
];

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.tsx$/.test(entry.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

const files = SCAN_ROOTS.flatMap(listFiles);

const RULES = [
  {
    id: "raw-heading",
    pattern: /<h[1-6][\s>]/,
    suggest: "<Heading size=...>",
    severity: "error",
  },
  {
    id: "raw-p-with-class",
    pattern: /<p\s+className=/,
    suggest: "<Body size=...> or <Prose>",
    severity: "warning",
  },
  {
    id: "card-like-div",
    pattern: /<div\s+className=["'][^"']*\bborder\b[^"']*\brounded\b[^"']*(\bp-\d|\bpx-\d|\bpy-\d)/,
    suggest: "<Card>",
    severity: "warning",
  },
  {
    id: "stack-like-div",
    pattern: /<div\s+className=["'][^"']*\bflex flex-col gap-\d+/,
    suggest: "<Stack gap=...>",
    severity: "warning",
  },
  {
    id: "cluster-like-div",
    pattern: /<div\s+className=["'](?![^"']*flex-col)[^"']*\bflex\b[^"']*\bitems-\w+[^"']*\bgap-\d+/,
    suggest: "<Cluster gap=...>",
    severity: "warning",
  },
  {
    id: "hex-in-classname",
    pattern: /className=["'][^"']*\[#[0-9a-fA-F]{3,8}\]/,
    suggest: "use a DS color token instead of a hex literal",
    severity: "error",
  },
  {
    id: "hex-in-style",
    pattern: /style=\{[^}]*#[0-9a-fA-F]{3,8}/,
    suggest: "use a DS color token via className",
    severity: "error",
  },
  {
    id: "arbitrary-font-size",
    pattern: /text-\[\d+px\]/,
    suggest: "<Heading size=...> or <Body size=...> with a typed size",
    severity: "error",
  },
  {
    id: "ext-ui-kit-import",
    pattern: /from\s+["'](@radix-ui\/|@shadcn|@headlessui\/|@mantine\/|react-aria)/,
    suggest: "use peer-design-system primitives only",
    severity: "error",
  },
];

const violations = [];

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: path.relative(outRoot, file),
          line: i + 1,
          rule: rule.id,
          severity: rule.severity,
          suggest: rule.suggest,
          source: line.trim().slice(0, 120),
        });
      }
    }
  }
}

// ---------- emit ----------

if (asJson) {
  process.stdout.write(JSON.stringify(
    { ran_at: new Date().toISOString(), out_root: outRoot, files_scanned: files.length, violations },
    null,
    2,
  ));
} else {
  console.log(`# Stage 4 primitive check\n`);
  console.log(`- Files scanned: ${files.length}`);
  console.log(`- Violations found: ${violations.length}\n`);
  if (violations.length > 0) {
    console.log(`| Severity | File | Line | Rule | Suggested primitive | Source line |`);
    console.log(`|---|---|---|---|---|---|`);
    for (const v of violations) {
      const escapedSource = v.source.replaceAll("|", "\\|");
      console.log(`| ${v.severity} | ${v.file} | ${v.line} | ${v.rule} | ${v.suggest} | \`${escapedSource}\` |`);
    }
    console.log(``);
    console.log(`Run again after agents apply primitive replacements.`);
  } else {
    console.log(`No violations. Semantic gate passed.`);
  }
}

if (strict && violations.length > 0) {
  process.exit(1);
}
