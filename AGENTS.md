# AGENTS

## Mission
Build and evolve Gravity Claw as a local-first, open-source autonomous agent system.

## Non-Negotiables
- Keep architecture modular by layer.
- Keep secrets local and out of logs.
- Enforce tool policy and auditability.
- Avoid hidden behavior and implicit SaaS assumptions.

## Engineering Standards
- Use strict TypeScript.
- Keep provider-specific logic inside `src/core/providers`.
- Keep orchestration logic provider-agnostic.
- Preserve backwards-compatible contracts in API routes when possible.

## Change Control
- Log architecture-impacting changes in `DEVLOG.md`.
- Update `GRAVITY_CONTEXT.md` when module state changes.
- Document extension points in `DEVELOPER_GUIDE.md`.

## Security Rules
- `.env` only for credentials.
- Never hardcode keys.
- Never bypass Telegram whitelist.
- Require confirmation flow for dangerous tools.

## Self-Modification Guardrails
- Run modifications in sandbox workflows first.
- Record diffs and rationale before promotion.
- Block unreviewed forge outputs from unrestricted execution.
