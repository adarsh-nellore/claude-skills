# Per-screen scaffold for `/build-hifi` agents (body-only)

Read this file before authoring your screen. The **chrome is pre-wired** — `AppShell`, `AppTopNav`, `AppLeftNav`, `PageContainer` are all bundled into `<AppScreen>` by Beat 4 on the main thread. Your job is the body only.

- Hard contract: `./build-hifi-ctx/HARD-CONTRACT.md`
- Motion: `./build-hifi-ctx/MOTION-RULES.md`
- Common mistakes: `./build-hifi-ctx/COMMON-MISTAKES.md`
- Available primitives: `./BUILD-CONTEXT.md`
- Entity shapes: `./MOCK-DATA-CONTRACT.md`

This file ships as `.md` so the TypeScript compiler ignores it. The fenced `tsx` block is reference code, not source.

## Canonical body-only screen shape

```tsx
import type { Metadata } from "next";
import { AppScreen } from "@/components/app/AppScreen";
// FILL: import only primitives listed in ./BUILD-CONTEXT.md
// import { Heading, Body } from "@/components/typography";
// import { Stack, Cluster } from "@/components/layout";
// import { Card, LinkButton, StatusBadge } from "@/components/ui";
// import { PageHeader } from "@/components/patterns";

// FILL: import mock data from the per-entity files
// import { queueArticles } from "@/lib/mock-data/queueArticles";
// import { getNotesForArticle } from "@/lib/content";

export const metadata: Metadata = {
  title: "FILL: short page title",
};

export default async function ScreenPage({
  params,
  searchParams,
}: {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const _params = await params;
  const sp = await searchParams;
  const state = (sp.state as "happy" | "empty" | "error" | "stress" | undefined) ?? "happy";

  // FILL: pick the right mock-data variant
  // const data = queueArticles[state] ?? queueArticles.happy;

  return (
    <AppScreen
      role={/* FILL: "workspace" | "editor" | "modal" — per IA-MODEL.md */ "workspace"}
      pageTitle={/* FILL: short identifier ≤ 80 chars */ "Title"}
      trailing={/* FILL: optional MetaText cluster, e.g. counter */ undefined}
    >
      <Stack gap="section">
        <section className="anim-fade-in-0">
          <PageHeader
            kicker={/* FILL */ ""}
            title={/* FILL */ ""}
            subtitle={/* FILL */ ""}
            meta={/* FILL: optional */ undefined}
            action={/* FILL: if it navigates, wrap in <Link> */ undefined}
          />
        </section>

        <section className="anim-fade-in-1">
          {/* FILL: primary content. If a table goes here, wrap in:
              <div className="overflow-x-auto min-w-0"><table>…</table></div>
              per HARD-CONTRACT.md "Desktop resilience". */}
        </section>

        <section className="anim-fade-in-2">
          {/* FILL: secondary content. Use <Stack gap=…> + <Cluster gap=…>
              for rhythm. Never raw flex flex-col gap-N. */}
        </section>
      </Stack>
    </AppScreen>
  );
}
```

## What changed from v2

In v2, per-screen agents authored the entire file: AppShell wrap, TopNav slot, LeftNav slot, PageContainer, body. ~300–400 LOC per screen.

In v3, Beat 4 main thread authors `src/components/app/AppScreen.tsx` once (~30 LOC). Per-screen agents import it and write **body only** (~150 LOC). Chrome consistency is guaranteed by a single source of truth; per-agent wall-clock drops by ~60–90s.

Do NOT author `AppShell`, `AppTopNav`, `AppLeftNav`, or `PageContainer` in your screen file. Use `<AppScreen>`.

## Authoring checklist (mental, not committed)

- [ ] First line of JSX is `<AppScreen role=… pageTitle=… …>`. NOT `<AppShell>`.
- [ ] All headings are `<Heading size=…>`, all paragraphs are `<Body size=…>`.
- [ ] All vertical rhythm via `<Stack>`, horizontal rhythm via `<Cluster>`.
- [ ] Every CTA is either a wrapped `<Link><Button/></Link>`, a `<LinkButton>`, a client-island button, or a preview-only disabled button with an `aria-disabled` + "preview only" tooltip.
- [ ] No fixed widths ≥ 300px on layout panels. Use `clamp()` or `max-w-[N] w-full`.
- [ ] Tables are inside `<div className="overflow-x-auto min-w-0">`.
- [ ] Page entrance carries `anim-fade-in-0..N` stagger on top-level sections.
- [ ] Mock data comes from per-entity files (`@/lib/mock-data/<entity>`), prose from `@/lib/content` — no hardcoded literals inside the screen body.
- [ ] `?state=empty` / `?state=error` (/ `?state=stress` if `--with-stress`) variants render the corresponding variant without separate code branches.
- [ ] Voice rules in `HARD-CONTRACT.md` "Voice rules": no em dashes, no "you", no AI slop.
