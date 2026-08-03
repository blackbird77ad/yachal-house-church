import { createHash } from "node:crypto";

const splitHeaderList = (value = "") =>
  String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const stripIpv4Port = (value) => {
  const portSeparator = value.lastIndexOf(":");
  if (portSeparator === -1) return value;

  const host = value.slice(0, portSeparator);
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? host : value;
};

const normalizeIpCandidate = (candidate = "") => {
  let value = String(candidate).trim();
  if (!value) return "";

  if (value.startsWith("\"") && value.endsWith("\"")) {
    value = value.slice(1, -1).trim();
  }

  if (value.startsWith("[")) {
    const bracketEnd = value.indexOf("]");
    if (bracketEnd > 0) {
      return value.slice(1, bracketEnd);
    }
  }

  return stripIpv4Port(value).replace(/^::ffff:/i, "");
};

const firstHeaderIp = (value) => {
  const [first] = splitHeaderList(value);
  return normalizeIpCandidate(first);
};

export const getClientIp = (req) => {
  const cloudflareIp = firstHeaderIp(req.get("cf-connecting-ip"));
  if (cloudflareIp) return cloudflareIp;

  const trueClientIp = firstHeaderIp(req.get("true-client-ip"));
  if (trueClientIp) return trueClientIp;

  const forwardedIp = firstHeaderIp(req.get("x-forwarded-for"));
  if (forwardedIp) return forwardedIp;

  return normalizeIpCandidate(req.ip || req.socket?.remoteAddress || "unknown");
};

export const rateLimitIpKey = (req) => `ip:${getClientIp(req)}`;

const getBearerToken = (req) => {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    return "";
  }

  return token.trim();
};

export const rateLimitCredentialOrIpKey = (req) => {
  const token = getBearerToken(req);

  if (!token) {
    return rateLimitIpKey(req);
  }

  const digest = createHash("sha256").update(token).digest("hex").slice(0, 32);
  return `token:${digest}`;
};

export const rateLimitUserOrIpKey = (req) => {
  const userId = req.user?._id?.toString?.() || req.user?.id?.toString?.();
  return userId ? `user:${userId}` : rateLimitIpKey(req);
};
