---
name: ux-review
description: |
  Audit a working prototype against a persona + JTBD AND implement the
  fixes in one closed loop. Default flow ≤5 min: 6-step Playwright
  walkthrough as the persona, one-line fix synthesis from observed
  friction, 3 parallel sub-agents generate patches as PATCH_OPS JSON,
  main thread applies sequentially with a single end-of-run
  node --check. Output: fixed prototype + UX-AUDIT.md. Opt-in flags
  --static (adds a 4-agent parallel Part A coverage audit, +1–2 min)
  and --verify (re-walks failure-point screens after fixes, +1–2 min).
  Triggers: "audit and fix", "ux review", "review and implement",
  "find issues and fix them", "close the loop on this prototype",
  "run a simulated user against this", "audit my prototype". Requires
  Playwright MCP. Composes downstream from /build-hifi or /build-lofi
  (which compose from /code-ready-prd ← /founding-design-ideation).
license: MIT
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebFetch
  - Agent
  - mcp__playwright__playwright_navigate
  - mcp__playwright__playwright_get_visible_text
  - mcp__playwright__playwright_get_visible_html
  - mcp__playwright__playwright_click
  - mcp__playwright__playwright_fill
  - mcp__playwright__playwright_press_key
  - mcp__playwright__playwright_select
  - mcp__playwright__playwright_screenshot
  - mcp__playwright__playwright_close
  - mcp__playwright__playwright_evaluate
---

## Role

Generator + executor + verifier. One invocation = one closed
audit-and-fix loop ending with a patched prototype and a
`UX-AUDIT.md`. Built for time-boxed design exercises where the user
has ≥ 10 minutes and wants the loop closed without serial bottlenecks.

## When to run

- Time-boxed exercise with a working prototype (file:// or
  localhost).
- User wants audit + fixes + a patched prototype in one Claude Code
  session.
- Fixes are likely surgical (3–5 inline edits in one or two files),
  not architectural.

## When NOT to run

- User wants to read the audit before any code changes. (Use this
  skill with `--no-fix` to stop after the walkthrough.)
- Likely fixes need design judgment the model shouldn't make alone
  (IA redesign, new flow). Use `/build-lofi` to pick a direction
  first.
- Framework prototype with an unreachable dev server. Stage 1 will
  fail — start the server first.

## Hard rules

- **Wall-clock target: ≤5 minutes for the default flow.** If Stage 2
  exceeds 4 minutes, stop adding walkthrough steps even if JTBD
  isn't complete; proceed to fix synthesis from what was observed.
- **No vague flags.** Every failure description names the screen,
  the exact UI element, the expected behavior, the observed behavior.
  Reject "consider improving X."
- **One runtime: Playwright MCP.** If it isn't loaded, fall to
  static-only (`--static` is the only viable mode) and say so.
  Do not fake walkthroughs.
- **Sub-agents in Stage 4 do not write files.** They return
  `PATCH_OPS` JSON. The main thread applies them via Edit.
- **One syntax check at the end.** Do not gate every fix.
- **No invented work.** If Stage 3 finds zero high-leverage fixes,
  the skill stops with the audit doc. Do not spawn patch agents to
  surface micro-polish that the walkthrough didn't surface.
- **Single primary persona.** Walk the prototype as the ONE primary
  persona named in `./PRD.md` Section 7. Do not generate alternate
  walkthroughs for secondary personas in the same run; per the
  pipeline principle, secondary personas never get dedicated flows.
- **Test one edge case per walkthrough.** Step 6 (or the last step
  before stop conditions hit) probes one Filing-blocking or
  High-severity edge case from `./PRD.md` Section 21. Use the
  `?state=<name>` dev toggle from `/build-hifi` to force the
  prototype into the named state; observe whether the app handles
  it as Section 21's "Expected behavior" specifies.

## Pipeline

### Stage 1 — Preflight (~10s)

**Context check.** Look for inputs, in order:
1. `./PRD.md` + `./JOURNEY.md`
2. PRD/persona/JTBD pasted into the conversation
3. URL + one-line persona + one-line JTBD inline
4. Nothing — ask the user for at minimum URL + persona + JTBD

**Prototype shape detection.** Inspect the project root:
- Single static HTML → URL is `file://...`. No dev server.
- `package.json` with a dev script → framework. Confirm the dev
  server is running on the expected port; if not, tell the user to
  start it before re-running (or set `--start-server` if the skill
  is invoked with that flag).

**Environment**: confirm `mcp__playwright__playwright_navigate` is
callable. If not loaded, switch to `--static` mode automatically and
log that Stage 2/4/5 are skipped.

### Stage 2 — Walkthrough (~3 min, 6-step cap)

Drive the prototype via Playwright MCP, playing the PRD persona
attempting the PRD JTBD.

1. **Frame the run.** Hold the persona + JTBD verbatim from the PRD.
   Do not rephrase.
2. **Navigate to start URL.**
   `mcp__playwright__playwright_navigate({ url, headless: true })`.
3. **Loop, max 6 steps.** Steps 1–5 advance the JTBD; **step 6 (or
   the last step before stop conditions hit) tests one edge case**
   from PRD Section 21. Each step:
   - `mcp__playwright__playwright_get_visible_text` (or
     `playwright_get_visible_html` only if selectors are ambiguous).
   - Reason as the persona. Hold the step entry in conversation
     state — do NOT write to `UX-AUDIT.md` yet. Format:
     `Step N — [screen]. Action: [X]. Expected: [Y]. Reason: [JTBD-anchored].`
   - Execute: `playwright_click` / `_fill` / `_press_key` / `_select`,
     or `_evaluate` for dynamic selector discovery.
   - Log result in conversation state: `Observed: [literal page
     response]. Next: [Z because reason].`
   - **For the edge-case step**: pick one Filing-blocking or
     High-severity row from PRD Section 21. Use `playwright_navigate`
     with `?state=<name>` appended to the URL (per `/build-hifi`'s
     dev-toggle pattern) to force the prototype into the edge-case
     state. Compare what renders against Section 21's "Expected
     behavior" column. If the prototype lacks the dev toggle, force
     state via `playwright_evaluate` mutations or skip and log
     "edge case not testable this run; prototype missing
     `?state=` toggle."
4. **Screenshot at most 3 times**, only at: (a) start, (b)
   JTBD-complete or dead-end, (c) one mid-run if a new screen is
   reached. Save under `./audit-screenshots/`. Do not screenshot
   every step.
5. **Stop conditions** (first match wins):
   - JTBD complete.
   - Dead-end with no recovery.
   - 6 steps reached.
   - Stage 2 elapsed > 4 minutes.
6. **`mcp__playwright__playwright_close()`** when done.
7. **Single end-of-stage write.** Compose the full Part B section
   from buffered step entries + failure points + completion status,
   and `Write` (or `Edit` if `UX-AUDIT.md` already exists from a
   prior `/ux-review` invocation) the file in one shot.

### Stage 3 — Top fixes synthesis (~20s)

Read the just-written Part B failure points. Produce 1–5 fix entries,
each one-line:

```
N. Fix [name] — screen `<screen>`, element `<element>`. Current: <observed>. Target: <target>. File:line `<path>:<n>` (renderer/handler to modify).
```

That's it. No multi-paragraph essays. Append the list as
`## Top fixes (prioritized)` in `UX-AUDIT.md`.

**Soft stop**: 0 high-leverage fixes → skill stops here with audit
doc, banner the user, end turn.

**Small-fix bypass.** Tag each fix as `small` (target change is ≤ 3 lines of source in ≤ 1 file with no shared logic) or `non-small`. If ALL fixes are `small`, skip Stage 4 entirely and have main thread apply the edits directly in Stage 5. Spawning patch agents for trivial inline edits costs more wall-clock than the fixes themselves and adds no quality (the prompt becomes longer than the patch). The full Stage 4 parallel batch runs only when at least one fix is `non-small`.

### Stage 4 — Parallel patch generation (~1 min)

Spawn N `general-purpose` Agent calls in **one tool-call batch**.

Batch sizing:
- N ≥ 3 fixes → one agent per fix, capped at 5.
- N = 1 or 2 fixes → spawn the 1–2 fix agents **plus** 1–2
  "micro-polish" agents to pad to 3 total. Each micro-polish agent
  owns one category (CTA wording, empty-state copy, spacing/alignment)
  scoped to screens the walkthrough touched. They must not invent
  new gaps the walkthrough didn't surface.

Per-agent prompt template (self-contained; do not require the
sub-agent to re-read large files):

```
You are implementing a single UX fix on a prototype. Return ONLY a
fenced ```PATCH_OPS code block containing a JSON array of
{ file, old_string, new_string } objects, then a one-sentence summary.
Do NOT call Edit, Write, or any file-modifying tool.

PROTOTYPE SOURCE:
[paste full file text if < 2,000 lines; else paste relevant span +
list paths]

YOUR FIX:
[one-line fix entry from Top fixes (prioritized)]

CONTEXT (UX-AUDIT.md failure point for this fix):
[paste the matching Step N entry from Part B]

REUSABLE ATOMS in the prototype (prefer over inventing new code):
[main thread populates from a quick grep — e.g. renderSectionPreview,
statusLabel, personName, findIssue, banner, closeModal, render,
escapeHtml]

CONSTRAINTS:
- old_string must match exactly (whitespace + line breaks).
- Prefer one larger patch over many small ones for the same fix.
- For new render blocks, include surrounding context in
  old_string + new_string so Edit applies unambiguously.
- No new dependencies. Use only what's imported.
- No prose narration. Just PATCH_OPS + one sentence.
```

Main thread collects the N JSON blobs. Do not parse-and-narrate them
in the chat; just hold them for Stage 5.

### Stage 5 — Apply + check (~30s)

1. **Apply (serial).** Loop over `PATCH_OPS` in fix-priority order.
   For each fix, call its `Edit` ops in order. Hold any errors.
2. **Single `node --check`** at the end:
   - Single-HTML prototype: extract inline `<script>` and run
     `node --check /tmp/peer-ai-script.js`.
   - Framework: run `npm run build`.
3. **If syntax check passes** → append "Fixes applied" section to
   `UX-AUDIT.md`:

```markdown
## Fixes applied

### Fix 1 — [name]
- Status: APPLIED
- File(s): [paths] · Edits: N
- Patch summary: [one sentence from sub-agent]
```

4. **If syntax check fails** → identify the offending fix by undoing
   fixes in reverse priority order and re-running `node --check`
   after each undo. The fix whose undo restores compilability is the
   bad one. Mark it FAILED with the syntax-check error excerpt;
   leave the others APPLIED. Append the "Fixes applied" section
   reflecting actual state.
5. **Stale `old_string`** during apply → mark that fix FAILED with
   the conflict snippet, leave the partial edits in place (the
   following fixes proceed). Note: this is rare in practice; lo-fi
   prototypes' inline patches usually don't overlap.

End the skill.

## Optional flags

### `--static` (+1–2 min): adds a 4-agent parallel Part A

Spawn 4 `Explore` agents in one tool-call batch **before Stage 2**:

1. **Agent-state coverage** — score the 13 states from
   `/agent-states` against the prototype source (Present / Partial /
   Missing / N/A) with file:line citations.
2. **Success-metric coverage** — for each PRD metric, find the UI
   moment that proves or disproves it; cite `file:function`.
3. **Missing fallbacks + slop check** — agent decisions without
   wired fallbacks; grep for AI-slop patterns ("Get started,"
   "Discover," lorem ipsum, generic empty states).
4. **Build/runtime sanity** — `npm run build` or `node --check`;
   route 200 sweep with console-error report.

Write Part A to `UX-AUDIT.md` before the walkthrough starts. The
walkthrough then proceeds normally.

### `--verify` (+1–2 min): adds a scoped re-walk after Stage 5

After Stage 5, navigate via Playwright MCP only to the failure-point
screens captured in Stage 2 (not the full walk). For each fix:
1. Navigate to the screen named in "Screen + element."
2. Read visible text post-action.
3. Compare to the fix's "target" string. Status: PASS / PARTIAL /
   FAIL with the literal missed substring listed.
4. Screenshot the post-fix state to `./audit-screenshots/`.

Append the re-verification result to each fix's entry in the
"Fixes applied" section.

### `--edges` (+1–2 min): robustness-focused edge case sweep

Default flow tests one edge case in step 6. `--edges` extends the
walkthrough cap to 12 steps and dedicates the **last 6 steps** to
edge-case probes — one per category (empty / error / stress /
permission / data / temporal) drawn from PRD Section 21.

For each edge-case step:
1. Force the prototype into the named state via `?state=<name>`.
2. `playwright_get_visible_text` + screenshot.
3. Compare against Section 21's "Expected behavior" column. Status:
   PASS / PARTIAL / FAIL.

Append per-edge-case PASS/FAIL to the audit doc under a new
`### Edge-case verification` subsection. If any edge case is FAIL,
queue a fix for it in Stage 3 alongside the JTBD-friction fixes.

Use when the user wants a robustness-focused audit (e.g., before
a stakeholder demo). Most demo days don't need this.

### `--no-fix`: stop after Stage 2 (audit-only)

Default flow runs through Stage 5. `--no-fix` truncates after the
walkthrough Part B is written. No synthesis, no patch agents, no
edits. Use when the user wants signal without code changes.

### `--max-steps N`: override the 6-step walkthrough cap

Default is 6. Acceptable range 4–12. Above 12, push back: the
walkthrough should be JTBD-focused, not exploratory; if 12 isn't
enough, the JTBD is probably too broad for one run.

### `--start-server`: spawn dev server before Stage 1 preflight

For framework prototypes. Runs `npm run dev` in the background and
waits for the expected port to respond before proceeding.

## Parallelism budget

Default flow spawns **3–5 sub-agents in 1 batch** (Stage 4 only).

With `--static`: adds a second batch of 4 Explore agents before
Stage 2. Maximum 9 sub-agents total, in 2 batches.

Each batch is **one assistant message with N tool uses**. Never
sequential. Sub-agents do not spawn sub-agents.

## Patch-conflict handling

- **Stale `old_string`**: mark that fix FAILED, log the conflict,
  continue with remaining fixes.
- **Two fixes touch the same lines**: apply in fix-priority order;
  the second's `old_string` won't match if the first changed it;
  flag the second as FAILED with "manual reconciliation required."
- No auto-rebasing. Skip-and-log is the right time/risk trade-off.

## Anti-slop scan

Reject any audit or fix description containing:
- "Consider improving" / "May benefit from" / "Could be enhanced"
- "Provides good UX" / "Generally works well"
- "The flow makes sense" / "The flow feels off"
- Any vague approval or vague criticism

Every line of the audit must be a concrete pass or a concrete fail
with a citation. Every fix must specify exact UI surface and exact
target behavior.

## Pre-exercise setup checklist

- [ ] Playwright MCP loaded — `mcp__playwright__playwright_navigate`
  is in the available tool list. If not:
  `claude mcp add playwright "npx @executeautomation/playwright-mcp-server"`
  then reload Claude Code.
- [ ] Chromium preheated — first invocation downloads ~150MB. Do this
  **before** exercise day by navigating to `https://example.com`
  once in a throwaway session.
- [ ] Prototype reachable — `file://` path opens in Chrome/Safari, or
  framework dev server is running on the expected port.
- [ ] PRD + JOURNEY (or persona + JTBD) ready as files or pasted
  into the conversation.

## Composes with

- **Upstream**: `/paper-react` or `/build-lofi` produced the
  prototype.
- **Reference**: `/agent-states` is loaded by `--static` Stage 2.1
  for agent-state coverage scoring.

## Out of scope

- IA / architectural redesign (use `/build-lofi`).
- Cross-file refactors touching > 3 files.
- Persisting state between sessions.
- Style/color/typography polish unrelated to JTBD friction.
