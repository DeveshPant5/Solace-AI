import pg from "pg";
import { config } from "./config.js";

// These parsers are process-wide (they affect every pg client in the process).
// Return DATE columns as plain "YYYY-MM-DD" strings instead of JS Dates,
// so day-based logic (streaks, daily caches) never shifts across timezones.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// COUNT(*) and SUM() come back as int8/numeric strings; our values are small.
// Revisit if a bigint id or an exact-decimal column is ever added.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  application_name: "solace-api",
  // Fail fast instead of hanging every request when the database is unreachable or stuck.
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 15_000,
  query_timeout: 20_000,
  idle_in_transaction_session_timeout: 30_000,
});

// An idle client can lose its connection (database restart, network blip, a
// managed database recycling connections). Without a listener that error would
// crash the process; pg drops the broken client and reconnects on demand.
pool.on("error", (err) => {
  console.error(`[db] idle connection error: ${err.message}`);
});

/** Anything that can run a query: the pool, or a client inside a transaction. */
export type Db = Pick<pg.Pool, "query"> | pg.PoolClient;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Db = pool,
): Promise<T[]> {
  const result = await db.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Db = pool,
): Promise<T | undefined> {
  const rows = await query<T>(text, params, db);
  return rows[0];
}

/**
 * Runs `fn` in a transaction that holds a per-person lock, so "check a limit,
 * then insert" steps can't race each other (two quick taps, parallel requests).
 */
export async function withUserLock<T>(userId: string, fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(4242, hashtext($1))", [userId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** True if the database answers within `ms`. */
export async function databaseReachable(ms = 2_000): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pool.query("SELECT 1").then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), ms);
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
