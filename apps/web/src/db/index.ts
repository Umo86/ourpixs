import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

type DB = ReturnType<typeof create>;
let instance: DB | null = null;

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
