import { z } from "zod";
import { mexicanPhoneSchema } from "./phone.schema.js";

const registrationPassword = z.string().min(12).max(128)
  .regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/);

export const customerRegistrationSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: mexicanPhoneSchema,
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional()
    .transform((value) => value || null),
  password: registrationPassword,
}).strict();

export const registrationReviewIdSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const registrationRejectionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
}).strict();

export type CustomerRegistrationInput = z.infer<typeof customerRegistrationSchema>;
