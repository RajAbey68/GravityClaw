Forge Research

Capability: prepare outbound status digest

Timestamp: 2026-02-21T10:37:21.914Z

## features to add.md
| Feature/Enhancement            | Detailed Explanation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :----------------------------- | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## instruction.md
# Gravity Claw — System Initialization Prompt

You are helping me design and build **Gravity Claw**, an advanced autonomous AI agent platform inspired by OpenClaw, but re-architected from scratch with stronger modularity, structured multi-agent orchestration, secure local-first deployment, and a dedicated observability interface.

This is not a fork.
This is a clean architectural rebuild.

---

# Phase 0 — Required Research

Before writing any code:

1. Study OpenClaw’s architectural model and design philosophy.
2. Extract and summarize:
   - Hub-and-spoke gateway model
   - Agent runtime loop
   - Context assembly strategy
   - SOUL.md and workspace configuration roles
   - Tool sandboxing model
   - Memory system
   - Security layering

3. Identify architectural strengths to preserve.
4. Identify structural weaknesses to eliminate.
5. Produce a concise architectural summary before building.

---

# Platform Definition

Gravity Claw consists of:

## 1. External Messaging Surface

- Telegram only
- Long polling only
- No webhooks
- User ID whitelist enforcement
- No public multi-channel gateway

## 2. Internal Control Plane (Web Interface)

Local-only web UI providing:

- Agent tabs
- Sub-agent tree view
- Group chat mode
- Live execution canvas
- Tool invocation logs
- Memory inspection
- Provider selection
- Cost tracking
- Forge activity logs
- Devlog viewer

The web UI is not a SaaS interface. It is a local observability and control dashboard.

---

# Core Architectural Layers

## Layer 1 — Interface Layer

- Telegram Adapter (long polling only)
- Local Web UI (WebSocket to internal event bus)

## Layer 2 — Orchestrator

Responsibilities:

- Route messages
- Inject SOUL.md
- Manage agent lifecy

## docs/architecture.md
# Architecture

Gravity Claw follows a seven-layer architecture:
1. Interface (`telegram`, `web-ui`, `websocket`, `voice`)
2. Orchestrator (routing, lifecycle, delegation, group fanout)
3. Runtime (context assembly, iterative loop, reflection)
4. Provider abstraction (OpenAI/Anthropic/Gemini)
5. Tool layer (registry, policy, sandbox)
6. Memory layer (SQLite + FTS5 + repository model)
7. Forge (self-improvement event scaffold)

## Layer 2 Implemented
- FTS memory retrieval with write-through triggers.
- Query-aware context assembly.
- Memory tools for write/search in runtime.

## Layer 3 Implemented
- Persistent sub-agent lifecycle.
- Delegated mode command parsing and routing.
- Group mode fanout execution.
- Canvas telemetry for hierarchy/delegation.

The orchestrator never calls provider-specific APIs directly.


## docs/security.md
# Security

## Default Controls
- Telegram user whitelist enforced.
- Secrets loaded from `.env`.
- Iteration caps required (`GC_MAX_ITERATIONS`).
- Risk-checked tool execution policy.
- Forge disabled by default.

## Auditability
- Runtime and tool events are persisted in SQLite.
- Provider usage is persisted with token/cost estimate metadata.
- Architecture changes are tracked in `DEVLOG.md`.

## Local-First Principles
- No central accounts.
- No multitenant assumptions.
- No hidden outbound telemetry.
