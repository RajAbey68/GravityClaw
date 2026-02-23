/**
 * GitHub Copilot OAuth — Device Flow Authentication
 * Enables: GitHub Copilot Individual/Business users to use Copilot-backed models
 * Flow: Device code → user completes on github.com → poll → exchange → Copilot token
 * Stores: data/auth/github-copilot.json (AES-256-GCM encrypted)
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// VS Code Copilot extension client ID (public, open-source)
const CLIENT_ID = "Iv1.b507a08c87ecfe98";
const DEVICE_CODE_ENDPOINT = "https://github.com/login/device/code";
const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const COPILOT_TOKEN_ENDPOINT = "https://api.github.com/copilot_internal/v2/token";
const COPILOT_MODELS_ENDPOINT = "https://api.githubcopilot.com/models";
const TOKEN_FILE = path.resolve("data/auth/github-copilot.json");
const COPILOT_SCOPE = "copilot";

// Required headers for Copilot API calls
export const COPILOT_HEADERS = {
  "Copilot-Integration-Id": "vscode-chat",
  "Editor-Plugin-Version": "copilot-chat/0.22.4",
  "Editor-Version": "vscode/1.95.3",
  "User-Agent": "GravityClaw/1.0"
};

export interface DeviceFlowInitiation {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface CopilotAuthStatus {
  authenticated: boolean;
  githubLogin?: string;
  copilotPlan?: string;
  tokenExpiresAt?: number;
  availableModels?: string[];
}

interface StoredCopilotTokens {
  githubToken: string;
  copilotToken: string;
  copilotTokenExpiresAt: number; // unix ms — copilot tokens expire ~30 min
  githubLogin?: string;
  copilotPlan?: string;
}

// ─── Encryption (matches google-oauth.ts key derivation) ─────────────────────

function getEncryptionKey(): Buffer {
  const salt = process.env.AUTH_ENCRYPTION_SALT ?? "gravity-claw-default-salt-0000000";
  return crypto.pbkdf2Sync("gravity-claw-machine-key", salt, 100_000, 32, "sha256");
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(data: string): string {
  const buf = Buffer.from(data, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

async function saveTokens(tokens: StoredCopilotTokens): Promise<void> {
  await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
  await fs.writeFile(TOKEN_FILE, encrypt(JSON.stringify(tokens)), "utf8");
}

async function loadTokens(): Promise<StoredCopilotTokens | null> {
  try {
    const raw = await fs.readFile(TOKEN_FILE, "utf8");
    return JSON.parse(decrypt(raw)) as StoredCopilotTokens;
  } catch {
    return null;
  }
}

// ─── Copilot Token Management ─────────────────────────────────────────────────

async function refreshCopilotToken(githubToken: string): Promise<string> {
  const response = await fetch(COPILOT_TOKEN_ENDPOINT, {
    method: "GET",
    headers: {
      Authorization: `token ${githubToken}`,
      "User-Agent": "GravityClaw/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get Copilot token: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { token?: string; expires_at?: string };
  if (!data.token) {
    throw new Error("Copilot token response missing token field");
  }

  // Update stored tokens with fresh copilot token
  const stored = await loadTokens();
  if (stored) {
    stored.copilotToken = data.token;
    stored.copilotTokenExpiresAt = data.expires_at
      ? new Date(data.expires_at).getTime()
      : Date.now() + 28 * 60 * 1000; // 28 min (expires in ~30 min)
    await saveTokens(stored);
  }

  return data.token;
}

export async function getCopilotToken(): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) {
    throw new Error("Not authenticated with GitHub Copilot. Complete device flow first.");
  }

  const expiresIn = tokens.copilotTokenExpiresAt - Date.now();
  if (expiresIn < 2 * 60 * 1000) {
    // Refresh 2 minutes before expiry
    return await refreshCopilotToken(tokens.githubToken);
  }

  return tokens.copilotToken;
}

// ─── Device Flow ──────────────────────────────────────────────────────────────

export async function initiateDeviceFlow(): Promise<DeviceFlowInitiation> {
  const response = await fetch(DEVICE_CODE_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "GravityClaw/1.0"
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      scope: COPILOT_SCOPE
    }).toString()
  });

  if (!response.ok) {
    throw new Error(`Device code request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    expires_in?: number;
    interval?: number;
    error?: string;
  };

  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new Error(`Invalid device flow response: ${JSON.stringify(data)}`);
  }

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in ?? 900,
    interval: data.interval ?? 5
  };
}

/**
 * Poll until user completes auth or timeout. Returns GitHub access token.
 * Call this after initiateDeviceFlow() and displaying user_code to user.
 */
export async function pollForToken(
  deviceCode: string,
  intervalSeconds: number,
  timeoutMs: number = 5 * 60 * 1000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const pollInterval = intervalSeconds * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "GravityClaw/1.0"
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      }).toString()
    });

    const data = (await response.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (data.access_token) {
      return data.access_token;
    }

    if (data.error === "authorization_pending") {
      continue; // User hasn't completed yet
    }

    if (data.error === "slow_down") {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Extra delay
      continue;
    }

    if (data.error === "expired_token") {
      throw new Error("Device code expired. Start auth flow again.");
    }

    if (data.error === "access_denied") {
      throw new Error("User denied access.");
    }

    // Other error — continue or throw
    if (data.error) {
      throw new Error(`Auth error: ${data.error} — ${data.error_description ?? ""}`);
    }
  }

  throw new Error("Device flow timed out after 5 minutes");
}

export async function completeDeviceFlow(githubToken: string): Promise<CopilotAuthStatus> {
  // Get GitHub user info
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `token ${githubToken}`,
      "User-Agent": "GravityClaw/1.0"
    }
  });
  const userInfo = (await userResponse.json()) as { login?: string };

  // Exchange for Copilot token
  const copilotTokenResponse = await fetch(COPILOT_TOKEN_ENDPOINT, {
    headers: {
      Authorization: `token ${githubToken}`,
      "User-Agent": "GravityClaw/1.0"
    }
  });

  if (!copilotTokenResponse.ok) {
    throw new Error(
      `Failed to get Copilot token. Make sure you have an active Copilot subscription. Status: ${copilotTokenResponse.status}`
    );
  }

  const copilotData = (await copilotTokenResponse.json()) as {
    token?: string;
    expires_at?: string;
  };

  if (!copilotData.token) {
    throw new Error("Copilot token not received. Ensure Copilot subscription is active.");
  }

  const copilotTokenExpiresAt = copilotData.expires_at
    ? new Date(copilotData.expires_at).getTime()
    : Date.now() + 28 * 60 * 1000;

  const stored: StoredCopilotTokens = {
    githubToken,
    copilotToken: copilotData.token,
    copilotTokenExpiresAt,
    githubLogin: userInfo.login,
    copilotPlan: "Individual" // Detected later if needed
  };

  await saveTokens(stored);

  // Try fetching available models
  let models: string[] = [];
  try {
    models = await fetchCopilotModels(copilotData.token);
  } catch {
    models = ["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-6", "o3-mini"];
  }

  return {
    authenticated: true,
    githubLogin: userInfo.login,
    copilotPlan: stored.copilotPlan,
    tokenExpiresAt: copilotTokenExpiresAt,
    availableModels: models
  };
}

async function fetchCopilotModels(copilotToken: string): Promise<string[]> {
  const response = await fetch(COPILOT_MODELS_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${copilotToken}`,
      ...COPILOT_HEADERS
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Copilot models: ${response.status}`);
  }

  const data = (await response.json()) as { data?: Array<{ id: string }> };
  return data.data?.map((m) => m.id) ?? [];
}

export async function getCopilotAuthStatus(): Promise<CopilotAuthStatus> {
  const tokens = await loadTokens();
  if (!tokens) return { authenticated: false };

  let models: string[] = [];
  try {
    const copilotToken = await getCopilotToken(); // Auto-refresh if needed
    models = await fetchCopilotModels(copilotToken);
  } catch {
    models = [];
  }

  return {
    authenticated: true,
    githubLogin: tokens.githubLogin,
    copilotPlan: tokens.copilotPlan,
    tokenExpiresAt: tokens.copilotTokenExpiresAt,
    availableModels: models
  };
}

export async function revokeCopilotAuth(): Promise<void> {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch {
    // File may not exist
  }
}
