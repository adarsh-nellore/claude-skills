# Quality bar

The six dimensions every `/build-hifi` v6 prototype must clear.
The post-build smoke harness, nav-crawl, and interactivity audit
enforce most of these mechanically. The rest are caught by the
final QUALITY-REPORT agent that reviews screenshots.

This is the contract agents have to write to. If your output fails
any of these, your run gets a DIAGNOSE verdict and you'll be asked
to retry one specific section.

---

## 1 · Visual

- Uses the DS's actual color tokens (`coral`, `ink`, `paper`, `soft`,
  `surface`, `hairline`). No invented hex codes. No flat-gray walls.
- Every screen uses `<Heading>`, `<Body>`, `<Stack>`, `<Cluster>` —
  audit-enforced.
- Cards use `<Card>` primitive (not divs with rounded-md).
- Tables use `<Table>` primitive wrapped in `<div
  className="overflow-x-auto min-w-0">`.
- Status badges use `<Badge>` with semantic tones (success / warning
  / danger / info), not arbitrary colors.

## 2 · Navigation

- Every CTA either:
  - Navigates via `<Link href>` to a real route (verified by
    `nav-crawl`)
  - Triggers a real action in a `"use client"` island
  - Has `aria-disabled="true"` + visible "preview only" affordance
- No dead links. No `href="#"`. No `<Button onClick={() => {}}>`.
- Every leftNav item resolves (verified by `validate-ia-screens` +
  `nav-crawl`).
- Cornerstone surface is reachable in ≤2 clicks from `/dashboard`.
  E.g. if the cornerstone is `/submissions/[id]/sections/[id]`, the
  dashboard must surface a primary CTA pointing to the most-urgent
  submission's most-urgent section.

## 3 · Interaction

Every screen body MUST include at least 3 dynamic patterns from this list:

- URL-param state (`?panel=`, `?memo=`, `?state=`, `?filter=`,
  `?sort=`). The agent reads `searchParams` and switches UI.
- Client-island state via `"use client"` + `useState` (filter
  input, sort toggle, expand/collapse).
- `<Link>` wraps that navigate to detail routes (cards as links).
- Hover affordance on at least 2 interactive elements (per
  MOTION-LIBRARY.md #2 + #4).
- Focus ring on every interactive primitive (per MOTION-LIBRARY.md
  #7).

If the screen has 0 interactive elements, it's a wireframe, not a
prototype. Add at least filterable / sortable / clickable affordances.

## 4 · Content

Every screen MUST include at least 1 narrative content element:

- A specific named entity from mock-data (e.g. "Shreya Varma",
  "Velatinib NDA-2025-B")
- A specific date (ISO or formatted, e.g. "2026-05-19" or "Due in
  6 days")
- A specific FK reference resolved to a readable label (e.g.
  "Module 5.3.5.1", not just "ss-001")

Cross-checked by the final review agent reading screenshots. If a
screen renders only generic placeholders ("User A", "Document 1"),
the quality bar fails.

For data-rich screens (dashboards, lists, document editors): EVERY
mock data row visible in the rendered HTML must have a named entity
+ date + at least one FK resolved to its readable label.

## 5 · Motion

Per MOTION-LIBRARY.md. Per page, the rendered HTML must contain:

- At least 1 `anim-fade-in-*` class application
- At least 1 `transition-*` + `duration-*` pair on an interactive
  element
- At least 1 `hover:` or `focus:` state class
- Total ≥ 3 motion class hits per route (asserted by smoke
  harness regex)

## 6 · Strategic POV

Each screen reflects the STRATEGY.md decisions:

- The cornerstone screen receives the deepest UI investment (most
  primitives, most regions, most interaction surface).
- Non-cornerstone screens funnel toward the cornerstone with explicit
  CTAs. E.g. if cornerstone is the doc editor, dashboard's "Recent
  activity" feed entries are clickable Links pointing into the
  editor.
- IA philosophy from STRATEGY.md is respected:
  - `hub_spoke` → dashboard is the hub, no deep nesting in nav
  - `linear` → there's a numbered next-step wherever possible
  - `deep_nested` → breadcrumbs everywhere
  - `tabbed` → tabs on the cornerstone screen group related sub-views
- Motion personality from STRATEGY.md is applied (calm = fewer/longer
  staggers; punchy = more/shorter staggers; quiet = subdued hover
  states only; playful = pulse + decoration motion).
- Content voice from STRATEGY.md is reflected in EVERY prose string
  (button labels, KPI labels, table column headers, banner copy).

---

## Mechanical gates (auto-checked)

These are checked by the build-hifi script + smoke harness:

1. `npx next build` exits 0 (audit-composition passes)
2. `nav-crawl --project` returns 0 unresolved hrefs
3. `interactivity-audit --project` returns 0 violations
4. `smoke.mjs` reports 0 critical failures including the per-pair
   nav walk
5. Per-route HTML grep: ≥ 3 motion class hits
6. Per-route HTML grep: at least 1 specific named entity from
   mock-data visible in `<body>` text content

If 1-6 all pass, the run is a SHIP candidate. Final QUALITY-REPORT
agent reads screenshots for subjective polish; if it says SHIP, ship.

## Editorial gates (judgment, agent-reviewed)

The final QUALITY-REPORT agent reviews 1280×800 screenshots of every
route + hovered states + URL-param overlay states. It looks for:

- Sparse layouts (large empty white areas, single column when grid
  would work better)
- Visual hierarchy errors (Heading size off, kicker too prominent,
  subtitle as title)
- Content errors (wrong tone, "lorem ipsum" smell, repeated text)
- Inconsistent motion (one screen has stagger, another doesn't)
- Strategic POV not reflected (cornerstone screen is the same depth
  as everything else)
- Em dashes anywhere (they're banned in product copy)

Output is 5 bullet points + 1 concrete next-move recommendation.
Verdict: SHIP / DIAGNOSE.

---

## Anti-patterns that fail this bar

- Generic banner with no actionable detail ("X new things this week")
  instead of named, dated, resolved entries
- Tables of 0 rows or 1 row when the entity has 5+ records
- Buttons with no click behavior
- Cards that look clickable but aren't wrapped in `<Link>`
- Activity feeds that read like log lines ("user_assigned_owner --
  assigned an X")
- Screens that don't fit the cornerstone funnel
- Pages with zero motion (no fade-in, no hover, no focus)
- Em dashes (— banned everywhere in product copy)
- "Lorem ipsum"-style placeholder content
- "You" in product copy (the user is named, third-person voice)
