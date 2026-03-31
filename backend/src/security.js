const rateStores = {
  api: new Map(),
  auth: new Map()
};

const loginAttempts = new Map();

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function now() {
  return Date.now();
}

function normalizeIp(req) {
  const raw = req.ip || req.headers["x-forwarded-for"] || "unknown";
  return String(raw).split(",")[0].trim();
}

function getRateConfig(scope) {
  if (scope === "auth") {
    return {
      windowMs: toInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 60_000),
      max: toInt(process.env.AUTH_RATE_LIMIT_MAX, 30)
    };
  }
  return {
    windowMs: toInt(process.env.API_RATE_LIMIT_WINDOW_MS, 60_000),
    max: toInt(process.env.API_RATE_LIMIT_MAX, 300)
  };
}

function checkRateLimit(scope, key) {
  const store = rateStores[scope];
  const { windowMs, max } = getRateConfig(scope);
  const ts = now();

  const item = store.get(key);
  if (!item || item.resetAt <= ts) {
    const next = { count: 1, resetAt: ts + windowMs };
    store.set(key, next);
    return { allowed: true, remaining: max - 1, resetAt: next.resetAt };
  }

  if (item.count >= max) {
    return { allowed: false, remaining: 0, resetAt: item.resetAt };
  }

  item.count += 1;
  return { allowed: true, remaining: Math.max(0, max - item.count), resetAt: item.resetAt };
}

function limiter(scope) {
  return (req, res, next) => {
    const key = normalizeIp(req);
    const result = checkRateLimit(scope, key);
    const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - now()) / 1000));

    res.set("X-RateLimit-Remaining", String(result.remaining));
    res.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      res.set("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        code: "RATE_LIMITED",
        message: "too many requests",
        details: { scope, retryAfterSec }
      });
    }
    return next();
  };
}

function lockConfig() {
  return {
    windowMs: toInt(process.env.LOGIN_LOCK_WINDOW_MS, 15 * 60_000),
    maxAttempts: toInt(process.env.LOGIN_LOCK_MAX_ATTEMPTS, 5),
    lockMs: toInt(process.env.LOGIN_LOCK_MS, 10 * 60_000)
  };
}

function lockKey(ip, email) {
  return `${ip}:${String(email || "").toLowerCase()}`;
}

export function checkLoginBlock(req, email) {
  const ip = normalizeIp(req);
  const key = lockKey(ip, email);
  const item = loginAttempts.get(key);
  const ts = now();
  if (!item) return { blocked: false, key };

  if (item.blockedUntil && item.blockedUntil > ts) {
    return { blocked: true, key, retryAfterSec: Math.max(1, Math.ceil((item.blockedUntil - ts) / 1000)) };
  }

  if (item.windowStart + lockConfig().windowMs <= ts) {
    loginAttempts.delete(key);
    return { blocked: false, key };
  }
  return { blocked: false, key };
}

export function recordFailedLogin(key) {
  const ts = now();
  const cfg = lockConfig();
  const current = loginAttempts.get(key);

  if (!current || current.windowStart + cfg.windowMs <= ts) {
    loginAttempts.set(key, { attempts: 1, windowStart: ts, blockedUntil: 0 });
    return;
  }

  current.attempts += 1;
  if (current.attempts >= cfg.maxAttempts) {
    current.blockedUntil = ts + cfg.lockMs;
  }
}

export function clearLoginFailures(req, email) {
  const ip = normalizeIp(req);
  loginAttempts.delete(lockKey(ip, email));
}

export function apiRateLimit() {
  return limiter("api");
}

export function authRateLimit() {
  return limiter("auth");
}

export function resetSecurityState() {
  rateStores.api.clear();
  rateStores.auth.clear();
  loginAttempts.clear();
}
