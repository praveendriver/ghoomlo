// Applies pending database migrations. Runs before the server starts in
// production, and uses only runtime dependencies.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
await migrate(drizzle({ client: pool }), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
await pool.end();
console.log("Database migrations applied.");
