# DEVELOPER_GUIDE

## Architecture Boundaries
- `src/core/interface/*`: Telegram adapter, WebSocket event bus, voice adapters, and call coordinator.
- `src/core/orchestrator/*`: routing, lifecycle, delegation, room/round coordination. No provider-specific logic.
- `src/core/runtime/*`: context assembly, iterative loop, reflection, runtime tool command handling.
- `src/core/providers/*`: provider adapters and failover routing only.
- `src/core/tools/*`: registry, risk policy, confirmation queue, sandbox execution, generated tool contract.
- `src/core/memory/*`: schema + repositories for sessions/events/memory + forge/audit/collaboration/calls/skills/proactive tables.
- `src/core/forge/*`: autonomous skill generation pipeline and approval workflow.
- `src/core/proactive/*`: proactive rule engine and scheduled/manual execution.
- `src/core/skills/*`: runtime skill synchronization and per-agent bindings.
- `src/ui/state/*`: control-plane client state and shared WebSocket event stream.
- `src/ui/pages/*`: route-isolated UI modules with no core engine logic embedded.

## Active Layer Details

### Layer 4 — Provider Abstraction
- Unified provider contract in `src/core/providers/types.ts`.
- Provider failover and health telemetry in `src/core/providers/provider-registry.ts`.
- Provider configuration API in `app/api/providers/route.ts`.

### Layer 5 — Tool Layer
- Policy decisions: `src/core/tools/policy.ts`.
- Confirmation queue: `src/core/tools/confirmation.ts`.
- Registry execution and confirmation pipeline: `src/core/tools/registry.ts`.
- Dynamic generated tool support: `src/core/tools/generated-tool.ts`.
- Multimedia tool: `src/core/tools/builtins/media-generate.ts`.

### Layer 6 — Memory Layer
- FTS schema and triggers: `src/core/memory/schema.ts`.
- Context retrieval + archival + compression: `src/core/memory/repositories/memories.ts`.
- Room/delegation/call/forge/audit/proactive persistence lives in dedicated repositories.
- Memory annotations table enables pinning + metadata + export/delete API actions.
- Memory mutation APIs emit `memory.write` events for live UI synchronization.

### Layer 7 — Forge Module
- Controller: `src/core/forge/forge-controller.ts`.
- Stages: analyze, research, generate, sandbox-test, formalize, register, logged.
- Manual approval gate via `/api/forge/jobs/[jobId]/approve`.
- Rejection path via `/api/forge/jobs/[jobId]/reject`.

## Multi-Agent Collaboration
- Orchestrator implements direct/delegated/group interaction modes.
- Group mode uses coordinator rounds with bounded round limits.
- Collaboration records are stored in `agent_rooms`, `agent_messages`, and `delegation_tasks`.
- Canvas state API (`/api/canvas/state`) aggregates hierarchy + live usage + forge/call state.
- Chat room APIs (`/api/chat/rooms`, `/api/chat/rooms/[roomId]`) provide persistent room history.
- Chat dispatch layer (`src/core/interface/chat/dispatch.ts`) keeps slash-command execution and conversation persistence outside UI components.

## Voice and Call Routing
- Twilio adapter: `src/core/interface/voice/twilio.ts`.
- Call session coordinator: `src/core/interface/voice/call-coordinator.ts`.
- API endpoints:
  - `POST /api/voice/calls`
  - `POST /api/voice/calls/[callId]/handoff`
  - `POST /api/voice/twilio/status`
  - `POST /api/voice/twilio/speech`

## Proactive Engine
- Engine: `src/core/proactive/proactive-engine.ts`.
- Rule endpoints:
  - `GET/POST /api/proactive/rules`
  - `POST /api/proactive/run`
- Proactive scheduling can now be toggled live through `global.proactiveEnabled` (settings API).
- Proactive rule patterns support workspace scoping via `pattern.workspaceId`.

## Runtime Policy Activation
- Runtime loop now applies persisted settings on every run:
  - `global.iterationLimit`
  - `global.reflectionEnabled`
  - `global.maxTokenLimit`
- Tool confirmation behavior in runtime respects `global.security.requireDangerousConfirmation` for config-gated confirmations.

## Skills Activation
- Filesystem sync from `skills/runtime/*` into `skill_registry`.
- Agent binding API: `POST /api/skills/attach`.
- Runtime prompt injection via `ContextAssembler` skill blocks.
- Skill management API: `GET/POST /api/skills` for metadata updates, code viewing, and detach actions.

## Security Model
- Telegram allowlist enforced (`TELEGRAM_ALLOWED_USER_IDS`).
- Secrets are `.env` only.
- Iteration and round limits enforced (`GC_MAX_ITERATIONS`, `GC_MAX_GROUP_ROUNDS`).
- Dangerous tools require confirmation and policy approval.
- Forge promotion requires explicit manual approval.
- Audit and diff logs are written for autonomous file writes.
- Provider key updates are written to `.env` with redacted audit records (secret values are never logged).

## UI Control Plane Map
1. `app/(control)/dashboard/page.tsx` -> `src/ui/pages/dashboard-page.tsx`
2. `app/(control)/onboarding/page.tsx` -> `src/ui/pages/onboarding-page.tsx`
3. `app/(control)/agents/page.tsx` -> `src/ui/pages/agents-page.tsx`
4. `app/(control)/workspace/page.tsx` -> `src/ui/pages/workspace-page.tsx`
5. `app/(control)/canvas/page.tsx` -> `src/ui/pages/canvas-page.tsx`
6. `app/(control)/chat/page.tsx` -> `src/ui/pages/chat-page.tsx`
7. `app/(control)/skills/page.tsx` -> `src/ui/pages/skills-page.tsx`
8. `app/(control)/tools/page.tsx` -> `src/ui/pages/tools-page.tsx`
9. `app/(control)/memory/page.tsx` -> `src/ui/pages/memory-page.tsx`
10. `app/(control)/profiles/page.tsx` -> `src/ui/pages/profiles-page.tsx`
11. `app/(control)/providers/page.tsx` -> `src/ui/pages/providers-page.tsx`
12. `app/(control)/logs/page.tsx` -> `src/ui/pages/logs-page.tsx`
13. `app/(control)/settings/page.tsx` -> `src/ui/pages/settings-page.tsx`

## Additional API Surface
- `GET /api/dashboard`
- `GET/POST /api/onboarding`
- `GET/POST /api/providers/keys`
- `GET/POST /api/profiles`
- `GET/POST /api/workspaces/[workspaceId]/configs`
- `GET /api/chat/rooms`
- `GET /api/chat/rooms/[roomId]`
- `GET/POST /api/conversations`
- `GET/PATCH/DELETE /api/conversations/[convId]`
- `GET /api/conversations/[convId]/messages`
- Extended `GET/POST /api/tools` for tool runtime config + logs.
- Extended `GET/POST /api/memory` for stats/export/pin/delete.
- `GET /api/forge/jobs?workspaceId=...` for scoped forge views.
- `GET /api/proactive/rules?workspaceId=...` for scoped proactive views.
- `GET /api/voice/calls?workspaceId=...` for scoped call-session views.

## Development Workflow
1. Copy `.env.example` to `.env`.
2. Configure Telegram allowlist and at least one provider key.
3. Optional: enable `FORGE_ENABLED` and/or `PROACTIVE_ENABLED`.
4. Run:
   - `npm install`
   - `npm run dev`

## Verification
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run check` (aggregated lint + typecheck + test)

## Onboarding Flow
- API: `GET/POST /api/onboarding` for interactive setup orchestration.
- UI: `app/(control)/onboarding/page.tsx` with guided provider/security/agent setup actions.
- Onboarding completion state persists in workspace configs (`onboarding.*`).

