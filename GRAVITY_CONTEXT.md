# GRAVITY_CONTEXT

## Current State
- Phase: Layer 7 + full multi-agent collaboration + voice call routing + proactive engine active.
- Stack: Next.js fullstack with custom Node bootstrap, WebSocket event bus, and SQLite persistence.
- Deployment targets: local machines, private servers, VPS, and Railway single-service deployment.
- UI mode: full control-panel architecture with page isolation and workspace-aware state.

## Layer Status
1. Interface Layer
- Telegram long polling with strict whitelist enforcement.
- Local control UI (Graphite+Teal) with page-based navigation and WebSocket live telemetry.
- Voice interfaces: ElevenLabs TTS, OpenAI STT path, Twilio call webhooks.

2. Orchestrator Layer
- Direct, delegated, and coordinator-round group modes.
- Persistent collaboration rooms and room messages.
- Delegation task persistence and lifecycle events.
- Provider-agnostic orchestration boundaries maintained.

3. Runtime Layer
- SOUL-loaded context assembly with mtime-aware refresh and ordered sections.
- Runtime skill prompt injection per agent.
- Iterative loop, tool command execution, self-healing reflection retries, and bounded iteration limits.
- Runtime policy keys are now active at execution time (`global.iterationLimit`, `global.reflectionEnabled`, `global.maxTokenLimit`).

4. Provider Layer
- Unified OpenAI/Anthropic/Gemini abstraction.
- Health telemetry and failover policy persisted in settings.

5. Tool Layer
- Global registry with risk policy and confirmation gate.
- Sandboxed timeout execution and dangerous path constraints.
- Dynamic generated-tool registration supported after Forge approval.
- Multimedia generation tool (`media-generate`) active for script/image/audio/storyboard workflows.

6. Memory Layer
- SQLite + FTS5 RAG retrieval.
- Short-term, long-term, archival, and compressed context.
- Namespace isolation strategy for sub-agent memory.
- Memory annotations enabled (pin + metadata + export/delete actions).
- Conversation persistence enabled through `conversations` and `conversation_messages` tables.

7. Forge Layer
- Full staged pipeline: analyze -> research -> generate -> sandbox-test -> formalize -> register -> logged.
- Manual approval required for promotion.
- Artifact persistence and audit logging integrated.

## Active Governance Services
- `AuditService`: chained-hash audit records and diff artifacts under `data/audit-diffs`.
- `DocSyncService`: structured updates to `DEVLOG.md` and architecture notes.
- Provider secret updates use redacted audit records (no secret value persisted in logs/diffs).

## Voice + Calls
- Outbound Twilio call sessions are persisted.
- Call control handoff between agents is active.
- Speech turns can route into orchestrator and return TwiML responses.

## Proactive Engine
- Pattern and cron rule definitions are persisted.
- Manual and scheduled proactive cycles execute bounded orchestrator tasks.
- Proactive task events are emitted to observability stream.
- `global.proactiveEnabled` setting now toggles scheduled engine execution live and survives restart.

## Live Config Events
- `provider.config.changed` emitted on provider/failover/key updates.
- `settings.updated` emitted on global settings writes.
- `memory.write` emitted for UI pin/delete operations to keep live memory views synchronized.

## Constraints
- Local-first and self-hosted by design.
- No SaaS multitenancy assumptions.
- Secrets remain `.env` only.
- Dangerous/self-modifying actions require explicit audit and approval gates.

## UI Navigation Surface
- `/dashboard`: system KPIs, provider/cost summaries, memory usage, sub-agent tree, forge/delegation snapshots.
- `/onboarding`: guided conversational setup for providers, security baseline, and first sub-agent creation.
- `/agents`: agent hierarchy, detail inspector, sub-agent visual editor, provider/tool/skill assignment.
- `/workspace`: workspace CRUD, clone/export, scoped config management.
- `/canvas`: live execution telemetry, timeline scrubber, hierarchy graph, delegation chains, heatmap.
- `/chat`: direct/delegated/group chat with traces, tool badges, room history.
- `/chat`: now backed by persistent conversation history APIs with slash-command palette and conversation sidebar.
- `/skills`: enable/disable, metadata edits, code/log viewing, binding assignment/removal.
- `/tools`: runtime config toggles, confirmation queue, tool execution logs.
- `/memory`: search/filter, pin/delete/export, embedding metadata inspection.
- `/profiles`: SOUL section editor with live raw preview.
- `/providers`: provider selection, failover toggles, masked API key management.
- `/logs`: tabbed/filterable system + agent + tool + forge + delegation + audit streams.
- `/settings`: global limits/policies with forge/proactive/call operational panels.

## Workspace-Aware Operations
- Forge jobs are now created/listed with workspace-scoped agent identifiers.
- Proactive rules are listed by workspace through `pattern.workspaceId`.
- Voice call list endpoint supports workspace filtering via session context.
- Conversation listing/search/persistence are workspace scoped (`/api/conversations`).

## Automated Updates
- 2026-02-21T19:39:03.519Z [tools] Updated tool config for 'memory-write'.
- 2026-02-21T19:39:00.917Z [tools] Updated tool config for 'memory-write'.
- 2026-02-21T19:38:58.338Z [tools] Updated tool config for 'memory-write'.
- 2026-02-21T00:00:00.000Z [bootstrap] Layer 7 activation finalized with forge, call routing, proactive rules, and runtime skills.
- 2026-02-21T13:55:00.000Z [ui] Full control-panel route architecture activated with workspace-aware state, visual editors, and live telemetry pages.
