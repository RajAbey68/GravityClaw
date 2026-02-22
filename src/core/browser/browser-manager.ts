import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { Page, BrowserContext } from "playwright";

export interface BrowserSession {
  agentId: string;
  context: BrowserContext;
  page: Page;
  lastUsedAt: number;
}

export class BrowserManager {
  private playwright: typeof import("playwright") | undefined;
  private sessions: Map<string, BrowserSession> = new Map();
  private readonly baseProfileDir: string;

  constructor(baseDataDir: string) {
    this.baseProfileDir = path.join(baseDataDir, "browser_profiles");
  }

  async getSession(agentId: string): Promise<BrowserSession> {
    const existing = this.sessions.get(agentId);
    if (existing) {
      existing.lastUsedAt = Date.now();
      return existing;
    }

    if (!this.playwright) {
      this.playwright = await import("playwright");
    }

    const userDataDir = path.join(this.baseProfileDir, agentId);
    await mkdir(userDataDir, { recursive: true });

    const context = await this.playwright.chromium.launchPersistentContext(userDataDir, {
      headless: true,
      viewport: { width: 1280, height: 720 },
      // Reduced memory footprint
      args: ['--disable-gpu', '--single-process', '--no-sandbox']
    });

    const page = context.pages()[0] || (await context.newPage());
    
    const session: BrowserSession = {
      agentId,
      context,
      page,
      lastUsedAt: Date.now()
    };

    this.sessions.set(agentId, session);
    return session;
  }

  async closeSession(agentId: string): Promise<void> {
    const session = this.sessions.get(agentId);
    if (session) {
      await session.context.close();
      this.sessions.delete(agentId);
    }
  }

  async closeAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    await Promise.all(ids.map(id => this.closeSession(id)));
  }
}
