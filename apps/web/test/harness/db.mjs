/**
 * TEST ONLY: a throwaway local PostgreSQL for the e2e run.
 *  - TEST_DATABASE_URL set → use that server (it must be disposable: the database is dropped and recreated).
 *  - otherwise → initdb + pg_ctl from the local PostgreSQL install (PG_BIN, or /usr/lib/postgresql/<v>/bin) under
 *    <work>/pgdata on port 54329 (run as the `postgres` user when we are root).
 * Then: create the database, install the test clock (testing.clock + public.now(), with search_path public, pg_catalog so
 * unqualified now() — including column defaults — follows the fake clock) and apply drizzle/0000…NNNN in journal order.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const WEB = new URL("../../", import.meta.url).pathname;

function pgBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const base = "/usr/lib/postgresql";
  if (existsSync(base)) {
    const v = readdirSync(base).sort((a, b) => Number(b) - Number(a))[0];
    if (v) return join(base, v, "bin");
  }
  return ""; // on PATH
}

function asPg(cmd, args) {
  const bin = join(pgBin(), cmd);
  if (process.getuid && process.getuid() === 0) return spawnSync("runuser", ["-u", "postgres", "--", bin, ...args], { encoding: "utf8" });
  return spawnSync(bin, args, { encoding: "utf8" });
}

export async function startPostgres(work, port = 54329) {
  if (process.env.TEST_DATABASE_URL) return { url: process.env.TEST_DATABASE_URL, stop: async () => {} };
  const data = join(work, "pgdata");
  mkdirSync(work, { recursive: true });
  chmodSync(work, 0o777);
  if (!existsSync(join(data, "PG_VERSION"))) {
    mkdirSync(data, { recursive: true });
    if (process.getuid?.() === 0) execFileSync("chown", ["-R", "postgres:postgres", data]);
    const r = asPg("initdb", ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C.UTF-8"]);
    if (r.status !== 0) throw new Error(`initdb failed: ${r.stderr}`);
  }
  asPg("pg_ctl", ["-D", data, "-m", "fast", "stop"]);
  const r = asPg("pg_ctl", ["-D", data, "-l", join(data, "server.log"), "-w", "-o", `-p ${port} -k /tmp -c listen_addresses=127.0.0.1 -c fsync=off -c max_connections=100 -c timezone=UTC`, "start"]);
  if (r.status !== 0) throw new Error(`pg_ctl start failed: ${r.stderr || r.stdout}`);
  return {
    url: `postgres://postgres@127.0.0.1:${port}/bizimresimler_test`,
    stop: async () => { asPg("pg_ctl", ["-D", data, "-m", "fast", "stop"]); },
  };
}

export async function resetDatabase(url) {
  const u = new URL(url);
  const name = u.pathname.slice(1);
  const admin = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).toString() });
  await admin.connect();
  await admin.query(`drop database if exists "${name}" with (force)`);
  await admin.query(`create database "${name}"`);
  await admin.query(`alter database "${name}" set search_path = public, pg_catalog`);
  await admin.query(`alter database "${name}" set timezone = 'UTC'`);
  await admin.end();

  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query(`
    create schema testing;
    create table testing.clock (id int primary key default 1, offset_ms bigint not null default 0);
    insert into testing.clock (id, offset_ms) values (1, 0);
    create function public.now() returns timestamptz language sql stable as
      $$ select pg_catalog.now() + make_interval(secs => (select offset_ms from testing.clock where id = 1) / 1000.0) $$;
  `);
  const journal = JSON.parse(readFileSync(join(WEB, "drizzle/meta/_journal.json"), "utf8"));
  for (const e of journal.entries) {
    const sql = readFileSync(join(WEB, "drizzle", `${e.tag}.sql`), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) {
      try {
        await c.query(stmt);
      } catch (err) {
        throw new Error(`migration ${e.tag} failed: ${err.message}\n${stmt.slice(0, 300)}`);
      }
    }
  }
  await c.end();
  return journal.entries.map((e) => e.tag);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const work = process.env.E2E_WORK || "/tmp/br-e2e";
  const { url } = await startPostgres(work);
  const tags = await resetDatabase(url);
  console.log(`database ready at ${url} (${tags.length} migrations: ${tags[0]} … ${tags.at(-1)})`);
}
