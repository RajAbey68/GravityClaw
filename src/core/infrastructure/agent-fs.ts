import path from "node:path";
import { mkdir, writeFile, readFile, readdir, rm, stat } from "node:fs/promises";

export class AgentFilesystem {
  private readonly baseDir: string;

  constructor(baseDataDir: string) {
    this.baseDir = path.join(baseDataDir, "agent_fs");
  }

  private getAgentRoot(agentId: string): string {
    return path.join(this.baseDir, agentId);
  }

  private resolvePath(agentId: string, relativePath: string): string {
    const root = this.getAgentRoot(agentId);
    const resolved = path.resolve(root, relativePath);
    if (!resolved.startsWith(root)) {
      throw new Error("Access denied: Path is outside of agent sandbox");
    }
    return resolved;
  }

  async ensureAgentRoot(agentId: string): Promise<void> {
    await mkdir(this.getAgentRoot(agentId), { recursive: true });
  }

  async write(agentId: string, filePath: string, content: string | Buffer): Promise<void> {
    const resolved = this.resolvePath(agentId, filePath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, content);
  }

  async read(agentId: string, filePath: string): Promise<Buffer> {
    const resolved = this.resolvePath(agentId, filePath);
    return readFile(resolved);
  }

  async list(agentId: string, dirPath = "."): Promise<string[]> {
    const resolved = this.resolvePath(agentId, dirPath);
    try {
      return await readdir(resolved);
    } catch (error) {
      if ((error as any).code === 'ENOENT') return [];
      throw error;
    }
  }

  async delete(agentId: string, targetPath: string): Promise<void> {
    const resolved = this.resolvePath(agentId, targetPath);
    await rm(resolved, { recursive: true, force: true });
  }

  async getInfo(agentId: string, targetPath: string) {
    const resolved = this.resolvePath(agentId, targetPath);
    return stat(resolved);
  }
}
