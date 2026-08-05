import { z } from "zod";
import { mexicanPhoneSchema } from "./phone.schema.js";

// El registro público ya no captura contraseña ni correo: la solicitud solo
// identifica a quién revisar manualmente. La contraseña se crea después,
// mediante el enlace de activación que el equipo de Mi Bicla comparte por
// WhatsApp tras verificar el teléfono (ver customerPasswordTokenSchema en
// customer-auth.schema.ts, sin cambios).
export const customerRegistrationSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: mexicanPhoneSchema,
}).strict();

export const registrationReviewIdSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const registrationRejectionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
}).strict();

export type CustomerRegistrationInput = z.infer<typeof customerRegistrationSchema>;
