import { z } from "zod";
import { bicycleSchema } from "./workshop.schema.js";

const clean = (max: number, min = 1) => z.string().trim().min(min).max(max)
  .refine((value) => !/[<>]/.test(value), "No se permite HTML");
const nullable = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => typeof value === "string" && !value.trim() ? null : value, schema.nullable());
const birthDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => value <= new Date().toISOString().slice(0, 10), "La fecha no puede estar en el futuro");

export const customerProfileUpdateSchema = z.object({
  firstName: clean(100),
  lastName: clean(100),
  email: nullable(z.string().trim().email().max(254)),
  birthDate: nullable(birthDate),
}).strict();

export const customerBicycleSchema = bicycleSchema.omit({
  customerId: true,
  notes: true,
  status: true,
}).strict();
export const customerBicycleUpdateSchema = customerBicycleSchema.partial().strict();

export const customerWorkshopRequestSchema = z.object({
  bicycleId: z.string().uuid(),
  serviceName: clean(150).nullable().optional(),
  problemDescription: clean(3000, 10),
  preferredContactMethod: z.enum(["whatsapp", "phone", "email"]).default("whatsapp"),
}).strict();
export const customerPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128)
    .regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
}).strict();

export type CustomerProfileUpdate = z.infer<typeof customerProfileUpdateSchema>;
export type CustomerBicycleInput = z.infer<typeof customerBicycleSchema>;
export type CustomerBicycleUpdate = z.infer<typeof customerBicycleUpdateSchema>;
export type CustomerWorkshopRequest = z.infer<typeof customerWorkshopRequestSchema>;
