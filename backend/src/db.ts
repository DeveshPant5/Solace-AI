import pg from "pg";
import { config } from "./config.js";

// Return DATE columns as plain "YYYY-MM-DD" strings instead of JS Dates,
// so day-based logic (streaks, daily caches) never shifts across timezones.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// COUNT(*) and SUM() come back as int8/numeric strings; our values are small.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}
