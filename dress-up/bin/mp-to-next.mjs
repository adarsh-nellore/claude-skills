#!/usr/bin/env node
// mp-to-next.mjs
//
// Deterministic codemod that ports a Magic Patterns / Vite + react-router app
// into a Next.js 16 App Router shape inside a peer-design-system clone.
//
// Scope: mechanical work only. File moves, import renames, hook signature
// swaps, 'use client' insertion, redirect page generation, layout patch,
// package.json patch. NO design judgment — that's Stages 2-4 of /dress-up.
//
// Usage:
//   node mp-to-next.mjs <mp-clone-root> <out-root> [--slug <slug>]
//
//   mp-clone-root  Absolute path to the shallow-cloned MP repo (must contain src/App.tsx).
//   out-root       Absolute path to the DS clone where the port will land.
//   --slug         Optional name used in package.json + layout title. Defaults to basename(out-root).
//
// Output:
//   - Writes pages under <out-root>/src/app/
//   - Writes components under <out-root>/src/components/peer/
//   - Writes lib files under <out-root>/src/lib/
//   - Patches <out-root>/src/app/layout.tsx (AppProvider wrap, metadata title)
//   - Patches <out-root>/package.json (dep additions, prebuild rename)
//   - Writes <out-root>/.dress-up/port-report.json with the route map + file list
//
// Assumptions:
//   - MP follows the Magic Patterns Vite template conventions:
//       * src/App.tsx contains <Route path=... element={<Comp/>}/> declarations
//       * Pages in src/pages/*.tsx, components in src/components/*.tsx
//       * State in src/AppContext.tsx (React Context), data in src/mockData.ts,
//         types in src/types.ts
//   - Output is a fresh peer-design-system clone with src/lib/{types,mock-data}.ts
//     as empty stubs and src/app/{layout,page}.tsx as the DS landing.
//
// Non-goals:
//   - Bundler / Vite plugin support, only react-router → Next.js.
//   - Adding the design system's <Heading>/<Stack>/etc. (that's Stage 4).
//   - Running npm install or build (caller's job).
//   - Detecting Suspense bailout edge cases beyond a TODO comment.

import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith("--"));
const [mpRoot, outRoot] = positional;
const slugFlag = argv.indexOf("--slug");
const slug =
  slugFlag !== -1 && argv[slugFlag + 1]
    ? argv[slugFlag + 1]
    : outRoot
      ? path.basename(outRoot)
      : "ported-app";

if (!mpRoot || !outRoot) {
  console.error(
    "usage: mp-to-next <mp-clone-root> <out-root> [--slug <slug>]",
  );
  process.exit(1);
}

const mpSrc = path.join(mpRoot, "src");
const outSrc = path.join(outRoot, "src");
const checkpointDir = path.join(outRoot, ".dress-up");

if (!fs.existsSync(path.join(mpSrc, "App.tsx"))) {
  console.error(`No App.tsx at ${path.join(mpSrc, "App.tsx")}`);
  process.exit(1);
}
fs.mkdirSync(checkpointDir, { recursive: true });

// ----------- 1. Route parsing -----------

function parseRoutes(appTsxPath) {
  const src = fs.readFileSync(appTsxPath, "utf8");
  const routes = [];

  // <Route path="..." element={<Comp />} />
  // Don't match Navigate elements as components.
  const routeRe = /<Route\s+path="([^"]+)"\s+element=\{\s*<(\w+)\b([^}]*)\}\s*\/?\>/g;
  let m;
  while ((m = routeRe.exec(src)) !== null) {
    const routePath = m[1];
    const elName = m[2];
    if (elName === "Navigate") {
      // Pull the `to` target out of m[3]
      const navTo = /to="([^"]+)"/.exec(m[3]);
      routes.push({
        path: routePath,
        kind: "redirect",
        target: navTo ? navTo[1] : null,
      });
    } else {
      routes.push({
        path: routePath,
        kind: "page",
        component: elName,
      });
    }
  }
  return routes;
}

function routeToAppFile(routePath) {
  // "/" handled separately.
  if (routePath === "/") return "app/page.tsx";
  if (routePath === "*") return null;
  const segs = routePath
    .split("/")
    .filter(Boolean)
    .map((s) => (s.startsWith(":") ? `[${s.slice(1)}]` : s));
  return `app/${segs.join("/")}/page.tsx`;
}

// ----------- 2. Source transformations -----------

const HOOK_RE =
  /\buse(State|Effect|Context|Ref|Memo|Callback|Reducer|LayoutEffect|ImperativeHandle|Id|Transition|DeferredValue|SyncExternalStore|InsertionEffect|Router|Params|SearchParams|Pathname|SelectedLayoutSegment|FormStatus|FormState|Optimistic|AppContext)\b/;

function detectHookUsage(src) {
  return HOOK_RE.test(src);
}

function rewriteReactRouterImport(src) {
  // Match multi-line: import { A, B, /* ... */ } from 'react-router-dom';
  const re = /import\s*\{\s*([\s\S]*?)\s*\}\s*from\s*['"]react-router-dom['"]\s*;?/g;
  return src.replace(re, (_, namesRaw) => {
    const names = namesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const nextNavSet = new Set();
    let needsLink = false;
    const dropMap = {
      Navigate: true,
      Outlet: true,
      BrowserRouter: true,
      Routes: true,
      Route: true,
    };
    const renameMap = {
      useNavigate: "useRouter",
      useLocation: "usePathname",
    };
    const passMap = ["useParams", "useSearchParams"];
    for (const n of names) {
      if (n === "Link") {
        needsLink = true;
        continue;
      }
      if (dropMap[n]) continue;
      if (renameMap[n]) {
        nextNavSet.add(renameMap[n]);
        continue;
      }
      if (passMap.includes(n)) {
        nextNavSet.add(n);
        continue;
      }
      // Unknown — keep it under next/navigation as a best guess
      nextNavSet.add(n);
    }
    const lines = [];
    if (nextNavSet.size) {
      lines.push(
        `import { ${[...nextNavSet].join(", ")} } from 'next/navigation';`,
      );
    }
    if (needsLink) {
      lines.push(`import Link from 'next/link';`);
    }
    return lines.join("\n");
  });
}

function rewriteNavigateUsage(src) {
  let out = src;
  // Rename the call-site identifier too (rewriteReactRouterImport only touches
  // the import). useNavigate → useRouter everywhere.
  out = out.replace(/\buseNavigate\b/g, "useRouter");
  // useLocation → usePathname call-site rename (approximate).
  out = out.replace(/\buseLocation\b/g, "usePathname");
  // const navigate = useRouter() → const router = useRouter()
  out = out.replace(
    /const\s+navigate\s*=\s*useRouter\(\s*\)\s*;?/g,
    "const router = useRouter();",
  );
  // navigate(x) → router.push(x)
  out = out.replace(/\bnavigate\s*\(/g, "router.push(");
  return out;
}

function rewriteLinkAttribute(src) {
  // <Link ... to= ...> → <Link ... href= ...>
  // Only inside the opening tag of a Link element.
  return src.replace(
    /<Link(\s+[^>]*?)\bto=/g,
    "<Link$1href=",
  );
}

function rewriteUseParamsTyping(src) {
  // const { a, b } = useParams() → const { a, b } = useParams<{ a: string; b: string }>()
  return src.replace(
    /const\s*\{\s*([^}]+)\s*\}\s*=\s*useParams\(\s*\)/g,
    (_, namesRaw) => {
      const names = namesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const typeFields = names.map((n) => `${n}: string`).join("; ");
      return `const { ${names.join(", ")} } = useParams<{ ${typeFields} }>()`;
    },
  );
}

function rewritePaths(src) {
  let out = src;
  // ../AppContext, ./AppContext, ../../AppContext etc.
  out = out.replace(
    /from\s+['"](?:\.\.?\/)+AppContext['"]/g,
    "from '@/lib/store'",
  );
  out = out.replace(
    /from\s+['"](?:\.\.?\/)+mockData['"]/g,
    "from '@/lib/mock-data'",
  );
  out = out.replace(
    /from\s+['"](?:\.\.?\/)+types['"]/g,
    "from '@/lib/types'",
  );
  // ../components/Foo or ./components/Foo
  out = out.replace(
    /from\s+['"](?:\.\.?\/)+components\/([^'"]+)['"]/g,
    "from '@/components/peer/$1'",
  );
  // Within the peer/ folder, relative ./X imports stay relative (e.g. PropagationReport imported by ConflictExplainerDrawer)
  return out;
}

function ensureReactNodeImport(src) {
  if (!/\bReactNode\b/.test(src)) return src;
  // If React is imported with named bindings, add ReactNode if missing.
  const importRe = /import\s+React\s*,\s*\{\s*([^}]*)\}\s*from\s+['"]react['"]/;
  const m = importRe.exec(src);
  if (!m) {
    // No named imports — add a separate import.
    if (/import\s+React\s+from\s+['"]react['"]/.test(src)) {
      return src.replace(
        /import\s+React\s+from\s+['"]react['"];?/,
        `import React, { ReactNode } from 'react';`,
      );
    }
    return src;
  }
  const items = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.includes("ReactNode")) return src;
  items.push("ReactNode");
  return src.replace(
    importRe,
    `import React, { ${items.join(", ")} } from 'react'`,
  );
}

function prependUseClient(src) {
  if (/^['"]use client['"]\s*;/.test(src.trimStart())) return src;
  return `'use client';\n\n${src}`;
}

function maybeFlagSuspense(src) {
  if (/\buseSearchParams\b/.test(src)) {
    return (
      "// TODO: mp-to-next — wrap the default export in <Suspense fallback={null}> per Next 16 CSR-bailout requirement.\n" +
      src
    );
  }
  return src;
}

function convertNamedToDefault(src, componentName) {
  // export const Foo: React.FC = () => {  →  export default function Foo() {
  // export const Foo: React.FC<Props> = ({a, b}) => {  →  export default function Foo({a, b}: Props) {
  const propsRe = new RegExp(
    `export\\s+const\\s+${componentName}\\s*:\\s*React\\.FC(?:<([^>]+)>)?\\s*=\\s*\\(([^)]*)\\)\\s*=>\\s*\\{`,
  );
  let out = src.replace(propsRe, (_, propsType, params) => {
    const paramsTrim = params.trim();
    const sig =
      paramsTrim && propsType
        ? `${paramsTrim}: ${propsType}`
        : paramsTrim || "";
    return `export default function ${componentName}(${sig}) {`;
  });
  if (out !== src) return out;
  // Fallback: untyped arrow function
  const plainRe = new RegExp(
    `export\\s+const\\s+${componentName}\\s*=\\s*\\(([^)]*)\\)\\s*=>\\s*\\{`,
  );
  out = src.replace(plainRe, `export default function ${componentName}($1) {`);
  return out;
}

function transformSource(src, opts) {
  const { kind, componentName } = opts;
  let out = src;
  out = rewriteReactRouterImport(out);
  out = rewriteNavigateUsage(out);
  out = rewriteLinkAttribute(out);
  out = rewriteUseParamsTyping(out);
  out = rewritePaths(out);
  out = ensureReactNodeImport(out);
  if (kind === "page" && componentName) {
    out = convertNamedToDefault(out, componentName);
  }
  if (detectHookUsage(out) || /\buseAppContext\b/.test(out)) {
    out = prependUseClient(out);
  }
  out = maybeFlagSuspense(out);
  return out;
}

// ----------- 3. Writers -----------

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function transformPage(route) {
  const candidates = [
    path.join(mpSrc, "pages", `${route.component}.tsx`),
    path.join(mpSrc, "pages", `${route.component}.jsx`),
  ];
  const mpFile = candidates.find((p) => fs.existsSync(p));
  if (!mpFile) return null;
  const src = fs.readFileSync(mpFile, "utf8");
  const transformed = transformSource(src, {
    kind: "page",
    componentName: route.component,
  });
  const outPath = path.join(outSrc, routeToAppFile(route.path));
  writeFile(outPath, transformed);
  return outPath;
}

function transformComponents() {
  const mpDir = path.join(mpSrc, "components");
  if (!fs.existsSync(mpDir)) return [];
  const outDir = path.join(outSrc, "components", "peer");
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const entry of fs.readdirSync(mpDir)) {
    if (!/\.tsx?$/.test(entry)) continue;
    const mpFile = path.join(mpDir, entry);
    const src = fs.readFileSync(mpFile, "utf8");
    const transformed = transformSource(src, { kind: "component" });
    const outFile = path.join(outDir, entry);
    writeFile(outFile, transformed);
    written.push(outFile);
  }
  return written;
}

function transformLib() {
  const written = [];

  // AppContext.tsx → src/lib/store.tsx
  const ctxMp = path.join(mpSrc, "AppContext.tsx");
  if (fs.existsSync(ctxMp)) {
    let src = fs.readFileSync(ctxMp, "utf8");
    src = ensureReactNodeImport(src);
    const transformed = transformSource(src, { kind: "context" });
    const outPath = path.join(outSrc, "lib", "store.tsx");
    writeFile(outPath, transformed);
    written.push(outPath);
  }

  // mockData.ts → src/lib/mock-data.ts. The DS ships this as a stub
  // ("export {};"), so it's safe to overwrite unconditionally. The codemod is
  // idempotent: rerunning replaces, not appends.
  const mdMp = path.join(mpSrc, "mockData.ts");
  if (fs.existsSync(mdMp)) {
    const src = fs.readFileSync(mdMp, "utf8");
    const transformed = transformSource(src, { kind: "lib" });
    const outPath = path.join(outSrc, "lib", "mock-data.ts");
    writeFile(outPath, transformed);
    written.push(outPath);
  }

  // types.ts → src/lib/types.ts. DS keeps its own AgentState/Tone/Size, so we
  // append the MP types under a marker. Rerunning won't double-append.
  const TYPES_MARKER = "// --- MP domain types (codemod append) ---";
  const tyMp = path.join(mpSrc, "types.ts");
  if (fs.existsSync(tyMp)) {
    const src = fs.readFileSync(tyMp, "utf8");
    const outPath = path.join(outSrc, "lib", "types.ts");
    let final;
    if (fs.existsSync(outPath)) {
      const existing = fs.readFileSync(outPath, "utf8");
      const isStub = /^\s*(?:\/\/.*\n)?\s*export\s*\{\s*\}\s*;?\s*$/.test(
        existing,
      );
      if (isStub) {
        final = src;
      } else if (existing.includes(TYPES_MARKER)) {
        // Replace the previously-appended block.
        const cutIdx = existing.indexOf(TYPES_MARKER);
        final = `${existing.slice(0, cutIdx)}${TYPES_MARKER}\n${src}`;
      } else {
        final = `${existing}\n\n${TYPES_MARKER}\n${src}`;
      }
    } else {
      final = src;
    }
    writeFile(outPath, final);
    written.push(outPath);
  }

  return written;
}

function writeRedirectHome(target) {
  const content = `import { redirect } from "next/navigation";\n\nexport default function Home() {\n  redirect(${JSON.stringify(target)});\n}\n`;
  writeFile(path.join(outSrc, "app", "page.tsx"), content);
  return path.join(outSrc, "app", "page.tsx");
}

function patchLayout(opts) {
  const layoutPath = path.join(outSrc, "app", "layout.tsx");
  if (!fs.existsSync(layoutPath)) return null;
  let src = fs.readFileSync(layoutPath, "utf8");
  // Add AppProvider import if missing.
  if (!/from\s+['"]@\/lib\/store['"]/.test(src)) {
    src = src.replace(
      /(import\s+['"]\.\/globals\.css['"];?)/,
      `$1\nimport { AppProvider } from "@/lib/store";`,
    );
  }
  // Wrap <body>{children}</body> with AppProvider.
  src = src.replace(
    /<body([^>]*)>\s*\{\s*children\s*\}\s*<\/body>/,
    `<body$1>\n        <AppProvider>{children}</AppProvider>\n      </body>`,
  );
  // Update metadata title/description if defaults are present.
  if (opts.title) {
    src = src.replace(
      /title:\s*"[^"]*"/,
      `title: ${JSON.stringify(opts.title)}`,
    );
  }
  if (opts.description) {
    src = src.replace(
      /description:\s*"[^"]*"/,
      `description: ${JSON.stringify(opts.description)}`,
    );
  }
  writeFile(layoutPath, src);
  return layoutPath;
}

function patchPackageJson(opts) {
  const pkgPath = path.join(outRoot, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (opts.slug) pkg.name = opts.slug;
  pkg.dependencies = pkg.dependencies || {};
  for (const [dep, ver] of Object.entries(opts.deps || {})) {
    if (!pkg.dependencies[dep]) {
      pkg.dependencies[dep] = ver;
    }
  }
  // Disable audit during Stages 1-3.
  if (pkg.scripts && pkg.scripts.prebuild) {
    pkg.scripts["prebuild:audit-disabled"] = pkg.scripts.prebuild;
    delete pkg.scripts.prebuild;
  }
  writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  return pkgPath;
}

function detectMpDeps() {
  // Read MP package.json for known external deps; map to versions to add.
  const mpPkgPath = path.join(mpRoot, "package.json");
  if (!fs.existsSync(mpPkgPath)) return {};
  const mpPkg = JSON.parse(fs.readFileSync(mpPkgPath, "utf8"));
  const deps = mpPkg.dependencies || {};
  const want = {};
  const propagate = [
    "lucide-react",
    "react-hot-toast",
    "tailwind-merge",
    "framer-motion",
    "zustand",
    "clsx",
  ];
  for (const name of propagate) {
    if (deps[name]) want[name] = deps[name];
  }
  return want;
}

// ----------- 4. Run -----------

const t0 = Date.now();
const routes = parseRoutes(path.join(mpSrc, "App.tsx"));
const writtenPages = [];
for (const r of routes) {
  if (r.kind === "redirect" && r.path === "/") {
    writtenPages.push({ route: r, file: writeRedirectHome(r.target) });
  } else if (r.kind === "page") {
    const f = transformPage(r);
    if (f) writtenPages.push({ route: r, file: f });
    else writtenPages.push({ route: r, file: null, missing: true });
  }
  // path === "*" Navigate fallback — Next.js handles via not-found.tsx; skip.
}
const writtenComponents = transformComponents();
const writtenLib = transformLib();
const mpDeps = detectMpDeps();
// Layout title defaults to the slug. The DS landing description is replaced
// with a neutral placeholder so the metadata doesn't keep advertising
// "peer-design-system". Customize layout.tsx manually if you want a richer
// title — the codemod isn't trying to do naming judgment.
const patchedLayout = patchLayout({
  title: slug,
  description: "Ported Magic Patterns prototype.",
});
const patchedPkg = patchPackageJson({ slug, deps: mpDeps });

const report = {
  mp_root: mpRoot,
  out_root: outRoot,
  slug,
  ran_at: new Date().toISOString(),
  duration_ms: Date.now() - t0,
  routes,
  written_pages: writtenPages,
  written_components: writtenComponents,
  written_lib: writtenLib,
  patched_layout: patchedLayout,
  patched_package_json: patchedPkg,
  mp_deps_propagated: mpDeps,
};
const reportPath = path.join(checkpointDir, "port-report.json");
writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
