import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";
import { BrowserManager } from "@/src/core/browser/browser-manager";

interface BrowserNavigateInput {
  url: string;
}

interface BrowserClickInput {
  selector: string;
}

interface BrowserTypeInput {
  selector: string;
  text: string;
}

interface BrowserExtractInput {
  selector?: string;
}

interface BrowserFillFormInput {
  fields: Array<{ selector: string; value: string }>;
}

interface BrowserWaitInput {
  ms: number;
}

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true;
  }
  if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) {
    return true;
  }
  const match = host.match(/^172\.(\d+)\./);
  if (match) {
    const block = Number(match[1]);
    return block >= 16 && block <= 31;
  }
  return false;
}

function assertSafeNavigation(target: string) {
  const parsed = new URL(target);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("only http/https navigation is allowed");
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error("local/private network targets are blocked");
  }
}

export function createBrowserTools(browserManager: BrowserManager): Array<ToolDefinition<any, any>> {
  const navigateTool: ToolDefinition<BrowserNavigateInput, { url: string; title: string }> = {
    id: "browser_navigate",
    description: "Navigate browser to a URL and return title.",
    risk: "elevated",
    async execute(input: BrowserNavigateInput, ctx: ToolExecutionContext) {
      const target = input.url?.trim();
      if (!target) throw new Error("url is required");
      assertSafeNavigation(target);
      const session = await browserManager.getSession(ctx.agentId);
      await session.page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return {
        url: session.page.url(),
        title: await session.page.title()
      };
    }
  };

  const clickTool: ToolDefinition<BrowserClickInput, { clicked: string; url: string }> = {
    id: "browser_click",
    description: "Click an element in the active browser page.",
    risk: "elevated",
    async execute(input: BrowserClickInput, ctx: ToolExecutionContext) {
      const selector = input.selector?.trim();
      if (!selector) throw new Error("selector is required");
      const session = await browserManager.getSession(ctx.agentId);
      await session.page.click(selector, { timeout: 15_000 });
      return { clicked: selector, url: session.page.url() };
    }
  };

  const typeTool: ToolDefinition<BrowserTypeInput, { typed: string; selector: string }> = {
    id: "browser_type",
    description: "Type text into an element in the active browser page.",
    risk: "elevated",
    async execute(input: BrowserTypeInput, ctx: ToolExecutionContext) {
      const selector = input.selector?.trim();
      if (!selector) throw new Error("selector is required");
      const session = await browserManager.getSession(ctx.agentId);
      await session.page.fill(selector, input.text ?? "", { timeout: 15_000 });
      return {
        typed: String(input.text ?? "").slice(0, 200),
        selector
      };
    }
  };

  const screenshotTool: ToolDefinition<Record<string, never>, { mimeType: string; base64: string }> = {
    id: "browser_screenshot",
    description: "Capture screenshot from active browser page as base64 PNG.",
    risk: "elevated",
    async execute(_input: Record<string, never>, ctx: ToolExecutionContext) {
      const session = await browserManager.getSession(ctx.agentId);
      const screenshot = await session.page.screenshot({ type: "png", fullPage: true });
      return {
        mimeType: "image/png",
        base64: screenshot.toString("base64")
      };
    }
  };

  const extractTool: ToolDefinition<BrowserExtractInput, { text: string; selector: string }> = {
    id: "browser_extract",
    description: "Extract text from page body or a specific selector.",
    risk: "elevated",
    async execute(input: BrowserExtractInput, ctx: ToolExecutionContext) {
      const session = await browserManager.getSession(ctx.agentId);
      const selector = input.selector?.trim() || "body";
      const text = await session.page.locator(selector).innerText({ timeout: 15_000 });
      return {
        text: text.slice(0, 40_000),
        selector
      };
    }
  };

  const fillFormTool: ToolDefinition<BrowserFillFormInput, { filled: number }> = {
    id: "browser_fill_form",
    description: "Fill multiple form fields in active browser page.",
    risk: "elevated",
    async execute(input: BrowserFillFormInput, ctx: ToolExecutionContext) {
      const fields = Array.isArray(input.fields) ? input.fields : [];
      if (fields.length === 0) {
        throw new Error("fields are required");
      }
      const session = await browserManager.getSession(ctx.agentId);
      for (const field of fields) {
        const selector = field.selector?.trim();
        if (!selector) continue;
        await session.page.fill(selector, String(field.value ?? ""), { timeout: 15_000 });
      }
      return {
        filled: fields.length
      };
    }
  };

  const waitTool: ToolDefinition<BrowserWaitInput, { waitedMs: number }> = {
    id: "browser_wait",
    description: "Wait for a specified duration in the active browser session.",
    risk: "safe",
    async execute(input: BrowserWaitInput, ctx: ToolExecutionContext) {
      const session = await browserManager.getSession(ctx.agentId);
      const waitedMs = Math.max(0, Math.min(Number(input.ms ?? 0), 30_000));
      await session.page.waitForTimeout(waitedMs);
      return { waitedMs };
    }
  };

  return [navigateTool, clickTool, typeTool, screenshotTool, extractTool, fillFormTool, waitTool];
}
