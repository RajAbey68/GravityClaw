import vm from "node:vm";

export async function runWithTimeout<T>(executor: () => Promise<T>, timeoutMs = 8000): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`Tool timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([executor(), timeout]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function runSandboxedJavascript<TOutput>(
  code: string,
  context: Record<string, unknown>,
  timeoutMs = 250
): TOutput {
  const sandbox = Object.freeze({
    ...context,
    result: undefined as unknown
  }) as Record<string, unknown>;
  const vmContext = vm.createContext(sandbox);
  const script = new vm.Script(code);
  const output = script.runInContext(vmContext, { timeout: timeoutMs });
  return output as TOutput;
}
