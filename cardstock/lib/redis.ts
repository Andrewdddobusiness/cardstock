export async function withThrottle(key: string, ttlSec: number, fn: () => Promise<void>) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    // No redis configured, run function directly
    return fn();
  }

  const lockKey = `lock:${key}`;
  
  try {
    const res = await fetch(
      `${url}/set/${encodeURIComponent(lockKey)}/1?EX=${ttlSec}&NX=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    const data = await res.json();
    const acquired = data.result === "OK";
    
    if (!acquired) {
      // Lock already held, skip execution
      return;
    }
    
    // Execute the function
    await fn();
  } catch (error) {
    // If Redis fails, execute anyway
    console.error("Redis throttle error:", error);
    await fn();
  }
}