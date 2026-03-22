// Simple in-memory rate limiting for Next.js API Routes
// Note: In serverless (Vercel), this memory resets per cold start.
// Good enough for MVP abuse protection.

const cache = new Map<string, number[]>();

export function rateLimit(userId: string, action: string, limit: number, windowSeconds: number): { success: boolean, remaining: number } {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  
  if (!cache.has(key)) {
    cache.set(key, []);
  }

  const timestamps = cache.get(key)!;
  // Filter out expired entries
  const activeTimestamps = timestamps.filter(t => now - t < windowMs);
  
  if (activeTimestamps.length >= limit) {
    cache.set(key, activeTimestamps); // update cache
    return { success: false, remaining: 0 };
  }

  activeTimestamps.push(now);
  cache.set(key, activeTimestamps);

  return { success: true, remaining: limit - activeTimestamps.length };
}
