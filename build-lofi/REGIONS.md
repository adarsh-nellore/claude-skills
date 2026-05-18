# Region vocabulary for build-lofi v4

Agents emit JSON describing each concept's sketch as a tree of regions. The renderer (`lofi.js`) turns that tree into the same DOM that v3 fragments wrote by hand. Agents do not produce HTML.

Every region has a `type` field. Most regions support `tooltip` (becomes `data-tip` on hover) and `children` (nested regions). Pills accept either a string (defaults to filter pill) or an object `{kind, text}`. Buttons accept a string or `{text, size, variant}`.

## Pill kinds (PRD-aligned)

- `filter` (default), `filter-active`
- `agent` (purple dashed — wrap AI-attributed content)
- `minor` (neutral grey)
- Severity: `blocking`, `high`, `medium`, `minor`
- Status: `status-detected`, `status-needs-review`, `status-assigned`, `status-in-progress`, `status-blocked`, `status-resolved`, `status-closed`
- Confidence: `confidence-high`, `confidence-med`, `confidence-low`
- Claim: `approved`, `under-review`, `superseded`, `expired`, `stale`
- Trace: `trace-complete`, `trace-partial`, `trace-broken`
- Tier: `tier-strong`, `tier-moderate`, `tier-limited`

Use only these kinds. Use only PRD enum values inside pill text (no fake counts, no fake names).

## Button variants

- `variant: 'primary'` — solid dark
- `variant: 'disabled'` — muted
- `size: 'sm'` — smaller

## Region types

### `topbar`
Top chrome bar. Params:
- `tooltip`
- `left[]` — array of pills or `{skel: 50}` for title slot
- `right[]` — array of pills
- `actions[]` — array of button text/objects (rendered after right pills, small)

### `breadcrumb`
- `tooltip`
- `depth` (default 3)

### `banner`
- `tooltip`
- `variant`: `'info'` (default) or `'error'`
- `label` — leading pill text
- `labelKind` — pill kind for the label (default `minor`, or `blocking` if error)
- `pills[]` — additional pills next to label
- `line` — skel width int (95/80/65/50/30) for a one-line description
- `actions[]` — right-side buttons
- `children[]` — nested regions rendered below the header row

### `kpi-strip`
- `tiles[]` — each `{label, alert?, tooltip?}`

### `box`
General container.
- `tooltip`
- `size`: `'sm'` | `'lg'` | `'xl'`
- `fill: true` for grey background; `muted: true` for muted background
- `label` — box label header
- `children[]`

### `card-list`
Repeated cards using a named pattern.
- `tooltip`
- `cardTooltip` — per-card tooltip (defaults to `tooltip`)
- `count` — how many cards
- `pattern` — one of: `simple`, `guidance-event`, `submission`, `excerpt`, `assessment`, `pending-content`, `queue-row`, `assignment`

### `side-by-side`
Two `.col` panels with optional highlighted conflict rows.
- `tooltip`
- `left: {label, tooltip?, pills?[], widths?[], highlightAt?, highlightColor?}`
- `right: {label, tooltip?, pills?[], widths?[], highlightAt?, highlightColor?}`

`highlightAt` is the zero-based index of the skel row to render as a colored highlight bar instead of a skeleton. `highlightColor` defaults to `#fde4e4` (red); use `#d8ebd8` for green-added rows.

### `queue-table`
Multi-column queue with header + rows.
- `tooltip`, `label`
- `columns[]` — header labels (defaults to EXCERPT/SECTION/IMPACT/CONFIDENCE/STATE/ACTION)
- `rowCount` — number of body rows
- `bulkBar: true` to append a bulk-confirm action bar
- `bulkBarTooltip`

### `form-rows`
Stacked form rows with labels and controls.
- `tooltip`, `label`
- `rows[]` — each `{label?: true, controls: [string|{skel: 50}|{btn: 'TEXT', size?, variant?}|{pill: ...}]}`
- `submit: {text, disabled?, hint?}` — appended footer with SAVE DRAFT + submit button

### `agent-block`
AI-attributed content with confidence + actions.
- `tooltip`, `label` (defaults to `AI`)
- `confidence`: `'high'` | `'med'` | `'low'`
- `pills[]` — additional header pills
- `lineCount` — number of skeleton lines (default 4)
- `actions[]` — right-side buttons
- `footerPills[]` — pills row below the lines

### `timeline`
Stacked dot + status pill + skel + timestamp rows.
- `tooltip`, `label`
- `rowCount` (default 6)
- `statuses[]`, `labels[]` — override the default lifecycle cycle
- `muted: true` for muted background

### `two-col`
Two-column row.
- `wide[]` — regions in the wide column (`flex: 1.6`)
- `narrow[]` — regions in the narrow column (320px fixed)

### `filter-strip`
Filter pill row in a small grey bar.
- `tooltip`
- `filters[]` — pills (first one auto-rendered as `filter-active`); pass `{kind, text}` objects to override
- `actions[]` — right-side pills (e.g. sort/group chips)

### `tab-row`
- `tabs[]` — array of tab labels; first is active

## Top-level concept object

Each concept in `concepts.json` is:

```json
{
  "id": "kebab-id",
  "title": "Sentence-case title",
  "blurb": "Two-sentence value-focused blurb.",
  "lofi": [ /* region tree */ ]
}
```

The top-level `concepts.json` envelope:

```json
{
  "product": "Product name",
  "primary_persona": "Name, Role",
  "subtitle": "optional override of the page subtitle",
  "concepts": [ /* concept objects */ ]
}
```

## Hard rules for agents

- No em dashes anywhere in text fields. Use periods, semicolons, colons, parens.
- No "you" pronoun in blurbs or labels.
- No fake content: no fake counts, no fake person names (2-letter initials like SV/DK are fine), no fake dates, no fake document titles. Pill text uses only PRD enums or system labels (TIMESTAMP, MODULE, PAGE, REQUIRED, OPTIONAL, etc.).
- Visual hierarchy: every concept must have one dominant region using `box.xl` (or `queue-table` / `side-by-side` inside one). Chrome (topbar, breadcrumb) stays `box.sm`.
- Every region with hover content (`box`, `banner`, `agent-block`, `kpi`, `issue-card` inside `card-list`) must have a `tooltip` string.
