import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { ghoomloPool?: Pool };

function pool(): Pool {
  if (!globalForDb.ghoomloPool) {
    // No connection is opened until the first query, so builds work without a database.
    globalForDb.ghoomloPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  return globalForDb.ghoomloPool;
}

export const db = drizzle({ client: pool(), schema });
export { schema };
