import { SQLiteMemoryDB } from "@/src/core/memory/db";

interface MemoryRow {
  id: number;
  namespace: string;
  kind: string;
  content: string;
  created_at: string;
  pinned: number | null;
  metadata_json: string | null;
}

function compatibleNamespaces(workspaceId: string, namespace: string) {
  const scopedMain = `workspace:${workspaceId}:main`;
  if (namespace === "main" || namespace === scopedMain) {
    return [scopedMain];
  }
  // Ensure the namespace is always scoped to the workspace
  if (namespace.startsWith(`workspace:${workspaceId}:`)) {
    return [namespace];
  }
  return [`workspace:${workspaceId}:${namespace}`];
}

function toMemoryView(row: MemoryRow) {
  return {
    id: row.id,
    namespace: row.namespace,
    kind: row.kind,
    content: row.content,
    created_at: row.created_at,
    pinned: (row.pinned ?? 0) === 1,
    metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : undefined
  };
}

function buildEmbeddingMeta(content: string) {
  const tokens = content.split(/\s+/).filter(Boolean).length;
  return {
    strategy: "lexical-fingerprint",
    tokenEstimate: tokens,
    charLength: content.length,
    updatedAt: new Date().toISOString()
  };
}

export class MemoryRepository {
  constructor(private readonly db: SQLiteMemoryDB) {}

  async addShortTerm(workspaceId: string, namespace: string, content: string) {
    await this.add(workspaceId, namespace, "short-term", content);
  }

  async addLongTerm(workspaceId: string, namespace: string, kind: string, content: string) {
    const normalizedKind = kind.startsWith("long-term:") ? kind : `long-term:${kind}`;
    await this.add(workspaceId, namespace, normalizedKind, content);
  }

  async add(workspaceId: string, namespace: string, kind: string, content: string) {
    const createdAt = new Date().toISOString();
    const [scopedNamespace] = compatibleNamespaces(workspaceId, namespace);
    const inserted = await this.db.run(
      `INSERT INTO memories (namespace, kind, content, created_at)
       VALUES (?, ?, ?, ?)`,
      [scopedNamespace, kind, content, createdAt]
    );
    await this.db.run(
      `INSERT INTO memory_annotations (memory_id, pinned, metadata_json, access_count, updated_at)
       VALUES (?, 0, ?, 0, ?)
       ON CONFLICT(memory_id) DO UPDATE SET 
         metadata_json = excluded.metadata_json, 
         updated_at = excluded.updated_at`,
      [inserted.lastID, JSON.stringify(buildEmbeddingMeta(content)), createdAt]
    );
  }

  async list(workspaceId: string, namespace?: string, limit = 100) {
    if (namespace) {
      const namespaces = compatibleNamespaces(workspaceId, namespace);
      const rows = await this.db.all<MemoryRow>(
        `SELECT m.id, m.namespace, m.kind, m.content, m.created_at, a.pinned, a.metadata_json
         FROM memories m
         LEFT JOIN memory_annotations a ON a.memory_id = m.id
         WHERE m.namespace IN (${namespaces.map(() => "?").join(",")})
         ORDER BY m.id DESC
         LIMIT ?`,
        [...namespaces, limit]
      );
      return rows.map(toMemoryView);
    }

    const rows = await this.db.all<MemoryRow>(
      `SELECT m.id, m.namespace, m.kind, m.content, m.created_at, a.pinned, a.metadata_json
       FROM memories m
       LEFT JOIN memory_annotations a ON a.memory_id = m.id
       WHERE m.namespace LIKE ?
       ORDER BY m.id DESC
       LIMIT ?`,
      [`workspace:${workspaceId}:%`, limit]
    );
    return rows.map(toMemoryView);
  }

  async search(input: { workspaceId: string; query: string; namespaces?: string[]; kinds?: string[]; limit?: number }) {
    const cleanedQuery = input.query
      .trim()
      .replace(/["']/g, " ")
      .split(/\s+/)
      .map((token) => token.replace(/[^a-zA-Z0-9_-]/g, ""))
      .filter(Boolean)
      .slice(0, 12)
      .join(" ");
    if (!cleanedQuery) {
      return [];
    }

    const limit = Math.max(1, Math.min(input.limit ?? 8, 30));
    const rawNamespaces = (input.namespaces ?? []).filter(Boolean);
    const namespaces = rawNamespaces.length > 0
      ? rawNamespaces.flatMap(ns => compatibleNamespaces(input.workspaceId, ns))
      : [`workspace:${input.workspaceId}:%`];

    const kinds = (input.kinds ?? []).filter(Boolean);
    const namespaceOperator = rawNamespaces.length > 0 ? "IN" : "LIKE";
    const namespaceFilter = `AND f.namespace ${namespaceOperator} (${namespaces.map(() => "?").join(",")})`;
    const kindFilter =
      kinds.length > 0
        ? `AND m.kind IN (${kinds.map(() => "?").join(",")})`
        : "";

    const rows = await this.db.all<{
      id: number;
      namespace: string;
      kind: string;
      content: string;
      rank: number;
      created_at: string;
      pinned: number | null;
      metadata_json: string | null;
    }>(
      `SELECT m.id, m.namespace, m.kind, m.content, bm25(memories_fts) AS rank, m.created_at, a.pinned, a.metadata_json
       FROM memories_fts f
       JOIN memories m ON m.id = f.rowid
       LEFT JOIN memory_annotations a ON a.memory_id = m.id
       WHERE memories_fts MATCH ?
       ${namespaceFilter}
       ${kindFilter}
       ORDER BY rank
       LIMIT ?`,
      [cleanedQuery, ...namespaces, ...kinds, limit]
    );

    // Increment access counts for results
    if (rows.length > 0) {
      const ids = rows.map(r => r.id);
      const placeholders = ids.map(() => "?").join(",");
      const now = Date.now();
      await this.db.run(
        `UPDATE memory_annotations 
         SET access_count = access_count + 1, last_accessed = ?
         WHERE memory_id IN (${placeholders})`,
        [now, ...ids]
      );
    }

    return rows.map((row) => ({
      ...toMemoryView({
        id: row.id,
        namespace: row.namespace,
        kind: row.kind,
        content: row.content,
        created_at: row.created_at,
        pinned: row.pinned,
        metadata_json: row.metadata_json
      }),
      rank: row.rank
    }));
  }

  async getById(memoryId: number) {
    const row = await this.db.get<MemoryRow>(
      `SELECT m.id, m.namespace, m.kind, m.content, m.created_at, a.pinned, a.metadata_json
       FROM memories m
       LEFT JOIN memory_annotations a ON a.memory_id = m.id
       WHERE m.id = ?`,
      [memoryId]
    );
    if (!row) return undefined;
    
    await this.db.run(
      `UPDATE memory_annotations SET access_count = access_count + 1, last_accessed = ? WHERE memory_id = ?`,
      [Date.now(), memoryId]
    );

    return toMemoryView(row);
  }

  async getMemoriesForEvolution(workspaceId: string, namespace: string, limit = 50) {
    const namespaces = compatibleNamespaces(workspaceId, namespace);
    const rows = await this.db.all<MemoryRow & { access_count: number }>(
      `SELECT m.id, m.namespace, m.kind, m.content, m.created_at, a.pinned, a.metadata_json, a.access_count
       FROM memories m
       LEFT JOIN memory_annotations a ON a.memory_id = m.id
       WHERE m.namespace IN (${namespaces.map(() => "?").join(",")})
       AND m.kind IN ('short-term', 'archival')
       ORDER BY a.access_count DESC, m.id DESC
       LIMIT ?`,
      [...namespaces, limit]
    );
    return rows.map(r => ({ ...toMemoryView(r), accessCount: r.access_count }));
  }

  async updateAnnotation(memoryId: number, update: { summary?: string; topicCluster?: string }) {
    const sets: string[] = [];
    const params: any[] = [];
    
    if (update.summary !== undefined) {
      sets.push("summary = ?");
      params.push(update.summary);
    }
    if (update.topicCluster !== undefined) {
      sets.push("topic_cluster = ?");
      params.push(update.topicCluster);
    }
    
    if (sets.length === 0) return;
    
    sets.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(memoryId);

    await this.db.run(
      `UPDATE memory_annotations SET ${sets.join(", ")} WHERE memory_id = ?`,
      params
    );
  }

  async archiveShortTerm(workspaceId: string, namespace: string, keepLatest = 24) {
    const [scopedNamespace] = compatibleNamespaces(workspaceId, namespace);
    const rows = await this.db.all<{ id: number }>(
      `SELECT id
       FROM memories
       WHERE namespace = ? AND kind = 'short-term'
       ORDER BY id DESC
       LIMIT -1 OFFSET ?`,
      [scopedNamespace, keepLatest]
    );
    if (rows.length === 0) {
      return 0;
    }

    const ids = rows.map((row) => row.id);
    const placeholders = ids.map(() => "?").join(",");
    await this.db.run(
      `UPDATE memories
       SET kind = 'archival'
       WHERE id IN (${placeholders})`,
      ids
    );
    return ids.length;
  }

  async compressNamespace(workspaceId: string, namespace: string, maxRows = 20) {
    const rows = await this.list(workspaceId, namespace, maxRows);
    if (rows.length < 6) {
      return undefined;
    }

    const summary = rows
      .slice(0, 12)
      .reverse()
      .map((row) => `- [${row.kind}] ${row.content}`)
      .join("\n");

    const compressed = `Compressed context snapshot:\n${summary}`;
    await this.add(workspaceId, namespace, "compressed", compressed);
    return compressed;
  }

  async retrieveContext(input: {
    workspaceId: string;
    query: string;
    shortTermNamespace: string;
    longTermNamespaces: string[];
    limit?: number;
  }) {
    const longTermKinds = [
      "long-term",
      "compressed",
      "archival",
      "long-term:fact",
      "long-term:preference",
      "long-term:summary",
      "long-term:task"
    ];

    return this.search({
      workspaceId: input.workspaceId,
      query: input.query,
      namespaces: [...new Set(input.longTermNamespaces.filter(Boolean))],
      kinds: longTermKinds,
      limit: input.limit ?? 10
    });
  }

  async pin(memoryId: number, pinned: boolean) {
    const row = await this.db.get<{ id: number; content: string }>(
      `SELECT id, content FROM memories WHERE id = ?`,
      [memoryId]
    );
    if (!row) {
      return false;
    }

    await this.db.run(
      `INSERT INTO memory_annotations (memory_id, pinned, metadata_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(memory_id) DO UPDATE SET
         pinned = excluded.pinned,
         updated_at = excluded.updated_at`,
      [memoryId, pinned ? 1 : 0, JSON.stringify(buildEmbeddingMeta(row.content)), new Date().toISOString()]
    );
    return true;
  }

  async delete(memoryId: number) {
    const existing = await this.db.get<{ id: number }>(`SELECT id FROM memories WHERE id = ?`, [memoryId]);
    if (!existing) {
      return false;
    }
    await this.db.run(`DELETE FROM memory_annotations WHERE memory_id = ?`, [memoryId]);
    await this.db.run(`DELETE FROM memories WHERE id = ?`, [memoryId]);
    return true;
  }

  async usageStats(namespace?: string) {
    const row = namespace
      ? await this.db.get<{
          total: number;
          pinned: number;
          short_term: number;
          long_term: number;
          archival: number;
          compressed: number;
          bytes: number;
          namespaces: number;
        }>(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN COALESCE(a.pinned, 0) = 1 THEN 1 ELSE 0 END) AS pinned,
             SUM(CASE WHEN m.kind = 'short-term' THEN 1 ELSE 0 END) AS short_term,
             SUM(CASE WHEN m.kind LIKE 'long-term:%' OR m.kind = 'long-term' THEN 1 ELSE 0 END) AS long_term,
             SUM(CASE WHEN m.kind = 'archival' THEN 1 ELSE 0 END) AS archival,
             SUM(CASE WHEN m.kind = 'compressed' THEN 1 ELSE 0 END) AS compressed,
             COALESCE(SUM(LENGTH(m.content)), 0) AS bytes,
             COUNT(DISTINCT m.namespace) AS namespaces
           FROM memories m
           LEFT JOIN memory_annotations a ON a.memory_id = m.id
           WHERE m.namespace = ?`,
          [namespace]
        )
      : await this.db.get<{
          total: number;
          pinned: number;
          short_term: number;
          long_term: number;
          archival: number;
          compressed: number;
          bytes: number;
          namespaces: number;
        }>(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN COALESCE(a.pinned, 0) = 1 THEN 1 ELSE 0 END) AS pinned,
             SUM(CASE WHEN m.kind = 'short-term' THEN 1 ELSE 0 END) AS short_term,
             SUM(CASE WHEN m.kind LIKE 'long-term:%' OR m.kind = 'long-term' THEN 1 ELSE 0 END) AS long_term,
             SUM(CASE WHEN m.kind = 'archival' THEN 1 ELSE 0 END) AS archival,
             SUM(CASE WHEN m.kind = 'compressed' THEN 1 ELSE 0 END) AS compressed,
             COALESCE(SUM(LENGTH(m.content)), 0) AS bytes,
             COUNT(DISTINCT m.namespace) AS namespaces
           FROM memories m
           LEFT JOIN memory_annotations a ON a.memory_id = m.id`
        );

    return {
      total: row?.total ?? 0,
      pinned: row?.pinned ?? 0,
      shortTerm: row?.short_term ?? 0,
      longTerm: row?.long_term ?? 0,
      archival: row?.archival ?? 0,
      compressed: row?.compressed ?? 0,
      bytes: row?.bytes ?? 0,
      namespaces: row?.namespaces ?? 0
    };
  }

  async setSetting(key: string, value: string) {
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, now]
    );
  }

  async getSetting(key: string) {
    const row = await this.db.get<{ value: string }>(
      `SELECT value FROM system_settings WHERE key = ?`,
      [key]
    );
    return row?.value;
  }
}
