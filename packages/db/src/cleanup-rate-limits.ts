import "dotenv/config";
import { lt } from "drizzle-orm";
import { createDatabase } from "./client.js";
import { rateLimits } from "./schema.js";
const { db, client } = createDatabase();
await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date()));
await client.end();
console.log("Rate limits vencidos eliminados.");
