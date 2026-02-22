# OpenClaw Architectural Summary (Phase 0)

## Preserved Strengths
- Gateway-centric policy enforcement before runtime actions.
- Bounded iterative agent loops with explicit completion controls.
- Structured context assembly (system, workspace, memory, task turn).
- Sandboxed/permissioned tool execution patterns.
- Strong observability orientation.

## Weaknesses Addressed in Gravity Claw
- Reduce config sprawl by centralizing environment and state scaffolds.
- Keep strict layer boundaries to avoid gateway over-coupling.
- Track token/cost usage and enforce iteration caps to prevent prompt/cost drift.
- Add explicit audit-first local governance docs (`AGENTS.md`, `DEVLOG.md`).

## Mapping to Gravity Claw
- OpenClaw gateway model -> Gravity orchestrator + interface layers.
- OpenClaw runtime loop -> Gravity runtime loop with reflection and tool gate.
- OpenClaw context model -> SOUL + memory-aware context assembler.
- OpenClaw tool safety -> policy + sandbox timeout + confirmation path scaffold.
- OpenClaw observability -> Graphite+Teal control plane + WebSocket event bus.
