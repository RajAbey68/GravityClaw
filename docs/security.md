# Security

## Default Controls
- Telegram user whitelist enforced (`TELEGRAM_ALLOWED_USER_IDS`).
- Secrets loaded from `.env` only.
- Iteration and round caps enforced (`GC_MAX_ITERATIONS`, `GC_MAX_GROUP_ROUNDS`).
- Risk-checked tool execution policy with confirmation gate for elevated/dangerous tools.
- Forge promotion requires explicit manual approval.

## Sandboxing and Modification Safety
- Dangerous tool execution is gated by policy + confirmation.
- Forge sandbox validation runs before formalization.
- Unreviewed generated code never executes outside sandbox.
- Autonomous file writes generate audit records and diff artifacts.

## Auditability
- Runtime/tool/provider events persist in SQLite.
- Forge jobs and artifacts persist with stage and status transitions.
- `audit_logs` stores chained-hash entries for tamper-evident change tracking.
- Diff artifacts are written under `data/audit-diffs`.

## Local-First Principles
- No central accounts.
- No multitenant assumptions.
- No hidden outbound telemetry.
- Deployment remains self-hosted friendly (local, VPS, private server, Railway single service).
