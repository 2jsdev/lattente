require("dotenv").config();

// Express only accepts a NUMBER or the boolean `true` for "trust proxy".
// Environment variables are always strings, and Express silently ignores the
// string "1" — so TRUST_PROXY=1 would leave req.ip pointing at the proxy and
// every visitor would share one rate-limit bucket. Coerce explicitly.
function parseTrustProxy(value) {
  if (value === undefined || value === null || value === "") {
    return process.env.NODE_ENV === "production" ? 1 : false;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  const hops = Number(normalized);
  return Number.isInteger(hops) && hops >= 0 ? hops : false;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  // 3030 is the project's canonical port: the Dockerfile pins
  // `ENV PORT=3030`, docker-compose maps 3030, the CI healthcheck probes
  // 3030, and CapRover's HTTP Port must be 3030. The default MUST match
  // them — a fallback to 3000 made the app listen on a different port than
  // every healthcheck expected whenever PORT was unset (the .env is
  // gitignored, so CI never has one).
  port: Number(process.env.PORT) || 3030,
  host: process.env.HOST || "0.0.0.0",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://lattente:lattente@localhost:5433/lattente",
  logLevel: process.env.LOG_LEVEL || "info",
  isProd: process.env.NODE_ENV === "production",
  // CapRover's nginx terminates TLS and forwards the real client IP in
  // X-Forwarded-For. Without trusting that single hop, Express sees the
  // nginx container's IP as the client, so every visitor shares one rate
  // limit bucket. Trust exactly one hop — never `true`, which would let a
  // client spoof its own IP and bypass the limiter entirely.
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
};

module.exports = { env };
