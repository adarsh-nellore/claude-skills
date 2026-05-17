# Composition ceilings for `/build-hifi` per-screen and per-sub-component agents

The design system at `--ds-path` ALREADY provides every primitive, pattern, and named layout shell you need. Your job is to compose. Not to author on top.

This file pairs with `HARD-CONTRACT.md`. Both apply.

- **HARD-CONTRACT** catches "this fails the audit": raw `<p>`, raw `<h*>`, `flex flex-col gap-N`, `<Button href>`, hex colors, em dashes, missing primary persona.
- **COMPOSITION-CEILINGS** (this file) catches "this passes the audit but looks over-composed": Card-in-Card, multiple accent actions, stacked sidebar Cards, inconsistent Tag/Pill/Badge mapping.

These ceilings are agent-discipline rules — they are NOT regex-enforced. Self-check before every write.

---

## Card budget

- Max **5 top-level Cards** per page.
- **Card-in-Card is FORBIDDEN.** If a region needs visual grouping, use `<Stack gap="block">` between regions, not a wrapper Card.
- **Banner-in-Card is also forbidden.** Banners are flat. If you need rows inside a banner, use `<Body>` + `<Cluster>`, not Cards.
- For compound screens, the 5-Card cap applies to the `page.tsx` shell. Each `_<child>.tsx` sub-component carries its own budget of ≤ 3 top-level Cards within its own body.

## One accent per screen

- Exactly ONE `<Pill variant="accent">` or `<LinkButton variant="primary">` per route. (DS Pill uses `accent`; DS Button/LinkButton uses `primary` — same semantic.)
- The `<PageHeader>` `action` slot owns the screen's primary verb.
- Everything else: `variant="ghost"` or `variant="outlined"`.
- If the lo-fi or PRD shows 5 buttons, 4 of them are ghost.

## Pill / Tag / Badge / ConfidenceBadge — closed mapping

| Primitive | What it represents | Examples |
|---|---|---|
| `<Tag>` | identity attributes only | agency, product code, drug/account/team name, indication, region |
| `<Badge>` | lifecycle state + level/severity | PROPOSED, ASSIGNED, DECIDED, MATERIAL, AMBIGUOUS, OPEN, CLOSED |
| `<ConfidenceBadge value={0-100}>` | AI confidence | high=85, medium=55, low=25 |
| `<Pill>` | interactive action triggers | Confirm, Dismiss, Open, Expedite, Send |
| `<MetaLabel>` | uppercase micro-label above a value | "Due", "Workload", "Sources" |

Apply this mapping consistently within one screen. If a lo-fi sketch shows `<span class="pill filter">FDA</span>` — that's a `<Tag>`, not a `<Pill>`. The lo-fi's CSS class name is not the DS primitive name.

## Gap rhythm — 3 tiers only

- **Between top-level regions:** `gap="block"`
- **Within a region:** `gap="comfortable"`
- **Within a sub-block** (header + meta line, row of badges): `gap="cozy"` (or `"tight"` for tightly-coupled items)
- A 4th tier means you're nesting too deep — collapse a level.

## PageHeader is mandatory

- First child of the page body, always.
- Its `action` slot owns the primary verb (the one accent action).
- Do NOT author your own title row with bare `<Heading>` + `<Cluster>`.

## Reach for DS patterns BEFORE inline composition

| Need | Pattern to use | Don't author |
|---|---|---|
| Filter + search row | `<FilterBar>` | Cards + Pills |
| Primary + secondary action group | `<ActionBar>` | bare Cluster of Pills |
| Label/value strip or grid | `<DefinitionList>` / `<KeyValue>` | Card + Stack + Cluster |
| Long-form text | `<Prose variant>` | bare Body wrappers |
| State + count summary | `<Stat variant="card">` | Card + Heading + Body |
| Centered reading column | `<Prose variant="reader">` | manual `max-w-[…]` |

If the DS doesn't expose a pattern for what you need, check `docs/LAYOUT.md` for a named shell first. Composing custom layout from `<Card>` + `<Stack>` + `<Cluster>` is the last resort, not the first.

## Sidebar discipline (SplitFrame narrow column / RightRail)

- **ONE Card per rail**, with multiple sections inside separated by `<Heading size="h4">` + `<Stack>`.
- NOT 3+ stacked Cards (no matter what the lo-fi shows).
- If the lo-fi sidebar has 3 boxes, fold them into one Card with Heading-separated sections inside. Rationale: a narrow column of N heavy Cards reads as a stack of receipts; folded sections read as one organized rail.

## NO new components unless strictly necessary

- **Do NOT author new files under `src/components/**`.** The DS is fixed.
- **Do NOT author new sibling files** next to `page.tsx` (e.g. `_filters.tsx`, `_tabs.tsx`, `_modal-shell.tsx`) UNLESS:
  - (a) the page genuinely needs `'use client'` for local state (tabs with selection state, controlled inputs, drawer close handlers with `useRouter`), AND
  - (b) inline composition with existing DS primitives is impossible (the state can't be lifted to URL params).
- **Default move:** inline everything in `page.tsx` using closed-enum primitives.
- **If a structure repeats 3+ times within ONE page**, extract a LOCAL function at the top of the same file:
  ```ts
  function ItemRow({ item }: { item: Foo }) { return <Cluster>…</Cluster>; }
  ```
  Still not a separate file.
- Existing DS components stay. Do not create more.

For compound screens: per-sub-component agents author `_<child>.tsx` files the script pre-scaffolded. They DO NOT author additional sibling files beyond the ones already in the route folder.

## Concept HTML is intent-only

If `concepts.json` or `concept<N>.html` files exist in the project root (from a `/build-lofi` v3+ run), they are intent reference only.

Read each `concept<N>.html` to answer THREE questions and nothing else:

1. **What's the dominant region?** (where does the eye land first)
2. **What's the user's verb?** (the one accent action)
3. **What's the supporting context?** (what surrounds the dominant region)

Do NOT:
- Translate `<div class="box xl">` → `<Card padding="lg">`
- Translate `<div class="row">` → `<SplitFrame>`
- Translate every `<span class="pill">` into its own primitive

DO:
- Pick the smallest set of DS primitives that delivers the same user moment.
- Pick the named shell from `docs/LAYOUT.md` that best fits the page type.
- Map lo-fi pills to the correct primitive per the Tag/Pill/Badge/ConfidenceBadge mapping above.

## LOC ceilings (firm — keyed to `screens.json` `layout` field)

| Layout | LOC ceiling | Notes |
|---|---|---|
| `workspace` (dashboards, lists, libraries, archives) | ≤ 250 | full-shell + content |
| `form` (settings, onboarding, single-focused action) | ≤ 230 | narrow-shell |
| `detail` / `split` (item detail, diff viewers, triage views) | ≤ 280 | split-shell or full-shell + rail |
| `editor` (compound screen — `page.tsx` shell) | ≤ 380 | doc-shell; composition of pre-scaffolded `_<child>.tsx` imports |
| `editor` per `_<child>.tsx` sub-component | ≤ 200 | each child is one focused region |

If you're over budget, you're over-composing. The fix is almost always: drop a wrapper Card, fold sidebar sections, inline a label-value pair instead of authoring a sub-block.

## Final check before write

Before saving the file, scan:

- Top-level Cards: ≤ 5 (or ≤ 3 for a sub-component) ✓
- `variant="accent"` uses (or LinkButton `variant="primary"`): exactly 1 ✓
- New files created: 0 ✓
- LOC: under the band for this layout ✓
- Top-level regions wrapped in `<Stack gap="block">` ✓
- One accent action in `<PageHeader>` `action` slot ✓
- Sidebar/rail is ONE Card with Heading-separated sections, not stacked Cards ✓
- Every `<Tag>` is identity; every `<Badge>` is state/level; every `<Pill>` is an action trigger ✓
