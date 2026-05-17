# Common mistakes that fail type check or audit

Institutional memory of every previous build cycle. Read this before authoring a screen.

```
Common mistakes (DO NOT write these):

- MetaText.tone = "muted"
  → use "default" (default IS the muted look)

- Tab.onClose passed from a server component
  → server pages must omit it

- Tabs.onChange passed from a server component
  → wrap in a client island

- Mock-data field names that shadow first-class API names
  (e.g. `variants` when state-variants is a sibling concept)
  → use `claimVariants` or similar

- Async params: must be Promise<{...}> in Next 16, always await before use

- searchParams handler signature: Promise<Record<string, string | undefined>>

- Functions passed to client components from server pages: not serializable
  → use URL-param <Link> or 'use client' islands

- Static rendered aria-disabled controls with no tooltip
  → see HARD-CONTRACT.md rule about preview-only affordances

- Mock-data record duplicates across same-id rows
  (e.g. two `Source` records for the same claim with identical fields)
  → de-dupe before export
```

## Verifying this list against the current codebase

When the build cycle starts, the main thread Reads this file and the codebase's component sources. If a primitive's API has drifted (e.g., the MetaText tone enum changed), the main thread updates the project copy at `./build-hifi-ctx/COMMON-MISTAKES.md` before agents read it. The skill repo copy is the long-lived baseline; the project copy is the per-run truth.
