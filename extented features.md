# GRAVITY CLAW — FULL PLATFORM IMPLEMENTATION PROMPT

### For: Codex / Claude Code / Google Antigravity

### Version: Phase 2 — Complete Platform Expansion

---

> **CRITICAL DIRECTIVE:** Do NOT scaffold. Do NOT write skeleton code. Do NOT leave TODOs or placeholder comments.
> Every file you create must be **production-ready, fully connected, and immediately runnable**.
> Every feature must be wired end-to-end — database schema → API route → service layer → UI component → WebSocket event.
> This is a self-hosted, local-first AI operating system. Treat it as a shipping product.

---

## 0. UNDERSTAND THE EXISTING CODEBASE FIRST

Before writing any code:

1. Read `GRAVITY_CONTEXT.md`, `DEVELOPER_GUIDE.md`, `DEVLOG.md`, and `README.md` in full.
2. Scan the full `src/` directory tree. Understand every existing layer.
3. Read existing API routes under `app/api/`.
4. Read `src/core/memory/schema.ts` — understand the full SQLite schema.
5. Read `src/core/providers/types.ts` — understand the unified provider contract.
6. Read `src/core/orchestrator/` — understand routing and lifecycle.
7. Read `src/ui/state/control-store.tsx` — understand the shared WebSocket state.
8. **Do not break any existing functionality.** All changes are purely additive unless explicitly told otherwise.

---

## 1. UI/UX COMPLETE REDESIGN

### 1.1 Design Philosophy

The current UI is too dense and clustered. Every page feels like data is crammed together.
Redesign the entire control plane UI following these principles:

- **Dark theme** — keep the existing Graphite+Teal color palette: `#0d1117` background, `#161b22` surfaces, `#21262d` elevated surfaces, `#00bfa5` teal primary accent, `#30363d` borders.
- **Breathing room** — generous padding (24–32px on cards), clear section separation, whitespace as a design element.
- **Modern card system** — rounded corners (12px), subtle shadow (`0 1px 3px rgba(0,0,0,0.4)`), glassmorphism micro-accents on active cards.
- **Typography hierarchy** — 3 font sizes max: 13px body, 15px subheading, 18px page title. Use `font-weight: 600` for headings, `400` for body.
- **Sidebar redesign** — make sidebar collapsible with icon-only mode. Each nav item: icon + label. Active state: teal left border + teal text. Hover: subtle teal tint background.
- **Status indicators** — animated pulse dot for active agents (green), idle (grey), error (red). Never raw text status.
- **No information overload** — each panel shows max 5 items before "see all" expansion.
- **Smooth transitions** — 150ms ease on all hover/active states. Page transitions: 200ms fade.
- **Top bar** — slim (48px), workspace selector left, WS status + user right. Clean, minimal.

### 1.2 Redesign Each Page

#### `/dashboard`

- Grid layout: 2 columns on desktop, 1 on mobile.
- Row 1: 5 KPI cards side-by-side (Active Agents, Running Loops, Token Usage, Estimated Cost, Memory Entries). Each card: icon top-left, large number, small label, trend indicator.
- Row 2: Agent Activity Heatmap (left, 2/3 width) + System Health (right, 1/3 width).
- Row 3: Active Sub-Agent Tree (left) + Recent Forge Events (middle) + Recent Delegations (right).
- Row 4: Top Tool Usage bar chart + Memory Footprint breakdown.
- Row 5: Guided Setup checklist — progress bar + step list with done/pending/optional tags.
- All panels: real-time WebSocket updates. No page refresh needed.

#### `/agents`

- Two-panel layout: Agent tree left (300px fixed), Agent config right (flex).
- Agent tree: visual tree with indented child agents. Each node: avatar circle (initials), agent name, status badge, model label.
- Clicking an agent: smooth slide-in config panel right side.
- Config panel: name, provider/model selectors, temperature slider, max tokens input, system prompt textarea, SOUL override textarea, spawn policy toggles (autonomous, short-term isolate, long-term isolate, tool isolation).
- "Open Chat" button → navigates to `/chat` with agent pre-selected.
- "Create Sub-Agent" → modal overlay with name, template, parent selector.
- Agent workspace preview card — show agent's recent activity, current iteration step, memory namespace.

#### `/workspace`

- **Workspace = Isolated AI Environment (like a separate computer for each agent)**
- Each workspace is a sandboxed context: its own config, its own memory namespace root, its own agent bindings, its own tool permissions, its own SOUL overlay.
- Layout: workspace list left sidebar, workspace detail main panel.
- Detail panel tabs: Overview | Agents Bound | Memory | Config | Forge Jobs | Call Sessions.
- "Create Workspace" modal: name, goal, clone from existing, export to JSON.
- Config tab: key-value editor for workspace-scoped settings.
- Workspace switcher in top bar: dropdown + "New" button.
- Workspace isolation visual — show which agents, tools, and memory namespaces are scoped to this workspace vs. global.

#### `/canvas`

- This is the **Mission Control / Live Execution Canvas**.
- Full-screen mode available.
- Agent Hierarchy Graph: force-directed D3 graph. Nodes = agents. Edges = parent-child relationships. Color: active=teal, idle=grey, error=red.
- Live Execution Timeline: horizontal scrollable timeline. Each agent has its own row. Events shown as chips (tool call, memory read, reflection, forge attempt).
- Delegation Chain Viewer: when a delegation is active, highlight the chain in the graph.
- Token Usage Heatmap: per-agent token usage over time, visualized as heat cells.
- Loop Iteration Counter: per-agent, live updating.
- Memory Retrieval Events: flash animation on agent node when memory is read.
- Forge Activity Panel: right side, live forge stage tracker (analyze → research → generate → sandbox-test → formalize → register).
- Call Session Panel: active Twilio call sessions, which agent is handling, duration.
- Timeline scrubber: playback past execution events.
- All data from WebSocket stream — no polling.

#### `/chat`

- **This is the primary interaction surface. Make it beautiful.**
- Left panel (260px): conversation list with search. Each conversation: agent avatar, last message preview, timestamp. "/" command opens conversation search + slash command palette.
- Middle panel (flex): chat messages. Markdown rendered. Code blocks with syntax highlighting and copy button. Tool call badges inline (show tool name, collapsed by default, expandable). Streaming responses — tokens render as they arrive via SSE.
- Right panel (300px, collapsible): Agent info, current reasoning step, iteration count, memory context used, active tools.
- Message composer: multi-line textarea, file upload button, voice record button, send on Enter (Shift+Enter for newline).
- Mode selector: Direct | Delegated | Group — rendered as segmented control above composer.
- In Group mode: show all agent avatars, messages attributed to each agent with colored left border.
- Typing indicators: show animated dots when agent is generating.
- "/" command palette: typing `/` opens a floating panel listing all slash commands: `/new`, `/status`, `/model`, `/think`, `/usage`, `/compact`, `/search`, `/delegate`.
- All conversations are **persisted in SQLite**. Conversation list loads on page mount. Browser refresh never loses history.
- Conversation sidebar stays in sync via WebSocket — new conversations appear instantly.

#### `/skills`

- Card grid layout: each skill is a card. Status toggle (enabled/disabled) prominent.
- Click card → expanded detail: description, code viewer (syntax-highlighted), bound agents list, execution logs.
- "Attach to Agent" button → modal with agent selector.
- "View Logs" tab → filtered log stream for this skill.
- Search + filter bar at top.

#### `/tools`

- Table layout: tool name, risk level badge, status toggle, confirmation required toggle, last used.
- Click row → side panel: tool description, config fields, execution logs, allow/block list editor.
- Confirmation queue: pinned at top if items pending. Each item: tool name, args preview, approve/reject buttons.
- Risk level badges: color coded (low=grey, medium=yellow, high=orange, dangerous=red).

#### `/memory`

- Two-panel: search/filter left, memory entry detail right.
- Left: search input (full-text), filter by type (short-term/long-term/archival), filter by agent namespace, filter by pinned.
- Memory list: each entry shows excerpt, type badge, timestamp, pin button, delete button.
- Click entry → detail panel: full content, metadata, embedding info, export button.
- Stats bar at top: total entries, by type, size, last write time.
- Pinecone status indicator (if configured): shows sync status.

#### `/providers`

- Card per provider: OpenAI, Anthropic, Google, xAI/Grok, DeepSeek, Groq, OpenRouter, Ollama.
- Each card: logo, connection status dot, masked API key field, test connection button, failover priority number (draggable to reorder).
- Model selector per provider: dropdown of available models for that provider.
- OpenRouter card: single key, list of accessible models (fetched from OpenRouter API).
- Ollama card: local endpoint URL, list of locally available models (fetched from Ollama API at startup).
- Failover settings: global toggle + priority order list.

#### `/logs`

- Tabbed: System | Agent | Tool | Forge | Delegation | Audit | Voice Calls.
- Each tab: filterable, searchable, auto-scrolling log stream.
- Log entries: timestamp, level badge, source label, message.
- Filter controls: level (debug/info/warn/error), time range, search text.
- Export button: download filtered logs as JSON.

#### `/settings`

- Section cards: Runtime Policy, Security, Forge Engine, Proactive Engine, Voice / Calls, Integrations, Workspace Config.
- Each section: clean form with labeled inputs, save button per section.
- Toggles use a styled switch component, not checkboxes.
- Runtime Policy: iteration limit slider, max token limit input, reflection toggle, thinking level selector.
- Security: dangerous tool confirmation toggle, Telegram allowlist editor.
- Integrations: ElevenLabs key, Whisper config, Twilio credentials, Pinecone key.

#### `/profiles`

- SOUL.md section editor: each section rendered as an editable card.
- Live raw preview panel on right.
- Save button: writes to disk with audit log + diff.
- Section add/remove/reorder.

#### `/onboarding`

- Conversational wizard UI.
- Step progress bar at top.
- Each step: instruction card + action card side by side.
- Completion checkmarks animate in.

---

## 2. CONVERSATION PERSISTENCE AND "/" COMMAND SYSTEM

### 2.1 Full Conversation History Persistence

Every conversation must be saved to SQLite and survive browser restarts, laptop reboots, and server restarts.

**Schema additions to `src/core/memory/schema.ts`:**

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'direct', -- direct | delegated | group
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_preview TEXT
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL, -- user | assistant | agent | system
  agent_id TEXT,
  content TEXT NOT NULL,
  tool_calls TEXT, -- JSON array of tool call events
  metadata TEXT, -- JSON: iteration, reflection, token_count, etc.
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conv_workspace ON conversations(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_msgs ON conversation_messages(conversation_id, created_at ASC);
```

**API routes:**

- `GET /api/conversations?workspaceId=&agentId=&limit=&offset=` — paginated conversation list.
- `POST /api/conversations` — create new conversation.
- `GET /api/conversations/[convId]/messages?limit=&before=` — paginated message history.
- `DELETE /api/conversations/[convId]` — delete conversation and messages.
- `PATCH /api/conversations/[convId]` — update title.

Wire every agent response through the conversation persistence layer. Every message sent and every response received must be written to `conversation_messages` immediately.

On chat page load: fetch conversation list from API. Load last active conversation. Stream message history into the chat panel.

### 2.2 "/" Slash Command System

When the user types `/` in the chat input, show a floating command palette:

| Command                           | Description                                       |
| --------------------------------- | ------------------------------------------------- |
| `/new`                            | Start a new conversation                          |
| `/list`                           | Show conversation list (same as sidebar)          |
| `/status`                         | Show current agent status, iteration, memory      |
| `/model [provider/model]`         | Hot-swap the active model                         |
| `/think [off\|low\|medium\|high]` | Set thinking depth level                          |
| `/usage`                          | Show token usage + cost estimate                  |
| `/compact`                        | Compress conversation context                     |
| `/search [query]`                 | Search conversation history                       |
| `/delegate [agentId] [task]`      | Delegate task to sub-agent                        |
| `/spawn [name]`                   | Spawn a new sub-agent                             |
| `/memory [query]`                 | Search memory                                     |
| `/forge`                          | Trigger a forge job                               |
| `/clear`                          | Clear current chat view (does NOT delete from DB) |

Implement slash command parsing in `src/core/interface/slash-commands.ts`. Parse before sending to orchestrator.

---

## 3. MULTI-LLM PROVIDER EXPANSION

### 3.1 Updated Provider Registry

Expand `src/core/providers/` to support all providers below. Each provider follows the unified contract in `src/core/providers/types.ts`.

**Supported providers and their current models (February 2026):**

#### OpenAI (`src/core/providers/openai.ts`)

```
gpt-5                      — GPT-5 (flagship, strongest general)
gpt-5-mini                 — GPT-5 Mini (fast, cost-effective)
gpt-4o                     — GPT-4o (multimodal)
gpt-4o-mini                — GPT-4o Mini
gpt-4.5-preview            — GPT-4.5 Preview
o3                         — o3 reasoning model
o4-mini                    — o4-mini reasoning model
```

#### Anthropic (`src/core/providers/anthropic.ts`)

```
claude-opus-4-5-20251101   — Claude Opus 4.5 (most capable, agentic)
claude-sonnet-4-5-20251022 — Claude Sonnet 4.5 (best coding/agents)
claude-sonnet-4-20250514   — Claude Sonnet 4
claude-opus-4-20250514     — Claude Opus 4
claude-haiku-4-5-20251001  — Claude Haiku 4.5 (fast, cheap)
claude-haiku-3-5-20251001  — Claude Haiku 3.5
```

#### Google Gemini (`src/core/providers/gemini.ts`)

```
gemini-2.5-pro             — Gemini 2.5 Pro (1M context, multimodal)
gemini-2.5-flash           — Gemini 2.5 Flash (fast, 1M context)
gemini-2.0-flash           — Gemini 2.0 Flash
gemini-2.0-flash-lite      — Gemini 2.0 Flash Lite (ultra cheap)
```

#### xAI Grok (`src/core/providers/xai.ts`)

```
grok-4                     — Grok 4 (latest, real-time X/Twitter access)
grok-3                     — Grok 3
grok-3-mini                — Grok 3 Mini
grok-2-1212                — Grok 2
```

API endpoint: `https://api.x.ai/v1/chat/completions` (OpenAI-compatible)

#### DeepSeek (`src/core/providers/deepseek.ts`)

```
deepseek-chat              — DeepSeek V3 (chat, cost-effective)
deepseek-reasoner          — DeepSeek R1 (reasoning, open-source)
```

API endpoint: `https://api.deepseek.com/v1/chat/completions` (OpenAI-compatible)

#### Groq (`src/core/providers/groq.ts`)

```
llama-3.3-70b-versatile    — Llama 3.3 70B (ultra-fast via Groq)
llama-3.1-8b-instant       — Llama 3.1 8B Instant
mixtral-8x7b-32768         — Mixtral 8x7B
gemma2-9b-it               — Gemma 2 9B
qwen-qwq-32b               — Qwen QwQ 32B (reasoning)
```

API endpoint: `https://api.groq.com/openai/v1/chat/completions` (OpenAI-compatible)

#### OpenRouter (`src/core/providers/openrouter.ts`)

Single API key, access to 200+ models. Fetch available models from `https://openrouter.ai/api/v1/models` at startup and cache. Route via `https://openrouter.ai/api/v1/chat/completions`.
Set `HTTP-Referer: http://localhost:3000` and `X-Title: Gravity Claw` headers.

#### Ollama (Local) (`src/core/providers/ollama.ts`)

No API key needed. Endpoint: `http://localhost:11434/api/chat` (or configurable via `OLLAMA_BASE_URL`).
Fetch available models from `http://localhost:11434/api/tags` at startup.
Supports offline, fully private operation.
Compatible models include: `llama3.2`, `mistral`, `codellama`, `gemma2`, `phi3`, `deepseek-r1`, `qwen2.5`, etc.

### 3.2 Model Failover System

In `src/core/providers/provider-registry.ts`:

- Maintain a priority-ordered list of provider/model pairs per workspace.
- On provider failure (network error, rate limit 429, timeout >30s): automatically retry with next in priority list.
- Emit `provider.failover` WebSocket event when switching.
- Track failure counts per provider per hour. If failure rate >50% in 1 hour: temporarily deprioritize.
- Configurable via `global.failoverEnabled`, `global.failoverList`.

### 3.3 `/model` Hot-Swap Command

Implement in slash command handler:

```
/model openai/gpt-5
/model anthropic/claude-sonnet-4-5-20251022
/model ollama/llama3.2
```

Parse provider/model. Validate against registry. Update active session. Respond with confirmation. Persist to agent config.

### 3.4 Thinking Level Control

Add `thinkingLevel` parameter: `off | low | medium | high`.

- `off`: standard generation, no chain-of-thought.
- `low`: brief reasoning steps, budget_tokens=1000.
- `medium`: moderate reasoning, budget_tokens=5000.
- `high`: deep reasoning, budget_tokens=16000.
  For Anthropic: use extended_thinking API parameter.
  For OpenAI o3/o4: use reasoning_effort parameter (low/medium/high).
  For others: inject system prompt reasoning instructions.
  Expose via `/think [level]` command and settings UI.

---

## 4. TOOL SYSTEM EXPANSION

### 4.1 Shell Command Execution

File: `src/core/tools/builtins/shell-exec.ts`

- Execute shell commands in a sandboxed subprocess.
- Allowlist enforcement: configurable list of allowed command prefixes.
- Timeout: default 30s, configurable.
- Output capture: stdout, stderr, exit code returned to LLM.
- Dangerous commands (rm -rf, format, etc.) blocked by default, require explicit policy override.
- Execution logged to audit trail.
- Risk level: `dangerous`. Requires confirmation by default.

```typescript
// Tool schema
{
  name: 'shell_exec',
  description: 'Execute a shell command and return the output',
  parameters: {
    command: string,     // command to run
    timeout_ms?: number, // default 30000
    cwd?: string         // working directory, default process.cwd()
  }
}
```

### 4.2 File System Operations

File: `src/core/tools/builtins/file-ops.ts`

Operations: `read_file`, `write_file`, `create_file`, `delete_file`, `list_dir`, `search_files`, `move_file`, `copy_file`.

- Path allowlisting: restrict to configured allowed paths (default: project dir + `data/` dir).
- Size limits: max read 10MB, max write 5MB.
- Binary detection: refuse to read binary files.
- Relative paths resolved against configured workspace root.
- All writes logged with diff to audit trail (`data/audit-diffs/`).
- Risk level: `medium` for read, `high` for write/delete.

### 4.3 Browser Automation

File: `src/core/tools/builtins/browser.ts`

Use Playwright (install `playwright` + `@playwright/browser-chromium`).
Launch in headless mode. Reuse browser instance across calls.

Operations:

- `browser_navigate(url)` — navigate, return page title + URL.
- `browser_click(selector)` — click element.
- `browser_type(selector, text)` — type text into field.
- `browser_screenshot()` — take screenshot, return base64.
- `browser_extract(selector?)` — extract text content from page or element.
- `browser_fill_form(fields: {selector, value}[])` — fill multiple fields.
- `browser_wait(ms)` — wait for duration.

Risk level: `medium`. Sandbox: do not allow navigation to local network addresses.
Auto-close browser after 5min of inactivity.

### 4.4 Web Search

File: `src/core/tools/builtins/web-search.ts`

Support multiple search backends (configurable):

- **SerpAPI** (primary if `SERPAPI_KEY` set): Google results.
- **Brave Search API** (if `BRAVE_SEARCH_KEY` set): privacy-focused.
- **DuckDuckGo** (fallback, no key needed): use `https://api.duckduckgo.com/?q=...&format=json`.

Return: top 5–10 results with title, URL, snippet.
Risk level: `low`. No confirmation required.

```typescript
{
  name: 'web_search',
  description: 'Search the web and return results',
  parameters: {
    query: string,
    max_results?: number // default 5
  }
}
```

### 4.5 Scheduled Tasks (Cron Scheduler)

File: `src/core/tools/builtins/scheduler.ts`

The agent can create, list, pause, and delete scheduled tasks.

```typescript
{
  name: 'schedule_task',
  description: 'Schedule a recurring or one-time task',
  parameters: {
    name: string,
    cron: string,      // cron expression OR natural language: "every day at 9am"
    task: string,      // prompt to execute
    agent_id?: string, // which agent to run it
    workspace_id?: string
  }
}
{
  name: 'list_tasks',
  description: 'List all scheduled tasks'
}
{
  name: 'cancel_task',
  description: 'Cancel a scheduled task',
  parameters: { name: string }
}
```

Parse natural language schedule via a simple NLP table (e.g., "every day at 9am" → `0 9 * * *`).
Persist in `proactive_rules` table. Run via existing proactive engine cron mechanism.

### 4.6 MCP Tool Bridge

File: `src/core/tools/mcp-bridge.ts`

Connect to external MCP (Model Context Protocol) servers. Read server configs from `mcp.json` in project root.

```json
{
  "servers": {
    "notion": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@notionhq/mcp"]
    },
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"]
    }
  }
}
```

On startup: scan `mcp.json`, connect to each server, list available tools, register them all in the global tool registry with prefix `mcp_[server]_[tool]`.
Handle SSE and stdio transport types.
Expose MCP server management API: `GET/POST /api/mcp/servers`.

---

## 5. PROACTIVE & HEARTBEAT SYSTEM

### 5.1 Heartbeat Loop

File: `src/core/proactive/heartbeat.ts`

A heartbeat loop runs every N seconds (configurable, default 60s).
On each heartbeat:

1. Check for new Telegram messages awaiting response.
2. Check for triggered proactive rules.
3. Check for overdue scheduled tasks.
4. Check for forge jobs awaiting review.
5. Check memory for any flagged items needing attention.
6. Emit `heartbeat.tick` WebSocket event with summary.

The heartbeat is the "always-on" awareness layer. Even without user input, the system is alive.

### 5.2 Smart Recommendations Engine

File: `src/core/proactive/recommendations.ts`

Track usage patterns:

- Frequently used tools → suggest adding to quick access.
- Repeated similar queries → suggest creating a skill.
- Task patterns (e.g., "every Friday same query") → suggest scheduling.
- Provider failover frequency → suggest checking API key.

Store pattern tracking in `proactive_patterns` table (timestamps, pattern type, count, last_seen).
Emit `recommendation.new` event when a recommendation confidence exceeds threshold.
Show recommendations as a dismissible notification card in dashboard.

---

## 6. AGENT MESH WORKFLOWS

### 6.1 Agent Swarm Upgrades

In `src/core/orchestrator/`:

Implement `/mesh [goal]` command:

1. **Decompose**: Main agent breaks the goal into subtasks using LLM planning prompt.
2. **Plan**: Create a dependency graph of subtasks. Identify which can run in parallel.
3. **Assign**: Match subtasks to available agents by capability tags. Spawn new agents if needed.
4. **Execute**: Run independent subtasks in parallel. Gather results.
5. **Synthesize**: Main agent synthesizes all sub-agent outputs into final result.
6. **Report**: Stream progress updates to UI via WebSocket as each subtask completes.

Emit events: `mesh.started`, `mesh.subtask.started`, `mesh.subtask.completed`, `mesh.completed`.

### 6.2 Agent-to-Agent Direct Communication

Add `agent_send` tool:

```typescript
{
  name: 'agent_send',
  description: 'Send a message to another agent and get response',
  parameters: {
    target_agent_id: string,
    message: string,
    await_response?: boolean // default true
  }
}
```

API routes:

- `GET /api/sessions` — list all active agent sessions.
- `GET /api/sessions/[agentId]/history` — get session message history.
- `POST /api/sessions/[agentId]/send` — send message to agent.

This allows agents to query each other's outputs, collaborate on tasks, and share context.

---

## 7. MEMORY SYSTEM EXPANSION

### 7.1 Self-Evolving Memory

File: `src/core/memory/evolution.ts`

Run memory evolution pass on a schedule (every 6 hours or triggered manually):

1. **Access pattern tracking**: increment `access_count` on every memory read. Store `last_accessed` timestamp.
2. **Decay**: memories not accessed in 30 days: move to `archival` tier. Not accessed in 90 days: compress and mark for pruning.
3. **Duplicate detection**: run FTS5 similarity comparison. Merge near-duplicate entries. Keep merged record, delete duplicates.
4. **Reorganization**: re-cluster memories by topic using LLM summary. Update metadata tags.
5. **Summarization**: long entries (>2000 chars) get an LLM-generated summary stored as `summary` field in annotations table.

Add columns to `memory_annotations`: `access_count INTEGER DEFAULT 0`, `last_accessed INTEGER`, `summary TEXT`, `topic_cluster TEXT`.

### 7.2 Multimodal Memory

File: `src/core/memory/multimodal.ts`

When a user uploads an image, audio, or document to WebChat:

- **Images**: use vision API (GPT-4o / Gemini 2.5 Pro) to extract description and key facts. Store text representation in memory.
- **Audio**: transcribe via Whisper API. Store transcript in memory.
- **PDFs / Documents**: extract text via `pdfjs-dist`. Chunk and store in memory with source attribution.
- **Videos** (optional, if provider supports): extract keyframe descriptions.

All multimodal extractions stored as `long_term` memories with type tag `multimodal_[image|audio|document]`.

### 7.3 Pinecone Integration

File: `src/core/memory/pinecone.ts`

If `PINECONE_API_KEY` and `PINECONE_INDEX` are set:

- Mirror all SQLite memory writes to Pinecone for cross-device persistence.
- Use Pinecone for vector similarity search (cosine similarity).
- SQLite remains the primary store; Pinecone is the vector search layer.
- Embed text using OpenAI `text-embedding-3-small` or Gemini `text-embedding-004`.
- Sync on write: every `memory.write` event triggers async Pinecone upsert.
- Search: when `memory-search` tool is called, run parallel FTS5 (SQLite) + vector search (Pinecone), merge results, deduplicate.

API: `GET /api/memory/pinecone/status` — show Pinecone connection status + index stats.

---

## 8. VOICE AND SPEECH SYSTEM

### 8.1 Voice Transcription (Whisper)

File: `src/core/interface/voice/whisper.ts`

When a Telegram voice message or WebChat audio upload arrives:

1. Receive audio file (ogg for Telegram, webm/mp3 for WebChat).
2. Send to OpenAI Whisper API: `POST https://api.openai.com/v1/audio/transcriptions`.
3. Get transcript text back.
4. Feed transcript into normal orchestrator as a text message.
5. Flag message metadata: `source: 'voice'` so agent knows it came from speech.

### 8.2 Talk Mode (Full Voice Conversation)

File: `src/core/interface/voice/talk-mode.ts`

Talk Mode: bidirectional voice conversation in WebChat.

**User side:**

- Click microphone button in WebChat → start recording (MediaRecorder API).
- Click again or silence detection → stop recording.
- Send audio blob to `POST /api/voice/transcribe`.
- Receive transcript → display in chat + send to agent.

**Agent side:**

- After generating text response → automatically pass to ElevenLabs TTS.
- Stream audio back to client via WebSocket or chunked response.
- Auto-play in browser.
- Show audio player with waveform in chat message.

Toggle Talk Mode via settings or `/talkmode on|off` command.

### 8.3 ElevenLabs TTS Integration

File: `src/core/interface/voice/elevenlabs.ts`

Full ElevenLabs integration:

- Configure `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.env`.
- API: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream`.
- Stream audio chunks via WebSocket to client for low-latency playback.
- Voice selection: list available voices from `GET https://api.elevenlabs.io/v1/voices`. Show in settings UI with preview play button.
- Per-agent voice assignment: each agent can have a different ElevenLabs voice. Configure on agent settings page.
- Telegram: send generated audio as `.ogg` voice message.

### 8.4 Text-to-Speech Tool

```typescript
{
  name: 'speak',
  description: 'Convert text to speech and send as voice message',
  parameters: {
    text: string,
    voice_id?: string // ElevenLabs voice ID override
  }
}
```

---

## 9. WEBCHAT UI — PRODUCTION BROWSER INTERFACE

File: `src/ui/pages/chat-page.tsx` (full redesign)

This is the main user-facing interface. It must be production-grade.

**Requirements:**

- Full markdown rendering: `react-markdown` + `remark-gfm` + `rehype-highlight`.
- Code blocks: syntax-highlighted, copy button, language label.
- Streaming: use Server-Sent Events (`EventSource`) for token-by-token streaming. Each token appends to the current message bubble. Cursor blink animation while streaming.
- File upload: drag-and-drop + click. Support images, PDFs, text files, audio. Files uploaded to `POST /api/chat/upload`. URL returned and injected into message.
- Voice record: MediaRecorder API in browser. Record WebM audio. Upload to transcription endpoint. Transcript inserted into input.
- Audio playback: when agent response includes TTS audio URL, show audio player with waveform (use `wavesurfer.js`).
- Typing indicator: show animated three-dot typing indicator while agent is processing.
- Message reactions: hover a message → show copy, thumbs up/down, retry, delete icons.
- Message grouping: consecutive messages from same sender grouped with reduced spacing.
- Auto-scroll: lock to bottom unless user has scrolled up. Show "scroll to bottom" button when not at bottom.
- Empty state: show beautiful empty state card with suggested prompts.
- Keyboard shortcuts: `Cmd+K` → focus input, `Cmd+N` → new conversation, `Cmd+/` → slash command palette.

**API routes needed:**

- `POST /api/chat/upload` — handle file uploads, return URL.
- `POST /api/voice/transcribe` — Whisper transcription.
- `GET /api/chat/stream/[convId]` — SSE stream for ongoing conversation.

---

## 10. MISSION CONTROL DASHBOARD (KANBAN + LIVE FEED)

Add a new page: `/mission` (accessible from sidebar).

This is inspired by OpenClaw Mission Control — a dedicated operations view.

### Layout

- **Left panel (240px)**: Agent roster. Each agent card: name, status dot, current task, heartbeat indicator (pulsing green if active < 2min ago).
- **Center panel (flex)**: Mission Queue — Kanban board with columns: `Inbox | Assigned | In Progress | Review | Done`.
- **Right panel (280px)**: Live Event Feed — real-time stream of all agent events.

### Mission Queue (Kanban)

- Tasks are drag-and-drop across columns.
- Each task card: title, description, assigned agent avatar, priority badge, created time, tags.
- Click task card → modal: full description (markdown), status history, agent activity log, approve/reject buttons for review-gated tasks.
- Create task button → modal with title, description, assigned agent, priority, required skills, tags.
- Agent auto-claim: tasks with matching skill tags can be auto-assigned to idle agents.

**Schema additions:**

```sql
CREATE TABLE IF NOT EXISTS mission_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inbox', -- inbox|assigned|in_progress|review|done
  priority TEXT NOT NULL DEFAULT 'medium', -- low|medium|high|critical
  assigned_agent_id TEXT,
  required_skills TEXT, -- JSON array
  tags TEXT, -- JSON array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  deliverables TEXT -- JSON array of {type, path, description}
);

CREATE TABLE IF NOT EXISTS mission_task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES mission_tasks(id),
  agent_id TEXT,
  event_type TEXT NOT NULL, -- created|assigned|started|reviewed|completed|commented
  content TEXT,
  created_at INTEGER NOT NULL
);
```

**API routes:**

- `GET/POST /api/mission/tasks?workspaceId=&status=&agentId=`
- `PATCH /api/mission/tasks/[taskId]` — update status, assignment, etc.
- `DELETE /api/mission/tasks/[taskId]`
- `POST /api/mission/tasks/[taskId]/approve` — approve review-gated task.
- `GET /api/mission/tasks/[taskId]/events` — task event history.

### Live Event Feed

Real-time stream of all system events via WebSocket:

- Agent messages (with agent avatar + colored border per agent).
- Tool calls (tool badge chip).
- Memory reads/writes.
- Forge events.
- Task status changes.
- Voice call events.
- Heartbeat check-ins.

Filter by event type via tag filter chips at top. Search by text. Pause/resume feed button.

### Agent Profile Panel (click agent in roster)

- Agent name, SOUL.md excerpt, current model, status.
- Last heartbeat: N seconds ago.
- Current task: link to task card.
- Recent activity: last 5 events.
- SOUL editor: inline edit agent personality and save.
- Expertise tags: display skill tags.

---

## 11. LIVE CANVAS UPGRADES

Upgrade `/canvas` to be a true real-time orchestration preview:

### D3 Force-Directed Agent Graph

Use `d3-force`. Each agent = node. Parent/child = edges. Colors: active=`#00bfa5`, idle=`#555`, error=`#ff4444`.
Node size scales with token usage. Hovering a node shows tooltip: agent name, current step, iteration count, memory reads in last 5min.
Clicking a node: opens agent detail side panel.
Zoom + pan enabled. Reset button.

### Execution Timeline

Horizontal timeline. Y-axis: agents. X-axis: time (last 30 min, scrollable).
Event chips: tool calls (blue), memory reads (purple), forge (orange), delegations (teal), errors (red).
Hover chip: tooltip with full event details.
Click chip: open event detail modal.

### Delegation Chain Visualization

When a delegation is active: draw animated flowing arrows between agents showing data flow direction. Arrows pulse during active data transfer.

### Resource Gauges

Four gauge widgets: CPU, Memory, Token Usage (this hour), API Cost (today).
Update every 5 seconds via WebSocket.

---

## 12. WORKSPACE AS AGENT SANDBOX ENVIRONMENT

Each workspace is a fully isolated agent environment — like a separate computer for each logical context.

### What a Workspace Isolates:

- **Agent bindings**: which agents operate in this workspace.
- **Memory namespace**: `workspace:{id}:agent:{agentId}` prefix. Agents in workspace A cannot read workspace B's memory (unless explicitly shared).
- **Tool permissions**: per-workspace tool allow/block list (override global policy).
- **Provider config**: workspace can override the global default provider/model.
- **SOUL overlay**: workspace-level SOUL.md sections that augment (not replace) the global SOUL.
- **Forge jobs**: scoped to workspace.
- **Proactive rules**: scoped to workspace.
- **Call sessions**: scoped to workspace.
- **Mission tasks**: scoped to workspace.
- **Conversation history**: scoped to workspace.

### Workspace Switcher

Top bar workspace dropdown: shows workspace name + agent count. Click to switch. All pages update to show workspace-scoped data.

### Workspace Operations

- Create: name + goal + optional clone from existing.
- Clone: deep copy — copies agents, config, skills, but NOT memory.
- Export: JSON export of workspace config + agent definitions (no secrets, no memory content).
- Delete: confirmation modal. Soft delete (archive) with 7-day recovery window.

---

## 13. SECURITY HARDENING

- All API routes validate `workspaceId` against the authenticated session.
- Rate limiting on voice transcription and browser automation endpoints: `express-rate-limit` or custom sliding window in SQLite.
- Input sanitization: all user inputs sanitized before passing to shell exec or file ops.
- Audit trail: every sensitive action (shell exec, file write, provider key change, forge approval) writes to `audit_log` table with hash chain integrity.
- Secrets: never log API key values. Mask all keys in UI with last 4 chars visible.
- CORS: restrict to `localhost` only in development. Configurable for production.
- Twilio webhook validation: verify `X-Twilio-Signature` header on all Twilio callbacks.

---

## 14. DEVLOG AND CONTEXT AUTO-UPDATE

After implementing each major feature group, append an entry to `DEVLOG.md`:

```
## [DATE]
- [Feature group name]: [brief description of what was implemented]
- [API routes added]
- [Schema changes]
```

Update `GRAVITY_CONTEXT.md`:

- Update "Layer Status" section to reflect new provider list.
- Add entries for new tools, new memory capabilities, new UI pages.
- Update "Active Capabilities" list in `README.md`.

Update `DEVELOPER_GUIDE.md`:

- Add documentation for MCP bridge, Pinecone integration, Ollama setup.
- Add voice stack setup instructions.
- Add Mission Control page documentation.

---

## 15. ENVIRONMENT VARIABLES (`.env.example` additions)

Add all new required and optional env vars:

```bash
# === PROVIDERS ===
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
XAI_API_KEY=               # Grok / xAI
DEEPSEEK_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434  # local Ollama

# === VOICE ===
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=       # default voice
WHISPER_MODEL=whisper-1    # OpenAI Whisper model

# === MEMORY ===
PINECONE_API_KEY=
PINECONE_INDEX=gravity-claw
PINECONE_ENVIRONMENT=

# === SEARCH ===
SERPAPI_KEY=               # Google search via SerpAPI
BRAVE_SEARCH_KEY=          # Brave Search API

# === TWILIO ===
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# === SECURITY ===
AUTH_TOKEN=                # min 50 chars, for API authentication

# === FEATURE FLAGS ===
FORGE_ENABLED=true
PROACTIVE_ENABLED=true
BROWSER_AUTOMATION_ENABLED=true
SHELL_EXEC_ENABLED=false   # disabled by default for safety
MCP_ENABLED=true
PINECONE_ENABLED=false
OLLAMA_ENABLED=false
```

---

## 16. DEPENDENCIES TO ADD

Add to `package.json`:

```json
{
  "dependencies": {
    "playwright": "^1.48.0",
    "@playwright/browser-chromium": "^1.48.0",
    "pdfjs-dist": "^4.7.76",
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0",
    "rehype-highlight": "^7.0.0",
    "highlight.js": "^11.10.0",
    "d3": "^7.9.0",
    "d3-force": "^3.0.0",
    "wavesurfer.js": "^7.8.5",
    "node-cron": "^3.0.3",
    "@pinecone-database/pinecone": "^4.0.0",
    "formidable": "^3.5.1",
    "serpapi": "^2.0.0",
    "express-rate-limit": "^7.4.1",
    "zod": "^3.23.8"
  }
}
```

Run `npm install` after modifying `package.json`.
Run `npx playwright install chromium` to install browser binary.

---

## 17. IMPLEMENTATION ORDER

Implement in this exact order to avoid dependency failures:

1. **Database schema migrations** — add all new tables first.
2. **Provider expansion** — add all providers + failover + model list.
3. **UI redesign** — global layout, sidebar, top bar, shared components.
4. **Conversation persistence** — schema + API + chat page wiring.
5. **Slash command system** — parser + command palette UI.
6. **Tool expansions** — shell, file, browser, web search, scheduler, MCP bridge.
7. **Memory expansions** — evolution, multimodal, Pinecone.
8. **Voice system** — Whisper, ElevenLabs, Talk Mode, WebChat audio.
9. **WebChat redesign** — streaming, file upload, markdown, audio player.
10. **Mission Control page** — Kanban, Live Feed, Agent roster.
11. **Canvas upgrades** — D3 graph, timeline, delegation visualization.
12. **Workspace isolation** — enforce namespace scoping everywhere.
13. **Heartbeat + recommendations** — proactive background layer.
14. **Agent mesh workflows** — /mesh command + parallel execution.
15. **Thinking level control** — per-provider implementation.
16. **Security hardening** — rate limits, input validation, audit.
17. **Docs update** — DEVLOG, GRAVITY_CONTEXT, DEVELOPER_GUIDE, README.

---

## 18. VERIFICATION CHECKLIST

After implementation, verify each item works end-to-end:

- [ ] All providers connect and return responses (test each individually).
- [ ] Model hot-swap via `/model` command works mid-conversation.
- [ ] Failover triggers when primary provider returns error.
- [ ] Conversations persist across browser refresh and server restart.
- [ ] "/" command palette opens and executes commands.
- [ ] Shell exec tool runs command and returns output (with confirmation gate).
- [ ] File read/write tools work within allowed path boundaries.
- [ ] Browser automation can navigate a URL and extract content.
- [ ] Web search returns results via at least one backend.
- [ ] Scheduled task is created, persisted, and executes at correct time.
- [ ] MCP bridge connects to at least one configured server.
- [ ] Voice message in Telegram transcribed and processed as text.
- [ ] ElevenLabs TTS generates audio and plays in WebChat.
- [ ] Talk Mode: record → transcribe → respond → play audio works.
- [ ] Mission Control Kanban shows tasks, drag-and-drop works.
- [ ] Live Event Feed shows real-time events via WebSocket.
- [ ] Canvas D3 graph renders agent hierarchy with live status.
- [ ] Memory evolution pass runs and merges duplicates.
- [ ] Pinecone sync works if key is configured.
- [ ] Workspace switching scopes all data correctly.
- [ ] Heartbeat loop runs and emits events.
- [ ] All new pages load without errors.
- [ ] `npm run check` passes (lint + typecheck + tests).
- [ ] `npm run build` succeeds.
- [ ] Server starts and all WebSocket connections establish.

---

## FINAL DIRECTIVE

This is a complete, production-ready AI operating system.
No scaffolding. No mocks. No TODOs.
Every line of code must work.
Every feature must be connected to the database, to the WebSocket event bus, and to the UI.
When you are done, a user must be able to `npm install && npm run dev`, open `localhost:3000`, and immediately have a fully functional, beautiful, autonomous AI agent platform ready to use.

Build it like it ships tomorrow.
