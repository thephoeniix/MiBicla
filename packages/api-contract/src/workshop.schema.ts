import { z } from "zod";
import { mexicanPhoneSchema } from "./phone.schema.js";
const safe = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((v) => !/[<>]/.test(v), "No se permite HTML");
const opt = (s: z.ZodTypeAny) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.union([z.null(), s]).optional(),
  );
export const WORKSHOP_STATUSES = [
  "received",
  "inspection",
  "diagnosis",
  "waiting_approval",
  "approved",
  "in_progress",
  "waiting_parts",
  "quality_check",
  "ready",
  "delivered",
  "cancelled",
] as const;
export const bicycleSchema = z
  .object({
    customerId: z.string().uuid().nullable().optional(),
    nickname: opt(safe(100)),
    brand: opt(safe(100)),
    model: opt(safe(100)),
    year: z.number().int().min(1900).max(2100).nullable().optional(),
    bikeType: opt(safe(100)),
    color: opt(safe(100)),
    wheelSize: opt(safe(50)),
    brakeType: opt(safe(100)),
    suspensionType: opt(safe(100)),
    drivetrain: opt(safe(100)),
    generalCondition: opt(safe(100)),
    serialNumber: opt(safe(150)),
    frameNumber: opt(safe(150)),
    notes: opt(safe(2000)),
    photoUrl: opt(z.string().url()),
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .strict();
export const bicycleUpdateSchema = bicycleSchema.partial().strict();
export const workshopRequestSchema = z
  .object({
    customerName: safe(150, 2),
    customerPhone: mexicanPhoneSchema,
    customerEmail: opt(z.string().email().max(254)),
    bikeBrand: opt(safe(100)),
    bikeModel: opt(safe(100)),
    bikeType: opt(safe(100)),
    problemDescription: safe(3000, 10),
    preferredContactMethod: z.enum(["whatsapp", "phone", "email"]),
  })
  .strict();
export const workshopRequestStatusSchema = z
  .object({
    status: z.enum(["reviewing", "accepted", "rejected", "cancelled"]),
    rejectionReason: opt(safe(1000)),
  })
  .strict();
export const workshopConvertSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    bicycleId: z.string().uuid().optional(),
  })
  .strict();
export const workshopOrderSchema = z
  .object({
    customerId: z.string().uuid(),
    bicycleId: z.string().uuid(),
    problemDescription: safe(3000, 1),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    initialDiagnosis: opt(safe(5000)),
    internalNotes: opt(safe(5000)),
    customerVisibleSummary: opt(safe(3000)),
    estimatedCompletionAt: opt(z.string().datetime()),
    assignedTo: z.string().uuid().nullable().optional(),
    discountCents: z.number().int().nonnegative().default(0),
  })
  .strict();
export const workshopOrderUpdateSchema = workshopOrderSchema
  .omit({ customerId: true, bicycleId: true })
  .partial()
  .strict();
export const workshopStatusSchema = z
  .object({
    status: z.enum(WORKSHOP_STATUSES),
    publicMessage: opt(safe(1000)),
    internalReason: opt(safe(1000)),
    customerVisible: z.boolean().default(true),
    force: z.boolean().default(false),
  })
  .strict();
const line = z.object({
  description: opt(safe(2000)),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  isCustomerVisible: z.boolean(),
});
export const workshopServiceCatalogSchema = z
  .object({
    name: safe(200, 1),
    description: opt(safe(2000)),
    suggestedPriceCents: z.number().int().nonnegative(),
    estimatedDurationMinutes: z.number().int().positive().nullable(),
    isCustomerVisible: z.boolean(),
    isActive: z.boolean(),
    sortOrder: z.number().int(),
  })
  .strict();
export const workshopServiceSchema = line
  .extend({
    catalogServiceId: z.string().uuid().nullable().optional(),
    serviceName: safe(200, 1),
    performedBy: z.string().uuid().nullable().optional(),
    status: z
      .enum(["pending", "approved", "in_progress", "completed", "cancelled"])
      .default("pending"),
  })
  .strict();
export const workshopPartSchema = line
  .extend({
    partName: safe(200, 1),
    brand: opt(safe(100)),
    sku: opt(safe(100)),
    status: z
      .enum([
        "planned",
        "requested",
        "ordered",
        "received",
        "installed",
        "cancelled",
      ])
      .default("planned"),
  })
  .strict();
export const workshopUpdateSchema = z
  .object({
    title: safe(200, 1),
    message: safe(3000, 1),
    progressPercent: z.number().int().min(0).max(100).nullable(),
    photoUrl: opt(z.string().url()),
    customerVisible: z.boolean().default(true),
  })
  .strict();
export const workshopWhatsappSchema = z
  .object({ templateKey: safe(100, 1).optional() })
  .strict();
export const workshopSettingsSchema = z
  .object({
    publicRequestsEnabled: z.boolean(),
    publicTrackingEnabled: z.boolean(),
    allowCustomerPhotos: z.boolean(),
    defaultEstimatedDays: z.number().int().positive().nullable(),
    readyWhatsappTemplate: safe(2000),
    statusWhatsappTemplates: z.record(z.string(), safe(2000)),
    publicStatusLabels: z.record(z.string(), safe(100)),
  })
  .strict();
