/**
 * Simple sliding window rate limiter (in-memory).
 */
export class RateLimiter {
  private windows: Map<string, number[]> = new Map();

  constructor(
    private readonly windowMs: number = 60000,
    private readonly maxRequests: number = 20
  ) {}

  /**
   * Check if a request from a specific key (IP, user ID, etc.) is allowed.
   */
  async check(key: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.windows.get(key) || [];

    // Purge expired timestamps
    timestamps = timestamps.filter((ts) => ts > windowStart);

    if (timestamps.length >= this.maxRequests) {
      this.windows.set(key, timestamps);
      const oldest = timestamps[0];
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldest + this.windowMs
      };
    }

    timestamps.push(now);
    this.windows.set(key, timestamps);

    return {
      allowed: true,
      remaining: this.maxRequests - timestamps.length,
      resetAt: now + this.windowMs // This isn't strictly accurate for sliding window but gives a hint
    };
  }

  /**
   * Cleanup method to prevent memory leaks over time.
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.windows.entries()) {
      const active = timestamps.filter((ts) => ts > windowStart);
      if (active.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, active);
      }
    }
  }
}

/**
 * Global registry for multiple rate limiters.
 */
export class RateLimitRegistry {
  private limiters: Map<string, RateLimiter> = new Map();

  get(name: string, windowMs = 60000, maxRequests = 20): RateLimiter {
    if (!this.limiters.has(name)) {
      this.limiters.set(name, new RateLimiter(windowMs, maxRequests));
    }
    return this.limiters.get(name)!;
  }
}
