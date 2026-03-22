const map = new Map<string, number[]>()
  
export function checkRateLimit(
  userId: string,
  max: number,
  windowSecs: number
) {
  const now = Date.now()
  const window = windowSecs * 1000
  const reqs = (map.get(userId) || [])
    .filter(t => now - t < window)
  if (reqs.length >= max) {
    return { allowed: false }
  }
  map.set(userId, [...reqs, now])
  return { allowed: true }
}
