#!/usr/bin/env node
// build-hifi v4 CLI. Scaffolds the deterministic parts of a build-hifi run.
// No external dependencies (Node >= 20 built-ins only).
//
// Usage:
//   build-hifi <subcommand> [args]
//
// Subcommands:
//   bootstrap          Clone DS, strip showcase, copy PRD, npm install
//   scaffold-types     Emit src/lib/types.ts from mock-contract.json
//   scaffold-mock-data Emit src/lib/mock-data/<entity>.ts + barrel from mock-contract.json
//   scaffold-chrome    Emit src/components/app/{AppLeftNav,AppTopNav,AppScreen}.tsx from ia.json
//   scaffold-routes    Emit src/app/<route>/page.tsx stubs from screens.json
//   scaffold-compound  Emit composition shells + empty _<child>.tsx for compound screens
//   bundle-context     Emit ./agent-ctx/<target>.md (one Read per agent)
//   build              Wrap `npm run build`
//   dev                Wrap `PORT=<n> npm run dev`
//   validate           Validate one of ia.json / screens.json / mock-contract.json against its schema
//
// Every subcommand accepts:
//   --timings <path>   Append a JSONL timing record on completion

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync, cpSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMA_DIR = path.resolve(__dirname, "..", "schemas");

// ===================================================================
// Helpers: timing, file IO, case conversion
// ===================================================================

function nowIso() {
  return new Date().toISOString();
}

function appendTiming(timingsPath, record) {
  if (!timingsPath) return;
  const abs = path.resolve(timingsPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  appendFileSync(abs, JSON.stringify(record) + "\n");
}

async function timed(timingsPath, phase, fn, extra = {}) {
  const start = Date.now();
  const startedAt = nowIso();
  try {
    const result = await fn();
    const durationS = (Date.now() - start) / 1000;
    appendTiming(timingsPath, { phase, start: startedAt, duration_s: durationS, ...extra });
    return result;
  } catch (err) {
    const durationS = (Date.now() - start) / 1000;
    appendTiming(timingsPath, { phase, start: startedAt, duration_s: durationS, error: String(err.message || err), ...extra });
    throw err;
  }
}

function readJson(p) {
  const text = readFileSync(p, "utf8");
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${p}: invalid JSON — ${err.message}`);
  }
}

function writeFileSafe(p, content) {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content);
}

function pascal(s) {
  return s.replace(/(^|[_-\s]+)([a-z0-9])/g, (_, _sep, ch) => ch.toUpperCase());
}

function kebab(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function routeToFsSegments(route) {
  // "/submissions/[submissionId]/sections/[sectionId]" -> ["submissions", "[submissionId]", "sections", "[sectionId]"]
  return route.split("/").filter(Boolean);
}

function extractDynamicParams(route) {
  // returns array of param names found in [bracket] segments
  const segs = routeToFsSegments(route);
  return segs.filter(s => s.startsWith("[") && s.endsWith("]")).map(s => s.slice(1, -1));
}

function routeToPagePath(projectDir, route) {
  const segs = routeToFsSegments(route);
  return path.join(projectDir, "src", "app", ...segs, "page.tsx");
}

// ===================================================================
// Mini JSON Schema validator (subset needed by our schemas)
// Supports: type, required, properties, additionalProperties (boolean),
// items (object or $ref), $defs / $ref (internal #/$defs/X),
// enum, pattern, minLength, maxLength, minimum, maximum,
// minItems, maxItems, minProperties, allOf, if/then.
// Returns { ok: true } or { ok: false, errors: [{ path, message }] }
// ===================================================================

function deref(schema, root) {
  if (schema && typeof schema === "object" && typeof schema.$ref === "string") {
    const ref = schema.$ref;
    if (!ref.startsWith("#/")) throw new Error(`unsupported $ref: ${ref}`);
    const segs = ref.slice(2).split("/");
    let cur = root;
    for (const s of segs) {
      cur = cur[s];
      if (cur === undefined) throw new Error(`unresolvable $ref: ${ref}`);
    }
    return cur;
  }
  return schema;
}

function jsonType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

function validateNode(schema, data, root, dataPath, errors) {
  schema = deref(schema, root);
  if (!schema || typeof schema !== "object") return;

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = jsonType(data);
    // integer satisfies number; number does not satisfy integer
    const ok = types.some(t => t === actual || (t === "number" && actual === "integer"));
    if (!ok) {
      errors.push({ path: dataPath, message: `expected ${types.join("|")}, got ${actual}` });
      return; // further checks meaningless once type is wrong
    }
  }

  if (schema.enum && !schema.enum.includes(data)) {
    errors.push({ path: dataPath, message: `expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(data)}` });
  }

  if (schema.const !== undefined && data !== schema.const) {
    errors.push({ path: dataPath, message: `expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(data)}` });
  }

  if (typeof data === "string") {
    if (schema.minLength != null && data.length < schema.minLength) {
      errors.push({ path: dataPath, message: `string shorter than ${schema.minLength}` });
    }
    if (schema.maxLength != null && data.length > schema.maxLength) {
      errors.push({ path: dataPath, message: `string longer than ${schema.maxLength}` });
    }
    if (schema.pattern) {
      const re = new RegExp(schema.pattern);
      if (!re.test(data)) {
        errors.push({ path: dataPath, message: `does not match pattern ${schema.pattern}` });
      }
    }
  }

  if (typeof data === "number") {
    if (schema.minimum != null && data < schema.minimum) {
      errors.push({ path: dataPath, message: `value < ${schema.minimum}` });
    }
    if (schema.maximum != null && data > schema.maximum) {
      errors.push({ path: dataPath, message: `value > ${schema.maximum}` });
    }
  }

  if (Array.isArray(data)) {
    if (schema.minItems != null && data.length < schema.minItems) {
      errors.push({ path: dataPath, message: `array shorter than ${schema.minItems}` });
    }
    if (schema.maxItems != null && data.length > schema.maxItems) {
      errors.push({ path: dataPath, message: `array longer than ${schema.maxItems}` });
    }
    if (schema.items) {
      for (let i = 0; i < data.length; i++) {
        validateNode(schema.items, data[i], root, `${dataPath}[${i}]`, errors);
      }
    }
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (schema.minProperties != null && Object.keys(data).length < schema.minProperties) {
      errors.push({ path: dataPath, message: `fewer than ${schema.minProperties} properties` });
    }
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in data)) {
          errors.push({ path: dataPath, message: `missing required property: ${key}` });
        }
      }
    }
    if (schema.properties) {
      for (const [k, v] of Object.entries(data)) {
        if (schema.properties[k]) {
          validateNode(schema.properties[k], v, root, `${dataPath}.${k}`, errors);
        } else if (schema.additionalProperties === false) {
          errors.push({ path: dataPath, message: `unexpected property: ${k}` });
        } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
          validateNode(schema.additionalProperties, v, root, `${dataPath}.${k}`, errors);
        }
      }
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      for (const [k, v] of Object.entries(data)) {
        validateNode(schema.additionalProperties, v, root, `${dataPath}.${k}`, errors);
      }
    }
  }

  if (Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf) {
      // if/then conditional
      if (sub.if) {
        const condErrors = [];
        validateNode(sub.if, data, root, dataPath, condErrors);
        if (condErrors.length === 0 && sub.then) {
          validateNode(sub.then, data, root, dataPath, errors);
        }
      } else {
        validateNode(sub, data, root, dataPath, errors);
      }
    }
  }
}

function validate(schema, data) {
  const errors = [];
  validateNode(schema, data, schema, "$", errors);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function loadAndValidate(jsonPath, schemaName) {
  const schemaPath = path.join(SCHEMA_DIR, `${schemaName}.schema.json`);
  if (!existsSync(schemaPath)) {
    throw new Error(`schema not found: ${schemaPath}`);
  }
  const schema = readJson(schemaPath);
  const data = readJson(jsonPath);
  const result = validate(schema, data);
  if (!result.ok) {
    const msg = result.errors.map(e => `  ${e.path}: ${e.message}`).join("\n");
    throw new Error(`schema validation failed for ${jsonPath}:\n${msg}`);
  }
  return data;
}

// ===================================================================
// scaffold-types
// ===================================================================

function tsTypeForField(field, enumNames) {
  switch (field.kind) {
    case "string":
    case "isoDate":
    case "url":
    case "id":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "stringArray":
      return "string[]";
    case "enum": {
      const name = pascal(field.enumName);
      if (!enumNames.has(field.enumName)) {
        throw new Error(`field ${field.name} references unknown enum ${field.enumName}`);
      }
      return name;
    }
    case "literalUnion":
      return field.literalValues.map(v => `"${v}"`).join(" | ");
    default:
      throw new Error(`unknown field kind: ${field.kind}`);
  }
}

function scaffoldTypes(contract) {
  const lines = [
    "// AUTO-GENERATED by build-hifi scaffold-types.",
    "// Source: ./mock-contract.json — edit that and re-run scaffold-types.",
    "",
  ];

  const sharedEnums = contract.sharedEnums || {};
  const enumNames = new Set(Object.keys(sharedEnums));

  for (const [name, values] of Object.entries(sharedEnums)) {
    lines.push(`export type ${pascal(name)} = ${values.map(v => `"${v}"`).join(" | ")};`);
  }
  if (Object.keys(sharedEnums).length > 0) lines.push("");

  for (const entity of contract.entities) {
    const ifaceName = entity.tsInterfaceName || pascal(entity.name);
    lines.push(`export interface ${ifaceName} {`);
    for (const field of entity.fields) {
      const optional = field.optional ? "?" : "";
      const tsType = tsTypeForField(field, enumNames);
      lines.push(`  ${field.name}${optional}: ${tsType};`);
    }
    lines.push("}");
    lines.push("");
  }

  return lines.join("\n");
}

// ===================================================================
// scaffold-mock-data
// ===================================================================

function placeholderForField(field, idx, entity, enumNames, narrativeRule) {
  if (field.kind === "id") {
    const pattern = entity.idConvention || `${entity.name}-{n}`;
    const id = pattern.replace("{n}", String(idx + 1).padStart(3, "0")).replace("{slug}", `seed-${idx + 1}`);
    return JSON.stringify(id);
  }
  if (field.example !== undefined && field.example !== null) {
    return JSON.stringify(field.example);
  }
  switch (field.kind) {
    case "string":
    case "url":
      // v6: bake the narrative hint into the placeholder so the value-fill agent can't miss it
      if (narrativeRule && narrativeRule.hint) {
        return JSON.stringify(`TODO: ${narrativeRule.hint}`);
      }
      if (narrativeRule && narrativeRule.mustBeFullSentence) {
        return JSON.stringify(`TODO: full sentence with named entity + specific detail (field: ${field.name})`);
      }
      return `""`;
    case "isoDate":
      return `"1970-01-01T00:00:00Z"`;
    case "number":
      return "0";
    case "boolean":
      return "false";
    case "stringArray":
      return "[]";
    case "enum": {
      const values = enumNames.get(field.enumName);
      if (!values || values.length === 0) return `"" as never`;
      return JSON.stringify(values[0]);
    }
    case "literalUnion":
      return JSON.stringify(field.literalValues[0]);
    default:
      return "undefined";
  }
}

function getNarrativeRule(narrativeConventions, entityName, fieldName) {
  if (!narrativeConventions) return null;
  const entity = narrativeConventions.entities?.[entityName];
  if (!entity || !entity.fields) return null;
  return entity.fields[fieldName] || null;
}

function buildRecord(entity, idx, enumNames, graph, variant, narrativeConventions) {
  const props = entity.fields.map(f => {
    const rule = getNarrativeRule(narrativeConventions, entity.name, f.name);
    if (graph) {
      // For 'happy' variant only: use seeded ids for own-id + FK fields
      if (variant === "happy") {
        return `${f.name}: ${seededPlaceholderForField(f, idx, entity, enumNames, graph, rule)}`;
      }
    }
    return `${f.name}: ${placeholderForField(f, idx, entity, enumNames, rule)}`;
  });
  return `  { ${props.join(", ")} }`;
}

function scaffoldMockDataFiles(contract, projectDir, opts = {}) {
  const written = [];
  const sharedEnums = contract.sharedEnums || {};
  const enumValuesByName = new Map(Object.entries(sharedEnums));

  // Build the id graph upfront so every entity skeleton uses real cross-referenceable ids
  const graph = buildIdGraph(contract);
  // Write ID-GRAPH.md as a side effect (single source of truth for entity-fill agents)
  const idGraphPath = path.join(projectDir, "ID-GRAPH.md");
  writeFileSafe(idGraphPath, idGraphMarkdown(graph));
  written.push(idGraphPath);

  // v6: load narrative-conventions if available (from explicit opts.narrativeConventions or from project dir)
  let narrativeConventions = opts.narrativeConventions || null;
  if (!narrativeConventions) {
    const ncPath = path.join(projectDir, "narrative-conventions.json");
    if (existsSync(ncPath)) {
      try {
        narrativeConventions = JSON.parse(readFileSync(ncPath, "utf8"));
      } catch {
        narrativeConventions = null;
      }
    }
  }

  for (const entity of contract.entities) {
    const ifaceName = entity.tsInterfaceName || pascal(entity.name);
    const counts = entity.variantCounts;
    const variants = ["happy"];
    if (counts.empty !== undefined) variants.push("empty");
    if (counts.error !== undefined) variants.push("error");
    if (counts.stress !== undefined && counts.stress > 0) variants.push("stress");

    const lines = [
      `// AUTO-GENERATED skeleton by build-hifi scaffold-mock-data.`,
      `// Shape pinned from ./mock-contract.json. Agents Edit non-id VALUES; never change shape or ids.`,
      `// Entity: ${entity.name}${entity.notes ? ` — ${entity.notes}` : ""}`,
      `import type { ${ifaceName} } from "@/lib/types";`,
      ``,
      `export const ${entity.name}: {`,
      ...variants.map(v => `  ${v}: ${ifaceName}[];`),
      `} = {`,
    ];
    for (const variant of variants) {
      const count = counts[variant] ?? 0;
      if (count === 0) {
        lines.push(`  ${variant}: [],`);
        continue;
      }
      lines.push(`  ${variant}: [`);
      for (let i = 0; i < count; i++) {
        lines.push(buildRecord(entity, i, enumValuesByName, graph, variant, narrativeConventions) + ",");
      }
      lines.push(`  ],`);
    }
    lines.push(`};`);
    lines.push(``);

    const filePath = path.join(projectDir, "src", "lib", "mock-data", `${entity.name}.ts`);
    writeFileSafe(filePath, lines.join("\n"));
    written.push(filePath);
  }

  // Aggregator barrel
  const barrelLines = [
    `// AUTO-GENERATED barrel by build-hifi scaffold-mock-data.`,
  ];
  for (const entity of contract.entities) {
    barrelLines.push(`import { ${entity.name} } from "./mock-data/${entity.name}";`);
  }
  barrelLines.push(``);
  barrelLines.push(`export const mockData = { ${contract.entities.map(e => e.name).join(", ")} };`);
  barrelLines.push(``);
  const barrelPath = path.join(projectDir, "src", "lib", "mock-data.ts");
  writeFileSafe(barrelPath, barrelLines.join("\n"));
  written.push(barrelPath);

  return written;
}

// ===================================================================
// scaffold-chrome
// ===================================================================

function scaffoldChromeFiles(ia, projectDir, opts = {}) {
  const brand = opts.brand || ia.brand || "App";
  const navItems = JSON.stringify(ia.leftNav, null, 2)
    .split("\n")
    .map((l, i) => (i === 0 ? l : "  " + l))
    .join("\n");

  const leftNav = `// AUTO-GENERATED by build-hifi scaffold-chrome.
// Source: ./ia.json — edit that and re-run scaffold-chrome.
"use client";
import Link from "next/link";

const LEFT_NAV_SECTIONS = ${navItems};

const FOOTER = ${JSON.stringify(ia.footer, null, 2)
    .split("\n")
    .map((l, i) => (i === 0 ? l : "  " + l))
    .join("\n")};

export function AppLeftNav() {
  return (
    <aside className="relative z-[60] flex h-screen w-[220px] flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center px-4 border-b border-border">
        <span className="font-medium">${brand}</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
        {LEFT_NAV_SECTIONS.map(section => (
          <div key={section.header}>
            <div className="px-2 mb-2 text-xs uppercase tracking-wide text-ink-soft">{section.header}</div>
            <ul className="space-y-1">
              {section.items.map(item => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-surface-hover"
                  >
                    <span>{item.label}</span>
                    {item.badge ? <span className="text-xs text-ink-soft">{item.badge}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-strong text-xs font-medium">
            {FOOTER.initials || FOOTER.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{FOOTER.name}</div>
            <div className="truncate text-xs text-ink-soft">{FOOTER.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
`;

  const topNavRoles = JSON.stringify(ia.topNavRoles, null, 2)
    .split("\n")
    .map((l, i) => (i === 0 ? l : "  " + l))
    .join("\n");

  const topNav = `// AUTO-GENERATED by build-hifi scaffold-chrome.
// Source: ./ia.json — edit that and re-run scaffold-chrome.
import type { ReactNode } from "react";

const TOP_NAV_ROLES = ${topNavRoles} as const;

type Role = keyof typeof TOP_NAV_ROLES;

type AppTopNavProps = {
  role: Role;
  pageTitle?: ReactNode;
  breadcrumb?: ReactNode;
  trailing?: ReactNode;
};

export function AppTopNav({ role, pageTitle, breadcrumb, trailing }: AppTopNavProps) {
  const config = TOP_NAV_ROLES[role];
  const center =
    config.center === "pageTitle" ? pageTitle :
    config.center === "breadcrumb" ? breadcrumb :
    null;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-4">
        {config.brand ? <span className="font-semibold tracking-tight">${brand}</span> : null}
        <div className="text-sm text-ink-soft">{center}</div>
      </div>
      <div className="flex items-center gap-3 text-sm text-ink-soft">{trailing}</div>
    </header>
  );
}
`;

  const appScreen = `// AUTO-GENERATED by build-hifi scaffold-chrome.
// Canonical screen wrapper. Per-screen agents wrap their body with <AppScreen>.
import type { ReactNode } from "react";
import { AppLeftNav } from "./AppLeftNav";
import { AppTopNav } from "./AppTopNav";

type AppScreenProps = {
  role: "${Object.keys(ia.topNavRoles).join('" | "')}";
  pageTitle?: ReactNode;
  breadcrumb?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
};

export function AppScreen({ role, pageTitle, breadcrumb, trailing, children }: AppScreenProps) {
  return (
    <div className="flex min-h-screen">
      <AppLeftNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopNav role={role} pageTitle={pageTitle} breadcrumb={breadcrumb} trailing={trailing} />
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
`;

  const written = [];
  const baseDir = path.join(projectDir, "src", "components", "app");
  for (const [name, content] of [
    ["AppLeftNav.tsx", leftNav],
    ["AppTopNav.tsx", topNav],
    ["AppScreen.tsx", appScreen],
  ]) {
    const fp = path.join(baseDir, name);
    writeFileSafe(fp, content);
    written.push(fp);
  }
  return written;
}

// ===================================================================
// scaffold-routes (simple screens + trivial redirects)
// ===================================================================

function paramsType(dynamicParams) {
  if (dynamicParams.length === 0) return null;
  const inner = dynamicParams.map(p => `${p}: string`).join("; ");
  return `{ ${inner} }`;
}

function simpleRouteFile(screen) {
  const dyn = extractDynamicParams(screen.path);
  const paramsT = paramsType(dyn);
  const title = screen.pageTitle || pascal(screen.path.replace(/\[|\]/g, "").split("/").filter(Boolean).pop() || "Page");

  const roleStr = JSON.stringify(screen.layout || "workspace");
  const titleProp = screen.layout === "editor" && screen.breadcrumb
    ? `breadcrumb={${JSON.stringify(screen.breadcrumb.join(" / "))}}`
    : `pageTitle=${JSON.stringify(title)}`;

  const fnSig = paramsT
    ? `export default async function Page({ params, searchParams }: { params: Promise<${paramsT}>; searchParams: Promise<Record<string, string | undefined>>; }) {
  const _params = await params;
  const _searchParams = await searchParams;`
    : `export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>>; }) {
  const _searchParams = await searchParams;`;

  return `import type { Metadata } from "next";
import { AppScreen } from "@/components/app/AppScreen";

export const metadata: Metadata = { title: ${JSON.stringify(title)} };

${fnSig}

  return (
    <AppScreen role=${roleStr} ${titleProp}>
      {/* BODY: ${screen.intent} */}
      {/* AGENT: replace the <></> below with the screen body. Primary regions: ${(screen.primaryRegions || []).join(", ") || "none declared"}. */}
      {/* AGENT: mock-data exports available: ${(screen.requiredMockEntities || []).map(e => `mockData.${e}`).join(", ") || "none declared"}. */}
      <></>
    </AppScreen>
  );
}
`;
}

function trivialRedirectFile(screen) {
  return `import { redirect } from "next/navigation";

export default function Page() {
  redirect(${JSON.stringify(screen.redirectTo)});
}
`;
}

function scaffoldRoutesFiles(screens, projectDir) {
  const written = [];
  for (const screen of screens.screens) {
    if (screen.complexity === "compound") continue; // handled by scaffold-compound
    const fp = routeToPagePath(projectDir, screen.path);
    const content = screen.trivial && screen.redirectTo
      ? trivialRedirectFile(screen)
      : simpleRouteFile(screen);
    writeFileSafe(fp, content);
    written.push(fp);
  }
  return written;
}

// ===================================================================
// scaffold-compound (composition shell + empty _<child>.tsx + _data.ts)
// ===================================================================

function compoundShellFile(screen) {
  const dyn = extractDynamicParams(screen.path);
  const paramsT = paramsType(dyn) || "Record<string, never>";
  const childImports = screen.compound.children
    .map(c => `import { ${c.name} } from "./${"_" + kebab(c.name)}";`)
    .join("\n");
  const roleStr = JSON.stringify(screen.layout || "editor");
  const title = screen.pageTitle || pascal(screen.path.split("/").filter(s => !s.startsWith("[")).pop() || "Page");
  const titleProp = screen.layout === "editor" && screen.breadcrumb
    ? `breadcrumb={${JSON.stringify(screen.breadcrumb.join(" / "))}}`
    : `pageTitle=${JSON.stringify(title)}`;

  // Data wiring: import each required mock entity + provide a generic data lookup
  const entityImports = (screen.requiredMockEntities || [])
    .map(e => `import { ${e} } from "@/lib/mock-data/${e}";`)
    .join("\n");

  // Generic data resolution: for each dynamic param ending in "Id" (e.g. submissionId, sectionId),
  // try to find a matching entity record by its `id` field. Fall back to the first happy record.
  const dataLookups = dyn.map(p => {
    // Heuristic: stripped-Id -> entity name (e.g. "submissionId" -> "submissions")
    const stripped = p.replace(/Id$/i, "").toLowerCase();
    const entityName = (screen.requiredMockEntities || []).find(e => e.toLowerCase().startsWith(stripped) || e.toLowerCase().startsWith(stripped + "s"));
    if (entityName) {
      return `  const ${stripped}Record = ${entityName}.happy.find(r => r.id === _params.${p}) ?? ${entityName}.happy[0];`;
    }
    return null;
  }).filter(Boolean).join("\n");

  const paramsRead = dyn.length
    ? `const _params = await params;`
    : `const _params = {} as Record<string, never>;`;
  const urlParamReads = (screen.urlParams || [])
    .map(p => `  const ${p.name}Id = sp.${p.name};`)
    .join("\n");

  // Each child renders as <Child /> — sub-component agents fill its real body and read from
  // the data above by referencing the imported mock-data directly. We pass NO props so children
  // remain stand-alone components with optional defaults.
  const childRenders = screen.compound.children.map(c => {
    if (c.visibilityCondition && /\?[a-z]+=/.test(c.visibilityCondition)) {
      const match = c.visibilityCondition.match(/\?([a-z]+)=/);
      const paramName = match ? match[1] : null;
      if (paramName) return `      {${paramName}Id ? <${c.name} /> : null}`;
    }
    return `      <${c.name} />`;
  }).join("\n");

  const unused = (dataLookups ? "// (data records resolved above are available for sub-components to import directly via mock-data)\n" : "");

  return `import type { Metadata } from "next";
import { AppScreen } from "@/components/app/AppScreen";
${childImports}
${entityImports}

export const metadata: Metadata = { title: ${JSON.stringify(title)} };

export default async function Page({ params, searchParams }: {
  params: Promise<${paramsT}>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  ${paramsRead}
  const sp = await searchParams;
${urlParamReads}
${dataLookups}
${unused ? "  " + unused : ""}
  return (
    <AppScreen role=${roleStr} ${titleProp}>
      {/* BODY: ${screen.intent} */}
${childRenders}
    </AppScreen>
  );
}
`;
}

function emptyChildFile(child, screen) {
  // Children take ALL props as optional so the shell can render <Child /> without explicit props.
  // Agents replacing the body should fill data lookups directly inside the component (importing
  // from @/lib/mock-data) rather than expecting parent-passed props.
  return `// AGENT-OWNED. Replace the stub body via Edit. Type props as OPTIONAL so the
// compound shell can render <${child.name} /> without explicit props. Resolve data
// inside this component by importing from @/lib/mock-data/<entity> directly.
// Intent: ${child.intent}
// Prop contract (from screens.json): ${child.propContract || "(none specified — derive from intent + parent shell)"}
// Approximate LOC budget: ${child.approximateLoc || 150}
// Visibility: ${child.visibilityCondition || "always"}
// Parent screen: ${screen.path}

type ${child.name}Props = Record<string, never>;

export function ${child.name}(_props: ${child.name}Props = {}) {
  return (
    <div data-component="${child.name}" data-stub="true">
      {/* AGENT: replace this stub with the real component body. */}
    </div>
  );
}
`;
}

function scaffoldCompoundFiles(screens, projectDir) {
  const written = [];
  for (const screen of screens.screens) {
    if (screen.complexity !== "compound") continue;
    const dirSegs = routeToFsSegments(screen.path);
    const dir = path.join(projectDir, "src", "app", ...dirSegs);
    // shell
    const shellPath = path.join(dir, "page.tsx");
    writeFileSafe(shellPath, compoundShellFile(screen));
    written.push(shellPath);
    // children
    for (const child of screen.compound.children) {
      const childPath = path.join(dir, `_${kebab(child.name)}.tsx`);
      writeFileSafe(childPath, emptyChildFile(child, screen));
      written.push(childPath);
    }
  }
  return written;
}

// ===================================================================
// extract-primitives (DS source → PRIMITIVE-ENUMS.md)
// ===================================================================

function extractPrimitivesMarkdown(dsPath) {
  const compsDir = path.join(dsPath, "src", "components");
  if (!existsSync(compsDir)) throw new Error(`DS components dir not found: ${compsDir}`);

  // Walk all .tsx files under src/components/
  function walk(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fp, out);
      else if (entry.isFile() && entry.name.endsWith(".tsx")) out.push(fp);
    }
    return out;
  }

  const files = walk(compsDir);
  const buckets = {}; // relPath -> [{ name, union }]

  for (const fp of files) {
    const text = readFileSync(fp, "utf8");
    // Match: export type NAME = "v1" | "v2" | ... possibly multi-line
    // Strategy: find /export type ([A-Z]\w*) =/ then capture until line that doesn't end with `|`.
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^export type ([A-Z][A-Za-z0-9]*) =\s*(.*)$/);
      if (!m) continue;
      const [, name, rest] = m;
      let union = rest.trim();
      let j = i;
      // If union has no string literal yet or ends with `|` or `=`, keep reading
      while (
        (union === "" || union.endsWith("|") || union.endsWith("="))
        && j + 1 < lines.length
      ) {
        j++;
        union += " " + lines[j].trim();
      }
      // Read additional `| "v"` lines after the initial declaration too
      while (j + 1 < lines.length && /^\s*\|\s*"/.test(lines[j + 1])) {
        j++;
        union += " " + lines[j].trim();
      }
      // Strip trailing semicolon if present
      union = union.replace(/;\s*$/, "").trim();
      // Only include if union contains at least one string literal
      if (/"[^"]+"/.test(union)) {
        const rel = path.relative(dsPath, fp);
        if (!buckets[rel]) buckets[rel] = [];
        buckets[rel].push({ name, union });
      }
      i = j;
    }
  }

  const out = [
    `# Primitive prop enums`,
    ``,
    `Closed-enum prop values extracted from the design system at \`${dsPath}\`. Every value listed here is exact. If you use a value not listed here, the TypeScript build will fail.`,
    ``,
    `Generated by \`build-hifi extract-primitives\`. Do not edit by hand.`,
    ``,
  ];
  const sortedKeys = Object.keys(buckets).sort();
  for (const rel of sortedKeys) {
    out.push(`## ${rel}`);
    out.push(``);
    for (const { name, union } of buckets[rel]) {
      out.push(`- **${name}**: ${union}`);
    }
    out.push(``);
  }
  return out.join("\n");
}

// ===================================================================
// seed-ids (mock-contract.json → seeded id graph)
// ===================================================================

function generateIdsForEntity(entity, count) {
  const pattern = entity.idConvention || `${entity.name}-{n}`;
  const ids = [];
  for (let i = 0; i < count; i++) {
    const id = pattern
      .replace("{n}", String(i + 1).padStart(3, "0"))
      .replace("{slug}", `seed-${i + 1}`);
    ids.push(id);
  }
  return ids;
}

function buildIdGraph(contract) {
  // Returns { entityName: { happy: [...ids], error: [...ids], ... } }
  const graph = {};
  for (const entity of contract.entities) {
    graph[entity.name] = {};
    for (const [variant, count] of Object.entries(entity.variantCounts || {})) {
      if (count > 0) graph[entity.name][variant] = generateIdsForEntity(entity, count);
    }
  }
  return graph;
}

function pickFromPool(pool, idx) {
  if (!pool || pool.length === 0) return "";
  return pool[idx % pool.length];
}

function seededPlaceholderForField(field, idx, entity, enumNames, graph, narrativeRule) {
  // Use the pre-seeded id from the graph for the entity's own id field
  if (field.kind === "id" && field.name === "id") {
    // Caller is iterating happy[idx]; we use happy ids from graph
    const pool = graph[entity.name]?.happy ?? [];
    return JSON.stringify(pool[idx] || `${entity.name}-${idx + 1}`);
  }
  // Use a real id from the referenced entity for FK fields
  if (field.kind === "id" && field.referencesEntity && graph[field.referencesEntity]) {
    const pool = graph[field.referencesEntity].happy ?? [];
    return JSON.stringify(pickFromPool(pool, idx));
  }
  // fallback to existing placeholder logic with narrative rule
  return placeholderForField(field, idx, entity, enumNames, narrativeRule);
}

function idGraphMarkdown(graph) {
  const out = [
    `# Mock-data id graph`,
    ``,
    `Pre-seeded ids per entity per variant. Every entity-value-fill agent MUST use these exact ids when populating id fields. FK fields (other entities' ids) MUST be drawn from the referenced entity's pool below.`,
    ``,
    `Generated by \`build-hifi seed-ids\`. Do not edit by hand.`,
    ``,
  ];
  for (const [entity, variants] of Object.entries(graph)) {
    out.push(`## ${entity}`);
    out.push(``);
    for (const [variant, ids] of Object.entries(variants)) {
      out.push(`### ${variant}`);
      out.push(``);
      out.push(ids.map(id => `- \`${id}\``).join("\n"));
      out.push(``);
    }
  }
  return out.join("\n");
}

// ===================================================================
// nav-crawl (v6: every href / Link / router.push resolves to a real route)
// ===================================================================

function listRouteFiles(projectDir) {
  const appDir = path.join(projectDir, "src", "app");
  if (!existsSync(appDir)) return [];
  const out = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fp);
      } else if (entry.isFile() && entry.name === "page.tsx") {
        const rel = path.relative(appDir, path.dirname(fp));
        const route = rel === "" ? "/" : "/" + rel;
        out.push(route);
      }
    }
  }
  walk(appDir);
  return out;
}

function matchRouteWithDynamic(href, routes) {
  // routes contain [param] segments; href contains real values. Match by segment shape.
  // Strip query + hash.
  const cleanHref = href.split(/[?#]/)[0];
  // Special: root "/" matches "/" exact
  if (cleanHref === "/" && routes.includes("/")) return "/";
  const hrefSegs = cleanHref.split("/").filter(Boolean);
  for (const route of routes) {
    const routeSegs = route.split("/").filter(Boolean);
    if (routeSegs.length !== hrefSegs.length) continue;
    let ok = true;
    for (let i = 0; i < routeSegs.length; i++) {
      const rs = routeSegs[i];
      const hs = hrefSegs[i];
      if (rs.startsWith("[") && rs.endsWith("]")) {
        if (!hs) { ok = false; break; }
      } else if (rs !== hs) {
        ok = false;
        break;
      }
    }
    if (ok) return route;
  }
  return null;
}

function navCrawl(projectDir) {
  const routes = listRouteFiles(projectDir);
  const violations = [];

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
        walk(fp);
      } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
        const text = readFileSync(fp, "utf8");
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Match href="…" and href={`…`} and router.push("…") forms
          const hrefMatches = [
            ...line.matchAll(/href=\{?["`']([^"`'$]+)["`']\}?/g),
            ...line.matchAll(/router\.push\(\s*["`']([^"`']+)["`']/g),
          ];
          for (const m of hrefMatches) {
            const href = m[1];
            if (!href.startsWith("/")) continue; // external / anchor / mailto
            if (href.startsWith("/api/")) continue; // API routes not validated
            if (href.startsWith("/_next")) continue;
            const matched = matchRouteWithDynamic(href, routes);
            if (!matched) {
              violations.push({
                href,
                file: path.relative(projectDir, fp),
                line: i + 1,
                snippet: line.trim().slice(0, 160),
              });
            }
          }
        }
      }
    }
  }

  const srcDir = path.join(projectDir, "src");
  if (existsSync(srcDir)) walk(srcDir);
  return { routes, violations };
}

function navCrawlReport({ routes, violations }, projectDir) {
  const out = [
    "# Nav crawl report",
    "",
    `Routes discovered: ${routes.length}`,
    `Violations: ${violations.length}`,
    "",
    "## Routes",
    "",
    ...routes.map(r => `- \`${r}\``),
    "",
  ];
  if (violations.length > 0) {
    out.push("## Violations", "");
    for (const v of violations) {
      out.push(`- **${v.file}:${v.line}** → \`${v.href}\``);
      out.push(`  ${v.snippet}`);
    }
  } else {
    out.push("## Violations", "", "(none — every href resolves to a real route)");
  }
  return out.join("\n");
}

// ===================================================================
// interactivity-audit (v6: no bare static buttons)
// ===================================================================

function interactivityAudit(projectDir) {
  const violations = [];
  const appDir = path.join(projectDir, "src", "app");
  if (!existsSync(appDir)) return { violations };

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fp);
      else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
        const text = readFileSync(fp, "utf8");
        const isClient = text.startsWith('"use client"') || text.startsWith("'use client'") || /^\s*"use client"/m.test(text.split("\n").slice(0, 3).join("\n"));
        // Find <Button ...>…</Button> JSX, including self-closing variants
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!/<Button\b/.test(line)) continue;
          // Capture the opening tag, which may span multiple lines
          let tag = line;
          let j = i;
          while (!tag.includes(">") && j + 1 < lines.length) {
            j++;
            tag += "\n" + lines[j];
          }
          const opening = tag.slice(tag.indexOf("<Button"));
          const tagBody = opening.slice(0, opening.indexOf(">") + 1);

          // Check satisfiers
          const hasOnClick = /onClick=/.test(tagBody) || /onClick=/.test(text.slice(text.indexOf(tagBody)));
          const hasAriaDisabled = /aria-disabled\s*=\s*["{]\s*["']?true/.test(tagBody) || /\bdisabled\b/.test(tagBody);
          // Check preceding context for <Link href=...>
          const beforeIndex = text.indexOf(tagBody);
          const contextBefore = text.slice(Math.max(0, beforeIndex - 300), beforeIndex);
          const wrappedInLink = /<Link\s+href=/.test(contextBefore.replace(/[\s\S]*<\/Link>/g, ""));

          // Pass conditions:
          //  - Wrapped in <Link href> (route nav)
          //  - aria-disabled=true / disabled (preview-only)
          //  - File is "use client" AND has onClick somewhere
          //  - Has explicit onClick handler (real action) in the tag itself
          const passes =
            wrappedInLink ||
            hasAriaDisabled ||
            (isClient && hasOnClick) ||
            hasOnClick;

          if (!passes) {
            violations.push({
              file: path.relative(projectDir, fp),
              line: i + 1,
              snippet: line.trim().slice(0, 160),
              reasons: {
                isClient,
                wrappedInLink,
                hasOnClick,
                hasAriaDisabled,
              },
            });
          }
        }
      }
    }
  }
  walk(appDir);
  return { violations };
}

function interactivityAuditReport({ violations }) {
  const out = [
    "# Interactivity audit report",
    "",
    `Violations: ${violations.length}`,
    "",
  ];
  if (violations.length === 0) {
    out.push("(none — every `<Button>` is wrapped in a `<Link>`, in a `\"use client\"` file with onClick, or has aria-disabled / disabled affordance.)");
  } else {
    for (const v of violations) {
      out.push(`- **${v.file}:${v.line}**`);
      out.push(`  ${v.snippet}`);
      out.push(`  reasons: client=${v.reasons.isClient} link=${v.reasons.wrappedInLink} onClick=${v.reasons.hasOnClick} disabled=${v.reasons.hasAriaDisabled}`);
    }
  }
  return out.join("\n");
}

// ===================================================================
// emit-brief-bundle (v6: collect all user inputs into one Read)
// ===================================================================

function readFileMaybe(p) {
  try {
    return existsSync(p) ? readFileSync(p, "utf8") : null;
  } catch {
    return null;
  }
}

function emitBriefBundle({ prdPath, briefPath, lofiFolder, cornerstone, references }) {
  const sections = [
    "# Brief bundle",
    "",
    "Single Read for the strategy agent. Concatenates every user-provided input.",
    "",
  ];

  if (cornerstone) {
    sections.push("## Cornerstone declaration (user-specified)", "");
    sections.push(`The user explicitly named **${cornerstone}** as the cornerstone of the experience. Every IA decision and screen design choice must respect that.`, "");
  }

  // PRD
  const prd = prdPath ? readFileMaybe(prdPath) : null;
  if (prd) {
    sections.push("## PRD", "", prd, "");
  } else {
    sections.push("## PRD", "", "(no PRD file found at " + (prdPath || "<unspecified>") + ")", "");
  }

  // Extra brief
  if (briefPath) {
    const brief = readFileMaybe(briefPath);
    sections.push("## Extra brief (user notes)", "", brief || "(file not found: " + briefPath + ")", "");
  }

  // Lo-fi
  if (lofiFolder) {
    sections.push("## Lo-fi references (from /build-lofi)", "");
    const concepts = readFileMaybe(path.join(lofiFolder, "concepts.json"));
    if (concepts) {
      sections.push("### concepts.json", "", "```json", concepts, "```", "");
    }
    const sketchHtml = readFileMaybe(path.join(lofiFolder, "sketch.html"));
    if (sketchHtml) {
      // Strip <script>, <style>, leave structural HTML
      const stripped = sketchHtml
        .replace(/<script[\s\S]*?<\/script>/g, "")
        .replace(/<style[\s\S]*?<\/style>/g, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\n{3,}/g, "\n\n");
      sections.push("### sketch.html (structural only — scripts/styles stripped)", "", "```html", stripped.slice(0, 8000), "```", "");
    }
    if (!concepts && !sketchHtml) {
      sections.push("(no concepts.json or sketch.html found in " + lofiFolder + ")", "");
    }
  }

  // Visual references
  if (references && references.length > 0) {
    sections.push("## Visual references", "");
    sections.push("The user pointed at these reference paths. Treat them as visual intent signals; you cannot view image bytes directly, but their filenames or any text content from the user's brief gives intent.", "");
    for (const ref of references) {
      sections.push(`- [reference: ${ref}]`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

// ===================================================================
// validate-ia-screens
// ===================================================================

function validateIaScreensConsistency(ia, screens) {
  const screenPaths = new Set(screens.screens.map(s => s.path));
  const errors = [];
  for (const group of (ia.leftNav || [])) {
    for (const item of (group.items || [])) {
      // Normalize: strip dynamic segments [param] to compare against screens.json paths which include the brackets
      if (!screenPaths.has(item.href)) {
        errors.push({
          href: item.href,
          label: item.label,
          message: `LeftNav href "${item.href}" (label: "${item.label}") does not match any screens[].path`,
        });
      }
    }
  }
  return errors;
}

// ===================================================================
// bundle-context
// ===================================================================

function readIfExists(p) {
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

function bundleContextFile(opts) {
  const { projectDir, target, type } = opts;
  const prd = readIfExists(path.join(projectDir, "PRD.md")) || "(PRD.md not found)";
  const manifest = readIfExists(path.join(projectDir, "BUILD-CONTEXT.md")) || "(BUILD-CONTEXT.md not found — run bootstrap)";
  const ia = readIfExists(path.join(projectDir, "ia.json"));
  const screens = readIfExists(path.join(projectDir, "screens.json"));
  const contract = readIfExists(path.join(projectDir, "mock-contract.json"));
  const hardContract = readIfExists(path.join(projectDir, "build-hifi-ctx", "HARD-CONTRACT.md")) || "";
  // v6: prefer MOTION-LIBRARY.md (expanded), fall back to MOTION-RULES.md (legacy v3-v5)
  const motionLibrary =
    readIfExists(path.join(projectDir, "build-hifi-ctx", "MOTION-LIBRARY.md")) ||
    readIfExists(path.join(projectDir, "build-hifi-ctx", "MOTION-RULES.md")) ||
    "";
  const qualityBar = readIfExists(path.join(projectDir, "build-hifi-ctx", "QUALITY-BAR.md")) || "";
  const narrativeRef = readIfExists(path.join(projectDir, "build-hifi-ctx", "NARRATIVE-CONVENTIONS.md")) || "";
  const commonMistakes = readIfExists(path.join(projectDir, "build-hifi-ctx", "COMMON-MISTAKES.md")) || "";
  const primitiveEnums = readIfExists(path.join(projectDir, "PRIMITIVE-ENUMS.md")) || "";
  const idGraph = readIfExists(path.join(projectDir, "ID-GRAPH.md")) || "";
  const strategy = readIfExists(path.join(projectDir, "STRATEGY.md")) || "";
  const strategyJson = readIfExists(path.join(projectDir, "strategy.json")) || "";
  const styleBaseline =
    readIfExists(path.join(projectDir, `style-baseline-${target}.json`)) ||
    readIfExists(path.join(projectDir, "style-baseline.json")) ||
    "";
  const narrativeConventions = readIfExists(path.join(projectDir, "narrative-conventions.json")) || "";

  // v7: entity value-fill agents author no markup and no motion classes, so the
  // Quality Bar + Motion Library sections are dead weight that slows Haiku's
  // read. Trim them from entity bundles only; keep the full bundle for screen /
  // compound / content targets where visual judgment matters.
  const isEntity = type === "entity";

  const sections = [
    `# Agent context: ${target}`,
    ``,
    `Target type: \`${type}\``,
    ``,
    `## How to use this file`,
    ``,
    `This is the ONE file you Read before writing. Everything you need is bundled below.`,
    ``,
    `Write only the file your prompt assigns. Use Edit to replace markers; do not Write that overwrites scaffolded files unless your prompt says so.`,
    ``,
  ];

  if (!isEntity) {
    sections.push(
      `---`,
      ``,
      `## Quality bar (the 6 dimensions your output must clear)`,
      ``,
      qualityBar || "(QUALITY-BAR.md not found in build-hifi-ctx/)",
      ``,
    );
  }

  sections.push(
    `---`,
    ``,
    `## Hard contract (audit-enforced)`,
    ``,
    hardContract,
    ``,
    `---`,
    ``,
    `## Primitive prop enums (closed enums — use ONLY these values)`,
    ``,
    primitiveEnums || "(PRIMITIVE-ENUMS.md not found — run \`build-hifi extract-primitives\`)",
    ``,
  );

  if (!isEntity) {
    sections.push(
      `---`,
      ``,
      `## Motion library (apply at least 3 patterns from here)`,
      ``,
      motionLibrary || "(MOTION-LIBRARY.md not found in build-hifi-ctx/)",
      ``,
    );
  }

  sections.push(
    `---`,
    ``,
    `## Common mistakes (avoid these specifically)`,
    ``,
    commonMistakes || "(COMMON-MISTAKES.md not found in build-hifi-ctx/)",
    ``,
    `---`,
    ``,
    `## Narrative conventions reference`,
    ``,
    narrativeRef || "(NARRATIVE-CONVENTIONS.md not found in build-hifi-ctx/)",
    ``,
    `---`,
    ``,
    `## Design system manifest`,
    ``,
    manifest,
    ``,
    `---`,
    ``,
    `## PRD`,
    ``,
    prd,
  );

  if (strategy) {
    sections.push(``, `---`, ``, `## Strategy (cornerstone, IA philosophy, persona, motion personality, content voice)`, ``, strategy);
  }
  if (strategyJson) {
    sections.push(``, `---`, ``, `## Strategy (structured)`, ``, "```json", strategyJson, "```");
  }
  if (styleBaseline) {
    sections.push(``, `---`, ``, `## Style baseline (apply these classes for consistency across screens)`, ``, "```json", styleBaseline, "```");
  }
  if (narrativeConventions) {
    sections.push(``, `---`, ``, `## Narrative conventions (structured per-field rules)`, ``, "```json", narrativeConventions, "```");
  }
  if (idGraph) {
    sections.push(``, `---`, ``, `## ID graph (real ids per entity — use these exact strings)`, ``, idGraph);
  }
  if (ia) {
    sections.push(``, `---`, ``, `## IA model`, ``, "```json", ia, "```");
  }
  if (screens) {
    sections.push(``, `---`, ``, `## Screen list`, ``, "```json", screens, "```");
  }
  if (contract) {
    sections.push(``, `---`, ``, `## Mock-data contract`, ``, "```json", contract, "```");
  }

  return sections.join("\n");
}

// ===================================================================
// bootstrap
// ===================================================================

function bootstrapProject({ dsPath, projectDir, prdPath, skipInstall }) {
  if (!existsSync(dsPath)) throw new Error(`DS not found: ${dsPath}`);
  if (!existsSync(prdPath)) throw new Error(`PRD not found: ${prdPath}`);
  const manifestPath = path.join(dsPath, "docs", "MANIFEST.md");
  if (!existsSync(manifestPath)) {
    throw new Error(`DS missing committed manifest: ${manifestPath}. Run \`npm run manifest\` in the DS repo and commit the result.`);
  }

  if (existsSync(projectDir)) {
    const entries = readdirSync(projectDir);
    if (entries.length > 0) {
      throw new Error(`project dir not empty: ${projectDir}. Pass --force to overwrite.`);
    }
  }
  mkdirSync(projectDir, { recursive: true });

  // Copy DS into project dir
  cpSync(dsPath, projectDir, { recursive: true });

  // Strip showcase artifacts
  for (const dropPath of [".git", ".next", "node_modules", "tsconfig.tsbuildinfo"]) {
    const p = path.join(projectDir, dropPath);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }
  // Strip showcase routes
  for (const showcase of ["src/app/templates", "src/app/components", "src/app/(showcase)", "src/app/page.tsx"]) {
    const p = path.join(projectDir, showcase);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }

  // Copy PRD
  cpSync(prdPath, path.join(projectDir, "PRD.md"));

  // Copy bundled context templates
  const templatesDir = path.join(__dirname, "..", "templates");
  if (existsSync(templatesDir)) {
    cpSync(templatesDir, path.join(projectDir, "build-hifi-ctx"), { recursive: true });
  }

  // Copy DS manifest as BUILD-CONTEXT.md
  cpSync(manifestPath, path.join(projectDir, "BUILD-CONTEXT.md"));

  // npm install
  if (!skipInstall) {
    const result = spawnSync("npm", ["install"], { cwd: projectDir, stdio: "inherit" });
    if (result.status !== 0) throw new Error("npm install failed");
  }

  return { projectDir };
}

// ===================================================================
// build / dev
// ===================================================================

function runBuild({ projectDir }) {
  const result = spawnSync("npm", ["run", "build"], { cwd: projectDir, stdio: "inherit" });
  if (result.status !== 0) throw new Error("npm run build failed");
}

function runDev({ projectDir, port }) {
  const env = { ...process.env, PORT: String(port) };
  const result = spawnSync("npm", ["run", "dev"], { cwd: projectDir, stdio: "inherit", env });
  if (result.status !== 0) throw new Error("npm run dev failed");
}

// ===================================================================
// CLI router
// ===================================================================

function parseFlags(args, schema) {
  return parseArgs({ args, options: schema, allowPositionals: true });
}

const COMMANDS = {
  async "scaffold-types"(args) {
    const { values, positionals } = parseFlags(args, {
      project: { type: "string", default: "." },
      timings: { type: "string" },
    });
    const contractPath = positionals[0];
    if (!contractPath) throw new Error("usage: scaffold-types <mock-contract.json> --project <dir>");
    await timed(values.timings, "scaffold-types", async () => {
      const contract = loadAndValidate(contractPath, "mock-contract");
      const out = scaffoldTypes(contract);
      const fp = path.join(values.project, "src", "lib", "types.ts");
      writeFileSafe(fp, out);
      console.log(fp);
    });
  },

  async "scaffold-mock-data"(args) {
    const { values, positionals } = parseFlags(args, {
      project: { type: "string", default: "." },
      timings: { type: "string" },
    });
    const contractPath = positionals[0];
    if (!contractPath) throw new Error("usage: scaffold-mock-data <mock-contract.json> --project <dir>");
    await timed(values.timings, "scaffold-mock-data", async () => {
      const contract = loadAndValidate(contractPath, "mock-contract");
      const written = scaffoldMockDataFiles(contract, values.project);
      written.forEach(p => console.log(p));
    });
  },

  async "scaffold-chrome"(args) {
    const { values, positionals } = parseFlags(args, {
      project: { type: "string", default: "." },
      brand: { type: "string" },
      timings: { type: "string" },
    });
    const iaPath = positionals[0];
    if (!iaPath) throw new Error("usage: scaffold-chrome <ia.json> --project <dir> [--brand <name>]");
    await timed(values.timings, "scaffold-chrome", async () => {
      const ia = loadAndValidate(iaPath, "ia");
      const written = scaffoldChromeFiles(ia, values.project, { brand: values.brand });
      written.forEach(p => console.log(p));
    });
  },

  async "extract-primitives"(args) {
    const { values } = parseFlags(args, {
      "ds-path": { type: "string" },
      project: { type: "string", default: "." },
      out: { type: "string" },
      timings: { type: "string" },
    });
    if (!values["ds-path"]) throw new Error("usage: extract-primitives --ds-path <p> --project <p> [--out <path>]");
    await timed(values.timings, "extract-primitives", async () => {
      const md = extractPrimitivesMarkdown(values["ds-path"]);
      const outPath = values.out || path.join(values.project, "PRIMITIVE-ENUMS.md");
      writeFileSafe(outPath, md);
      console.log(outPath);
    });
  },

  async "seed-ids"(args) {
    const { values, positionals } = parseFlags(args, {
      project: { type: "string", default: "." },
      timings: { type: "string" },
    });
    const contractPath = positionals[0];
    if (!contractPath) throw new Error("usage: seed-ids <mock-contract.json> --project <dir>");
    await timed(values.timings, "seed-ids", async () => {
      const contract = loadAndValidate(contractPath, "mock-contract");
      const graph = buildIdGraph(contract);
      const outPath = path.join(values.project, "ID-GRAPH.md");
      writeFileSafe(outPath, idGraphMarkdown(graph));
      console.log(outPath);
    });
  },

  async "validate-ia-screens"(args) {
    const { values } = parseFlags(args, {
      ia: { type: "string" },
      screens: { type: "string" },
      timings: { type: "string" },
    });
    if (!values.ia || !values.screens) throw new Error("usage: validate-ia-screens --ia <path> --screens <path>");
    await timed(values.timings, "validate-ia-screens", async () => {
      const ia = loadAndValidate(values.ia, "ia");
      const screens = loadAndValidate(values.screens, "screens");
      const errors = validateIaScreensConsistency(ia, screens);
      if (errors.length > 0) {
        console.error(`validate-ia-screens: ${errors.length} mismatch(es):`);
        for (const e of errors) console.error(`  - ${e.message}`);
        const validPaths = screens.screens.map(s => s.path).join(", ");
        console.error(`Valid screen paths: ${validPaths}`);
        process.exitCode = 1;
        throw new Error("ia↔screens validation failed");
      }
      console.log("ia↔screens: ok");
    });
  },

  async "scaffold-routes"(args) {
    const { values, positionals } = parseFlags(args, {
      project: { type: "string", default: "." },
      timings: { type: "string" },
    });
    const screensPath = positionals[0];
    if (!screensPath) throw new Error("usage: scaffold-routes <screens.json> --project <dir>");
    await timed(values.timings, "scaffold-routes", async () => {
      const screens = loadAndValidate(screensPath, "screens");
      const written = scaffoldRoutesFiles(screens, values.project);
      written.forEach(p => console.log(p));
    });
  },

  async "scaffold-compound"(args) {
    const { values, positionals } = parseFlags(args, {
      project: { type: "string", default: "." },
      timings: { type: "string" },
    });
    const screensPath = positionals[0];
    if (!screensPath) throw new Error("usage: scaffold-compound <screens.json> --project <dir>");
    await timed(values.timings, "scaffold-compound", async () => {
      const screens = loadAndValidate(screensPath, "screens");
      const written = scaffoldCompoundFiles(screens, values.project);
      if (written.length === 0) console.log("(no compound screens in spec)");
      else written.forEach(p => console.log(p));
    });
  },

  async "bundle-context"(args) {
    const { values } = parseFlags(args, {
      project: { type: "string", default: "." },
      target: { type: "string" },
      type: { type: "string", default: "screen" },
      out: { type: "string" },
      timings: { type: "string" },
    });
    if (!values.target) throw new Error("usage: bundle-context --target <name> [--type screen|compound-child|entity|content] [--out <path>] --project <dir>");
    await timed(values.timings, `bundle-context:${values.target}`, async () => {
      const content = bundleContextFile({ projectDir: values.project, target: values.target, type: values.type });
      const outPath = values.out || path.join(values.project, "agent-ctx", `${kebab(values.target)}.md`);
      writeFileSafe(outPath, content);
      console.log(outPath);
    });
  },

  async bootstrap(args) {
    const { values } = parseFlags(args, {
      "ds-path": { type: "string" },
      project: { type: "string" },
      prd: { type: "string" },
      "skip-install": { type: "boolean", default: false },
      timings: { type: "string" },
    });
    if (!values["ds-path"] || !values.project || !values.prd) {
      throw new Error("usage: bootstrap --ds-path <p> --project <p> --prd <p> [--skip-install]");
    }
    await timed(values.timings, "bootstrap", async () => {
      bootstrapProject({
        dsPath: values["ds-path"],
        projectDir: values.project,
        prdPath: values.prd,
        skipInstall: values["skip-install"],
      });
      console.log(values.project);
    });
  },

  async build(args) {
    const { values } = parseFlags(args, {
      project: { type: "string", default: "." },
      timings: { type: "string" },
    });
    await timed(values.timings, "build", async () => {
      runBuild({ projectDir: values.project });
    });
  },

  async dev(args) {
    const { values } = parseFlags(args, {
      project: { type: "string", default: "." },
      port: { type: "string", default: "3000" },
      timings: { type: "string" },
    });
    await timed(values.timings, "dev", async () => {
      runDev({ projectDir: values.project, port: values.port });
    });
  },

  async validate(args) {
    const { values, positionals } = parseFlags(args, {
      schema: { type: "string" },
      timings: { type: "string" },
    });
    const jsonPath = positionals[0];
    if (!jsonPath || !values.schema) {
      throw new Error("usage: validate <file.json> --schema ia|screens|mock-contract|strategy|narrative-conventions|style-baseline");
    }
    loadAndValidate(jsonPath, values.schema);
    console.log(`${jsonPath}: ok`);
  },

  async "emit-brief-bundle"(args) {
    const { values } = parseFlags(args, {
      prd: { type: "string" },
      brief: { type: "string" },
      from: { type: "string" },
      cornerstone: { type: "string" },
      references: { type: "string" },
      project: { type: "string", default: "." },
      out: { type: "string" },
      timings: { type: "string" },
    });
    if (!values.prd) throw new Error("usage: emit-brief-bundle --prd <p> [--brief <p>] [--from <lofi-folder>] [--cornerstone <name>] [--references a.png,b.png] --project <p>");
    await timed(values.timings, "emit-brief-bundle", async () => {
      const refs = values.references ? values.references.split(",").map(s => s.trim()).filter(Boolean) : [];
      const text = emitBriefBundle({
        prdPath: values.prd,
        briefPath: values.brief,
        lofiFolder: values.from,
        cornerstone: values.cornerstone,
        references: refs,
      });
      const outPath = values.out || path.join(values.project, "BRIEF-BUNDLE.md");
      writeFileSafe(outPath, text);
      console.log(outPath);
    });
  },

  async "nav-crawl"(args) {
    const { values } = parseFlags(args, {
      project: { type: "string", default: "." },
      out: { type: "string" },
      timings: { type: "string" },
    });
    await timed(values.timings, "nav-crawl", async () => {
      const result = navCrawl(values.project);
      const report = navCrawlReport(result, values.project);
      const outPath = values.out || path.join(values.project, "NAV-CRAWL-REPORT.md");
      writeFileSafe(outPath, report);
      console.log(outPath);
      if (result.violations.length > 0) {
        console.error(`nav-crawl: ${result.violations.length} unresolved hrefs`);
        for (const v of result.violations.slice(0, 5)) {
          console.error(`  ${v.file}:${v.line} -> ${v.href}`);
        }
        process.exitCode = 1;
        throw new Error("nav-crawl failed");
      }
      console.log(`nav-crawl: ok (${result.routes.length} routes discovered)`);
    });
  },

  async "interactivity-audit"(args) {
    const { values } = parseFlags(args, {
      project: { type: "string", default: "." },
      out: { type: "string" },
      timings: { type: "string" },
    });
    await timed(values.timings, "interactivity-audit", async () => {
      const result = interactivityAudit(values.project);
      const report = interactivityAuditReport(result);
      const outPath = values.out || path.join(values.project, "INTERACTIVITY-AUDIT.md");
      writeFileSafe(outPath, report);
      console.log(outPath);
      if (result.violations.length > 0) {
        console.error(`interactivity-audit: ${result.violations.length} bare-button violations`);
        for (const v of result.violations.slice(0, 5)) {
          console.error(`  ${v.file}:${v.line}`);
        }
        process.exitCode = 1;
        throw new Error("interactivity-audit failed");
      }
      console.log("interactivity-audit: ok");
    });
  },
};

function printUsage() {
  console.error("usage: build-hifi <subcommand> [args]");
  console.error("subcommands:", Object.keys(COMMANDS).join(", "));
}

async function main() {
  const sub = process.argv[2];
  if (!sub || sub === "--help" || sub === "-h") {
    printUsage();
    process.exit(sub ? 0 : 1);
  }
  const handler = COMMANDS[sub];
  if (!handler) {
    console.error(`unknown subcommand: ${sub}`);
    printUsage();
    process.exit(1);
  }
  try {
    await handler(process.argv.slice(3));
  } catch (err) {
    console.error(`build-hifi ${sub}: ${err.message}`);
    process.exit(1);
  }
}

// Allow this file to be imported by the test suite without auto-running.
const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}

export {
  // exported for unit tests
  validate,
  loadAndValidate,
  scaffoldTypes,
  scaffoldMockDataFiles,
  scaffoldChromeFiles,
  scaffoldRoutesFiles,
  scaffoldCompoundFiles,
  bundleContextFile,
  extractPrimitivesMarkdown,
  buildIdGraph,
  idGraphMarkdown,
  validateIaScreensConsistency,
  // v6 additions
  emitBriefBundle,
  navCrawl,
  navCrawlReport,
  interactivityAudit,
  interactivityAuditReport,
  listRouteFiles,
  matchRouteWithDynamic,
  pascal,
  kebab,
  extractDynamicParams,
  routeToFsSegments,
};
