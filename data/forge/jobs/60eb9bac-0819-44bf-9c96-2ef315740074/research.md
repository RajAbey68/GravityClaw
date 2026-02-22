Forge Research

Capability: prepare outbound status digest

Timestamp: 2026-02-21T12:05:14.439Z

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
﻿# Architecture

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


## docs/security.md
﻿# Security

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
