continue with Phase 7: Voice System
Talk Mode implementation (bidirectional voice)
Browser MediaRecorder → Whisper pipeline
ElevenLabs streaming to browser
/talkmode command
Per-agent voice assignment
speak tool
Phase 8: Proactive & Heartbeat
Heartbeat loop (heartbeat.ts)
Smart recommendations engine (recommendations.ts)
heartbeat.tick and recommendation.new events
Phase 9: Agent Mesh Workflows
/mesh [goal] command with decompose → plan → assign → execute → synthesize
agent_send tool for direct agent-to-agent communication
Mesh events: mesh.started, mesh.subtask.\*, mesh.completed
Phase 10: Workspace Full Isolation
Enforce namespace scoping on all repositories
Per-workspace tool allow/block lists
Per-workspace provider config override
SOUL overlay per workspace
Phase 11: Security Hardening
Rate limiting on voice/browser endpoints
Input sanitization for shell/file tools
CORS restriction configuration
Twilio webhook signature validation
API key masking in UI
Phase 12: Documentation Updates
Update DEVLOG.md with all changes
Update GRAVITY_CONTEXT.md layer status
Update DEVELOPER_GUIDE.md with new integrations
Update README.md active capabilities
Phase 13: Verification
All providers connect and respond
Model hot-swap works
Failover triggers on error
Conversations persist across restarts
Slash commands execute
All tools function within boundaries
Voice pipeline works end-to-end
Mission Control kanban functional
Canvas D3 graph renders
Memory evolution runs
Workspace switching scopes data
Heartbeat loop emits events
npm run check passes
npm run build succeeds. And also change the models for the models provider to Google Gemini 3 Pro Gemini-3-Pro
Gemini 3 Pro DeepThink Gemini-3-Pro-DeepThink
Gemini 3 Flash Gemini-3-Flash
OpenAI GPT-5.2 GPT-5.2
GPT-5.2 Instant GPT-5.2-Instant
GPT-5.2 Thinking GPT-5.2-Thinking
GPT-5.2 Pro GPT-5.2-Pro
GPT-5.2 Codex GPT-5.2-Codex
Anthropic Claude Opus 4.6 claude-opus-4-6
Claude Sonnet 4.6 claude-sonnet-4-6
Claude Haiku 4.5 claude-haiku-4-5
xAI / Grok Grok 4 Grok-4
Grok 4.1 Grok-4.1
Grok 4 Fast Grok-4-Fast
Grok Code Fast 1 Grok-Code-Fast-1. Update all pages with this new changes and start implementation. Also for the gemini model i think the latest one is 3.1 pro so searh the web for that. Amd emable everything to be true in the .env.example file. And there should not be any defult models any model is allowed. # GRAVITY CLAW — PHASE 3 MASTER IMPLEMENTATION PROMPT

### Subscription Auth · Persistent Agent Browser · VPS-Grade Filesystem · Live Activity Feed · Agency Workspace Model

### For: Codex / Claude Code / AI Coding Agents

---

> **NON-NEGOTIABLE DIRECTIVES:**
>
> - Zero skeleton code. Zero TODOs. Zero placeholder comments. Every function body must be complete.
> - Every feature is wired end-to-end: schema → service → API route → WebSocket event → UI component.
> - Every UI component renders real data. No hardcoded strings or mock arrays in production paths.
> - Read the full existing codebase before writing a single line. Do not break existing functionality.
> - This is a shipping product. Build it like it deploys tomorrow.

---

## 0. PRE-IMPLEMENTATION AUDIT

Before writing any code:

1. Read `GRAVITY_CONTEXT.md`, `DEVELOPER_GUIDE.md`, `DEVLOG.md`, `README.md` in full.
2. Map every file in `src/core/`, `src/ui/`, `app/api/`, `src/core/memory/schema.ts`.
3. Understand the existing WebSocket event bus in `src/core/interface/`.
4. Understand provider abstraction in `src/core/providers/types.ts`.
5. Understand workspace data model in the existing schema.
6. Confirm `npm run check` passes before you touch anything.
7. All changes are **strictly additive** unless an existing file requires surgical modification for integration.

---

## PART 1 — SUBSCRIPTION-BASED PROVIDER AUTHENTICATION

### 1.1 Architectural Principle

Not all providers expose subscription OAuth. The situation as of February 2026:

| Provider         | Subscription OAuth       | Notes                                                                                                                                                      |
| ---------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Gemini    | ✅ Fully supported       | Official OAuth via Google account, documented, legal                                                                                                       |
| Anthropic Claude | ❌ Explicitly blocked    | Since Jan 2026, OAuth tokens from Claude Code are restricted to Claude Code only. Third-party use violates Anthropic ToS. Do NOT implement. API keys only. |
| OpenAI           | ❌ No subscription OAuth | ChatGPT subscriptions have no programmatic API path. API keys only.                                                                                        |
| GitHub Copilot   | ✅ Via Copilot OAuth     | OAuth device flow gives access to Copilot-gated models                                                                                                     |
| Groq             | ❌ API key only          | No subscription OAuth path                                                                                                                                 |
| DeepSeek         | ❌ API key only          | No subscription OAuth path                                                                                                                                 |

**For providers without subscription OAuth: guide users clearly toward API keys with direct links to their console. Do not attempt workarounds.**

---

### 1.2 Google Gemini OAuth (Subscription-Based Access)

**What this enables:** Users with a Google AI Pro ($19.99/month) or Google AI Ultra ($249.99/month) subscription can authenticate via their Google account and access Gemini models without an API key. Free tier users also get 60 requests/min and 1,000 requests/day through this path.

**Technical implementation:** Mirror the Gemini CLI OAuth flow (`@google/gemini-cli` open source, `packages/core/src/auth/oauthClient.ts`).

#### File: `src/core/providers/auth/google-oauth.ts`

Implement full Google OAuth 2.0 PKCE flow:

```
OAuth Client ID: (use Gemini CLI's open-source client ID)
  6931539499-g2r0f7t97ej3q90cqkjvb7hnrm4ro7s8.apps.googleusercontent.com
Scopes:
  https://www.googleapis.com/auth/generative-language.retriever
  https://www.googleapis.com/auth/cloud-platform (for Vertex AI path)
Token endpoint: https://oauth2.googleapis.com/token
Auth endpoint: https://accounts.google.com/o/oauth2/v2/auth
Code Assist API endpoint: https://cloudcode-pa.googleapis.com/v1internal/codelassist:completeTask
```

Full implementation requirements:

- Generate PKCE code_verifier (32 random bytes, base64url-encoded) and code_challenge (SHA-256 of verifier, base64url).
- Open browser to authorization URL with `response_type=code`, `access_type=offline`, `prompt=consent`.
- Start a local HTTP server on port `9999` (or next available) to receive the OAuth callback at `http://localhost:9999/oauth/callback`.
- On callback: exchange authorization code for `access_token` + `refresh_token` using PKCE verifier.
- Store tokens in `data/auth/google-oauth.json` (encrypted at rest using AES-256 with key derived from machine ID + salt stored in `.env`).
- Implement automatic token refresh: refresh `access_token` using `refresh_token` when within 5 minutes of expiry.
- Expose `getGoogleAccessToken(): Promise<string>` — refreshes if needed, returns valid access token.
- Expose `revokeGoogleAuth(): Promise<void>` — deletes stored tokens, revokes refresh token via Google revoke endpoint.
- Handle headless/VPS environments: if `DISPLAY` not set and `BROWSER_OPEN_DISABLED=true`, print the OAuth URL to stdout and poll for the callback instead of auto-opening browser.

#### File: `src/core/providers/gemini-oauth.ts`

A separate provider adapter that uses the OAuth token instead of an API key:

- Extends the base Gemini provider adapter.
- On each request: call `getGoogleAccessToken()` and set `Authorization: Bearer {token}` header.
- Route to `https://generativelanguage.googleapis.com/v1beta/` (same API, different auth).
- For Code Assist endpoint (when using Google AI Pro/Ultra quota): route to `https://cloudcode-pa.googleapis.com/` with appropriate headers.
- Report auth method as `oauth_google` in provider telemetry.
- Available models via this path: same as API key path (`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`).

#### API Routes for OAuth Management

**`POST /api/providers/auth/google/initiate`**

- Generate PKCE pair, store verifier in session.
- Start local callback server.
- Return `{ authUrl: string, port: number }` to frontend.
- Frontend opens `authUrl` in new browser tab.

**`GET /api/providers/auth/google/status`**

- Return `{ authenticated: boolean, email?: string, expiresAt?: number, subscriptionTier?: string }`.
- Fetch user info from `https://www.googleapis.com/oauth2/v2/userinfo` to get email.

**`DELETE /api/providers/auth/google/revoke`**

- Revoke tokens, delete stored auth file.
- Remove OAuth provider from active providers list.

**`POST /api/providers/auth/google/refresh`**

- Force token refresh. Return new expiry time.

---

### 1.3 GitHub Copilot OAuth

**What this enables:** Users with GitHub Copilot Individual ($10/month) or Copilot Business can authenticate and access Copilot-backed models (currently GPT-4o and Claude Sonnet via Copilot).

#### File: `src/core/providers/auth/github-oauth.ts`

Implement GitHub Device Flow (works in headless/VPS environments):

```
Device code endpoint: https://github.com/login/device/code
Token endpoint: https://github.com/login/oauth/access_token
Copilot token endpoint: https://api.github.com/copilot_internal/v2/token
Client ID: (use VS Code Copilot extension client ID: Iv1.b507a08c87ecfe98)
Scopes: copilot
```

Full implementation:

- POST to device code endpoint → get `device_code`, `user_code`, `verification_uri`.
- Return `user_code` and `verification_uri` to frontend for display to user.
- Poll token endpoint every `interval` seconds until user completes auth.
- Exchange GitHub `access_token` for Copilot-specific API token via `/copilot_internal/v2/token`.
- Copilot token expires every 30 minutes — implement auto-refresh.
- Store tokens in `data/auth/github-copilot.json` (encrypted same as Google OAuth).
- Use Copilot API endpoint: `https://api.githubcopilot.com/chat/completions` (OpenAI-compatible).
- Set required headers: `Copilot-Integration-Id: vscode-chat`, `Editor-Plugin-Version: copilot-chat/0.22.4`, `Editor-Version: vscode/1.95.3`.

#### File: `src/core/providers/copilot.ts`

Provider adapter for GitHub Copilot:

- Uses Copilot API token (not GitHub personal access token).
- OpenAI-compatible endpoint.
- Available models: `gpt-4o`, `gpt-4o-mini`, `claude-sonnet-4-5`, `o3-mini` (Copilot's available model list changes — fetch from `https://api.githubcopilot.com/models`).

---

### 1.4 Provider Auth UI

#### Page: `src/ui/pages/providers-page.tsx` (extend existing)

Add an "Auth Methods" section to each provider card that supports subscription OAuth:

**Google Gemini card additions:**

- Show two tabs: `API Key` | `Google Account (OAuth)`.
- OAuth tab: if not authenticated → show "Connect Google Account" button with Google logo. Clicking initiates OAuth flow (calls `/api/providers/auth/google/initiate`, opens URL in new tab, polls status endpoint every 2s).
- If authenticated → show green connected badge, user email, subscription tier (Pro/Ultra/Free), token expiry, "Disconnect" button.
- Status: "Connected as user@gmail.com · Google AI Pro · Refreshes in 47 min".

**GitHub Copilot card (new card):**

- If not authenticated → "Connect GitHub Copilot" button with GitHub logo.
- Clicking: calls initiate, shows device code display (code + URL to visit), countdown timer, auto-detects when auth completes and updates UI.
- If authenticated → show GitHub username, Copilot plan, available models.

**All other providers (OpenAI, Anthropic, DeepSeek, Groq, xAI):**

- API Key tab only.
- Add a clear help text: "This provider requires an API key. Subscription accounts do not have programmatic OAuth access."
- Add direct link to their API console (e.g., "Get your Anthropic API key → console.anthropic.com").

**Global auth status bar (dashboard widget):**

- New "Connected Accounts" widget on dashboard.
- Lists all authenticated OAuth accounts with status dots.
- Click any account → navigates to providers page.

---

### 1.5 Auth Security

- Tokens stored in `data/auth/` directory. This directory must be in `.gitignore`.
- Tokens encrypted at rest: AES-256-GCM. Key = PBKDF2(machine-id + `AUTH_ENCRYPTION_SALT` from .env, 100000 iterations, SHA-256). Machine ID via `node-machine-id` package.
- Tokens never logged. Never included in WebSocket events.
- Auth files never included in workspace export.
- If `AUTH_ENCRYPTION_SALT` not set in .env: generate a random 32-byte hex string, write to .env, warn user in startup logs.

Add to `.env.example`:

```bash
# OAuth Encryption (auto-generated if not set)
AUTH_ENCRYPTION_SALT=
# Set to true to disable auto-opening browser for OAuth (for VPS/headless deployments)
BROWSER_OPEN_DISABLED=false
```

---

## PART 2 — PERSISTENT AGENT BROWSER

### 2.1 Architecture

Each agent gets its own **persistent browser profile**. Sessions, cookies, localStorage, IndexedDB, and cached credentials survive agent restarts, server restarts, and reboots. An agent that logs into Gmail stays logged in. An agent that logs into a CRM stays logged in. Forever, until explicitly cleared.

This is implemented using **Playwright with persistent context** (not `browser.newPage()`, but `playwright.chromium.launchPersistentContext(profilePath)`).

### 2.2 File: `src/core/browser/agent-browser.ts`

**Browser profile storage:** `data/browser-profiles/{agentId}/` — one directory per agent.

```typescript
// Core interface
class AgentBrowser {
  private context: BrowserContext;
  private agentId: string;
  private profilePath: string;

  async initialize(agentId: string): Promise<void>;
  async navigate(url: string): Promise<NavigateResult>;
  async click(selector: string): Promise<void>;
  async type(
    selector: string,
    text: string,
    options?: TypeOptions,
  ): Promise<void>;
  async fill(selector: string, value: string): Promise<void>;
  async screenshot(options?: ScreenshotOptions): Promise<string>; // base64
  async extractContent(selector?: string): Promise<string>;
  async evaluate(script: string): Promise<unknown>;
  async waitForSelector(selector: string, timeout?: number): Promise<void>;
  async waitForNavigation(): Promise<void>;
  async getUrl(): Promise<string>;
  async getTitle(): Promise<string>;
  async goBack(): Promise<void>;
  async scroll(direction: "up" | "down", amount?: number): Promise<void>;
  async selectOption(selector: string, value: string): Promise<void>;
  async uploadFile(selector: string, filePath: string): Promise<void>;
  async downloadFile(url: string, savePath: string): Promise<string>;
  async getCookies(domain?: string): Promise<Cookie[]>;
  async clearCookies(domain?: string): Promise<void>;
  async getStorage(): Promise<{
    local: Record<string, string>;
    session: Record<string, string>;
  }>;
  async close(): Promise<void>;
  async isSessionValid(url: string): Promise<boolean>; // check if still logged in
}
```

**Playwright persistent context configuration:**

```typescript
const context = await chromium.launchPersistentContext(profilePath, {
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--disable-extensions",
  ],
  viewport: { width: 1280, height: 720 },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  locale: "en-US",
  timezoneId: "America/New_York",
  geolocation: undefined,
  permissions: ["clipboard-read", "clipboard-write"],
  ignoreHTTPSErrors: false,
  recordVideo: undefined, // enable per-session if needed for debugging
});
```

### 2.3 File: `src/core/browser/browser-manager.ts`

Singleton manager that maintains one browser instance per agent:

```typescript
class BrowserManager {
  private browsers: Map<string, AgentBrowser> = new Map();

  async getOrCreate(agentId: string): Promise<AgentBrowser>;
  async get(agentId: string): Promise<AgentBrowser | null>;
  async close(agentId: string): Promise<void>;
  async closeAll(): Promise<void>;
  async getActiveSessions(): Promise<BrowserSession[]>;
  async clearProfile(agentId: string): Promise<void>; // wipe all stored session data
  async exportProfile(agentId: string, targetPath: string): Promise<void>;
}
```

Auto-restart browser on crash. Emit `browser.crashed` WebSocket event, re-initialize automatically.
On server shutdown: call `closeAll()` gracefully.
On server startup: browsers are NOT auto-launched. They're created on first use (lazy init).

### 2.4 Browser Tools (registered in tool registry)

#### `browser_navigate`

```typescript
{
  name: 'browser_navigate',
  description: 'Navigate the agent browser to a URL. The browser maintains session state (cookies, login sessions) permanently across restarts.',
  parameters: { url: string, wait_for?: 'load' | 'networkidle' | 'domcontentloaded' }
}
```

#### `browser_screenshot`

```typescript
{
  name: 'browser_screenshot',
  description: 'Take a screenshot of the current browser state. Returns base64 image. Use to verify current page state.',
  parameters: { full_page?: boolean, selector?: string }
}
// Screenshot is automatically sent to LLM as vision input (base64 image in next turn)
```

#### `browser_click`

```typescript
{ name: 'browser_click', parameters: { selector: string, button?: 'left' | 'right' | 'middle', force?: boolean } }
```

#### `browser_type`

```typescript
{ name: 'browser_type', parameters: { selector: string, text: string, clear_first?: boolean, press_enter?: boolean } }
```

#### `browser_extract`

```typescript
{
  name: 'browser_extract',
  description: 'Extract text content from the page or a specific element',
  parameters: { selector?: string, attribute?: string } // attribute for href, src, value, etc.
}
```

#### `browser_evaluate`

```typescript
{
  name: 'browser_evaluate',
  description: 'Execute JavaScript in the browser and return result',
  parameters: { script: string }
}
// Risk level: HIGH. Requires confirmation. Allowed scripts limited to read-only by default.
```

#### `browser_wait`

```typescript
{ name: 'browser_wait', parameters: { selector?: string, ms?: number, url_pattern?: string } }
```

#### `browser_fill_form`

```typescript
{
  name: 'browser_fill_form',
  parameters: { fields: Array<{ selector: string, value: string, type?: 'text' | 'select' | 'checkbox' | 'file' }> }
}
```

#### `browser_download`

```typescript
{ name: 'browser_download', parameters: { url: string, filename: string } }
// Downloads to agent's workspace directory: data/workspaces/{workspaceId}/downloads/
```

#### `browser_session_status`

```typescript
{
  name: 'browser_session_status',
  description: 'Check if the agent is logged into a specific service by checking the current URL and page content',
  parameters: { service: string, check_url: string, logged_in_indicator: string }
}
```

#### `browser_clear_session`

```typescript
{
  name: 'browser_clear_session',
  description: 'Clear cookies/session for a specific domain or all domains',
  parameters: { domain?: string }
}
// Risk: HIGH. Requires confirmation.
```

### 2.5 Browser Live Preview (UI)

#### New UI component: `BrowserPreviewPanel`

In the Canvas page and in agent detail view: add a "Browser" tab showing a live screenshot stream of the agent's browser.

Implementation:

- `GET /api/agents/[agentId]/browser/screenshot` — returns current screenshot as PNG.
- `GET /api/agents/[agentId]/browser/status` — returns `{ active: boolean, url: string, title: string }`.
- Frontend polls screenshot endpoint every 2 seconds when browser panel is open (configurable, default 2000ms).
- Display: `<img>` tag refreshed every 2 seconds. Show URL bar above, title below. "Open in New Tab" button (for VNC-style viewing if VPS has display). Loading spinner while screenshot loads.
- Show browser activity indicator on agent node in Canvas D3 graph when browser is active.
- Emit `browser.navigated`, `browser.screenshot.taken`, `browser.action.executed` WebSocket events.

### 2.6 Profile Management API

- `GET /api/agents/[agentId]/browser/sessions` — list active cookies/sessions by domain.
- `DELETE /api/agents/[agentId]/browser/sessions/[domain]` — clear session for domain.
- `GET /api/agents/[agentId]/browser/profile/size` — disk usage of browser profile.
- `DELETE /api/agents/[agentId]/browser/profile` — wipe entire browser profile (confirmation required).

Add "Browser" section to agent settings page:

- Active sessions table: domain, # cookies, last active time, "Clear" button per domain.
- "Clear All Sessions" — wipe all cookies.
- "Clear Entire Profile" — nuclear option with double confirmation.
- Profile size usage indicator.

---

## PART 3 — VPS-GRADE AGENT FILESYSTEM AND TERMINAL

### 3.1 Philosophy

When Gravity Claw runs on a VPS, the agent already has access to the host filesystem and terminal. The goal here is to make this **explicit, organized, and safe** by giving each agent a managed workspace on the host filesystem, while also providing a full virtual filesystem layer for when running in constrained environments.

### 3.2 Agent Filesystem Layout

```
data/
├── workspaces/
│   ├── {workspaceId}/
│   │   ├── home/              ← agent's "home directory"
│   │   │   ├── projects/      ← code, files the agent works on
│   │   │   ├── downloads/     ← browser downloads, fetched files
│   │   │   ├── exports/       ← generated reports, documents
│   │   │   └── tmp/           ← temporary work files
│   │   ├── agents/
│   │   │   └── {agentId}/
│   │   │       ├── home/      ← per-agent home directory
│   │   │       ├── notes/     ← agent's self-written notes
│   │   │       └── scratch/   ← temporary agent work
│   │   └── shared/            ← files all agents in workspace can read/write
├── browser-profiles/
│   └── {agentId}/             ← Playwright persistent context
├── auth/
│   └── *.json                 ← encrypted OAuth tokens
└── audit-diffs/               ← existing audit trail
```

### 3.3 File: `src/core/filesystem/agent-fs.ts`

```typescript
class AgentFilesystem {
  constructor(
    private agentId: string,
    private workspaceId: string,
  ) {}

  // Path resolution — resolves relative to agent's home, prevents path traversal
  private resolvePath(path: string): string;

  // File operations
  async readFile(path: string): Promise<string>;
  async writeFile(
    path: string,
    content: string,
    options?: WriteOptions,
  ): Promise<void>;
  async appendFile(path: string, content: string): Promise<void>;
  async deleteFile(path: string): Promise<void>;
  async moveFile(from: string, to: string): Promise<void>;
  async copyFile(from: string, to: string): Promise<void>;
  async listDirectory(path?: string): Promise<FileEntry[]>;
  async createDirectory(path: string): Promise<void>;
  async deleteDirectory(path: string, recursive?: boolean): Promise<void>;
  async fileExists(path: string): Promise<boolean>;
  async getFileInfo(path: string): Promise<FileInfo>;
  async searchFiles(query: string, path?: string): Promise<SearchResult[]>;
  async readBinary(path: string): Promise<Buffer>;
  async writeBinary(path: string, data: Buffer): Promise<void>;

  // Workspace shared access
  async readShared(path: string): Promise<string>;
  async writeShared(path: string, content: string): Promise<void>;
  async listShared(path?: string): Promise<FileEntry[]>;
}
```

Path traversal protection: resolve paths, ensure they stay within `data/workspaces/{workspaceId}/`. Any path containing `..` that exits the workspace root is rejected with a `PathTraversalError`.

All file writes emit `audit.file.write` event with before/after diff (using `diff` library).

### 3.4 File: `src/core/terminal/agent-terminal.ts`

Full persistent terminal session per agent:

```typescript
class AgentTerminal {
  private ptyProcess: IPty; // node-pty for real PTY
  private sessionId: string;
  private agentId: string;
  private workspaceId: string;
  private outputBuffer: string[] = [];
  private outputListeners: Set<(data: string) => void> = new Set();

  async spawn(shell?: string): Promise<void>;
  async execute(command: string, timeout?: number): Promise<CommandResult>;
  async write(data: string): Promise<void>; // raw PTY write
  async resize(cols: number, rows: number): Promise<void>;
  async kill(signal?: string): Promise<void>;
  async restart(): Promise<void>;
  async getHistory(): Promise<string[]>;

  // Stream output to WebSocket
  onOutput(listener: (data: string) => void): () => void;
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}
```

Use `node-pty` for real PTY (pseudo-terminal) — supports colors, interactive programs, curses apps.

Shell: default to `bash` on Linux/Mac, `powershell` on Windows (auto-detected). Configurable via agent settings.

CWD: default to agent's `home/projects/` directory.

Environment: inherit process.env, plus inject:

```bash
AGENT_ID={agentId}
WORKSPACE_ID={workspaceId}
AGENT_HOME=data/workspaces/{workspaceId}/agents/{agentId}/home
WORKSPACE_HOME=data/workspaces/{workspaceId}/home
```

Session persistence: when server restarts, re-attach to existing PTY process if still alive (check PID in `data/workspaces/{workspaceId}/agents/{agentId}/.terminal.pid`). If process dead, re-spawn and restore last 500 lines of output buffer from SQLite.

### 3.5 Terminal Schema

```sql
CREATE TABLE IF NOT EXISTS terminal_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  pid INTEGER,
  shell TEXT NOT NULL,
  cwd TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' -- active|dead|suspended
);

CREATE TABLE IF NOT EXISTS terminal_history (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES terminal_sessions(id),
  command TEXT NOT NULL,
  output TEXT,
  exit_code INTEGER,
  duration_ms INTEGER,
  executed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_term_agent ON terminal_sessions(agent_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_term_history ON terminal_history(session_id, executed_at DESC);
```

### 3.6 Terminal Tools (registered in tool registry)

#### `terminal_execute`

```typescript
{
  name: 'terminal_execute',
  description: 'Execute a shell command in the agent terminal. Working directory persists between calls. Session survives restarts.',
  parameters: {
    command: string,
    timeout_ms?: number, // default 60000
    cwd?: string         // override CWD for this command only
  },
  risk: 'high' // confirmation required unless in allowlist
}
```

#### `terminal_write`

```typescript
{
  name: 'terminal_write',
  description: 'Write raw input to the terminal (for interactive programs)',
  parameters: { input: string },
  risk: 'high'
}
```

#### `terminal_read_output`

```typescript
{
  name: 'terminal_read_output',
  description: 'Read the latest terminal output (last N lines)',
  parameters: { lines?: number } // default 100
}
```

#### `terminal_get_history`

```typescript
{
  name: 'terminal_get_history',
  parameters: { limit?: number, search?: string }
}
```

### 3.7 Terminal UI Component

New "Terminal" tab in agent detail view and Canvas workspace view:

**Web-based terminal emulator using `xterm.js`:**

- Full color support, keyboard shortcuts, scrollback buffer.
- WebSocket connection: `ws://localhost:3000/api/agents/[agentId]/terminal/stream`.
- Terminal resizes with window (send resize event to PTY via `agent-terminal.resize()`).
- Input: user can type directly into terminal (with permission gate — confirm "Allow manual terminal input for this agent?").
- Output: real-time streaming via WebSocket binary frames.
- History tab: show `terminal_history` table records — filterable by command/output/date.
- "Clear" button: clears xterm.js display only (not history).
- "Kill Process" button: sends SIGTERM to current foreground process.

**API routes:**

- `GET /api/agents/[agentId]/terminal/session` — get or create terminal session.
- `POST /api/agents/[agentId]/terminal/execute` — execute command, wait for result.
- `WebSocket /api/agents/[agentId]/terminal/stream` — bidirectional PTY stream.
- `GET /api/agents/[agentId]/terminal/history` — command history.
- `DELETE /api/agents/[agentId]/terminal/session` — kill and restart terminal.

### 3.8 On VPS Deployment

When deployed on a VPS, agents automatically have access to:

- The host filesystem (within their scoped directories).
- The host terminal (bash, full system commands per policy).
- Persistent browser sessions (Playwright runs headless, sessions persist to disk).
- Network access from the VPS IP (useful for webhooks, server-side requests).
- All tools work immediately without additional setup.

Add to `README.md` and `docs/deployment.md`:

> "On a VPS or dedicated server, Gravity Claw agents operate like they have their own laptop. Each agent has a persistent home directory, a persistent terminal session, a persistent browser with saved logins, and full access to the host network. This is the recommended deployment model for long-running autonomous agents."

---

## PART 4 — LIVE ACTIVITY FEED AND UNIVERSAL CANVAS

### 4.1 What the Live Feed Shows

The Live Activity Feed is a **real-time window into exactly what every agent is doing, right now**. It is not a log viewer. It is a live, human-readable stream showing agent consciousness.

Each event in the feed is displayed as a natural-language card:

- "🤔 **Main Agent** is thinking — _iteration 3 of 8_"
- "🔧 **Research Bot** called `web_search` — query: _latest React 19 features_"
- "📁 **Coder Agent** wrote file — `src/components/Dashboard.tsx` (847 bytes)"
- "💾 **Main Agent** stored memory — _User prefers TypeScript strict mode_"
- "🌐 **Web Scraper** navigated browser to — `https://github.com/vercel/next.js`"
- "🔗 **Project Manager** delegated task to **Coder Agent** — _Implement login page_"
- "✅ **Research Bot** completed task — returned 2,847 tokens"
- "⚠️ **Coder Agent** hit reflection loop — retrying with different approach"
- "🏭 **Forge** started skill generation — _Missing: YouTube download capability_"

### 4.2 WebSocket Event Schema

All events emitted on the existing WebSocket bus. Add these new event types:

```typescript
type LiveFeedEvent = {
  id: string; // unique event ID
  timestamp: number; // unix ms
  workspaceId: string;
  agentId: string;
  agentName: string;
  eventType: LiveFeedEventType;
  icon: string; // emoji
  title: string; // short human-readable title
  detail: string; // longer detail text
  metadata?: Record<string, unknown>; // tool args, file paths, etc.
  level: "info" | "warn" | "error" | "success";
  groupId?: string; // for grouping related events (e.g., a single task run)
};

type LiveFeedEventType =
  | "agent.thinking"
  | "agent.responding"
  | "agent.iteration.start"
  | "agent.iteration.complete"
  | "agent.reflection.triggered"
  | "agent.reflection.resolved"
  | "tool.called"
  | "tool.completed"
  | "tool.failed"
  | "tool.confirmation.required"
  | "memory.read"
  | "memory.write"
  | "memory.search"
  | "browser.navigated"
  | "browser.action"
  | "browser.screenshot"
  | "terminal.command"
  | "terminal.output"
  | "delegation.sent"
  | "delegation.received"
  | "delegation.completed"
  | "forge.triggered"
  | "forge.stage.changed"
  | "forge.completed"
  | "agent.spawned"
  | "agent.terminated"
  | "workspace.switched"
  | "provider.called"
  | "provider.failover"
  | "mesh.started"
  | "mesh.subtask.completed"
  | "file.read"
  | "file.write"
  | "schedule.triggered";
```

Emit these events from every relevant point in the codebase:

- Runtime loop: emit `agent.thinking` at start of each iteration, `agent.iteration.complete` at end.
- Tool registry: emit `tool.called` before execution, `tool.completed` after, `tool.failed` on error.
- Memory repositories: emit `memory.read`, `memory.write`, `memory.search`.
- Browser: emit `browser.navigated`, `browser.action` for each tool call.
- Terminal: emit `terminal.command`, `terminal.output`.
- Orchestrator: emit `delegation.*`, `agent.spawned`, `agent.terminated`.
- Forge: emit `forge.*` at each stage transition.
- Providers: emit `provider.called` (provider name, model, tokens), `provider.failover`.

Persist all live feed events to database:

```sql
CREATE TABLE IF NOT EXISTS live_feed_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  icon TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  metadata TEXT, -- JSON
  level TEXT NOT NULL DEFAULT 'info',
  group_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feed_workspace ON live_feed_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_agent ON live_feed_events(agent_id, created_at DESC);
```

Retention: keep last 10,000 events per workspace. Prune old events in a background cleanup job (runs hourly).

### 4.3 Live Feed UI Component

#### `src/ui/components/live-feed/LiveFeed.tsx`

A full-screen-capable real-time event stream:

**Layout:**

- Header: "Live Activity" title + agent filter chips + event type filter + "Pause/Resume" toggle + "Clear Display" button.
- Feed: virtualized list (use `react-virtual`) — critical for performance with thousands of events.
- Each event card (36–64px height depending on detail length):
  - Left: colored vertical bar (color = agent's assigned color) + icon emoji (20px).
  - Middle: agent name (bold, teal), event title (normal weight), detail (smaller, muted). Timestamp relative ("just now", "2s ago", "5m ago").
  - Right: event type badge (pill shape, colored per type).
  - Hover: show full metadata in tooltip. Click: open event detail modal.
- New events slide in from top with 200ms animation. Auto-scroll locks to top when new events arrive (newest on top).
- Pause button: freeze the display. Events still accumulate in buffer. Unpause: flush buffered events with a smooth cascade animation.
- Group mode: related events (same `groupId`) collapse into a summary card. Click to expand all events in group.

**Filters:**

- Agent filter: chips for each agent (color coded). Multiple selectable.
- Event type: dropdown with grouped types (Agent Activity, Tools, Memory, Browser, Terminal, System).
- Level filter: Info | Warn | Error | Success.
- Search: text search across title + detail.
- Time range: "Last 5 min", "Last hour", "Today", "Custom".

**Minimal mode:** 1-line per event (icon + agent + title + time). Toggle between normal and minimal.

### 4.4 Universal Canvas — All Agents Live View

#### Page upgrade: `src/ui/pages/canvas-page.tsx`

The Universal Canvas is the **command center for all agents across all workspaces**. It answers: "What is every single agent doing right now, in real time?"

**Layout: three-panel with full-screen toggle:**

**Panel 1 — Agent Grid (left, 320px):**

- Grid of agent cards. Each card: avatar (initials + color), name, workspace badge, status pulse (active/idle/error).
- Under name: current action in human-readable text (updated in real time from feed events): "Searching web...", "Writing file...", "Thinking (iter 4)...", "Idle".
- Click card → select agent, highlight in graph and filter feed.
- Sub-agents indented under parent with tree connector line.
- Workspace group headers (collapsible) separate agents by workspace.

**Panel 2 — Live Graph (center, flex):**

- D3 force-directed graph as described in previous prompt.
- ENHANCEMENT: pulsing animation on node when that agent has an active `agent.thinking` event.
- Browser activity indicator: browser icon overlaid on node when agent has active browser session.
- Terminal activity: terminal icon on node when a terminal command is executing.
- Edge labels: show current delegation task name on delegation edges.
- Mini-map in bottom-right corner for large graphs.
- Double-click node: expand to show last 3 events from that agent as floating chips.

**Panel 3 — Live Feed (right, 360px):**

- Filtered to selected agent (or all agents if none selected).
- Compact feed view (minimal mode by default).
- Click event → expand to full detail in modal.
- "See all" link → navigate to full-page Live Feed view.

**Full Live Feed Page: `/feed`**

- Full-width, full-height live feed.
- All agents, all workspaces (or filter by workspace).
- This is the "mission control screen" meant to be shown on a monitor or second screen.

**Timeline strip (bottom of Canvas):**

- Horizontal timeline showing the last 30 minutes.
- Each agent gets a swim lane (row).
- Events plotted as colored chips on the timeline.
- Hover chip: event detail tooltip.
- Click chip: show event in feed panel.
- Drag timeline edge: zoom in/out on time range.

---

## PART 5 — AGENCY WORKSPACE MODEL (TIED SUB-AGENTS)

### 5.1 Conceptual Model

This is the most important architectural addition. It introduces a **three-tier hierarchy**:

```
Global Level
├── Workspace A (e.g., "Web Dev Agency")          ← AGENCY WORKSPACE
│   ├── Main Agency Agent (orchestrator)
│   ├── Team: Development                          ← TEAM WORKSPACE
│   │   ├── Lead Dev Agent
│   │   ├── Frontend Dev Agent
│   │   ├── Backend Dev Agent
│   │   └── Code Reviewer Agent
│   ├── Team: Marketing                             ← TEAM WORKSPACE
│   │   ├── Strategy Agent
│   │   ├── Content Writer Agent
│   │   ├── Social Media Agent
│   │   └── Analytics Agent
│   └── Team: Client Relations                      ← TEAM WORKSPACE
│       ├── Account Manager Agent
│       └── Proposal Writer Agent
└── Workspace B (e.g., "Research Lab")
    └── ...
```

**Agency Workspace:** A top-level workspace with a mission goal. Contains a main orchestrator agent + multiple teams.
**Team Workspace:** A sub-workspace within an agency. Contains 2–10 specialized agents that collaborate on that team's function.
**Agent Workspace:** Each individual agent's isolated environment (their own filesystem, browser, terminal, memory namespace).

Teams can communicate with other teams through the main agency agent (by default) or directly (if explicitly granted cross-team access).

### 5.2 Schema Additions

```sql
-- Agency Workspaces (top-level)
CREATE TABLE IF NOT EXISTS agency_workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  mission TEXT NOT NULL,            -- what this agency is built to do (persisted in all agents' context)
  status TEXT NOT NULL DEFAULT 'active', -- active|paused|archived
  orchestrator_agent_id TEXT,        -- the main agency orchestrator agent
  parent_workspace_id TEXT,          -- NULL for top-level
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  config TEXT                        -- JSON: max_teams, auto_spawn_policy, etc.
);

-- Team Workspaces (sub-workspaces within an agency)
CREATE TABLE IF NOT EXISTS team_workspaces (
  id TEXT PRIMARY KEY,
  agency_workspace_id TEXT NOT NULL REFERENCES agency_workspaces(id),
  name TEXT NOT NULL,               -- e.g., "Development Team", "Marketing Team"
  specialty TEXT NOT NULL,          -- what this team specializes in
  lead_agent_id TEXT,               -- the team lead / coordinator agent
  member_limit INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  config TEXT                        -- JSON: collaboration_mode, shared_memory_access, etc.
);

-- Team Members (agents bound to a team)
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_workspace_id TEXT NOT NULL REFERENCES team_workspaces(id),
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL,               -- e.g., "Frontend Developer", "Content Writer"
  specialty_tags TEXT,              -- JSON array of skills: ["react", "typescript", "UI"]
  joined_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

-- Team Collaboration Messages (within a team's shared workspace)
CREATE TABLE IF NOT EXISTS team_messages (
  id TEXT PRIMARY KEY,
  team_workspace_id TEXT NOT NULL REFERENCES team_workspaces(id),
  sender_agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'chat', -- chat|task|result|status
  reply_to_id TEXT,
  metadata TEXT,                    -- JSON: task_id, file_refs, etc.
  created_at INTEGER NOT NULL
);

-- Cross-team Tasks (agency orchestrator assigns to teams)
CREATE TABLE IF NOT EXISTS agency_tasks (
  id TEXT PRIMARY KEY,
  agency_workspace_id TEXT NOT NULL REFERENCES agency_workspaces(id),
  assigned_team_id TEXT REFERENCES team_workspaces(id),
  assigned_agent_id TEXT,           -- if assigned to specific agent
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|in_progress|review|done|failed
  priority TEXT NOT NULL DEFAULT 'medium',
  parent_task_id TEXT,              -- for sub-tasks
  deliverables TEXT,                -- JSON: list of expected outputs
  result TEXT,                      -- JSON: actual outputs from team
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Team Shared Files (files accessible to entire team)
CREATE TABLE IF NOT EXISTS team_shared_files (
  id TEXT PRIMARY KEY,
  team_workspace_id TEXT NOT NULL REFERENCES team_workspaces(id),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,          -- actual path in team's shared directory
  uploaded_by_agent_id TEXT NOT NULL,
  file_type TEXT,
  size_bytes INTEGER,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agency_workspace ON team_workspaces(agency_workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_members ON team_members(team_workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_agency_tasks ON agency_tasks(agency_workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_team_messages ON team_messages(team_workspace_id, created_at DESC);
```

### 5.3 Agency Orchestration Engine

#### File: `src/core/orchestrator/agency-orchestrator.ts`

The Agency Orchestrator sits above the standard orchestrator. It manages the lifecycle of an entire agency:

```typescript
class AgencyOrchestrator {
  constructor(private agencyWorkspaceId: string) {}

  // Bootstrap a new agency from a mission description
  async bootstrap(mission: string, proposedTeams?: TeamConfig[]): Promise<void>;
  // Uses LLM to:
  // 1. Analyze the mission
  // 2. Propose team structure (if not provided)
  // 3. Define each team's specialty and roles
  // 4. Spawn all required agents
  // 5. Configure each agent's SOUL with their role context
  // 6. Create shared workspaces and filesystems
  // 7. Initialize collaboration channels

  // Assign a high-level task to the appropriate team
  async assignTask(task: string, priority?: TaskPriority): Promise<string>; // returns taskId

  // Route a request to the best-suited agent/team
  async route(request: string, context?: string): Promise<RoutingDecision>;

  // Synthesize results from multiple teams into a unified report
  async synthesize(taskIds: string[]): Promise<string>;

  // Agency heartbeat: check all teams, escalate stalled tasks
  async heartbeat(): Promise<AgencyStatus>;

  // Spawn a new team within the agency
  async spawnTeam(config: TeamConfig): Promise<string>; // returns teamId

  // Pause all agency activity (preserves state)
  async pause(): Promise<void>;

  // Resume all agency activity
  async resume(): Promise<void>;
}
```

### 5.4 Team Collaboration Engine

#### File: `src/core/orchestrator/team-orchestrator.ts`

Each team has its own internal orchestrator for intra-team coordination:

```typescript
class TeamOrchestrator {
  constructor(private teamWorkspaceId: string) {}

  // Broadcast a message to all team members
  async broadcast(message: string, fromAgent: string): Promise<void>;

  // Assign a sub-task to a specific team member
  async assignToMember(
    agentId: string,
    task: string,
    context?: string,
  ): Promise<string>;

  // Initiate a team discussion round (all agents respond to a shared prompt)
  async discuss(topic: string, rounds?: number): Promise<DiscussionResult>;

  // Merge outputs from multiple agents into a coherent result
  async merge(agentOutputs: AgentOutput[]): Promise<string>;

  // Check which agents are free to take on work
  async getAvailableAgents(): Promise<string[]>;

  // Store a shared file accessible to all team members
  async shareFile(
    agentId: string,
    filePath: string,
    description: string,
  ): Promise<void>;

  // Get shared files for this team
  async getSharedFiles(): Promise<TeamSharedFile[]>;
}
```

**Intra-team communication flow:**

1. Team member agent sends a message via `team_message` tool.
2. Team orchestrator receives message, stores in `team_messages` table.
3. Emits `team.message` WebSocket event (visible in team workspace chat).
4. Routes message to relevant team members based on tags/role or broadcasts to all.
5. Recipients see message in their context on next iteration.

### 5.5 Agent Tools for Team Collaboration

#### `team_message`

```typescript
{
  name: 'team_message',
  description: 'Send a message to other agents in your team',
  parameters: {
    content: string,
    to?: string,  // agent ID or 'all' (default: all)
    type?: 'chat' | 'task' | 'result' | 'status',
    reply_to?: string  // message ID to reply to
  }
}
```

#### `team_read_messages`

```typescript
{
  name: 'team_read_messages',
  parameters: { limit?: number, unread_only?: boolean }
}
```

#### `team_share_file`

```typescript
{
  name: 'team_share_file',
  description: 'Share a file with all agents in your team',
  parameters: { file_path: string, description: string }
}
```

#### `team_get_files`

```typescript
{
  name: 'team_get_files',
  description: 'Get list of files shared by team members',
  parameters: { search?: string }
}
```

#### `agency_report`

```typescript
{
  name: 'agency_report',
  description: 'Send a status report or result to the agency orchestrator',
  parameters: {
    task_id: string,
    status: 'in_progress' | 'completed' | 'blocked' | 'failed',
    summary: string,
    deliverables?: string[]  // file paths or content summaries
  }
}
```

### 5.6 Agency Memory Model

Each level of the hierarchy has its own memory namespace:

```
{agencyWorkspaceId}:global          ← accessible to ALL agents in agency
{agencyWorkspaceId}:team:{teamId}   ← accessible to agents in that team only
{agencyWorkspaceId}:agent:{agentId} ← private to that agent
```

Cross-team memory access can be granted explicitly via agency config: `allowCrossTeamMemoryRead: ['teamId1', 'teamId2']`.

Agency-level long-term memory: facts about the agency's mission, clients, ongoing projects, past results — shared by all agents.

Team-level memory: team-specific knowledge, work products, decisions — shared within team only.

Agent-level memory: individual agent's working memory, personal notes — private.

### 5.7 Agency and Team Workspace UI

#### New Page: `/agency` (add to sidebar under a "Teams" section)

**Agency List View (default):**

- Grid of agency workspace cards.
- Each card: agency name, mission excerpt, # of teams, # of agents, status (active/paused/archived), token usage this week, last activity time.
- "Create Agency" button → wizard modal.
- Click card → Agency Detail View.

**Agency Detail View:**

- Breadcrumb: Agencies → [Agency Name].
- Header: agency name, mission, status badge, "Pause", "Resume", "Settings" buttons.
- **Team Grid:** Cards for each team. Card shows: team name, specialty, # of agents, current task in progress, last message time.
- Click team card → Team Detail View.
- **Agency Tasks panel:** Kanban board at agency level. Drag tasks between Pending/Assigned/In Progress/Done.
- **Agency Feed:** Live feed filtered to this agency's workspace ID.
- **Agency Timeline:** Horizontal timeline showing all teams' activity.

**Team Detail View:**

- Breadcrumb: Agencies → [Agency Name] → [Team Name].
- Header: team name, specialty description, lead agent badge.
- **Sub-agent workspace grid:** Cards for each agent in the team.
  - Each card: agent avatar (initials), name, role, status pulse, current action (from live feed).
  - Click agent card → Agent Workspace View.
- **Team Chat:** Persistent chat room showing `team_messages`. Real-time via WebSocket. Each message attributed to agent (color-coded). User can write into the chat (messages injected into all agents' context).
- **Shared Files:** List of files shared within team. Click to view content or download.
- **Team Tasks:** Tasks assigned to this team. Click task → task detail (full description, status history, deliverables).
- **Team Live Feed:** Feed filtered to this team's agents.

**Agent Workspace View (deepest level):**

- Breadcrumb: Agencies → [Agency] → [Team] → [Agent Name].
- This is the agent's individual workspace. Shows everything scoped to this single agent:
  - **File Explorer:** Interactive file tree of agent's `home/` directory. Click files to view content. "New File", "New Folder" buttons. Upload button. Download button.
  - **Terminal:** xterm.js terminal connected to this agent's PTY session.
  - **Browser:** Live screenshot preview of agent's browser. URL bar. Session list.
  - **Memory:** Memory entries in this agent's namespace. Search, pin, delete.
  - **Conversation:** Chat with this specific agent directly.
  - **Activity:** Live feed filtered to this agent.

### 5.8 Agency Creation Wizard

"Create Agency" modal — 4-step wizard:

**Step 1 — Mission:**

- Name: text input.
- Mission: multi-line text. "What is this agency's purpose? Be specific. This will be injected into every agent's context."
- Example: "We are a full-service web development agency. We build custom websites and web applications for small businesses. We prioritize clean code, fast delivery, and clear communication."

**Step 2 — Team Structure:**

- Two options: "AI-suggested teams" (LLM proposes teams based on mission) or "Manual setup".
- AI-suggested: call `POST /api/agency/suggest-teams` with mission text → returns JSON list of `{name, specialty, suggestedRoles[]}`.
- Display suggestions as editable cards. User can add/remove teams, edit team names and roles.

**Step 3 — Agent Configuration:**

- For each team: show role list. User can customize each role's name and system prompt override.
- Provider/model selector per team (or "inherit agency default").
- Member limit slider per team.

**Step 4 — Review and Launch:**

- Summary: N teams, M agents total, provider selection, estimated setup time.
- "Launch Agency" button → calls `POST /api/agency` → `AgencyOrchestrator.bootstrap()` runs asynchronously.
- Progress stream: WebSocket events as agents are spawned, workspaces created, filesystems initialized.
- Redirect to Agency Detail View when bootstrap completes.

**API Routes:**

```
GET    /api/agency                              — list all agency workspaces
POST   /api/agency                              — create new agency (triggers bootstrap)
GET    /api/agency/[agencyId]                   — agency detail + team list
PATCH  /api/agency/[agencyId]                   — update mission, config
DELETE /api/agency/[agencyId]                   — archive agency
POST   /api/agency/[agencyId]/pause             — pause all activity
POST   /api/agency/[agencyId]/resume            — resume all activity
POST   /api/agency/suggest-teams                — LLM team suggestion

GET    /api/agency/[agencyId]/teams             — list teams
POST   /api/agency/[agencyId]/teams             — create new team
GET    /api/agency/[agencyId]/teams/[teamId]    — team detail + members
PATCH  /api/agency/[agencyId]/teams/[teamId]    — update team config
DELETE /api/agency/[agencyId]/teams/[teamId]    — remove team

GET    /api/agency/[agencyId]/teams/[teamId]/messages      — team chat history
POST   /api/agency/[agencyId]/teams/[teamId]/messages      — post to team chat (from user)
GET    /api/agency/[agencyId]/teams/[teamId]/files         — shared files list
GET    /api/agency/[agencyId]/tasks                        — agency task list
POST   /api/agency/[agencyId]/tasks                        — create agency task
PATCH  /api/agency/[agencyId]/tasks/[taskId]               — update task
```

---

## PART 6 — ENHANCED UI/UX FOR ALL NEW FEATURES

### 6.1 Sidebar Navigation Update

Add to sidebar navigation:

```
Dashboard
Onboarding
─────────────────
Agents
Agency            ← NEW (with sub-items expandable)
  └ [Agency Name] → Teams → Agent workspaces
Workspace
─────────────────
Canvas            ← now "Universal Canvas"
Live Feed         ← NEW dedicated page at /feed
Mission Control   ← NEW at /mission (from previous prompt)
─────────────────
Chat
Skills
Tools
Memory
─────────────────
Profiles
Providers         ← now shows OAuth connection options
Logs
Settings
```

### 6.2 Provider Cards — OAuth Design

Each provider card in `/providers` that supports OAuth must have a visually distinct connection section:

- **Google Gemini OAuth card:** Google's official blue brand color (`#4285F4`), Google "G" logo. Two states: "Connect with Google" (outlined button, Google logo) → "Connected" (filled green badge with email, subscription tier, token expiry ring indicator).
- **GitHub Copilot card:** GitHub dark background (`#24292e`), GitHub Octocat logo. Device code display: mono-spaced code in a box with copy button, "Visit github.com/login/device" link with QR code preview.

### 6.3 Agent Color System

Every agent gets a unique color from a fixed palette of 20 colors. This color is used consistently everywhere:

- Agent avatar background.
- Left border on their messages in chat.
- Node color in D3 graph.
- Feed event left bar color.
- Team workspace accent color.

Color assignment: deterministic based on `agentId` hash. Store in `agents` table. Allow override via agent settings.

### 6.4 Workspace Breadcrumb System

Implement a global breadcrumb in the top bar (below workspace selector row) that shows the current navigation context:

```
Workspace: Web Dev Agency > Development Team > Frontend Dev Agent
                [collapse]       [collapse]         [active]
```

Clicking any breadcrumb level navigates to that level's overview. Collapses deeper levels.

### 6.5 Real-Time Status Indicators

**Top bar status row (new slim row between workspace selector and main content):**

- Active agents count (teal dot + number).
- Running tasks count (blue dot + number).
- Any error agents (red dot + number, clickable → navigates to canvas with error filter).
- Token usage today (cost meter with bar).
- Provider health (single dot: green = all healthy, yellow = failover active, red = all down).

This row is always visible across all pages.

---

## PART 7 — CROSS-CUTTING CONCERNS

### 7.1 Performance

- Virtual lists everywhere — `react-virtual` for all lists that could have >50 items (live feed, conversations, file lists, memory entries, logs).
- WebSocket event batching: events within 50ms of each other are batched into a single WS frame.
- D3 graph performance: limit visible nodes to 50 at once; cluster distant nodes. Debounce force simulation.
- Database: add indices for all new tables (listed above). Enable WAL mode: `PRAGMA journal_mode=WAL`.
- Browser screenshots: compress to JPEG at 70% quality before sending over WebSocket.

### 7.2 Agency SOUL Injection

When an agent belongs to a team in an agency:

- Their system prompt is assembled in layers:
  1. Global SOUL.md (base persona).
  2. Agency context block: mission statement, agency name, current date.
  3. Team context block: team name, specialty, team members and their roles, team's current active task.
  4. Agent role block: this agent's specific role, their expertise tags, their responsibilities.
  5. Agent-specific SOUL override (if set).
- This layered injection happens in `ContextAssembler` and updates dynamically when team composition changes.

### 7.3 Agency Long-Running Persistence

Agencies are designed to run indefinitely ("it can go on forever if I want"). Implement:

- Agency heartbeat job: runs every 15 minutes. Checks all teams. Identifies stalled tasks (no progress in >30 min). Escalates to agency orchestrator. Logs heartbeat result.
- Task timeout: configurable per agency (default 2 hours). If task exceeds timeout without completion: escalate + notify via WebSocket.
- Auto-restart: if an agent process crashes, automatically respawn it within the same team context with full memory restored.
- Daily summary: every 24h at midnight, agency orchestrator writes a summary of the day's accomplishments, tasks completed, issues encountered, to the agency's long-term memory and to DEVLOG.md.

### 7.4 Docs Update

After implementing everything:

Update `DEVLOG.md` with dated entry covering all additions.
Update `GRAVITY_CONTEXT.md`:

- Add "Agency Architecture" section describing the three-tier model.
- Add "Subscription Auth" section noting Google OAuth and GitHub Copilot support.
- Add "Persistent Browser" and "Agent Terminal" to Layer 3 (Agent Runtime) description.
- Add "Live Feed" and "Agency Workspace" to UI Navigation Surface.

Update `DEVELOPER_GUIDE.md`:

- Add "Agency Model" section with architecture explanation and code walkthrough.
- Add "OAuth Setup" section for Google and GitHub.
- Add "Browser Profile Management" section.
- Add "Terminal Configuration" section.

Update `README.md` active capabilities list.

### 7.5 New Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "node-pty": "^1.0.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "xterm-addon-web-links": "^0.9.0",
    "node-machine-id": "^1.1.12",
    "google-auth-library": "^9.14.1",
    "open": "^10.1.0",
    "react-virtual": "^2.10.4",
    "diff": "^7.0.0",
    "qrcode": "^1.5.4"
  }
}
```

Note on `node-pty`: it has native bindings. After `npm install`, run `npm rebuild node-pty`. In Docker: ensure `python3`, `make`, `gcc` are in the image.

---

## IMPLEMENTATION ORDER

1. Database schema: add all new tables (`agency_workspaces`, `team_workspaces`, `team_members`, `team_messages`, `agency_tasks`, `team_shared_files`, `live_feed_events`, `terminal_sessions`, `terminal_history`).
2. Agent filesystem (`agent-fs.ts`): foundational, other systems depend on it.
3. Live feed event system: update all existing services to emit events. Build persistence and API.
4. Google OAuth auth flow: initiate → callback → token storage → provider adapter.
5. GitHub Copilot auth flow: device flow → token storage → provider adapter.
6. Provider UI: update providers page with OAuth cards.
7. Agent terminal (`agent-terminal.ts`, PTY, API routes, xterm.js UI component).
8. Persistent browser (`agent-browser.ts`, browser manager, browser tools, live preview).
9. Browser profile management UI.
10. Agency schema + `AgencyOrchestrator` + `TeamOrchestrator`.
11. Team collaboration tools (`team_message`, `team_share_file`, etc.).
12. Agency API routes.
13. Agency SOUL injection layers in `ContextAssembler`.
14. Agency UI: `/agency` page, Agency Detail, Team Detail, Agent Workspace views.
15. Live Feed UI page (`/feed`).
16. Universal Canvas upgrades (agent grid, enhanced graph, browser/terminal indicators).
17. Agency heartbeat job, daily summary, auto-restart.
18. Navigation updates (sidebar, breadcrumb, status row).
19. Performance optimizations (virtual lists, WS batching, D3 clustering).
20. Docs updates (DEVLOG, GRAVITY_CONTEXT, DEVELOPER_GUIDE, README).

---

## VERIFICATION

- [ ] Google OAuth: connect Google account, make a Gemini API call using OAuth token, confirm no API key needed.
- [ ] GitHub Copilot: complete device flow, make a chat completion to Copilot API.
- [ ] OAuth tokens survive server restart (loaded from encrypted file on startup).
- [ ] Token auto-refresh triggers before expiry without user intervention.
- [ ] Playwright persistent browser: navigate to a site, log in, restart server, agent browser still logged in.
- [ ] Browser screenshot streams to UI in real time.
- [ ] Terminal PTY spawns, runs `ls -la`, output streams to xterm.js in UI.
- [ ] Terminal session survives server restart (re-attach to existing PTY or respawn with history).
- [ ] Live feed events appear in UI within 200ms of occurring in the system.
- [ ] Live feed pause/resume works correctly (no events lost).
- [ ] Create agency with 2 teams, 3 agents each → all spawn correctly.
- [ ] Team agents can exchange messages via `team_message` tool.
- [ ] Team messages appear in Team Chat UI in real time.
- [ ] Agency orchestrator can assign a task → team lead picks it up → team members collaborate.
- [ ] Task marked complete → result visible in agency task board.
- [ ] Agent Workspace View: file explorer shows files, terminal works, browser preview works.
- [ ] `/agency` page loads with agency card grid.
- [ ] Clicking agency → team grid → clicking team → agent grid → clicking agent → agent workspace.
- [ ] Agency heartbeat job runs every 15 minutes and logs to DEVLOG.
- [ ] Universal Canvas shows all agents across all workspaces with correct status.
- [ ] Canvas graph animates when agents are active.
- [ ] `npm run check` passes.
- [ ] `npm run build` succeeds.
- [ ] Server starts cleanly, all WebSocket connections establish, all API routes respond.

---

**This is a complete autonomous AI operating system with agency-grade multi-agent orchestration. No scaffolding. No TODOs. Ship it.**
