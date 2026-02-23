/**
 * Google OAuth 2.0 PKCE flow for Gemini subscription access.
 * Mirrors the Gemini CLI open-source auth implementation.
 * Stores tokens encrypted at rest in data/auth/google-oauth.json
 */
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { URL } from "node:url";

const CLIENT_ID =
  "6931539499-g2r0f7t97ej3q90cqkjvb7hnrm4ro7s8.apps.googleusercontent.com";
const CLIENT_SECRET = "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"; // public Gemini CLI secret
const REDIRECT_PORT = 9999;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth/callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/generative-language.retriever",
  "https://www.googleapis.com/auth/cloud-platform",
  "openid",
  "email",
  "profile"
];
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
const TOKEN_FILE = path.resolve("data/auth/google-oauth.json");

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
  email?: string;
  tier?: string;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

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

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
  await fs.writeFile(TOKEN_FILE, encrypt(JSON.stringify(tokens)), "utf8");
}

async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const raw = await fs.readFile(TOKEN_FILE, "utf8");
    return JSON.parse(decrypt(raw)) as StoredTokens;
  } catch {
    return null;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<StoredTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken
    }).toString()
  });
  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!data.access_token) {
    throw new Error(`Token refresh failed: ${data.error ?? "unknown"}`);
  }
  const stored = await loadTokens();
  const updated: StoredTokens = {
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    email: stored?.email,
    tier: stored?.tier
  };
  await saveTokens(updated);
  return updated;
}

async function fetchUserInfo(accessToken: string): Promise<{ email?: string }> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = (await response.json()) as { email?: string };
    return data;
  } catch {
    return {};
  }
}

export async function getGoogleAccessToken(): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error("Not authenticated with Google. Run OAuth flow first.");

  const expiresIn = tokens.expires_at - Date.now();
  if (expiresIn < 5 * 60 * 1000) {
    // Refresh if within 5 minutes of expiry
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    return refreshed.access_token;
  }
  return tokens.access_token;
}

export async function getGoogleAuthStatus(): Promise<{
  authenticated: boolean;
  email?: string;
  expiresAt?: number;
  tier?: string;
}> {
  const tokens = await loadTokens();
  if (!tokens) return { authenticated: false };
  return {
    authenticated: true,
    email: tokens.email,
    expiresAt: tokens.expires_at,
    tier: tokens.tier ?? "unknown"
  };
}

export async function revokeGoogleAuth(): Promise<void> {
  const tokens = await loadTokens();
  if (tokens) {
    try {
      await fetch(`${REVOKE_ENDPOINT}?token=${tokens.refresh_token}`, { method: "POST" });
    } catch {
      // Best-effort revoke
    }
  }
  try {
    await fs.unlink(TOKEN_FILE);
  } catch {
    // File may not exist
  }
}

export async function initiateGoogleOAuth(): Promise<{ authUrl: string; verifier: string }> {
  const { verifier, challenge } = generatePKCE();
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent"
  });
  return { authUrl: `${AUTH_ENDPOINT}?${params.toString()}`, verifier };
}

export async function exchangeCodeForTokens(
  code: string,
  verifier: string
): Promise<StoredTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: verifier
    }).toString()
  });
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!data.access_token || !data.refresh_token) {
    throw new Error(`Token exchange failed: ${data.error ?? JSON.stringify(data)}`);
  }
  const userInfo = await fetchUserInfo(data.access_token);
  const tokens: StoredTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    email: userInfo.email,
    tier: "unknown"
  };
  await saveTokens(tokens);
  return tokens;
}

/**
 * Start a local HTTP server on port 9999 to receive the OAuth callback.
 * Returns a promise that resolves with the authorization code.
 */
export function startOAuthCallbackServer(): Promise<{
  code: string;
  server: http.Server;
}> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith("/oauth/callback")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(`<html><body><h2>Auth failed: ${error}</h2><p>Close this tab.</p></body></html>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }
      if (!code) {
        res.writeHead(400, { "content-type": "text/html" });
        res.end("<html><body><h2>No code received</h2></body></html>");
        return;
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`
        <html>
          <body style="font-family:sans-serif;background:#0b1216;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
            <div style="text-align:center">
              <h2 style="color:#00c5a1">✓ Google Account Connected</h2>
              <p style="color:#8899a6">Authentication successful. You can close this tab.</p>
            </div>
          </body>
        </html>
      `);
      resolve({ code, server });
    });
    server.listen(REDIRECT_PORT, () => {
      // Server is listening
    });
    server.on("error", reject);
    // Auto-close after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth callback timeout"));
    }, 5 * 60 * 1000);
  });
}
