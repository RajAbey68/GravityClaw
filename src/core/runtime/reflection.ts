export interface ReflectionDecision {
  verdict: "pass" | "retry";
  summary: string;
  remediation: string;
}

const FAILURE_PATTERNS = [
  "i cannot",
  "i can't",
  "unable to",
  "not enough context",
  "need more information",
  "iteration limit reached",
  "all configured providers are unavailable"
];

function containsFailurePattern(text: string) {
  const lower = text.toLowerCase();
  return FAILURE_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function reflectOnOutput(text: string): ReflectionDecision {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      verdict: "retry",
      summary: "Model returned an empty response.",
      remediation:
        "Return a concrete answer with explicit next actions. If context is missing, ask one precise clarifying question."
    };
  }

  if (trimmed.length < 24) {
    return {
      verdict: "retry",
      summary: "Response is too short to be actionable.",
      remediation:
        "Expand the answer with specific steps, assumptions, and an explicit outcome."
    };
  }

  if (containsFailurePattern(trimmed)) {
    return {
      verdict: "retry",
      summary: "Response indicates unresolved failure.",
      remediation:
        "Provide a recovery plan, include alternative strategies, and avoid generic failure statements."
    };
  }

  return {
    verdict: "pass",
    summary: "Response passes reflection checks.",
    remediation: "No remediation needed."
  };
}
