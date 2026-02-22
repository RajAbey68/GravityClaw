# Deployment

## Local
```bash
npm install
npm run dev
```

## Docker
```bash
docker compose up --build
```

## Railway
- Use `railway.json` included in the repo.
- Set environment values from `.env.example`.
- Keep single-replica default for local-first behavior unless explicitly scaling.

## Important Environment Variables
- `TELEGRAM_ALLOWED_USER_IDS` (required)
- `GC_MAX_ITERATIONS`
- `GC_MAX_GROUP_ROUNDS`
- `GC_DEFAULT_PROVIDER`, `GC_DEFAULT_MODEL`
- `GC_PUBLIC_BASE_URL` (required for Twilio callbacks)
- `FORGE_ENABLED`
- `PROACTIVE_ENABLED`
- Provider keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`
- Voice keys: `ELEVENLABS_API_KEY`, `TWILIO_*`
