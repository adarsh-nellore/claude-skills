# Motion library

Concrete motion patterns every screen agent in `/build-hifi` must apply.
Replaces the old MOTION-RULES.md. Each pattern names its exact class
strings so agents copy-paste correctness, not approximate it.

The design system at `~/Projects/adarsh-design-system/` ships a small
motion vocabulary in `src/app/globals.css` (the `anim-fade-in-*`
keyframes). On top of that, plain Tailwind motion utilities
(`transition-*`, `duration-*`, `ease-*`) are allowed and expected.

**Rule of thumb:** every screen body MUST apply at least 3 patterns
below. The post-build smoke harness greps each rendered page for
`anim-fade-in`, `transition-`, `duration-`, `hover:`, and `focus:` —
if a route has fewer than 3 hits, the quality bar fails.

---

## 1 · Page entrance stagger

Wrap each top-level region in a stagger class so the page settles in
~480ms instead of popping.

```tsx
<Stack gap="section">
  <section className="anim-fade-in-0"><PageHeader … /></section>
  <section className="anim-fade-in-1">{/* KPI strip */}</section>
  <section className="anim-fade-in-2">{/* primary card grid */}</section>
  <section className="anim-fade-in-3">{/* secondary panel */}</section>
  <section className="anim-fade-in-4">{/* activity feed */}</section>
</Stack>
```

Classes (delays in parentheses):
- `anim-fade-in-0` (0ms)
- `anim-fade-in-1` (60ms)
- `anim-fade-in-2` (120ms)
- `anim-fade-in-3` (180ms)
- `anim-fade-in-4` (240ms)
- `anim-fade-in-5` (300ms)

Don't exceed `-5`. Pages with more than 6 top-level regions should be
restructured, not given a `-6`.

---

## 2 · Card / row hover lift (interactive list items)

Every clickable card or table row that navigates must visually
respond on hover. Lift by 1px, soften the shadow, surface the border.

```tsx
<Link
  href={…}
  className="block transition-all duration-200 ease-out
             hover:-translate-y-px hover:shadow-md
             focus-visible:ring-2 focus-visible:ring-coral
             rounded-lg"
>
  <Card …>…</Card>
</Link>
```

Apply to: dashboard submission cards, list-page table rows, section
cards in submission detail, guidance event rows.

Do NOT apply to: KPI tiles (decorative, not interactive), banner copy
blocks (non-routing).

---

## 3 · Button press feedback

Already baked into the DS `<Button>` primitive (hover token swap +
focus ring). Agents should not override. If a button is wrapped in
`<Link>` for navigation, the press feedback still works.

Anti-pattern (do NOT add):
```tsx
<Button className="hover:bg-coral-strong">  ❌ overrides DS
```

The DS owns button motion. Use it as shipped.

---

## 4 · Annotation / inline-decoration hover

Document-editor annotations and any inline emphasized spans should
respond on hover so the user knows they're interactive.

```tsx
<Link
  href={`?panel=${item.id}`}
  scroll={false}
  className="border-b-2 border-amber-400
             cursor-pointer
             transition-colors duration-150
             hover:bg-amber-50 focus-visible:bg-amber-100
             rounded-sm px-px"
>
  {annotatedText}
</Link>
```

Active state (when this annotation is the one the side panel is
focused on):
```tsx
className={cn(base, activeItemId === item.id && "bg-amber-100")}
```

---

## 5 · Slide-in / drawer entrance

Side panels and drawers (the GuidanceSidePanel, DecisionMemoDrawer)
should slide in from their anchor edge, not pop.

```tsx
{/* right-anchored side panel */}
<aside className="
  fixed right-0 top-0 h-screen z-[55]
  w-[clamp(360px,28vw,460px)]
  bg-surface border-l border-border
  anim-fade-in
  motion-safe:animate-[slide-in-right_240ms_ease-out]
">
```

If the keyframe doesn't exist (DS only ships `ads-fade-in`), fall
back to `anim-fade-in` plus `translate-x-2 transition-transform`
on mount via a tiny client island. Easier path: just `anim-fade-in`
on the aside root; the fade carries 80% of the perceived motion.

---

## 6 · Empty state + loading state motion

For `?state=empty` and `?state=loading` URL params, ensure the
substituted UI has its own entrance:

```tsx
{state === "loading" ? (
  <Stack gap="cozy" className="anim-fade-in-0">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-32 w-full" />
  </Stack>
) : state === "empty" ? (
  <EmptyState className="anim-fade-in-0" … />
) : (
  <RealContent />
)}
```

---

## 7 · Focus rings (required on every interactive primitive)

Every `<Link>`, `<Button>`, every clickable surface MUST have a
visible focus ring. The DS focus token is `focus:border-coral`
(for inputs/checkboxes) or `focus-visible:ring-2 focus-visible:ring-coral`
(for buttons and cards).

If wrapping a Card in a Link:
```tsx
<Link
  href={…}
  className="block focus-visible:ring-2 focus-visible:ring-coral
             focus-visible:ring-offset-2 focus-visible:outline-none
             rounded-lg"
>
```

---

## 8 · Tab / segmented control transitions

When a screen has tabs (FilterBar, segmented decision picker), the
active indicator should slide smoothly. The DS Tabs primitive
handles this. Don't roll your own.

---

## 9 · Modal / overlay backdrop fade

Modals over a backdrop:
```tsx
<div className="
  fixed inset-0 z-50 bg-ink/30
  anim-fade-in
" />
<div className="relative z-[55] anim-fade-in-1
                bg-surface rounded-lg shadow-lg">
  {/* modal content */}
</div>
```

The slight stagger (backdrop first, content second) reads as
intentional choreography.

---

## 10 · Status indicator pulse (optional, but high-quality)

For "live" status indicators (e.g. a dot signaling agent is
working), add a subtle pulse:

```tsx
<span className="relative flex h-2 w-2">
  <span className="absolute inline-flex h-full w-full
                   rounded-full bg-coral opacity-75
                   motion-safe:animate-ping" />
  <span className="relative inline-flex rounded-full
                   h-2 w-2 bg-coral" />
</span>
```

Use sparingly. Only on genuinely "live" surfaces (agent activity
strip, real-time counter).

---

## Things to NEVER do

- Add new `@keyframes` to `globals.css`. The DS owns the keyframe set.
- Use `framer-motion`, `react-spring`, `@motionone/dom`, or any external
  motion library. The audit fails on these imports.
- Use raw `style={{ transition: ... }}` inline. Always Tailwind utility.
- Apply `anim-fade-in-N` to a sub-component inside another
  `anim-fade-in-N` parent — the stagger is meant for top-level page
  sections only.
- Animate every element on a page. Animate the entrance, the
  interactions, and any state change. Static content is fine.

---

## Quick checklist

When done with a screen, mentally run this:

- [ ] Top-level sections use `anim-fade-in-0..N` stagger
- [ ] Every clickable card / row has a hover lift (#2)
- [ ] Every interactive element has a focus ring (#7)
- [ ] If the screen has annotations, they have hover/active states (#4)
- [ ] If the screen has a drawer or modal, it fades in (#5 / #9)
- [ ] No external motion library imports
- [ ] At least 3 motion classes total visible in the rendered HTML
