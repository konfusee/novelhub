---
title: "Plan: moderator approval and AI evidence pipeline"
date: 2026-10-29
summary: "Hard+advice plan for moderation API, OpenAI/mongot evidence worker, moderator UI, shared-env rollout"
---

# Plan: moderator approval and AI evidence pipeline

## Context
NovelHub had no moderator decision API, no AI pipeline (evidence batches stuck at `validated`), and mock moderator pages. Shared MongoDB was upgraded to 8.3.13 with mongot earlier the same day; `$vectorSearch` verified.

## Plan
`plans/261029-0745-moderation-review-and-ai-evidence/` — 4 phases, 51 tasks, handover format (`--advice`), each phase with a binding Failure Protocol.
1. Review lifecycle + decision API (claim TTL 24 h, approve/reject, reject unlocks with a fresh draft, in-app notification).
2. AI evidence worker (OpenAI text-embedding-3-small, `$vectorSearch` outside transactions, gpt-6-luna low effort, strict JSON), budget ledger (`AI_BUDGET_USD=3`), worker flag off by default, rollback script, plan-based backfill.
3. Moderator frontend on the real API.
4. Shared-env rollout: create-only indexes, backfill, real smoke that must produce a vector match.

## Decisions / gotchas
- Every teammate backend points at the shared DB, so workers must be opt-in (`AI_EVIDENCE_WORKER_ENABLED=false`).
- Removing the AI-deferred release bypass makes the worker the only path out of `validated`; `ai:fail-pending` is the rollback.
- `$vectorSearch` cannot run inside a multi-document transaction (error 263); missing index returns empty results, so readiness is required.
- `db:sync-indexes` can drop teammates' indexes on the shared DB; use diff + create-only.
- All four candidate small LLMs from research are deprecated soon; gpt-6-luna is available on the key.
- User deferred decision e-mail (in-app only).

## Next
`/ak:cook plans/261029-0745-moderation-review-and-ai-evidence/plan.md --advice`

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
