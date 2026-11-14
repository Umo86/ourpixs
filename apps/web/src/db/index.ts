import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createNeon() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

function create(): DB {
  if (process.env.TEST_DB === "postgres") return createTestDb();
  return createNeon();
}

type DB = ReturnType<typeof createNeon>;
let instance: DB | null = null;

/**
 * TEST ONLY (apps/web/test, docs/TESTING.md): `TEST_DB=postgres` runs the app against a local PostgreSQL through
 * node-postgres instead of Neon's HTTP driver. Never used in production: refused when VERCEL_ENV=production, and
 * nothing here runs unless TEST_DB is set. `db.batch` (neon-http only) is emulated by running the queries in order.
 */
function createTestDb(): DB {
  if (process.env.VERCEL_ENV === "production") throw new Error("TEST_DB is not allowed in production");
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: drizzlePg } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
  const pg = drizzlePg(new Pool({ connectionString: url, max: 10 }), { schema });
  const batch = async (queries: readonly PromiseLike<unknown>[]) => {
    const out: unknown[] = [];
    for (const q of queries) out.push(await q);
    return out;
  };
  return Object.assign(pg, { batch }) as unknown as DB;
}

/**
 * Lazily-initialised Drizzle client. Importing this module never touches the network or env,
 * so `next build` works without DATABASE_URL; the first query creates the client.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    instance ??= create();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
