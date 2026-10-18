# NovelHub documentation

**Status: DRAFT FOR REVIEW.** This small documentation set is the repository's
team-facing requirements boundary for the accepted requirements-to-database
work. It is intended for the five-person team working in GitHub and locally;
it does not require access to the external source directory.

## Start here

- [Final Author/Admin validation](author-admin-final-validation.md) — current scope and full automated regression results.
- Current Author/Admin implementation status: [Author 02–06](author-02-06-acceptance.md),
  [Author 07–16](author-07-16-acceptance.md), [remaining Admin acceptance](admin-remaining-acceptance.md)
  and [desktop browser acceptance](admin-author-browser-acceptance.md). These records use the
  progress workbook IDs and exclude deferred media/AI; they do not certify production banking/SMTP.
  Feature documents describe individual increments; earlier "remaining" statements must be read
  alongside these later acceptance records.
- [Requirements baseline](./requirements-baseline.md) — the implementation-facing
  product boundary, lifecycle constraints, traceability, and deferred
  technical/process-gate pointers.
- [Decision log](./decision-log.md) — confirmed decisions, proposed technical
  design, and the remaining technical/process gates.
- [Active working plan](../plans/261007-1022-novelhub-requirements-to-database/plan.md)
  — the staged requirements-to-database plan and foundation gate.
- [Phase 1 start](../plans/261007-1022-novelhub-requirements-to-database/phase-01-start.md)
  — the current curation and acceptance checklist.

The detailed domain, MongoDB, review, and foundation phases remain owned by
`plans/` and are linked from the active plan. This README
is navigation, not a second plan or a collection inventory.

## Source material

[`source/`](./source/) holds the original requirement inputs: the requirements
spec (`novelhub_requirements_spec.md`, owner of `FR-*`/`BR-*`/`NFR-*` IDs), the
use-case catalogue (`use-case-list.md`, owner of `UC-*` IDs), the Moderator
use-case CSV, the context and Moderator diagrams, and the scripts that generate
those diagrams. They are kept unchanged as traceability evidence. Where they
disagree with the decision log, the decision log wins. `SRS.md` and
`SRS-mismatches.md` are external working files and are not in the repository.

## Authority and editing contract

1. The accepted target contract and decisions recorded as **confirmed** in
   `decision-log.md` control conflicts. `SRS.md` is the current reconciled
   requirements narrative; `SRS-mismatches.md` records audit findings and
   conflicts; its earlier open policy questions are superseded by confirmed
   decisions. `novelhub_requirements_spec.md` owns the `FR-*` and
   `BR-*` identifiers, and `use-case-list.md` owns canonical `UC-*` identifiers;
   `moderator-use-cases.csv` supplies detailed Moderator goals. Legacy diagrams,
   draft/template material, and stale fixed-rate wording are evidence to
   reconcile, not authority.
2. Keep the baseline concise and traceable. Cite source filenames, headings,
   and requirement/use-case IDs as plain code. Do not add external URLs,
   machine-specific paths, secrets, personal data, or a `links.md` file.
3. State a product rule only when it is a requirement or a confirmed decision.
   Label a technical choice as **Proposed technical design** and keep
   remaining technical/process gates visibly separate; do not turn a proposal
   into a business rule.
4. Code, schemas, manifests, and workflows own executable behavior. These docs
   own the rationale, boundary, navigation, and decisions that implementation
   cannot express. Remove duplicate or superseded prose rather than preserving
   compatibility guidance.
5. Every accepted source change must update the affected traceability and
   decision entry before domain or schema work proceeds. A new requirement
   keeps its existing `FR-*`, `BR-*`, or canonical `UC-*` ID; preserve numbering
   gaps and map drift by goal instead of inventing a replacement convention.
6. All documents in this set remain **DRAFT FOR REVIEW** until the team accepts
   the requirements baseline and the database review/freeze gate. No application
   or monorepo foundation work starts before that gate.

When this route conflicts with a source, record the conflict in the decision
log and baseline rather than silently choosing an implementation assumption.

## Remaining items

All business rules are confirmed. The only remaining items are:
- TTS provider selection.
- Team acceptance/process gates.
- Local tooling prerequisites.

See the [decision record](./decision-log.md#deferred-technical-selection-and-process-gates)
for owners and safe treatment. Draft status is not team acceptance.
