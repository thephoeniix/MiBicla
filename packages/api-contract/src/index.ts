import { z } from "zod";
import { PERMISSION_NAMES, ROLE_NAMES } from "@mi-bicla/shared";

const email = z.string().trim().email().max(254);
const strongPassword = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, "Debe contener una minúscula")
  .regex(/[A-Z]/, "Debe contener una mayúscula")
  .regex(/[0-9]/, "Debe contener un número")
  .regex(/[^A-Za-z0-9]/, "Debe contener un símbolo");

export const loginSchema = z
  .object({ email, password: z.string().min(1).max(128) })
  .strict();
export const roleSchema = z.object({
  id: z.string().uuid(),
  name: z.enum(ROLE_NAMES),
});
export const permissionSchema = z.object({
  id: z.string().uuid(),
  name: z.enum(PERMISSION_NAMES),
  description: z.string().nullable(),
});
export const sessionResponseSchema = z.object({
  authenticated: z.literal(true),
  administrator: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: email,
    role: z.enum(ROLE_NAMES),
    permissions: z.array(z.enum(PERMISSION_NAMES)),
  }),
});
export const csrfResponseSchema = z.object({
  csrfToken: z.string().length(64),
});
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().uuid(),
  }),
});
export const createAdministratorSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    email,
    password: strongPassword,
    roleId: z.string().uuid(),
  })
  .strict();
export const updateAdministratorSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    email: email.optional(),
    roleId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: strongPassword,
  })
  .strict();
export const managedAdministratorRoleSchema = z.enum(["admin", "employee"]);
export const createManagedAdministratorSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    email,
    password: strongPassword,
    role: managedAdministratorRoleSchema,
  })
  .strict();
export const updateManagedAdministratorRoleSchema = z
  .object({ role: managedAdministratorRoleSchema })
  .strict();
export const updateManagedAdministratorStatusSchema = z
  .object({ isActive: z.boolean() })
  .strict();
export const resetManagedAdministratorPasswordSchema = z
  .object({ newPassword: strongPassword })
  .strict();
export const managedAdministratorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email,
  role: z.enum(ROLE_NAMES),
  isActive: z.boolean(),
  lastLoginAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export const ownerEnvironmentSchema = z.object({
  OWNER_NAME: z.string().trim().min(1).max(150),
  OWNER_EMAIL: email,
  OWNER_PASSWORD: strongPassword,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type CreateManagedAdministratorInput = z.infer<
  typeof createManagedAdministratorSchema
>;
export type ManagedAdministratorRole = z.infer<
  typeof managedAdministratorRoleSchema
>;
export * from "./business-settings.schema.js";
export * from "./phone.schema.js";
export * from "./phase-2.schema.js";
export * from "./workshop.schema.js";
export * from "./customer-auth.schema.js";
export * from "./customer-registration.schema.js";
export * from "./customer-portal.schema.js";
export * from "./commerce.schema.js";
