# DEVLOG

## 2026-02-21
- Initialized Gravity Claw repository as a clean rebuild architecture.
- Implemented Next fullstack + custom bootstrap server with WebSocket event bus.
- Added Level 1 runtime loop, SOUL context injection, provider abstraction (OpenAI/Anthropic/Gemini), and safe `health-check` tool.
- Added SQLite persistence for sessions, runtime steps, tool events, provider usage, and memory entries.
- Added Telegram long polling adapter with whitelist enforcement and voice response path via ElevenLabs.
- Created Graphite+Teal local control UI with chat, event stream, canvas placeholder, provider settings, and memory inspector.
- Added required docs: `GRAVITY_CONTEXT.md`, `DEVLOG.md`, `DEVELOPER_GUIDE.md`, `SOUL.md`.
- Added governance files: `AGENTS.md`, `AGENT.md`, MIT `LICENSE`.
- Added deployment assets: `Dockerfile`, `docker-compose.yml`, `railway.json`, `.env.example`.
- Added contributor skill scaffold (`skills/gravity-builder`) and runtime prebuilt skill scaffolds.
- Implemented Level 2 memory layer upgrades: SQLite FTS5 table/triggers, memory search API path, context retrieval injection, and compression snapshots.
- Implemented Level 2 memory tools: `memory-search` and `memory-write` with runtime slash command hooks.
- Implemented Level 3 lifecycle upgrades: persistent sub-agent registry, spawn commands, status transitions, and lifecycle events.
- Implemented Level 3 orchestration modes: active delegated routing and group fanout aggregation.
- Upgraded control UI to active multi-agent workbench: dynamic agent tabs, spawn form, mode switching, reusable chat workspaces, and richer universal canvas.
- Clarified and completed Layer 4-6 upgrades: provider failover/health telemetry, confirmation-gated dangerous tools, and namespace-aware memory tiers.
- Added unit coverage for tool confirmation and memory archival behavior.

## 2026-02-22
- Activated Layer 7 Forge pipeline with persisted jobs/artifacts and staged transitions.
- Implemented manual Forge approval/rejection endpoints and dynamic generated-tool registration.
- Added audit + diff logging flow for Forge formalization and approval actions.
- Added `DocSyncService` and wired architecture/change logging hooks.
- Expanded orchestrator to coordinator-round group collaboration with persistent room/message/delegation records.
- Added `/api/canvas/state` with aggregated observability: hierarchy, rooms, usage, forge, calls, and memory-read telemetry.
- Implemented Twilio call control APIs: start outbound call, status callbacks, speech callbacks, and agent handoff.
- Implemented proactive engine with rule persistence (`pattern` + `cron`) and manual trigger endpoint.
- Activated runtime skill loading from `skills/runtime/*`, skill attachment API, and isolated skill bindings.
- Updated context assembly to load SOUL with mtime-aware refresh and ordered section injection.
- Added unit tests for Forge approval flow and call coordinator state routing.
- Verified full project health: `npm run check` and `npm run build` both pass.
- Activated runtime policy settings at execution time:
  - `global.iterationLimit` now caps runtime loop iterations.
  - `global.reflectionEnabled` now toggles self-healing reflection behavior.
  - `global.maxTokenLimit` now enforces per-run token ceilings.
- Activated live settings-to-runtime toggle for proactive engine:
  - `global.proactiveEnabled` now starts/stops scheduled proactive cycles immediately and persists across restarts.
- Added additive real-time config events:
  - `provider.config.changed`
  - `settings.updated`
- Wired provider/settings/memory UI surfaces to live event refresh paths.
- Upgraded Settings operational panels (`Forge`, `Proactive`, `Voice Calls`) to workspace-aware runtime bindings.
- Added workspace-aware filtering/scoping for proactive rules, forge job listing/creation, and call session list retrieval.

## 2026-02-21 (UI OS Expansion)
- Re-architected control UI into full page-based AI OS navigation: `dashboard`, `agents`, `workspace`, `canvas`, `chat`, `skills`, `tools`, `memory`, `profiles`, `providers`, `logs`, `settings`.
- Replaced compact shell with top navigation + workspace selector + collapsible sidebar + persistent client state in `src/ui/state/control-store.tsx`.
- Added WebSocket-driven event state to the shared control store and removed polling from active route-level pages.
- Implemented dedicated route components and page modules under `src/ui/pages/*` for isolated, maintainable feature surfaces.
- Added workspace management APIs and UI controls: create, clone, delete (confirmed), export, and workspace config key/value updates.
- Added dashboard aggregation endpoint `/api/dashboard` with provider usage, cost, memory stats, system resource metrics, forge/delegation summaries, and setup checklist data.
- Expanded memory layer/API with pin/delete/export/metadata support via `memory_annotations` table and enhanced `MemoryRepository`.
- Expanded tools API to support runtime enable/disable and confirmation policy toggles, plus tool execution log retrieval.
- Added profile/SOUL visual editor endpoint `/api/profiles` with safe audited file updates.
- Added provider key management endpoint `/api/providers/keys` with masked key display and redacted audit logging for `.env` updates.
- Added chat room history endpoints for persistent room/message inspection from the chat page.
- Added multimedia generation capability through new `media-generate` tool and `multimedia-creator` runtime skill.
- Hardened build script for constrained environments: `NODE_OPTIONS=--max-old-space-size=4096` and `NEXT_DISABLE_SWC_WORKER=1`.

## 2026-02-21 (Onboarding + Runtime Self-Heal)
- Added interactive onboarding API (/api/onboarding) with actionable setup stages and completion persistence per workspace.
- Added new Onboarding UI page with guided provider key save, provider/model selection, workspace goal setup, sub-agent creation, and security baseline application.
- Wired onboarding into control navigation and dashboard setup links.
- Upgraded runtime reflection from static check to self-healing retry decisions with remediation prompts and aggregated usage tracking across retries.
- 2026-02-21T19:38:58.338Z [tools] Updated tool config for 'memory-write'.
- 2026-02-21T19:39:00.917Z [tools] Updated tool config for 'memory-write'.
- 2026-02-21T19:39:03.519Z [tools] Updated tool config for 'memory-write'.

## 2026-02-21 (Conversation Persistence + Slash Activation)
- Added persistent conversation APIs:
  - `GET/POST /api/conversations`
  - `GET/PATCH/DELETE /api/conversations/[convId]`
  - `GET /api/conversations/[convId]/messages`
- Added `ConversationRepository` into app container for workspace-scoped conversation/message CRUD and search.
- Activated slash command execution in live chat flow through `src/core/interface/chat/dispatch.ts`.
- Wired `/api/chat/send` and `/api/chat/rooms/[roomId]` to:
  - persist user and assistant turns in `conversation_messages`
  - execute slash commands before orchestrator routing
  - return `conversationId`, `clearView`, and `slashCommand` metadata
- Rebuilt `src/ui/pages/chat-page.tsx` to use live conversation APIs for history/sidebar, while preserving WebSocket streaming for runtime output.
