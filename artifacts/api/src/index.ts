import "dotenv/config";
import { createDatabase } from "@mi-bicla/db";
import { parseEnv } from "@mi-bicla/shared";
import { createApp } from "./app.js";
import { CommerceService } from "./services/commerce.service.js";
import path from "node:path";

const env = parseEnv(process.env);
const { db, client } = createDatabase();
const app = createApp(env, db);
const commerceMaintenance = new CommerceService(db, {
  uploadDir: path.resolve(env.UPLOAD_DIR),
});
const cleanExpiredEvents = () =>
  commerceMaintenance
    .deleteExpiredEvents()
    .catch((error) => console.error("No fue posible limpiar eventos vencidos", error));
void cleanExpiredEvents();
const eventCleanupTimer = setInterval(cleanExpiredEvents, 15 * 60 * 1000);
eventCleanupTimer.unref();

const server = app.listen(env.PORT, env.HOST, () => console.log(`API en ${env.API_BASE_URL}`));
let stopping = false;
function shutdown(signal: NodeJS.Signals) {
  if (stopping) return;
  stopping = true;
  clearInterval(eventCleanupTimer);
  console.log(`Cerrando API por ${signal}`);
  const forced = setTimeout(() => process.exit(1), 10_000);
  forced.unref();
  server.close(async (error) => {
    try {
      await client.end({ timeout: 5 });
    } finally {
      clearTimeout(forced);
      process.exit(error ? 1 : 0);
    }
  });
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
