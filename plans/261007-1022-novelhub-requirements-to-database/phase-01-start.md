---
title: "Phase 1: Requirements Baseline and Traceability"
status: draft-for-review
---

# Phase 1: Requirements Baseline and Traceability

## Overview

Curate the external NovelHub materials into a concise, self-contained `docs/` baseline before any database or application foundation work begins.

## Context Links

- Repository documents: `docs/README.md`, `docs/requirements-baseline.md`, `docs/decision-log.md`
- External source filenames used during curation: `novelhub_requirements_spec.md`, `SRS.md`, `SRS-mismatches.md`, `use-case-list.md`, `moderator-use-cases.csv`
- No external local-path links are permitted in committed repository documentation.

## Key Insights

- The accepted target contract identifies roles, domain boundaries, mandatory review ordering, and financial consistency requirements.
- The source set contains stale policies, provisional ERDs, and drifting use-case IDs.
- User-confirmed decisions and the curated repository baseline control implementation; legacy wording remains evidence to reconcile, not an executable contract.

All business rules are confirmed. The only remaining items are:
- TTS provider selection.
- Team acceptance/process gates.
- Local tooling prerequisites.

See the [decision record](../../docs/decision-log.md#deferred-technical-selection-and-process-gates)
for owners and safe treatment.

## Requirements

- [ ] `docs/requirements-baseline.md` states the product boundary, actors, core flows, external systems, security requirements, reliability invariants, and requirement IDs needed for database design.
- [ ] `docs/decision-log.md` separates confirmed decisions, proposed technical
  design, and deferred technical/process gates.
- [ ] The baseline adopts one canonical use-case ID convention and records mappings only where needed.
- [ ] The baseline explicitly rejects stale fixed revenue wording, invented payout approval, and unbounded provider assumptions.
- [ ] Every database-relevant requirement has a traceability entry or an explicit “schema decision required” marker.

## Implementation Steps

1. Extract only current, database-relevant requirements from the source materials.
2. Reconcile conflicts using the authority order recorded in `docs/requirements-baseline.md`.
3. Record actors, ownership, lifecycle states, invariants, and external boundaries.
4. Record deferred technical selection and process gates with lane owners.
5. Review the baseline with all five team members.

- [x] Confirm the in-repository documentation structure.
- [x] Confirm canonical requirement and use-case identifiers.
- [x] Confirm that no document requires the external local source directory.
- [ ] Approve the baseline as the input to domain modeling.

## Success Criteria

- A new contributor can understand the current product contract using only `docs/`.
- Each later database design decision can cite a repository requirement ID or a documented design decision.
- No stale source wording is presented as authority; only the three remaining
  items listed above are deferred.

## Risk Assessment

- **Risk:** Concise documentation loses important constraints. **Mitigation:**
  preserve requirement IDs and the decision log's
  [Reconciliation notes](../../docs/decision-log.md#reconciliation-notes).
- **Risk:** Source documents change outside the repository. **Mitigation:**
  update affected decisions/traceability and re-run this phase when source
  changes are accepted.

## Security Considerations

- Do not copy secrets, provider credentials, private account data, or machine-specific paths into `docs/`.

## Next Steps

After team acceptance, start Phase 2. Do not create Mongoose schemas yet.
