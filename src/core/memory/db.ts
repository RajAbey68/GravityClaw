import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
import { schemaStatements } from "@/src/core/memory/schema";

export interface RunResult {
  lastID: number;
  changes: number;
}

export class SQLiteMemoryDB {
  private readonly db: sqlite3.Database;

  constructor(private readonly dbPath: string) {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
    sqlite3.verbose();
    this.db = new sqlite3.Database(dbPath);
  }

  async init() {
    for (const statement of schemaStatements) {
      await this.run(statement);
    }
    await this.run(`INSERT INTO memories_fts(memories_fts) VALUES('rebuild');`);
  }

  run(sql: string, params: unknown[] = []) {
    return new Promise<RunResult>((resolve, reject) => {
      this.db.run(sql, params, function onRun(error) {
        if (error) {
          reject(error);
          return;
        }
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  get<T>(sql: string, params: unknown[] = []) {
    return new Promise<T | undefined>((resolve, reject) => {
      this.db.get(sql, params, (error, row) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(row as T | undefined);
      });
    });
  }

  all<T>(sql: string, params: unknown[] = []) {
    return new Promise<T[]>((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(rows as T[]);
      });
    });
  }
}
