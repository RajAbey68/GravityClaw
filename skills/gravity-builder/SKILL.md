---
name: gravity-builder
description: Build and extend the Gravity Claw local-first agent platform with strict layer boundaries, secure-by-default patterns, and auditable changes. Use when creating providers, tools, runtime loops, memory modules, control UI observability surfaces, or project documentation updates in this repository.
---

# Gravity Builder

## Follow Layer Discipline
- Keep provider-specific logic inside `src/core/providers`.
- Keep orchestration logic inside `src/core/orchestrator` and provider-agnostic.
- Keep runtime loop logic inside `src/core/runtime`.
- Keep policy checks inside `src/core/tools/policy.ts`.
- Keep persistence logic inside `src/core/memory`.

## Implement Safely
- Enforce tool risk checks before execution.
- Preserve Telegram whitelist checks.
- Do not hardcode secrets.
- Record architecture-impacting work in `DEVLOG.md`.

## Build/Verify Workflow
1. Run `npm run typecheck`.
2. Run `npm run test`.
3. Run `npm run lint`.
4. Update `GRAVITY_CONTEXT.md` and `DEVELOPER_GUIDE.md` when architecture changes.

## Reusable References
- Read `references/module-map.md` for module boundaries and extension points.
