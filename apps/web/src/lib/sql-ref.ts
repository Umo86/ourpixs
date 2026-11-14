import { getTableName, sql, type Column } from "drizzle-orm";

/**
 * A fully qualified column reference ("table"."column") for correlated subqueries.
 * Drizzle renders a bare `${table.column}` inside a SELECT-list `sql` as just "column" when the query has one table
 * (no joins), so in `(select … from media m where m.occasion_id = ${occasions.id})` the subquery's own tables capture
 * it ("id" → m.id: silently wrong counts, or "column reference is ambiguous"). Use `${ref(occasions.id)}` there.
 */
export const ref = (c: Column) => sql.raw(`"${getTableName(c.table)}"."${c.name}"`);
