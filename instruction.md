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
- Manage agent lifecycle
- Spawn and manage sub-agents
- Enforce iteration limits
- Coordinate delegation
- Manage group chat mode

No provider logic in this layer.

## Layer 3 — Agent Runtime

Each agent instance contains:

- Unique agent ID
- Memory namespace
- Context assembler
- Iterative reasoning loop
- Reflection loop
- Tool access registry

Sub-agents:

- Inherit tools and skills by default
- Have isolated short-term memory
- Share long-term memory unless explicitly isolated
- Have independent tabs in UI

## Layer 4 — Provider Abstraction

Must support multiple model providers via a unified interface.
Provider logic must be isolated.
No provider-specific logic inside orchestrator.

## Layer 5 — Tool Layer

- Globally registered tools
- Permission-checked execution
- Sandboxed execution environment
- Confirmation required for dangerous operations

## Layer 6 — Memory Layer

Support:

- Short-term working memory
- Long-term structured memory
- Archival memory
- Retrieval-augmented generation
- Context compression
- Sub-agent namespace isolation

## Layer 7 — Forge Module

Autonomous skill generation engine.

Trigger conditions:

- Task failure
- Missing capability

Forge Loop:

1. Analyze failure
2. Research missing capability
3. Generate prototype tool code
4. Test in sandbox
5. Formalize tool
6. Register tool
7. Log to DEVLOG.md
8. Update GRAVITY_CONTEXT.md

Unreviewed code must never run outside sandbox.

---

# Multi-Agent System Requirements

## Agent Types

- Main Agent
- Dynamically spawned Sub-Agents

## Sub-Agent Capabilities

- Own reasoning loop
- Own workspace tab
- Shared skills by default
- Shared tools by default
- Optional isolation

## Interaction Modes

### Direct Mode

User chats with selected agent tab.

### Group Mode

All agents share a common room.
Agents can talk to each other.
User can observe or participate.

### Delegated Mode

Main agent assigns sub-tasks to sub-agents.
Sub-agents iterate and return structured results.

## Universal Canvas View

Real-time observability layer showing:

- Active agents
- Current reasoning step
- Tool calls
- Token usage
- Iteration counts
- Memory retrieval events
- Forge attempts
- Agent hierarchy graph

---

# SOUL.md Integration

SOUL.md defines:

- Persona
- Behavioral constraints
- Ethical boundaries
- Communication style
- Delegation rules
- Proactivity rules
- Sub-agent spawning policies

SOUL.md must be loaded into system prompt assembly at runtime.

---

# Voice and Communication Extensions

- ElevenLabs integration for voice generation
- Speech-to-text integration
- Telegram voice message support
- Twilio integration for outbound calls
- Ability to transfer call control between agents

---

# Security Requirements

- Telegram user whitelist
- Secrets stored in .env only
- No hardcoded credentials
- Max iteration limits
- Tool sandboxing
- Code modification must require audit logging
- All self-modification must produce diff logs

---

# Self-Modification Requirements

Agents may:

- Modify configuration
- Switch provider APIs
- Improve internal modules

All modifications must:

- Be logged in DEVLOG.md
- Produce file diffs
- Require sandboxed validation

---

# Required Documentation Files

Gravity Claw must auto-generate and maintain:

## GRAVITY_CONTEXT.md

Canonical architecture and system state description.

## DEVLOG.md

Chronological record of system evolution.

## DEVELOPER_GUIDE.md

Complete explanation of architecture and extension model.

## SOUL.md

Persona and behavior configuration.

---

# Build Phases

Level 1 — Core

- Telegram bot
- Provider abstraction
- Basic agent loop
- Single safe tool
- Documentation scaffolding

Level 2 — Memory

- SQLite + FTS5
- Memory tools
- Context injection

Level 3 — Sub-Agent System

- Delegator module
- Agent tab system
- Group chat mode
- Universal canvas view

Level 4 — Forge

- Autonomous skill creation
- Sandbox testing
- Tool formalization

Level 5 — Voice + Twilio

- Voice generation
- Call routing

Level 6 — Proactive Engine

- Pattern recognition
- Predictive task initiation
- Scheduled reasoning

---

# Immediate Task

1. Produce:
   - OpenClaw architectural summary
   - Gravity Claw architectural proposal
   - Folder structure
   - Documentation scaffolds
   - Level 1 implementation

2. Ensure the project runs with:
   npm install
   npm run dev

3. Automatically generate:
   - GRAVITY_CONTEXT.md
   - DEVLOG.md
   - DEVELOPER_GUIDE.md
   - SOUL.md

No pseudo-code.
Working foundation only. (i want you to read @features to add.md to understand what features we want to add to this platfrom) and also for the interface the web interface i want it to be kind of likeopenclaws but deferent theme or color. Also create a skill for this project. just so you know we are building openclaw but with this enhanced features and capabilities. You are building Gravity Claw as a local-first, open-source AI operating system.

This project is not a SaaS platform.
It will not provide hosted infrastructure.

Core Strategy

Gravity Claw must be fully self-hosted.

Users will deploy it on:

Local machines

Mac Mini

VPS

Private servers

There will be no multi-tenant cloud architecture.

There will be no centralized user account system.

There will be no built-in billing layer.

Architectural Implications

Design the system to:

Be secure by default for local deployment.

Avoid assumptions about centralized hosting.

Keep secrets strictly local.

Avoid external data collection.

Support portability across environments.

Maintain clear modular boundaries to allow future enterprise extensions.

Open-Source Readiness Requirements

The codebase must:

Be cleanly structured.

Be well documented.

Include setup instructions.

Include security explanation.

Avoid hidden behavior.

Avoid architectural hacks.

Be understandable by external developers.

The goal is to build a developer-grade autonomous agent framework that people can run, inspect, modify, and extend themselves.

Focus on architectural integrity, modular design, and long-term maintainability.

Do not design for SaaS scaling.

Design for power users and developers. Also know that users should be able to deplo on the cloud like railway. Also the platfrom should come with prebuilt skills and more.
