export function limitFailedAttempts({ windowMs, max, message }) {
  const failures = new Map();

  function removeExpired(now) {
    for (const [key, entry] of failures) {
      if (entry.resetAt <= now) failures.delete(key);
    }
  }

  function countFailure(key) {
    const now = Date.now();
    const entry = failures.get(key);
    if (!entry || entry.resetAt <= now) {
      failures.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;
    }
  }

  return (req, res, next) => {
    const now = Date.now();
    if (failures.size > 1000) removeExpired(now);
    const entry = failures.get(req.ip);
    if (entry && entry.resetAt > now && entry.count >= max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    res.on("finish", () => {
      if (res.statusCode >= 400) countFailure(req.ip);
    });
    next();
  };
}
