// Tests for build-hifi.mjs. Run with: node --test ~/.claude/skills/build-hifi/bin/build-hifi.test.mjs
// No external deps. Uses node:test + node:assert.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
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
} from "./build-hifi.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "..", "fixtures");
const SCHEMAS = path.resolve(__dirname, "..", "schemas");

const SCRIPT = path.resolve(__dirname, "build-hifi.mjs");

function tmpProject() {
  return mkdtempSync(path.join(os.tmpdir(), "buildhifi-"));
}

function readSchema(name) {
  return JSON.parse(readFileSync(path.join(SCHEMAS, `${name}.schema.json`), "utf8"));
}

function readFixture(name) {
  return JSON.parse(readFileSync(path.join(FIXTURES, name), "utf8"));
}

// ===================================================================
// Helpers
// ===================================================================

test("pascal/kebab/extractDynamicParams basics", () => {
  assert.equal(pascal("guidanceEvents"), "GuidanceEvents");
  assert.equal(pascal("guidance_events"), "GuidanceEvents");
  assert.equal(pascal("guidance-events"), "GuidanceEvents");
  assert.equal(kebab("DocumentViewer"), "document-viewer");
  assert.equal(kebab("GuidanceSidePanel"), "guidance-side-panel");
  assert.deepEqual(routeToFsSegments("/submissions/[id]/sections/[sid]"), ["submissions", "[id]", "sections", "[sid]"]);
  assert.deepEqual(extractDynamicParams("/submissions/[submissionId]/sections/[sectionId]"), ["submissionId", "sectionId"]);
  assert.deepEqual(extractDynamicParams("/dashboard"), []);
});

// ===================================================================
// Schema validation
// ===================================================================

test("validate: ia.valid passes", () => {
  const schema = readSchema("ia");
  const data = readFixture("ia.valid.json");
  const result = validate(schema, data);
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.errors, null, 2));
});

test("validate: ia.invalid fails with expected field paths", () => {
  const schema = readSchema("ia");
  const data = readFixture("ia.invalid.json");
  const result = validate(schema, data);
  assert.equal(result.ok, false);
  const paths = result.errors.map(e => e.path).join("\n");
  // href without leading slash
  assert.match(paths, /href/);
  // footer missing required `role`
  assert.match(paths, /footer/);
});

test("validate: screens.valid passes", () => {
  const schema = readSchema("screens");
  const data = readFixture("screens.valid.json");
  const result = validate(schema, data);
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.errors, null, 2));
});

test("validate: screens.invalid (compound missing compound block) fails", () => {
  const schema = readSchema("screens");
  const data = readFixture("screens.invalid.json");
  const result = validate(schema, data);
  assert.equal(result.ok, false);
  const msgs = result.errors.map(e => e.message).join("\n");
  assert.match(msgs, /compound/);
});

test("validate: mock-contract.valid passes", () => {
  const schema = readSchema("mock-contract");
  const data = readFixture("mock-contract.valid.json");
  const result = validate(schema, data);
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.errors, null, 2));
});

test("validate: mock-contract.invalid fails", () => {
  const schema = readSchema("mock-contract");
  const data = readFixture("mock-contract.invalid.json");
  const result = validate(schema, data);
  assert.equal(result.ok, false);
  const msgs = result.errors.map(e => e.message).join("\n");
  // entity missing fields + variantCounts AND the name fails the camelCase pattern
  assert.match(msgs, /missing required|pattern/);
});

test("loadAndValidate throws on schema failure", () => {
  assert.throws(
    () => loadAndValidate(path.join(FIXTURES, "ia.invalid.json"), "ia"),
    /schema validation failed/,
  );
});

// ===================================================================
// scaffold-types
// ===================================================================

test("scaffoldTypes emits enums + interfaces with correct TS shape", () => {
  const contract = readFixture("mock-contract.valid.json");
  const out = scaffoldTypes(contract);
  // shared enum becomes union type
  assert.match(out, /export type Agency = "fda" \| "ema";/);
  assert.match(out, /export type SubmissionStatus = "in_progress" \| "filed" \| "on_hold";/);
  // interface name uses tsInterfaceName override
  assert.match(out, /export interface User \{/);
  assert.match(out, /export interface Submission \{/);
  // field with literalUnion inlines
  assert.match(out, /role: "ra_director" \| "section_owner" \| "vp";/);
  // enum field references type alias
  assert.match(out, /agency: Agency;/);
  // id field becomes string
  assert.match(out, /id: string;/);
});

test("scaffoldTypes throws on unknown enum reference", () => {
  const contract = {
    entities: [
      {
        name: "thing",
        variantCounts: { happy: 1 },
        fields: [{ name: "kind", kind: "enum", enumName: "undeclaredEnum" }],
      },
    ],
  };
  assert.throws(() => scaffoldTypes(contract), /unknown enum undeclaredEnum/);
});

// ===================================================================
// scaffold-mock-data
// ===================================================================

test("scaffoldMockDataFiles emits per-entity files + aggregator barrel", () => {
  const dir = tmpProject();
  try {
    const contract = readFixture("mock-contract.valid.json");
    const written = scaffoldMockDataFiles(contract, dir);

    // Per-entity files
    for (const entity of contract.entities) {
      const ep = path.join(dir, "src", "lib", "mock-data", `${entity.name}.ts`);
      assert.ok(existsSync(ep), `expected ${ep}`);
      const content = readFileSync(ep, "utf8");
      // exports the variant container
      assert.match(content, new RegExp(`export const ${entity.name}: \\{`));
      // happy variant has the right count of records
      const happyMatches = content.match(/^\s*\{ id: "/gm) || [];
      assert.equal(happyMatches.length, entity.variantCounts.happy + (entity.variantCounts.error || 0));
    }

    // Barrel
    const barrel = path.join(dir, "src", "lib", "mock-data.ts");
    assert.ok(existsSync(barrel));
    const bc = readFileSync(barrel, "utf8");
    assert.match(bc, /export const mockData = \{ users, submissions, guidanceEvents \};/);
    // entities + barrel + ID-GRAPH.md
    assert.equal(written.length, contract.entities.length + 2);
    // ID-GRAPH.md exists
    assert.ok(existsSync(path.join(dir, "ID-GRAPH.md")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scaffoldMockDataFiles: id placeholders follow idConvention", () => {
  const dir = tmpProject();
  try {
    const contract = readFixture("mock-contract.valid.json");
    scaffoldMockDataFiles(contract, dir);
    const usersFile = readFileSync(path.join(dir, "src", "lib", "mock-data", "users.ts"), "utf8");
    // idConvention is "u-{n}", so first id should be "u-001"
    assert.match(usersFile, /id: "u-001"/);
    const subsFile = readFileSync(path.join(dir, "src", "lib", "mock-data", "submissions.ts"), "utf8");
    // idConvention is "sub-{slug}" -> "sub-seed-1"
    assert.match(subsFile, /id: "sub-seed-1"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===================================================================
// scaffold-chrome
// ===================================================================

test("scaffoldChromeFiles emits AppLeftNav/AppTopNav/AppScreen with nav marker", () => {
  const dir = tmpProject();
  try {
    const ia = readFixture("ia.valid.json");
    const written = scaffoldChromeFiles(ia, dir);
    assert.equal(written.length, 3);
    const leftNav = readFileSync(path.join(dir, "src", "components", "app", "AppLeftNav.tsx"), "utf8");
    assert.match(leftNav, /LEFT_NAV_SECTIONS/);
    assert.match(leftNav, /"label": "Dashboard"/);
    assert.match(leftNav, /Shreya Varma/);
    const topNav = readFileSync(path.join(dir, "src", "components", "app", "AppTopNav.tsx"), "utf8");
    assert.match(topNav, /TOP_NAV_ROLES/);
    assert.match(topNav, /"workspace"/);
    const appScreen = readFileSync(path.join(dir, "src", "components", "app", "AppScreen.tsx"), "utf8");
    assert.match(appScreen, /role: "workspace" \| "editor" \| "modal"/);
    assert.match(appScreen, /import \{ AppLeftNav \} from "\.\/AppLeftNav";/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===================================================================
// scaffold-routes
// ===================================================================

test("scaffoldRoutesFiles emits simple stubs with BODY marker and trivial redirects", () => {
  const dir = tmpProject();
  try {
    const screens = readFixture("screens.valid.json");
    const written = scaffoldRoutesFiles(screens, dir);
    // Trivial redirect
    const root = readFileSync(path.join(dir, "src", "app", "page.tsx"), "utf8");
    assert.match(root, /import \{ redirect \} from "next\/navigation";/);
    assert.match(root, /redirect\("\/dashboard"\);/);
    // Simple workspace screen
    const dashboard = readFileSync(path.join(dir, "src", "app", "dashboard", "page.tsx"), "utf8");
    assert.match(dashboard, /import \{ AppScreen \} from "@\/components\/app\/AppScreen";/);
    assert.match(dashboard, /\{\/\* BODY: Cross-submission/);
    assert.match(dashboard, /role="workspace"/);
    // Compound screen is NOT emitted by scaffold-routes
    const editor = path.join(dir, "src", "app", "submissions", "[submissionId]", "sections", "[sectionId]", "page.tsx");
    assert.equal(existsSync(editor), false);
    assert.ok(written.length >= 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===================================================================
// scaffold-compound
// ===================================================================

test("scaffoldCompoundFiles emits shell + one _<child>.tsx per child", () => {
  const dir = tmpProject();
  try {
    const screens = readFixture("screens.valid.json");
    const written = scaffoldCompoundFiles(screens, dir);
    const editorDir = path.join(dir, "src", "app", "submissions", "[submissionId]", "sections", "[sectionId]");
    const shell = path.join(editorDir, "page.tsx");
    assert.ok(existsSync(shell));
    const shellContent = readFileSync(shell, "utf8");
    // Shell imports all 4 children with kebab-case file names
    assert.match(shellContent, /import \{ DocumentViewer \} from "\.\/_document-viewer";/);
    assert.match(shellContent, /import \{ GuidanceSidePanel \} from "\.\/_guidance-side-panel";/);
    assert.match(shellContent, /import \{ DecisionMemoDrawer \} from "\.\/_decision-memo-drawer";/);
    assert.match(shellContent, /import \{ ConflictBanner \} from "\.\/_conflict-banner";/);
    // URL param conditionals
    assert.match(shellContent, /const panelId = sp\.panel;/);
    assert.match(shellContent, /const memoId = sp\.memo;/);
    assert.match(shellContent, /\{panelId \? <GuidanceSidePanel/);
    assert.match(shellContent, /\{memoId \? <DecisionMemoDrawer/);
    // editor breadcrumb
    assert.match(shellContent, /role="editor"/);
    // Each child file exists
    for (const child of ["_document-viewer.tsx", "_guidance-side-panel.tsx", "_decision-memo-drawer.tsx", "_conflict-banner.tsx"]) {
      const cp = path.join(editorDir, child);
      assert.ok(existsSync(cp), `expected ${cp}`);
      const cc = readFileSync(cp, "utf8");
      assert.match(cc, /AGENT-OWNED/);
      assert.match(cc, /export function /);
    }
    // 1 shell + 4 children = 5
    assert.equal(written.length, 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===================================================================
// bundle-context
// ===================================================================

test("bundleContextFile concatenates PRD + manifest + ia/screens/contract", () => {
  const dir = tmpProject();
  try {
    writeFileSync(path.join(dir, "PRD.md"), "# PRD\n\nThe brief.");
    writeFileSync(path.join(dir, "BUILD-CONTEXT.md"), "# DS Manifest\n\nPrimitives.");
    mkdirSync(path.join(dir, "build-hifi-ctx"), { recursive: true });
    writeFileSync(path.join(dir, "build-hifi-ctx", "HARD-CONTRACT.md"), "# Hard contract\n\nRules.");
    writeFileSync(path.join(dir, "ia.json"), JSON.stringify(readFixture("ia.valid.json")));
    writeFileSync(path.join(dir, "screens.json"), JSON.stringify(readFixture("screens.valid.json")));
    writeFileSync(path.join(dir, "mock-contract.json"), JSON.stringify(readFixture("mock-contract.valid.json")));

    const out = bundleContextFile({ projectDir: dir, target: "dashboard", type: "screen" });
    assert.match(out, /Agent context: dashboard/);
    assert.match(out, /Target type: `screen`/);
    assert.match(out, /# PRD/);
    assert.match(out, /# DS Manifest/);
    assert.match(out, /# Hard contract/);
    assert.match(out, /## IA model/);
    assert.match(out, /## Screen list/);
    assert.match(out, /## Mock-data contract/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===================================================================
// End-to-end: emitted TS files pass `node --check` style parsing
// (sanity check that the script doesn't emit syntactically broken TS)
// ===================================================================

test("emitted files: scaffold-types output type-checks-shape-wise via syntactic scan", () => {
  const contract = readFixture("mock-contract.valid.json");
  const out = scaffoldTypes(contract);
  // braces balance
  const opens = (out.match(/\{/g) || []).length;
  const closes = (out.match(/\}/g) || []).length;
  assert.equal(opens, closes, `unbalanced braces in scaffoldTypes output (opens=${opens}, closes=${closes})`);
  // semicolons at end of each interface field
  const fieldLines = out.split("\n").filter(l => /^\s+\w+\??: /.test(l));
  for (const l of fieldLines) {
    assert.match(l, /;\s*$/, `field line missing semicolon: ${l}`);
  }
});

test("end-to-end CLI: scaffold-types + scaffold-mock-data via spawn", () => {
  const dir = tmpProject();
  try {
    const contractPath = path.join(FIXTURES, "mock-contract.valid.json");
    let r = spawnSync("node", [SCRIPT, "scaffold-types", contractPath, "--project", dir], { encoding: "utf8" });
    assert.equal(r.status, 0, `scaffold-types failed: ${r.stderr}`);
    assert.ok(existsSync(path.join(dir, "src", "lib", "types.ts")));

    r = spawnSync("node", [SCRIPT, "scaffold-mock-data", contractPath, "--project", dir], { encoding: "utf8" });
    assert.equal(r.status, 0, `scaffold-mock-data failed: ${r.stderr}`);
    assert.ok(existsSync(path.join(dir, "src", "lib", "mock-data.ts")));
    assert.ok(existsSync(path.join(dir, "src", "lib", "mock-data", "users.ts")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("end-to-end CLI: scaffold-chrome + scaffold-routes + scaffold-compound", () => {
  const dir = tmpProject();
  try {
    const iaPath = path.join(FIXTURES, "ia.valid.json");
    const screensPath = path.join(FIXTURES, "screens.valid.json");

    let r = spawnSync("node", [SCRIPT, "scaffold-chrome", iaPath, "--project", dir], { encoding: "utf8" });
    assert.equal(r.status, 0, `scaffold-chrome failed: ${r.stderr}`);
    assert.ok(existsSync(path.join(dir, "src", "components", "app", "AppScreen.tsx")));

    r = spawnSync("node", [SCRIPT, "scaffold-routes", screensPath, "--project", dir], { encoding: "utf8" });
    assert.equal(r.status, 0, `scaffold-routes failed: ${r.stderr}`);
    assert.ok(existsSync(path.join(dir, "src", "app", "dashboard", "page.tsx")));

    r = spawnSync("node", [SCRIPT, "scaffold-compound", screensPath, "--project", dir], { encoding: "utf8" });
    assert.equal(r.status, 0, `scaffold-compound failed: ${r.stderr}`);
    assert.ok(existsSync(path.join(dir, "src", "app", "submissions", "[submissionId]", "sections", "[sectionId]", "page.tsx")));
    assert.ok(existsSync(path.join(dir, "src", "app", "submissions", "[submissionId]", "sections", "[sectionId]", "_document-viewer.tsx")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: validate subcommand returns 0 on valid, nonzero on invalid", () => {
  let r = spawnSync("node", [SCRIPT, "validate", path.join(FIXTURES, "ia.valid.json"), "--schema", "ia"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  r = spawnSync("node", [SCRIPT, "validate", path.join(FIXTURES, "ia.invalid.json"), "--schema", "ia"], { encoding: "utf8" });
  assert.notEqual(r.status, 0);
});

test("CLI: --timings appends JSONL record", () => {
  const dir = tmpProject();
  const timingsPath = path.join(dir, "timings.jsonl");
  try {
    const contractPath = path.join(FIXTURES, "mock-contract.valid.json");
    const r = spawnSync("node", [SCRIPT, "scaffold-types", contractPath, "--project", dir, "--timings", timingsPath], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(timingsPath));
    const content = readFileSync(timingsPath, "utf8").trim();
    const record = JSON.parse(content);
    assert.equal(record.phase, "scaffold-types");
    assert.equal(typeof record.duration_s, "number");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===================================================================
// extract-primitives
// ===================================================================

test("extractPrimitivesMarkdown emits closed-enum table with known types", () => {
  const dsPath = "/Users/adarshnellore/Projects/adarsh-design-system";
  if (!existsSync(dsPath)) return;
  const md = extractPrimitivesMarkdown(dsPath);
  assert.match(md, /MetaTextTone/);
  assert.match(md, /"default"/);
  assert.match(md, /"faint"/);
  assert.match(md, /BadgeSize/);
  assert.match(md, /MetaLabelTone/);
});

// ===================================================================
// seed-ids / id-graph
// ===================================================================

test("buildIdGraph generates pools per entity per variant", () => {
  const contract = readFixture("mock-contract.valid.json");
  const graph = buildIdGraph(contract);
  assert.equal(graph.users.happy.length, 5);
  assert.equal(graph.users.happy[0], "u-001");
  assert.equal(graph.users.happy[4], "u-005");
  assert.equal(graph.submissions.happy.length, 4);
  assert.match(graph.submissions.happy[0], /^sub-seed-1$/);
  assert.ok(Array.isArray(graph.submissions.error));
});

test("scaffoldMockDataFiles pre-fills FK fields with referenced entity ids", () => {
  const dir = tmpProject();
  try {
    const contract = readFixture("mock-contract.valid.json");
    scaffoldMockDataFiles(contract, dir);
    const subsFile = readFileSync(path.join(dir, "src", "lib", "mock-data", "submissions.ts"), "utf8");
    const createdByMatches = subsFile.match(/createdBy: "(u-\d{3})"/g) || [];
    assert.ok(createdByMatches.length >= 4, `expected at least 4 createdBy refs, got: ${createdByMatches.length}`);
    for (const m of createdByMatches) {
      assert.match(m, /createdBy: "u-00[1-5]"/, `bad FK: ${m}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("idGraphMarkdown contains all entities + ids", () => {
  const contract = readFixture("mock-contract.valid.json");
  const graph = buildIdGraph(contract);
  const md = idGraphMarkdown(graph);
  assert.match(md, /## users/);
  assert.match(md, /## submissions/);
  assert.match(md, /u-001/);
  assert.match(md, /sub-seed-1/);
});

// ===================================================================
// validate-ia-screens
// ===================================================================

test("validateIaScreensConsistency returns specific error objects", () => {
  const ia = { leftNav: [{ header: "x", items: [{ label: "Missing", href: "/missing" }] }], topNavRoles: {}, footer: { name: "x", role: "y" } };
  const screens = { screens: [{ path: "/dashboard", intent: "a dashboard" }] };
  const errors = validateIaScreensConsistency(ia, screens);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].href, "/missing");
  assert.equal(errors[0].label, "Missing");
});

test("validateIaScreensConsistency returns no errors when all hrefs match", () => {
  const ia = { leftNav: [{ header: "x", items: [{ label: "Dashboard", href: "/dashboard" }] }], topNavRoles: {}, footer: { name: "x", role: "y" } };
  const screens = { screens: [{ path: "/dashboard", intent: "a dashboard" }] };
  const errors = validateIaScreensConsistency(ia, screens);
  assert.equal(errors.length, 0);
});

// ===================================================================
// compound shell now wires data
// ===================================================================

test("scaffoldCompoundFiles shell imports mock-data + resolves dynamic params", () => {
  const dir = tmpProject();
  try {
    const screens = readFixture("screens.valid.json");
    scaffoldCompoundFiles(screens, dir);
    const shell = readFileSync(path.join(dir, "src", "app", "submissions", "[submissionId]", "sections", "[sectionId]", "page.tsx"), "utf8");
    assert.match(shell, /from "@\/lib\/mock-data\/submissionSections"/);
    assert.match(shell, /from "@\/lib\/mock-data\/impactItems"/);
    assert.match(shell, /\.happy\.find\(r => r\.id === _params\./);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===================================================================
// scaffold-chrome --brand
// ===================================================================

test("scaffoldChromeFiles injects brand into LeftNav + TopNav", () => {
  const dir = tmpProject();
  try {
    const ia = readFixture("ia.valid.json");
    scaffoldChromeFiles(ia, dir, { brand: "Guidance Impact" });
    const leftNav = readFileSync(path.join(dir, "src", "components", "app", "AppLeftNav.tsx"), "utf8");
    const topNav = readFileSync(path.join(dir, "src", "components", "app", "AppTopNav.tsx"), "utf8");
    assert.match(leftNav, /Guidance Impact/);
    assert.match(topNav, /Guidance Impact/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===================================================================
// bundle-context expanded
// ===================================================================

test("bundleContextFile includes motion + common-mistakes + primitive-enums + id-graph when present", () => {
  const dir = tmpProject();
  try {
    writeFileSync(path.join(dir, "PRD.md"), "# PRD");
    writeFileSync(path.join(dir, "BUILD-CONTEXT.md"), "# manifest");
    mkdirSync(path.join(dir, "build-hifi-ctx"), { recursive: true });
    writeFileSync(path.join(dir, "build-hifi-ctx", "HARD-CONTRACT.md"), "# Hard contract");
    writeFileSync(path.join(dir, "build-hifi-ctx", "MOTION-RULES.md"), "# Motion rules\nUse anim-fade-in-N classes.");
    writeFileSync(path.join(dir, "build-hifi-ctx", "COMMON-MISTAKES.md"), "# Common mistakes\nDo not use MetaText tone='muted'.");
    writeFileSync(path.join(dir, "PRIMITIVE-ENUMS.md"), "# Primitive enums\nMetaTextTone: 'default' | 'faint'");
    writeFileSync(path.join(dir, "ID-GRAPH.md"), "# ID Graph\n## users\n- u-001");

    const out = bundleContextFile({ projectDir: dir, target: "test", type: "screen" });
    assert.match(out, /Motion rules/);
    assert.match(out, /anim-fade-in-N/);
    assert.match(out, /Common mistakes/);
    assert.match(out, /MetaText tone='muted'/);
    assert.match(out, /Primitive prop enums/);
    assert.match(out, /MetaTextTone/);
    assert.match(out, /ID graph/);
    assert.match(out, /u-001/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// v7: entity bundles omit Quality Bar + Motion Library (Haiku doesn't need them)
test("bundleContextFile (entity type) omits Quality Bar + Motion Library but keeps everything else", () => {
  const dir = tmpProject();
  try {
    writeFileSync(path.join(dir, "PRD.md"), "# PRD\nThe brief.");
    writeFileSync(path.join(dir, "BUILD-CONTEXT.md"), "# DS Manifest");
    mkdirSync(path.join(dir, "build-hifi-ctx"), { recursive: true });
    writeFileSync(path.join(dir, "build-hifi-ctx", "HARD-CONTRACT.md"), "# Hard contract\nNo em dashes.");
    writeFileSync(path.join(dir, "build-hifi-ctx", "QUALITY-BAR.md"), "# Quality bar\nSix dimensions.");
    writeFileSync(path.join(dir, "build-hifi-ctx", "MOTION-LIBRARY.md"), "# Motion library\nanim-fade-in patterns.");
    writeFileSync(path.join(dir, "build-hifi-ctx", "MOTION-RULES.md"), "# Motion rules (legacy)\nfallback.");
    writeFileSync(path.join(dir, "build-hifi-ctx", "COMMON-MISTAKES.md"), "# Common mistakes\nNo placeholders left.");
    writeFileSync(path.join(dir, "build-hifi-ctx", "NARRATIVE-CONVENTIONS.md"), "# Narrative\nFull sentences.");
    writeFileSync(path.join(dir, "PRIMITIVE-ENUMS.md"), "# Primitive enums\nTone: 'default'");
    writeFileSync(path.join(dir, "ID-GRAPH.md"), "# ID Graph\n## users\n- u-001");

    const out = bundleContextFile({ projectDir: dir, target: "submissions", type: "entity" });

    // Trimmed: Quality Bar + Motion Library section headings + bodies absent
    assert.doesNotMatch(out, /## Quality bar/);
    assert.doesNotMatch(out, /Six dimensions/);
    assert.doesNotMatch(out, /## Motion library/);
    assert.doesNotMatch(out, /Motion library\nanim-fade-in/);
    assert.doesNotMatch(out, /anim-fade-in patterns/);
    assert.doesNotMatch(out, /Motion rules \(legacy\)/);

    // Retained: everything else the entity agent still needs
    assert.match(out, /Target type: `entity`/);
    assert.match(out, /## Hard contract/);
    assert.match(out, /No em dashes/);
    assert.match(out, /## Primitive prop enums/);
    assert.match(out, /## Common mistakes/);
    assert.match(out, /No placeholders left/);
    assert.match(out, /## Narrative conventions reference/);
    assert.match(out, /Full sentences/);
    assert.match(out, /## Design system manifest/);
    assert.match(out, /## PRD/);
    assert.match(out, /The brief/);
    assert.match(out, /## ID graph/);
    assert.match(out, /u-001/);

    // Regression: screen-type bundle still includes Quality Bar + Motion Library
    const screenOut = bundleContextFile({ projectDir: dir, target: "dashboard", type: "screen" });
    assert.match(screenOut, /## Quality bar/);
    assert.match(screenOut, /Six dimensions/);
    assert.match(screenOut, /## Motion library/);
    assert.match(screenOut, /anim-fade-in patterns/);

    // Trim should produce a meaningfully shorter bundle for entity vs screen
    assert.ok(out.length < screenOut.length, `entity bundle (${out.length} chars) should be shorter than screen bundle (${screenOut.length} chars)`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===================================================================
// v6: schemas
// ===================================================================

test("validate: strategy.valid passes", () => {
  const schema = JSON.parse(readFileSync(path.join(SCHEMAS, "strategy.schema.json"), "utf8"));
  const data = JSON.parse(readFileSync(path.join(FIXTURES, "strategy.valid.json"), "utf8"));
  const r = validate(schema, data);
  assert.equal(r.ok, true, r.ok ? "" : JSON.stringify(r.errors, null, 2));
});

test("validate: narrative-conventions.valid passes", () => {
  const schema = JSON.parse(readFileSync(path.join(SCHEMAS, "narrative-conventions.schema.json"), "utf8"));
  const data = JSON.parse(readFileSync(path.join(FIXTURES, "narrative-conventions.valid.json"), "utf8"));
  const r = validate(schema, data);
  assert.equal(r.ok, true, r.ok ? "" : JSON.stringify(r.errors, null, 2));
});

test("validate: style-baseline.valid passes", () => {
  const schema = JSON.parse(readFileSync(path.join(SCHEMAS, "style-baseline.schema.json"), "utf8"));
  const data = JSON.parse(readFileSync(path.join(FIXTURES, "style-baseline.valid.json"), "utf8"));
  const r = validate(schema, data);
  assert.equal(r.ok, true, r.ok ? "" : JSON.stringify(r.errors, null, 2));
});

// ===================================================================
// v6: emit-brief-bundle
// ===================================================================

test("emitBriefBundle concatenates PRD + brief + cornerstone + references", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "brief-"));
  try {
    writeFileSync(path.join(dir, "prd.md"), "# Test PRD\n\nThe brief.");
    writeFileSync(path.join(dir, "notes.md"), "# Notes\n\nExtra context.");
    const out = emitBriefBundle({
      prdPath: path.join(dir, "prd.md"),
      briefPath: path.join(dir, "notes.md"),
      cornerstone: "/editor",
      references: ["a.png", "b.png"],
    });
    assert.match(out, /Cornerstone declaration/);
    assert.match(out, /\/editor/);
    assert.match(out, /# Test PRD/);
    assert.match(out, /Extra context/);
    assert.match(out, /reference: a\.png/);
    assert.match(out, /reference: b\.png/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===================================================================
// v6: nav-crawl
// ===================================================================

test("listRouteFiles discovers Next.js page.tsx routes", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "nav-"));
  try {
    mkdirSync(path.join(dir, "src/app/dashboard"), { recursive: true });
    mkdirSync(path.join(dir, "src/app/submissions/[id]"), { recursive: true });
    writeFileSync(path.join(dir, "src/app/page.tsx"), "export default function P(){return null}");
    writeFileSync(path.join(dir, "src/app/dashboard/page.tsx"), "export default function P(){return null}");
    writeFileSync(path.join(dir, "src/app/submissions/[id]/page.tsx"), "export default function P(){return null}");

    const routes = listRouteFiles(dir);
    assert.ok(routes.includes("/"));
    assert.ok(routes.includes("/dashboard"));
    assert.ok(routes.includes("/submissions/[id]"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("matchRouteWithDynamic resolves dynamic segments", () => {
  const routes = ["/", "/dashboard", "/submissions/[id]", "/submissions/[id]/sections/[sid]"];
  assert.equal(matchRouteWithDynamic("/dashboard", routes), "/dashboard");
  assert.equal(matchRouteWithDynamic("/submissions/sub-001", routes), "/submissions/[id]");
  assert.equal(matchRouteWithDynamic("/submissions/sub-001/sections/ss-1", routes), "/submissions/[id]/sections/[sid]");
  assert.equal(matchRouteWithDynamic("/missing", routes), null);
  assert.equal(matchRouteWithDynamic("/submissions", routes), null); // depth mismatch
});

test("navCrawl reports unresolved hrefs with file:line", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "navc-"));
  try {
    mkdirSync(path.join(dir, "src/app/dashboard"), { recursive: true });
    writeFileSync(path.join(dir, "src/app/dashboard/page.tsx"), "export default function P(){return null}");
    mkdirSync(path.join(dir, "src/components"), { recursive: true });
    writeFileSync(path.join(dir, "src/components/Nav.tsx"),
      `import Link from "next/link";\nexport function Nav() {\n  return <><Link href="/dashboard">D</Link><Link href="/missing">M</Link></>;\n}`);
    const r = navCrawl(dir);
    assert.ok(r.routes.includes("/dashboard"));
    assert.equal(r.violations.length, 1);
    assert.equal(r.violations[0].href, "/missing");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===================================================================
// v6: interactivity-audit
// ===================================================================

test("interactivityAudit flags bare Button without Link wrap or onClick or disabled", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ia-"));
  try {
    mkdirSync(path.join(dir, "src/app/page"), { recursive: true });
    // bare Button — should violate
    writeFileSync(path.join(dir, "src/app/page/page.tsx"),
      `export default function P(){return <Button variant="primary">Click</Button>}`);
    const r = interactivityAudit(dir);
    assert.equal(r.violations.length, 1);
    assert.match(r.violations[0].snippet, /<Button/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("interactivityAudit accepts Link-wrapped Button", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ia-"));
  try {
    mkdirSync(path.join(dir, "src/app/page"), { recursive: true });
    writeFileSync(path.join(dir, "src/app/page/page.tsx"),
      `import Link from "next/link";\nexport default function P(){return <Link href="/target"><Button variant="primary">Click</Button></Link>}`);
    const r = interactivityAudit(dir);
    assert.equal(r.violations.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("interactivityAudit accepts aria-disabled Button", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ia-"));
  try {
    mkdirSync(path.join(dir, "src/app/page"), { recursive: true });
    writeFileSync(path.join(dir, "src/app/page/page.tsx"),
      `export default function P(){return <Button aria-disabled="true" variant="primary">Preview</Button>}`);
    const r = interactivityAudit(dir);
    assert.equal(r.violations.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===================================================================
// v6: narrative-conventions placeholders
// ===================================================================

test("scaffoldMockDataFiles bakes narrative-convention hints into TODO placeholders", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "nc-"));
  try {
    const contract = JSON.parse(readFileSync(path.join(FIXTURES, "mock-contract.valid.json"), "utf8"));
    // add a 'summary' field to users for the test
    const augmented = JSON.parse(JSON.stringify(contract));
    const usersEntity = augmented.entities.find(e => e.name === "users");
    usersEntity.fields.push({ name: "summary", kind: "string" });
    const narrativeConventions = {
      entities: {
        users: {
          fields: {
            summary: {
              mustBeFullSentence: true,
              hint: "Full sentence naming the user's role + tenure",
            },
          },
        },
      },
    };
    scaffoldMockDataFiles(augmented, dir, { narrativeConventions });
    const text = readFileSync(path.join(dir, "src/lib/mock-data/users.ts"), "utf8");
    assert.match(text, /TODO: Full sentence naming the user's role/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
