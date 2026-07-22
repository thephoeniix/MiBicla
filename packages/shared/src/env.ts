import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres')),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  TRUST_PROXY: z.string().default('1'),
  ALLOWED_ORIGINS: z.string().transform((v) => v.split(',').map((x) => x.trim()).filter(Boolean)),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});
export type AppEnv = z.infer<typeof envSchema>;
export const parseEnv = (input: NodeJS.ProcessEnv): AppEnv => envSchema.parse(input);
