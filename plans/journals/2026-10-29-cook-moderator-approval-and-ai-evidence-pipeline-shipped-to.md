---
title: "Cook: moderator approval and AI evidence pipeline shipped to shared dev"
date: 2026-10-29
summary: "4 phases implemented, live smoke passed, 0.0018 USD spent"
---

# Cook: moderator approval and AI evidence pipeline shipped to shared dev

## What shipped (uncommitted, branch main)
Plan `plans/261029-0745-moderation-review-and-ai-evidence/` executed under `--advice`, kongming gate after each phase.
- P01 moderator API: queue/claim(24 h)/release/approve/reject, reject creates fresh draft, in-app notification, legacy AI-deferred release bypass removed.
- P02 AI worker: text-embedding-3-small + `$vectorSearch` (outside tx) + gpt-6-luna strict JSON; flag-gated (default off), persisted cost ledger, `ai:fail-pending` rollback, plan-based backfill.
- P03 moderator UI on real API (fail-closed "no findings" state, 50-finding disclosure).
- P04 shared DB: create-only indexes, `embedding_vectors` READY, 29 revisions backfilled, live smoke PASSED (5 findings, maxScore 1.00), spend 0.00176656 / 3 USD.

## Gate catches worth remembering
- `OPENAI_CUSTOM_HEADERS` / `OPENAI_ADMIN_KEY` are read from the shell by openai 7.x and can override auth — blocked/nullified.
- Voluntary lease release had no attempt cap → fixed at 3.
- UI would have shown "no similarity" for a failed comparison → fail-closed helper.
- Mongoose autoCreate made "read-only" diff/preflight scripts create collections → disabled before connect.
- Smoke notification count was not repeat-safe with reused accounts → scoped to run.

## Residual
Runner stopped (forced kill on Windows skips graceful shutdown); new submissions wait in `validated` until a designated runner resumes. Smoke content remains on the shared dev DB. `StoryManagerPage` test is load-sensitive.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
