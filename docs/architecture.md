# Architecture

Gravity Claw follows a seven-layer local-first architecture:
1. Interface (`telegram`, `web-ui`, `websocket`, `voice`)
2. Orchestrator (routing, lifecycle, delegation, coordinator rounds)
3. Runtime (SOUL-aware context, skill injection, iterative loop, reflection)
4. Provider abstraction (OpenAI/Anthropic/Gemini)
5. Tool layer (registry, policy, confirmation, sandbox)
6. Memory layer (SQLite + FTS5 + collaboration/call/forge/proactive repositories)
7. Forge (autonomous generation pipeline with manual promotion gate)

## Layer 2-3 Active
- Persistent agent lifecycle and sub-agent spawning.
- Direct/delegated/group modes with room persistence.
- Coordinator-round group collaboration with bounded rounds.
- Delegation tasks and room messages stored in SQLite.

## Layer 4-6 Active
- Provider abstraction with failover + health telemetry.
- Tool policy gates and dangerous confirmation pipeline.
- Memory tiers (short-term, long-term, archival, compressed) with FTS retrieval.

## Layer 7 Active
- Forge jobs and artifacts persisted in database.
- Real stage transitions: analyze, research, generate, sandbox-test, formalize.
- Manual approval endpoint required before registration.
- Generated tools loaded at startup from promoted manifests.
- Audit and diff tracking integrated for autonomous writes.

## Voice + Proactive
- Twilio outbound call sessions + agent handoff.
- Speech callbacks route through orchestrator and return TwiML.
- Proactive rule engine supports `pattern` and `cron` triggers.

## Control Plane
- Universal Canvas consumes `/api/canvas/state` and renders:
  - agent hierarchy graph
  - active rooms
  - tool/cost/memory metrics
  - forge and call activity

The orchestrator never calls provider-specific APIs directly.
