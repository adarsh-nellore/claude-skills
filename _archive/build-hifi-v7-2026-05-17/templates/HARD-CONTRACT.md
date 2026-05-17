# Hard contract for `/build-hifi` per-screen agents

This file is the canonical contract every per-screen agent must follow. The skill copies it into the project as `./build-hifi-ctx/HARD-CONTRACT.md`. Agents Read it; it is not pasted into prompts.

## Two prototype-level hard rules

- **Single primary persona.** Every screen this skill generates serves ONE primary persona (the one named in `./PRD.md` Section 7). Secondary personas populate mock data and activity timelines but NEVER get dedicated screens, dashboards, or routes. Per-screen agents receive only the primary persona's user stories (Section 11) in their prompts.
- **Generate edge-case states.** Each screen must support the edge cases listed in `./PRD.md` Section 21 for that screen's UI surface. Implementation pattern: a `?state=<name>` query param (e.g., `?state=empty`, `?state=error`, `?state=stress`) that swaps the screen into the named edge-case state. The mock-data agent produces parallel variants — `mockData.happy`, `mockData.empty`, `mockData.error`, `mockData.stress` — alongside the default happy-path data. Production users never see the toggle; reviewers (and `/ux-review`) flip it via the URL.

---

## Composition contract (audit-enforced)

Pairs with `COMPOSITION-CEILINGS.md` (composition density ceilings, agent-discipline only). HARD-CONTRACT catches "this fails the audit"; CEILINGS catches "this passes the audit but looks over-composed". **Both apply.** Read both before writing.

If the codebase has `docs/COMPOSITION.md`, it is the authoritative contract; every rule below sits on top of it. `npm run audit` must return 0 violations after generation. The `prebuild` hook will fail `npm run build` otherwise.

- Every display/heading element is `<Heading size="display|h1|h2|h3|h4">`. No raw `<h1>`…`<h6>` with className font/size.
- Every paragraph is `<Body size="lead|body|small">`. No raw `<p>` with `text-[Npx]`.
- Every vertical rhythm uses `<Stack gap="tight|cozy|comfortable|block|section|page|hero">`. Every horizontal row group uses `<Cluster gap="…">`. No raw `flex flex-col gap-N` or `flex items-* gap-N` in pages.
- Every page header uses `<PageHeader kicker subtitle title meta action>`. Every reading-style body uses `<Prose variant>`. Brand wordmarks use `<PeerBrand>` (or the codebase's equivalent brand primitive).
- **Navigation:** every button that changes route is `<LinkButton href>` or wrapped with `<Link href>`. Plain `<Button>` is reserved for in-page commands and MUST have an `onClick` (even `onClick={() => {}}` in prototype-stage). NEVER `<Button href=...>` — Button is a `<button>` element, not a link. The audit's `no-button-with-href` rule catches this anti-pattern.
- **Heading vs Body:** `<Heading>` and `<PageHeader title>` accept short identifiers only (~80 chars max). Long content goes in `<Body size="lead|body">`. Putting a full claim text, sentence, or paragraph in a heading slot produces visually broken output even when audit clears. The audit's `no-long-heading-literal` catches one-line literal abuse; JSX-interpolated long content (e.g. `title={claim.full_text}`) must be avoided by discipline.

## Asset bans

- **No new color values.** All colors come from CSS variables defined in `globals.css` or via Tailwind utility classes that consume those variables. No hex codes in TSX. No arbitrary Tailwind values like `[#fef9c3]`.
- **No new fonts.** No `next/font` imports beyond what the codebase already has. No Google Fonts URLs.
- **No external UI kits.** No `@radix-ui`, no `@shadcn`, no `@headlessui`, no `@mantine`, no `react-aria`. Only the codebase's own components.
- **No external icon libraries except the one already in the codebase.** If the codebase uses `lucide-react`, keep using it. If it uses inline SVG, keep that.
- **No new chart libraries.** No Recharts, no Visx, no D3 imports. Use the codebase's existing custom SVG chart components and `monotoneCubicPath` / equivalent utilities.
- **No inline `style={{...}}` except for one-off positioning** (top, left, transform). Colors, fonts, sizes, radii, shadows all go through tokens or utility classes.
- **No new animation keyframes.** Reuse the codebase's `anim-fade-in-*` and chart-related keyframes. Subagents MUST apply the existing motion utility classes per `MOTION-RULES.md`; static screens are not acceptable.
- **No new files outside `src/app/<route>/` and `src/lib/`** without matching the codebase's existing conventions. If a needed UI primitive does not exist, the agent creates it in `src/components/ui/` following the same shape as a sibling (typed, OKLCH-friendly via tokens, default + variant API).
- **Domain vocabulary from the PRD, never lorem ipsum or generic placeholder text.**

## Content & cohesion

- **Every routable surface gets authored content.** Every item in the LeftNav (and every leaf route in the IA model from `./IA-MODEL.md`) must route to a screen with authored content matching its role. Stubs are not allowed by default. If the PRD does not author content for a given doc or feature, the content agent and per-screen agent generate plausible domain content in the same voice. The "stub EmptyState" pattern is reserved for routes the IA model EXPLICITLY marked `stub-by-design` with a one-line justification.

- **Modal backdrops reuse the underlying screen.** Modal routes that overlay another screen (e.g., `/documents/[id]/claims/[cid]`) MUST render the underlying screen as their backdrop by importing a shared component (e.g., `<DocumentEditorView documentId={...} viewport="backdrop" />`). Per-screen agents do NOT author independent backdrop prose, file tabs, or rail content. The backdrop is a literal slice of the underlying screen. Continuity is non-negotiable: the writer reading the modal must see the exact prose they were just looking at, plus the modal on top. Main thread extracts the shared component into `src/components/<feature>/` during prep (before the parallel batch) if it does not exist yet.

  **Scrim + LeftNav z-index gotcha.** The modal scrim MUST cover the full viewport (`fixed inset-0 z-50`) so the modal panel is centered in the screen, not pushed to the right by the LeftNav width. To keep the LeftNav clickable above the scrim (the nav-unification contract requires this), the design-system `AppShell`'s LeftNav aside needs `position: relative` and a z-index higher than the scrim (e.g. `relative z-[60]`). If the upstream `AppShell` primitive lacks this, the skill applies a one-line patch to the DS source in Beat 0 — this is the one DS edit the skill is permitted to make, because it's a structural requirement, not an aesthetic one. Do NOT solve the problem by shrinking the scrim to `left-[<leftNavWidth>]` — the modal will appear visually off-center and reads as broken.

- **Compose by import, never copy-paste.** Per-screen agents compose by importing other agents' output. Editor backdrop imports the shared `<DocumentEditorView>`. Workspace screens import the same `<StatusBadge>`, `<StatusDeltaBadge>`, `<AppLeftNav>`. When two screens need the same primitive, main thread extracts it to `src/components/<feature>/` BEFORE the parallel batch runs. Re-implementing a sibling component is a cohesion-check failure.

## Interactivity (audit-aware)

- **No silently non-functional interactivity.** Every filter pill, tab, search input, sort control, and CTA button must satisfy ONE of three conditions:
  1. **Functional via URL params or `<Link>`.** Server-rendered control whose state lives in `searchParams`; main thread wires a `<Link>` whose `href` flips the param.
  2. **Functional via a `'use client'` island.** The control lives in a small client component that handles its event locally (search input filters list state, sort toggles a useState).
  3. **Preview-only with a visible disabled affordance.** The control renders with `aria-disabled`, lowered opacity (e.g. `opacity-60`), `cursor-not-allowed`, AND a tooltip or adjacent MetaText reading `"preview only"`. Hidden non-functionality reads as broken; visible disabled honesty does not.

  Specifically: a bare `<Button>onClick={() => {}}` is NEVER acceptable. Buttons that should navigate are wrapped in `<Link href="...">`; buttons that should mutate state live in a `'use client'` island; buttons that are decorative pivot to preview-only.

- **Navigation buttons wrap in `<Link>`.** The design-system's `<Button>` is a plain `<button>` element. It does NOT navigate on click. Every button intended to navigate to another route MUST be rendered as:

  ```tsx
  <Link href="/target"><Button …>Label</Button></Link>
  ```

  Bare `<Button onClick={() => router.push(…)}>` is allowed ONLY inside a `'use client'` file with `useRouter` imported. Never use `window.location.assign(…)` inside an `onClick`; that bypasses Next.js client-side routing and breaks Turbopack hot reload.

## Information hierarchy: heading vs body

`<Heading size="display|h1|h2|h3|h4">` is for short identifiers and section labels (5 to 12 words typical, max one short sentence). `<Body size="lead|body|small">` is for paragraph-level prose. Never put a full sentence longer than ~60 characters inside `<Heading>`. Never render a body paragraph as a title because it happens to be short. Claim text, summaries, descriptions, and any prose with a period in the middle belong in `<Body>` or `<Prose>`, regardless of how prominent the screen needs them to feel. The composition audit does not catch this; the per-screen agent must.

## Desktop resilience (1280px floor)

Prototypes must render cleanly at 1280px wide without horizontal page scroll or columns crushed below readable widths. See `docs/LAYOUT.md` "Desktop resilience" for the canonical rules. Three load-bearing constraints:

- **No hardcoded layout widths ≥ 300px.** Asides, list panels, side panels — anything in the layout-budget race — must NOT use `w-[380px]`, `w-[400px]`, etc. Use `<SplitFrame>` for two-column splits, `w-[clamp(min,fluid,max)]` for asides with a target + floor (e.g. `w-[clamp(320px,28vw,420px)]`), or `max-w-[Npx] w-full` for centered cards and search inputs whose width is a cap, not a load-bearing dimension. The audit's `no-fixed-wide-width` rule fails the build on violation.
- **Wide content wraps in `overflow-x-auto min-w-0`.** Every `<table>`, every code block, every horizontal scroller authored in a screen sits inside `<div className="overflow-x-auto min-w-0">…</div>`. `AppShell` carries `overflow-x-hidden` as a runtime safety net, but content authored without a wrapper will be silently clipped rather than gracefully scrolling.
- **Tight columns use responsive padding.** A detail section that shares viewport budget with `LeftNav` + `RightRail` + an aside must not also pay `px-12` (96px). Prefer `px-6 xl:px-12` or `px-8` on tight columns; reserve bare `px-12` for full-bleed columns (dashboards without rails).

## Voice rules

Apply to UI copy, mock data prose (issue titles, summaries, comments), README updates, and any subagent-written documentation.

- No em dashes. Use periods, semicolons, colons, parens.
- No "you" in product copy unless the brief explicitly calls for second-person voice.
- No AI slop: no decorative arrows, no fake quotes, no punchy 4-7 word section titles, no aphoristic openers, no "X, not Y" parallels, no "this isn't just X" intensifiers.
- No filler ("essentially," "ultimately," "at its core," "it's worth noting").

Exempt: column headers, function-label glyphs, technical constants.
