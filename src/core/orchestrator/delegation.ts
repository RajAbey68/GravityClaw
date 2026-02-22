export interface DelegationRequest {
  parentAgentId: string;
  objective: string;
}

export interface DelegationResolution {
  targetAgentId?: string;
  rewrittenObjective: string;
}

function parseSlashDelegate(objective: string): DelegationResolution | undefined {
  const trimmed = objective.trim();
  if (!trimmed.toLowerCase().startsWith("/delegate ")) {
    return undefined;
  }

  const payload = trimmed.replace(/^\/delegate\s+/i, "").trim();
  const [agentId, ...rest] = payload.split(" ");
  if (!agentId || rest.length === 0) {
    return undefined;
  }

  return {
    targetAgentId: agentId,
    rewrittenObjective: rest.join(" ").trim()
  };
}

function parseMentionDelegate(objective: string): DelegationResolution | undefined {
  const match = objective.match(/^@([a-zA-Z0-9\-_]+)\s*:\s*(.+)$/);
  if (!match) {
    return undefined;
  }

  return {
    targetAgentId: match[1],
    rewrittenObjective: match[2].trim()
  };
}

export function resolveDelegationObjective(request: DelegationRequest): DelegationResolution {
  const slash = parseSlashDelegate(request.objective);
  if (slash) {
    return slash;
  }

  const mention = parseMentionDelegate(request.objective);
  if (mention) {
    return mention;
  }

  return {
    rewrittenObjective: request.objective.trim()
  };
}
