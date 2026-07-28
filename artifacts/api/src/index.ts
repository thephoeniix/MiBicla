import "dotenv/config";
import { createDatabase } from "@mi-bicla/db";
import { parseEnv } from "@mi-bicla/shared";
import { createApp } from "./app.js";

const env = parseEnv(process.env);
const { db } = createDatabase();
const app = createApp(env, db);

app.listen(env.PORT, () => console.log(`API en ${env.API_BASE_URL}`));
