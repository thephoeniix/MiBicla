import { z } from "zod";
import { mexicanPhoneSchema } from "./phone.schema.js";
const safe = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !/[<>]/.test(v), "No se permite HTML");
const nullable = (schema: z.ZodTypeAny) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.union([z.null(), schema]),
  );
const isoBirthDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar el formato YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "La fecha de nacimiento no es válida")
  .refine(
    (value) => value <= new Date().toISOString().slice(0, 10),
    "La fecha de nacimiento no puede estar en el futuro",
  );
export const customerCreateSchema = z
  .object({
    firstName: safe(100),
    lastName: safe(100),
    phone: mexicanPhoneSchema,
    email: nullable(z.string().trim().email().max(254)),
    birthDate: nullable(isoBirthDate),
    notes: nullable(z.string().trim().max(2000)),
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .strict();
export const customerUpdateSchema = customerCreateSchema.partial().strict();
export const customerListQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: z.enum(["active", "inactive", "all"]).default("all"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const purchaseRuleSchema = z
  .object({
    minimumAmount: z.number().int().nonnegative(),
    units: z.number().int().nonnegative(),
  })
  .strict();
export const loyaltySettingsSchema = z
  .object({
    enabled: z.boolean(),
    currency: z.literal("MXN"),
    purchaseRules: z
      .array(purchaseRuleSchema)
      .max(100)
      .superRefine((rules, ctx) => {
        const seen = new Set<number>();
        rules.forEach((r, i) => {
          if (seen.has(r.minimumAmount))
            ctx.addIssue({
              code: "custom",
              path: [i, "minimumAmount"],
              message: "No se permiten montos duplicados",
            });
          seen.add(r.minimumAmount);
        });
      })
      .transform((r) =>
        [...r].sort((a, b) => a.minimumAmount - b.minimumAmount),
      ),
    rewardUnits: z.number().int().positive(),
    rewardDiscountPercent: z.number().min(0).max(100),
    rewardName: safe(150),
    rewardDescription: z.string().trim().max(2000),
    allowManualAdjustments: z.boolean(),
    allowNegativeBalance: z.boolean(),
  })
  .strict();
export const loyaltyAdjustmentSchema = z
  .object({
    units: z
      .number()
      .int()
      .refine((v) => v !== 0, "Debe ser distinto de cero"),
    reason: safe(500),
  })
  .strict();
export const customerScanTokenSchema = z
  .object({
    token: z.string().trim().regex(/^[a-f0-9]{64}$/, "Token inválido"),
  })
  .strict();
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
export type LoyaltySettingsInput = z.infer<typeof loyaltySettingsSchema>;
