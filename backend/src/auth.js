import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN
  });
}

function authError(res, req, message) {
  return res.status(401).json({
    code: "AUTH_ERROR",
    message,
    details: null,
    traceId: req.traceId || null
  });
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return authError(res, req, "missing bearer token");
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.sub, email: decoded.email, name: decoded.name };
    return next();
  } catch {
    return authError(res, req, "invalid or expired token");
  }
}
