import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";

function requireEnv(name, fallback, allowMissingInDev = false) {
  const val = process.env[name];
  if (val) return val;
  if (!isProd && allowMissingInDev && fallback !== undefined) return fallback;
  if (!isProd && allowMissingInDev) return undefined;
  throw new Error(`Missing required env var: ${name}`);
}

export const env = {
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT || "3001"),
  appUrl: process.env.BASE_URL || process.env.FRONTEND_URL || "https://qrave.netlify.app/",
  corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173",
  sessionSecret: requireEnv("SESSION_SECRET", "dfgjiosdfvghnsdfjn", true),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "qrave.sid",
  sessionTtlMs: Number(process.env.SESSION_TTL_MS || String(1000 * 60 * 60 * 24)),
  jwtSecret: requireEnv("JWT_SECRET", "ngioerntiowerngdhfgdfj", true),

  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "test_key",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "test_secret", 
  // Subscription Pricing Parameters
  planStarterPrice: Number(process.env.PLAN_STARTER_PRICE || "0"),
  planProPrice: Number(process.env.PLAN_PRO_PRICE || "700"),

  // Access token (JWT): short-lived, sent in Authorization header
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "15m",

  // Refresh token: long-lived, stored server-side as a hash, and sent via HttpOnly cookie (web) or native secure storage (mobile)
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || "60"),
  refreshTokenCookieName: process.env.REFRESH_TOKEN_COOKIE_NAME || "qrave.refresh",

  // Cookie settings for web/PWA refresh token.
  // - SameSite=Strict is most secure but can break cross-site deployments.
  // - Recommended: Lax for same-site; None + Secure for cross-site.
  refreshCookieSameSite: (process.env.REFRESH_COOKIE_SAMESITE || "lax").toLowerCase(),
  refreshCookieSecure: String(process.env.REFRESH_COOKIE_SECURE || "").length
    ? String(process.env.REFRESH_COOKIE_SECURE).toLowerCase() === "true"
    : isProd,

  databaseUrl: requireEnv("DATABASE_URL", undefined, true),
  databaseReadUrl: process.env.DATABASE_READ_URL || requireEnv("DATABASE_URL", undefined, true),
  databaseWriteUrl: process.env.DATABASE_WRITE_URL || requireEnv("DATABASE_URL", undefined, true),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || "10"),
  menuCacheTtlSec: Number(process.env.MENU_CACHE_TTL_SEC || "300"),
  allowDevRegister: String(process.env.ALLOW_DEV_REGISTER || "false").toLowerCase() === "true",
  redisMode: (process.env.REDIS_MODE || "single").toLowerCase(),
  redisUrl: process.env.REDIS_URL,
  // Redis Sentinel HA (used when REDIS_MODE=sentinel)
  redisSentinels: process.env.REDIS_SENTINELS,          // e.g. "host1:26379,host2:26379"
  redisSentinelName: process.env.REDIS_SENTINEL_NAME || "mymaster",
  redisSentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,

  geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,

  // S3 / object storage
  s3Bucket: process.env.AWS_S3_BUCKET,
  s3Region: process.env.AWS_REGION,
  s3Endpoint: process.env.S3_ENDPOINT, // optional (e.g., MinIO/Cloudflare R2)
  s3ForcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || "").toLowerCase() === "true",

  // CDN — INFRA: Menu images should go through CloudFront, not S3 direct.
  // Set AWS_CLOUDFRONT_URL to your CloudFront distribution domain, e.g. https://d1234.cloudfront.net
  // If not set, falls back to direct S3 URL. No code changes needed once this is set.
  cdnUrl: process.env.AWS_CLOUDFRONT_URL || process.env.CDN_URL || null,

  // Email / SMTP (all optional — email is skipped gracefully if not configured)
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT || "587",
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM || "Orderzi <noreply@orderzi.com>",
};

