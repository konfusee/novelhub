---
title: "NovelHub Requirements-to-Database Working Plan"
description: "Iteratively reconcile NovelHub requirements, stabilize the domain and MongoDB design, then build the shared monorepo foundation."
status: draft-for-review
priority: P1
effort: iterative
tags: [backend, database, api, auth, critical]
created: 2026-10-07
branch: TBD
blockedBy: []
blocks: []
---

# NovelHub Requirements-to-Database Working Plan

## Overview
This is the persistent NovelHub requirements-to-database work plan. The team will refine requirements into a reviewed domain model and MongoDB design before creating the backend and frontend foundation. The repository now contains a curated `docs/` baseline and draft Phase 2–5 artifacts; none is accepted yet.

All business rules are confirmed. The only remaining items are:
- TTS provider selection.
- Team acceptance/process gates.
- Local tooling prerequisites.

Owners and safe treatment are in the
[decision record](../../docs/decision-log.md#deferred-technical-selection-and-process-gates).
The current checkpoint is review of the requirements baseline, domain,
logical-design, and red-team drafts, not implementation approval.

## Current checkpoint

- Read [`docs/README.md`](../../docs/README.md), [`docs/requirements-baseline.md`](../../docs/requirements-baseline.md), and [`docs/decision-log.md`](../../docs/decision-log.md) as the portable team contract.
- Review [`phase-02-domain-model.md`](./phase-02-domain-model.md) and [`phase-03-mongodb-logical-design.md`](./phase-03-mongodb-logical-design.md) against the baseline.
- Use [`phase-04-database-review.md`](./phase-04-database-review.md) to record the five-person team's freeze decision. Phase 5 remains blocked until that decision is explicit.

The repository contains no application foundation yet. This plan does not authorize Mongoose schemas or backend/frontend bootstrap until the Phase 4 gate passes.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Freeze the requirements authority and traceability rules for implementation. | P1 |
| 2 | Produce a domain model with explicit invariants, lifecycle states, and ownership boundaries. | P1 |
| 3 | Produce a reviewable MongoDB design with collections, references, indexes, transaction boundaries, and failure behavior. | P1 |
| 4 | Record confirmed decisions and remaining technical/process gates without inventing business rules. | P1 |
| 5 | Build the shared local-development foundation only after the database design gate passes. | P1 |

## Scope Contract

### Outcome

A reviewed, traceable requirements-to-database plan that the five-person team can use to build the NovelHub monorepo without destabilizing foundational data decisions.

### Constraints

- Five-person team using GitHub.
- Local development first; deployment is a later plan.
- Direct `backend/` and `frontend/` subprojects.
- Backend uses Node.js, Express, MongoDB, and MVC/service boundaries.
- Frontend is static React and must not contain provider secrets.
- MongoDB replica-set transactions are required for cross-document financial and moderation invariants.
- The repository is shared through GitHub and MUST contain a concise, self-contained `docs/` directory. External requirement files are source material for curating the repository baseline, not runtime dependencies. The plan MUST NOT contain links to machine-specific paths or require `../docs` to be available to other team members.
- User-confirmed decisions override stale source wording. A per-Author negotiated
  rate overrides the configurable 70% Author/30% platform default; Author share
  rounds down. A universal fixed rate is not authority.

### Non-goals

- Implementing application code before the design gates pass.
- Blindly copying external requirements, diagrams, or local paths into the repository.
- Final deployment configuration.
- Adding product policy beyond the confirmed decisions in `docs/decision-log.md`.
- Treating provisional ERD diagrams as an executable schema.

### Repository Documentation Boundary

- `docs/README.md` explains the in-repository documentation set and editing rules.
- `docs/requirements-baseline.md` is the concise implementation contract.
- `docs/decision-log.md` records confirmed decisions, proposed technical design,
  and remaining technical/process gates.
- Detailed working plans remain under `plans/`.
- Diagrams are included only when they clarify a current contract; legacy or conflicting diagrams are not copied as authoritative.
- Every copied requirement MUST be reconciled, summarized, and traceable to its source section or requirement ID.

### Foundation Gate

The monorepo foundation MUST NOT begin until the curated requirements baseline and reviewed database design are accepted by the team.

### Acceptance Criteria

- Every planned collection and relationship traces to one or more requirement IDs or is explicitly marked as a design decision.
- Every cross-document invariant has a proposed enforcement mechanism.
- Each remaining item listed above has an owner and safe treatment in the decision log.
- The database design includes lifecycle states, uniqueness rules, indexes, transaction boundaries, audit behavior, and failure handling.
- A red-team review records and resolves schema risks before foundation implementation starts.
- The foundation phase has a clear database contract and does not re-open settled decisions accidentally.
- A new team member can understand the current product boundary from `docs/` without access to the external source directory.
## Phases

| # | Phase | Status |
|---|------|--------|
| 1 | [Requirements Baseline and Traceability](./phase-01-start.md) | draft-for-review |
| 2 | [Domain Model and Invariants](./phase-02-domain-model.md) | draft-for-review |
| 3 | [MongoDB Logical Design](./phase-03-mongodb-logical-design.md) | draft-for-review |
| 4 | [Database Design Review and Freeze Gate](./phase-04-database-review.md) | draft-for-review |
| 5 | [Shared Local Foundation](./phase-05-shared-foundation.md) | draft-for-review; blocked until Phase 4 |

## Success Criteria

- [ ] The team can identify which source controls each requirement and how conflicts are resolved.
- [ ] The in-repository `docs/` set is concise, self-contained, and free of machine-specific links.
- [ ] Domain ownership and lifecycle state machines are documented before schema implementation.
- [ ] The MongoDB design is reviewable independently of application code.
- [ ] Database review explicitly covers duplicate operations, stale writes, partial provider failures, and unauthorized access.
- [ ] Foundation work starts only after the database freeze gate is accepted.
## Working Rules

- This plan is a draft and may be amended after each review round.
- A changed requirement MUST update the affected traceability, domain, and schema sections before implementation resumes.
- A schema decision MUST include its rejected alternative and the reason it was rejected when the choice is material.
- No team member starts a domain implementation from an unreviewed collection design.