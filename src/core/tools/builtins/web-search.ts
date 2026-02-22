import type { ToolDefinition, ToolExecutionContext } from "@/src/core/types";

interface WebSearchInput {
  query: string;
  max_results?: number;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: "serpapi" | "brave" | "duckduckgo";
}

interface WebSearchOutput {
  backend: "serpapi" | "brave" | "duckduckgo";
  results: WebSearchResult[];
}

function limitCount(value: number | undefined) {
  return Math.max(1, Math.min(value ?? 5, 10));
}

async function searchSerpApi(query: string, maxResults: number, key: string) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", key);
  url.searchParams.set("num", String(maxResults));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`serpapi failed with status ${response.status}`);
  }
  const payload = (await response.json()) as {
    organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (payload.organic_results ?? [])
    .slice(0, maxResults)
    .map((entry) => ({
      title: entry.title ?? "untitled",
      url: entry.link ?? "",
      snippet: entry.snippet ?? "",
      source: "serpapi" as const
    }))
    .filter((entry) => Boolean(entry.url));
}

async function searchBrave(query: string, maxResults: number, key: string) {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(maxResults));
  const response = await fetch(url, {
    headers: {
      "X-Subscription-Token": key
    }
  });
  if (!response.ok) {
    throw new Error(`brave failed with status ${response.status}`);
  }
  const payload = (await response.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  return (payload.web?.results ?? [])
    .slice(0, maxResults)
    .map((entry) => ({
      title: entry.title ?? "untitled",
      url: entry.url ?? "",
      snippet: entry.description ?? "",
      source: "brave" as const
    }))
    .filter((entry) => Boolean(entry.url));
}

async function searchDuckDuckGo(query: string, maxResults: number) {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_redirect", "1");
  url.searchParams.set("no_html", "1");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`duckduckgo failed with status ${response.status}`);
  }
  const payload = (await response.json()) as {
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
  };

  const flattened: Array<{ Text?: string; FirstURL?: string }> = [];
  for (const topic of payload.RelatedTopics ?? []) {
    if (topic.Topics) {
      flattened.push(...topic.Topics);
      continue;
    }
    flattened.push(topic);
  }

  return flattened
    .filter((entry) => entry.FirstURL)
    .slice(0, maxResults)
    .map((entry) => ({
      title: (entry.Text ?? "duckduckgo result").split(" - ")[0] ?? "duckduckgo result",
      url: entry.FirstURL ?? "",
      snippet: entry.Text ?? "",
      source: "duckduckgo" as const
    }));
}

export function createWebSearchTool(): ToolDefinition<WebSearchInput, WebSearchOutput> {
  return {
    id: "web_search",
    description: "Search the web using SerpAPI, Brave, or DuckDuckGo fallback.",
    risk: "safe",
    async execute(input: WebSearchInput, _ctx: ToolExecutionContext) {
      const query = input.query?.trim();
      if (!query) {
        throw new Error("query is required");
      }
      const maxResults = limitCount(input.max_results);
      const serpApiKey = process.env.SERPAPI_KEY?.trim();
      const braveKey = process.env.BRAVE_SEARCH_KEY?.trim();

      if (serpApiKey) {
        const results = await searchSerpApi(query, maxResults, serpApiKey);
        return { backend: "serpapi", results };
      }

      if (braveKey) {
        const results = await searchBrave(query, maxResults, braveKey);
        return { backend: "brave", results };
      }

      const results = await searchDuckDuckGo(query, maxResults);
      return { backend: "duckduckgo", results };
    }
  };
}
