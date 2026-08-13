import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgres")),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  APP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  TRUST_PROXY: z.string().regex(/^\d+$/).default("1"),
  ALLOWED_ORIGINS: z.string().transform((v) =>
    v
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  ),
  HOST: z.string().ip({ version: "v4" }).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  UPLOAD_DIR: z.string().min(1).default("uploads"),
}).superRefine((env, context) => {
  if (env.NODE_ENV !== "production") return;
  for (const [field, value] of [
    ["APP_BASE_URL", env.APP_BASE_URL],
    ["API_BASE_URL", env.API_BASE_URL],
  ] as const) {
    if (new URL(value).protocol !== "https:") {
      context.addIssue({ code: "custom", path: [field], message: "Debe usar HTTPS en producción" });
    }
  }
  if (env.TRUST_PROXY !== "1") {
    context.addIssue({ code: "custom", path: ["TRUST_PROXY"], message: "La topología soportada requiere exactamente un proxy" });
  }
  if (env.HOST !== "127.0.0.1") {
    context.addIssue({ code: "custom", path: ["HOST"], message: "La API de producción solo debe escuchar en loopback" });
  }
  if (env.ALLOWED_ORIGINS.length === 0) {
    context.addIssue({ code: "custom", path: ["ALLOWED_ORIGINS"], message: "Debe incluir al menos un origen" });
  }
  for (const origin of env.ALLOWED_ORIGINS) {
    const url = new URL(origin);
    if (
      url.protocol !== "https:" ||
      ["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.origin !== origin
    ) {
      context.addIssue({ code: "custom", path: ["ALLOWED_ORIGINS"], message: "Use orígenes HTTPS públicos exactos, sin ruta ni barra final" });
    }
  }
});
export type AppEnv = z.infer<typeof envSchema>;
export const parseEnv = (input: NodeJS.ProcessEnv): AppEnv =>
  envSchema.parse(input);
