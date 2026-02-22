# API Endpoints

## Runtime and Agents
- `POST /api/chat/send` -> run an agent turn.
  - body: `{ agentId, message, mode, chatId, roomId?, roundLimit?, coordinatorId? }`
  - `mode`: `direct | delegated | group`
- `GET /api/agents` -> list agents.
- `POST /api/agents` -> create sub-agent.

## Providers and Tools
- `GET /api/providers` -> provider list + current selection + failover status.
- `POST /api/providers` -> set provider/model and/or failover.
- `POST /api/providers/keys` -> update provider API key in `.env` with masked response.
- `GET /api/tools` -> tool list + pending confirmations.
- `POST /api/tools` -> execute tool or approve pending confirmation.

## Memory
- `GET /api/memory` -> list entries.
- `GET /api/memory?q=<query>&namespace=<optional>&kinds=<csv>` -> FTS search.

## Canvas and Observability
- `GET /api/canvas/state` -> hierarchy graph, active rooms, forge jobs, calls, usage metrics, memory-read counts, event snapshots.
- `GET /api/events/ws` -> websocket metadata endpoint.
- WebSocket path: `/api/events/ws`.

## Forge
- `GET /api/forge/jobs?workspaceId=<id>` -> list forge jobs scoped to workspace.
- `POST /api/forge/jobs` -> create forge job `{ capability, agentId, workspaceId?, trigger? }`.
- `POST /api/forge/jobs/[jobId]/approve` -> approve + promote generated tool.
- `POST /api/forge/jobs/[jobId]/reject` -> reject forge job.
- `GET /api/forge/jobs/[jobId]/artifacts` -> list artifacts and metadata.

## Skills
- `GET /api/skills?workspaceId=<id>&agentId=<id>` -> list registered skills, bindings, and active prompts for agent.
- `POST /api/skills/attach` -> attach `{ agentId, skillId, mode }` where mode is `shared` or `isolated`.

## Voice and Calls
- `GET /api/voice/status` -> adapter status + active call count.
- `GET /api/voice/calls?workspaceId=<id>` -> list call sessions scoped by workspace context.
- `POST /api/voice/calls` -> start outbound call `{ toNumber, agentId, objective, workspaceId? }`.
- `POST /api/voice/calls/[callId]/handoff` -> transfer call control `{ toAgentId }`.
- `POST /api/voice/twilio/status` -> Twilio status callback.
- `GET/POST /api/voice/twilio/speech` -> TwiML speech gather loop + speech turn processing.

## Proactive Engine
- `GET /api/proactive/rules?workspaceId=<id>` -> list proactive rules and last runs for workspace scope.
- `POST /api/proactive/rules` -> create rule (`pattern` or `cron`).
- `POST /api/proactive/run` -> trigger proactive cycle manually.

## Settings and Profiles
- `GET/POST /api/settings` -> global runtime/security settings (`iteration`, `reflection`, `token limit`, `proactive`, confirmations).
- `GET/POST /api/profiles` -> SOUL section read/write with audited file update.

## Telegram
- `GET /api/telegram/poll` -> polling status.
- `POST /api/telegram/poll` -> start/stop polling.

## Docs
- `GET /api/docs/{name}` where `{name}` in:
  - `DEVLOG.md`
  - `GRAVITY_CONTEXT.md`
  - `DEVELOPER_GUIDE.md`
  - `SOUL.md`

## Onboarding
- `GET /api/onboarding?workspaceId=<id>` -> onboarding progress, pending steps, and setup prompt.
- `POST /api/onboarding` -> apply onboarding actions (`set-workspace-goal`, `set-provider-default`, `apply-security-baseline`, `create-sub-agent`, `complete-onboarding`).

