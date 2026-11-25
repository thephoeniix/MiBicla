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
    bikeColor: opt(safe(100)),
    bikeWheelSize: opt(safe(50)),
    bikeYear: z.number().int().min(1900).max(2100).nullable().optional(),
    bikeBrakeType: opt(safe(100)),
    bikeSuspensionType: opt(safe(100)),
    bikeDrivetrain: opt(safe(100)),
    bikeGeneralCondition: opt(safe(100)),
    bikeSerialNumber: opt(safe(150)),
    bikeFrameNumber: opt(safe(150)),
    bikeNotes: opt(safe(2000)),
    bikeAccessories: opt(safe(1000)),
    catalogServiceId: z.string().uuid().nullable().optional(),
    serviceName: opt(safe(200)),
    problemDescription: safe(3000, 10),
    symptoms: opt(safe(2000)),
    visibleDamage: opt(safe(2000)),
    additionalComments: opt(safe(2000)),
    requestedDate: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    requestedTime: opt(z.string().regex(/^\d{2}:\d{2}$/)),
    desiredDeliveryDate: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    urgency: z.enum(["normal", "soon", "urgent"]).nullable().optional(),
    preferredContactMethod: z.enum(["whatsapp", "phone", "email"]),
  })
  .strict();
export const workshopRequestStatusSchema = z
  .object({
    status: z.enum(["reviewing", "awaiting_contact", "confirmed", "reschedule_proposed", "accepted", "rejected", "cancelled"]),
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
  })
  .strict();
export const workshopOrderUpdateSchema = workshopOrderSchema
  .omit({ customerId: true, bicycleId: true })
  .partial()
  .strict();
export const WORKSHOP_MOVEMENT_TYPES = ["advance", "payment", "discount", "credit_applied", "charge", "refund", "correction"] as const;
export const WORKSHOP_PAYMENT_METHODS = ["cash", "card", "transfer", "customer_credit", "agreement", "other"] as const;
export const workshopMovementSchema = z.object({
  type: z.enum(["advance", "payment", "discount", "charge"]),
  amountCents: z.number().int().positive(),
  paymentMethod: z.enum(WORKSHOP_PAYMENT_METHODS).nullable().optional(),
  reference: opt(safe(300)),
  note: opt(safe(2000)),
  occurredDate: z.string().date(),
}).strict().superRefine((value, ctx) => {
  if (value.paymentMethod === "other" && !value.note) ctx.addIssue({ code: "custom", path: ["note"], message: "La nota es obligatoria para otro método" });
  if (["customer_credit", "agreement"].includes(value.paymentMethod ?? "")) ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Este método requiere su flujo dedicado" });
});
export const workshopMovementReversalSchema = z.object({ reason: safe(1000, 1) }).strict();
export const workshopFavorApplicationSchema = z.object({ targetOrderId: z.string().uuid(), amountCents: z.number().int().positive(), occurredDate: z.string().date(), note: opt(safe(1000)) }).strict();
export const workshopRefundSchema = z.object({ amountCents: z.number().int().positive(), paymentMethod: z.enum(WORKSHOP_PAYMENT_METHODS), reference: opt(safe(300)), reason: safe(1000, 1), occurredDate: z.string().date() }).strict();
export const teamSchema = z.object({ name: safe(200, 1), active: z.boolean().default(true) }).strict();
export const agreementSchema = z.object({
  teamId: z.string().uuid(), discountType: z.enum(["percentage", "fixed"]), value: z.number().int().positive(),
  validFrom: z.string().date(), validUntil: z.string().date().nullable(), conditions: opt(safe(3000)), active: z.boolean(), combinable: z.boolean(),
}).strict().superRefine((value, ctx) => { if (value.discountType === "percentage" && value.value > 10000) ctx.addIssue({ code: "custom", path: ["value"], message: "El porcentaje usa puntos base y no puede exceder 10000" }); });
export const affiliationRequestSchema = z.object({ teamId: z.string().uuid().optional(), proposedTeamName: safe(200, 1).optional() }).strict().refine((v) => Number(!!v.teamId) + Number(!!v.proposedTeamName) === 1, "Selecciona un equipo o propón otro");
export const affiliationReviewSchema = z.object({ status: z.enum(["verified", "rejected", "expired"]), evidenceNote: safe(2000, 1) }).strict();
export const workshopAgreementApplicationSchema = z.object({ agreementId: z.string().uuid(), occurredDate: z.string().date() }).strict();
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
    scheduleTimezone: z.literal("America/Mexico_City").default("America/Mexico_City"),
    minimumNoticeMinutes: z.number().int().nonnegative().default(120),
    bookingHorizonDays: z.number().int().positive().max(365).default(30),
    dailyCapacity: z.number().int().positive().nullable(),
    schedule: z.record(z.string(), z.array(z.string().regex(/^\d{2}:\d{2}$/))).default({}),
    readyWhatsappTemplate: safe(2000),
    statusWhatsappTemplates: z.record(z.string(), safe(2000)),
    publicStatusLabels: z.record(z.string(), safe(100)),
  })
  .strict();
