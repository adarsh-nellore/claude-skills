# Narrative conventions

Voice rules per mock-data field. The MockContract spec emission step
applies these to seeded `notes` per entity. The entity-value-fill
agents in Beat 3 then have explicit guidance on what each field's
prose should read like.

Why this exists: v5 entity agents filled `auditLog.summary` with
mechanical templates like "user_assigned_owner — assigned X". v3 had
the same field as "Shreya Varma assigned PFS co-primary endpoint
conflict to David Kim, Module 5.3.5.1, due 2026-05-19". The difference
is convention, not capability.

This doc defines the conventions agents must follow.

---

## Entity-level voice rules

### `auditLog.summary`

**Convention**: full sentence. Names the actor by first + last name.
References any FK by readable label (resolve user id to name, section
id to module code + title, submission id to product name).
Includes a deadline or timestamp when relevant.

✅ "Shreya Varma assigned the PFS co-primary endpoint conflict to
   David Park, Module 5.3.5.1, due 2026-05-19."
✅ "Agent flagged Module 3.2.P.5 (Velatinib drug product) as
   material impact under EMA guidance EMA-2026-Q4 published
   May 2."
✅ "Decision lock: Maria Lopez approved 'amend before filing' for
   ii-003 on 2026-05-12, requiring post-filing review."

❌ "user_assigned_owner — assigned a conflict"
❌ "Agent surfaced a stability data conflict"
❌ "Shreya Varma confirmed material impact"   ← FK never named

### `submissions.name`

**Convention**: product name + dose + formulation + submission type.
Reads like an actual eCTD title.

✅ "Velatinib 200mg Capsules: NDA"
✅ "Pirfenidox 267mg Tablets: MAA Type II Variation"
✅ "Trilaciclib Sodium 240mg/vial: sBLA"
✅ "Nintedanib Esylate 150mg Capsules: Line Extension MAA"

❌ "Velatinib NDA"   ← missing dose + formulation
❌ "Submission 1"    ← placeholder
❌ "Velatinib — NDA" ← em dash banned

### `submissions.indication`

**Convention**: for oncology, include subtype / line / genotype. For
non-oncology, include severity / patient population.

✅ "Non-small cell lung cancer, EGFR exon 19 deletion, first-line"
✅ "Idiopathic pulmonary fibrosis, severe (DLCO <40%)"
✅ "Extensive-stage small cell lung cancer, post-platinum"

❌ "Lung cancer"
❌ "IPF"

### `decisionRecords.rationale`

**Convention**: 1-2 sentences. Cites the regulatory standard. Names
the assessor or section owner. References the impact item by what
it actually covers (not just by id).

✅ "Material impact confirmed under ICH E9 §3.4 (estimands).
   The pivotal study's primary endpoint of overall response rate
   no longer satisfies the Agency's preference for progression-free
   survival as the co-primary in advanced solid tumors. Maria Lopez
   approved amendment before filing."

❌ "Material impact. Amend."

### `decisionRecords.questionsForEscalation`

**Convention**: when the decision is `escalate_to_legal` or
`escalate_to_medical`, this field MUST contain 2-3 specific questions
that read like real escalation memos.

✅ "Does the FDA's revised draft guidance on companion diagnostics
   create a regulatory obligation to amend our IVD device
   submission timeline? Should legal review the indemnification
   clauses in our partnership with Bio-Rad?"

❌ "Need legal review."

### `guidanceEvents.title`

**Convention**: ≤80 chars. Reads like an actual FDA or EMA title
(check fda.gov/regulatory-information for tone reference).

✅ "Draft Guidance for Industry: Oncology Clinical Trials in Patients
   with Brain Metastases"   ← real FDA pattern
✅ "EMA Reflection Paper on Patient Experience Data in Regulatory
   Decision-Making"
✅ "Guidance for Industry: Clinical Lactation Studies — Considerations"

❌ "New oncology guidance"
❌ "FDA updated something"

### `changedExcerpts.excerptText`

**Convention**: 1-2 sentence quote from a plausible FDA or EMA
guidance. Use regulatory voice ("Sponsors should...", "Applicants
must...", "The Agency recommends...").

✅ "Sponsors should include a pre-specified subgroup analysis of
   patients with central nervous system metastases in pivotal
   Phase 3 studies of agents with CNS-penetrant properties."

❌ "We changed the requirement for clinical trials."

### `changedExcerpts.agentSummary`

**Convention**: 1 sentence describing what changed and why it
matters for regulatory submissions. Names the section / topic.

✅ "PFS now required as a co-primary endpoint in oncology pivotal
   trials when the indication includes advanced or metastatic
   disease."

❌ "Endpoint requirements updated."

### `impactItems.agentRationale`

**Convention**: 1-2 sentences. Names the specific section being
affected. Cites the change-type from the excerpt. Reasons about
the submission's deadline pressure.

✅ "Module 5.3.5.1 of Velatinib's NDA describes overall response
   rate as the sole primary endpoint. The May 2 draft guidance
   now positions PFS as a required co-primary for advanced
   solid tumor indications; the submission's June 7 filing
   deadline does not allow a Phase 3 amendment, so the most
   likely outcome is filing an amendment before submission."

❌ "Material impact. Affects efficacy."

### `assessments.notes`

**Convention**: 1-2 sentences. Regulatory voice. Reasons about
why the verdict was reached, with specific reference to the
section content.

✅ "Verdict: material. The protocol's exclusion of patients with
   CNS metastases is incompatible with the new FDA guidance's
   expectation of explicit subgroup analysis. Amendment recommended."

❌ "Material impact."

### `users.title`

**Convention**: full job title with org context. Reads like a real
corporate signature line.

✅ "Director, Regulatory Affairs (Global Submissions)"
✅ "Senior Manager, CMC Regulatory"
✅ "Principal Medical Writer, Clinical Writing"

❌ "Director"
❌ "RA Director"   ← role abbreviation, not title

---

## Field-class conventions (apply when the entity has these fields)

Any field named `summary`, `rationale`, `notes`, `excerptText`,
`agentRationale`, `agentSummary`, `description` → MUST follow the
"full sentence" rule (named entity + FK ref where applicable +
specific detail, not template language).

Any field named `name`, `title` → MUST be specific (product +
identifier + qualifier), not a placeholder.

Any field named `agency`, `status`, `level`, `tone`, `severity` →
uses ONLY the closed enum from the entity's field definition.

Any optional string field that v5 marked `nullable` → set to empty
string `""` or omit, NEVER `null` (causes TypeScript errors).

---

## How agents apply these

The mock-data scaffold step (`scaffold-mock-data` in
`build-hifi.mjs`) pre-fills these fields with `"TODO: <convention
hint>"` placeholders. E.g.:

```ts
{
  id: "al-001",
  summary: "TODO: full sentence naming actor + FK ref + deadline",
  ...
}
```

Entity-value-fill agents in Beat 3 replace the TODO placeholders
with real values following the convention. The convention hint is
visible in the placeholder itself, so the agent can't miss it.

The narrative-conventions.json sidecar pins exactly which fields
need which convention. The MockContract Beat 1 agent reads this
doc and embeds the convention into each entity's `notes` field so
downstream value-fill agents see it inline.

---

## Validation

The post-Beat-3 quality review samples 10 entries from
`auditLog.happy`, `decisionRecords.happy`, and
`changedExcerpts.happy`. For each entry, asserts:

1. `summary` / `rationale` / `notes` field is a full sentence (≥6
   words, ends with `.` or `?`)
2. Contains at least one capitalized proper noun (named entity)
3. Contains at least one cross-reference matching a known id /
   readable label
4. Does NOT contain "TODO:" (unfilled placeholder)
5. Does NOT contain em dash (`—`)
6. Does NOT contain "lorem ipsum", "placeholder", or "example"

Any entity with > 2 violations fails the quality bar.
