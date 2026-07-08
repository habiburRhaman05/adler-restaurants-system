import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// Reuse a single Pool + PrismaClient across warm serverless invocations (and
// across dev hot-reloads). Without this, every cold start would open a fresh
// pool and quickly exhaust the database's connection limit.
const globalForPrisma = globalThis as unknown as {
  __pgPool?: pg.Pool;
  __prisma?: PrismaClient;
};

const pool =
  globalForPrisma.__pgPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // Keep the per-instance pool small: on serverless, many instances share the
    // database, so point DATABASE_URL at a pooled endpoint (Neon pooler /
    // PgBouncer) and let it fan out. Tunable via DB_POOL_MAX.
    max: Number(process.env.DB_POOL_MAX ?? 5),
  });

const adapter = new PrismaPg(pool);

const prisma = globalForPrisma.__prisma ?? new PrismaClient({ adapter });

globalForPrisma.__pgPool = pool;
globalForPrisma.__prisma = prisma;

export { prisma };
