import { z } from "zod";
import { mexicanPhoneSchema } from "./phone.schema.js";

export const customerAuthTokenSchema = z
  .object({ token: z.string().regex(/^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{16})$/) })
  .strict();

const password = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

export const customerPasswordTokenSchema = customerAuthTokenSchema
  .extend({ password })
  .strict();

export const customerLoginSchema = z
  .object({ phone: mexicanPhoneSchema, password: z.string().min(1).max(128) })
  .strict();

export const customerAuthLinkResponseSchema = z.object({
  expiresAt: z.coerce.date(),
  link: z.string().url(),
  whatsappUrl: z.string().url(),
});

export const customerSessionResponseSchema = z.object({
  authenticated: z.literal(true),
  csrfToken: z.string().length(64).optional(),
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    phone: mexicanPhoneSchema,
    accountStatus: z.enum(["active"]),
  }),
});

export type CustomerAuthPurpose = "activation" | "recovery";
