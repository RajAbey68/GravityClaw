# Gravity Claw

Gravity Claw is a local-first autonomous AI operating system inspired by OpenClaw and rebuilt with strict modular boundaries.

## Active Capabilities
- Telegram long polling adapter with whitelist enforcement.
- Unified provider abstraction (OpenAI, Anthropic, Gemini) with health + failover.
- Multi-agent runtime with direct/delegated/group coordinator-round modes.
- Persistent collaboration rooms, room messages, and delegation task tracking.
- Persistent conversation history (`conversations` + `conversation_messages`) with slash-command execution (`/new`, `/model`, `/delegate`, `/forge`, etc.).
- Tool layer with confirmation-gated dangerous execution and sandbox controls.
- Memory layer with short/long/archival tiers, FTS5 retrieval, and compression.
- Forge Layer 7 pipeline with manual promotion gate and generated tool registration.
- Runtime skills loading from `skills/runtime/*` with agent-specific bindings.
- Voice stack: Telegram STT/TTS path plus Twilio outbound calls and agent handoff.
- Proactive rule engine (`pattern` + `cron`) with manual trigger API.
- Universal Canvas API/UI for hierarchy, usage, forge, call, and memory telemetry.

## Quick Start
1. Copy `.env.example` to `.env`.
2. Configure required values (`TELEGRAM_ALLOWED_USER_IDS`, provider key(s)).
3. Optional toggles: `FORGE_ENABLED`, `PROACTIVE_ENABLED`.
4. Run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation
```bash
npm run check
npm run build
```

## Deployment
- Local or private server: `npm run dev` / `npm start`.
- Docker: `docker-compose up --build`.
- Railway: deploy single service with environment variables from `.env.example`.

## Core Docs
- `GRAVITY_CONTEXT.md`
- `DEVLOG.md`
- `DEVELOPER_GUIDE.md`
- `SOUL.md`
- `docs/architecture.md`
- `docs/security.md`
- `docs/deployment.md`
- `docs/api.md`
