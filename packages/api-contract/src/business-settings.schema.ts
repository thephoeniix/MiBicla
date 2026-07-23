import { z } from "zod";
const plain = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => !/[<>]/.test(v), "No se permite HTML");
const optionalUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? null
      : typeof value === "string"
        ? value.trim()
        : value,
  z.union([
    z.null(),
    z.undefined(),
    z
      .string()
      .max(500)
      .url("Debe ser una URL válida")
      .refine(
        (v) => /^https?:\/\//i.test(v),
        "Debe comenzar con http:// o https://",
      ),
  ]),
);
const optionalWhatsapp = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? null
      : typeof value === "string"
        ? value.trim()
        : value,
  z.union([
    z.null(),
    z.undefined(),
    z.string().regex(/^\+[1-9]\d{7,14}$/, "Usa formato internacional E.164"),
  ]),
);
const whatsapp = z.union([
  z.literal(""),
  z.string().regex(/^\+[1-9]\d{7,14}$/),
]);
const editableBusinessFields = {
  businessName: plain(150),
  address: plain(500),
  phone: plain(30),
  email: z.union([z.literal(""), z.string().email().max(254)]),
  primaryWhatsapp: whatsapp,
  secondaryWhatsapp: optionalWhatsapp,
  facebook: optionalUrl,
  instagram: optionalUrl,
  tiktok: optionalUrl,
  website: optionalUrl,
  openingHours: z
    .record(z.string().max(30), z.string().max(100))
    .refine((v) => JSON.stringify(v).length <= 4000),
  logoUrl: optionalUrl,
  faviconUrl: optionalUrl,
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
};
export const businessSettingsUpdateSchema = z
  .object(editableBusinessFields)
  .partial()
  .strict();
export const businessSettingsResponseSchema = z.object({
  ...editableBusinessFields,
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  updatedBy: z.string().uuid().nullable(),
});
export const businessSettingsSchema = businessSettingsUpdateSchema;
export const depositSettingsSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .refine((v) => !/[<>]/.test(v), "No se permite HTML"),
    bankName: plain(100),
    accountHolder: plain(150),
    accountNumber: z.union([z.literal(""), z.string().regex(/^\d+$/).max(30)]),
    clabe: z.union([z.literal(""), z.string().regex(/^\d{18}$/)]),
    cardNumber: z.union([z.literal(""), z.string().regex(/^\d{13,19}$/)]),
    referenceText: plain(200),
    instructions: plain(2000),
    whatsappNumber: whatsapp,
    whatsappTemplate: plain(500),
    showAccountNumber: z.boolean(),
    showClabe: z.boolean(),
    showCardNumber: z.boolean(),
    showBank: z.boolean(),
    showHolder: z.boolean(),
    isActive: z.boolean(),
    sortOrder: z.number().int().nonnegative(),
    clearAccountNumber: z.boolean().default(false),
    clearClabe: z.boolean().default(false),
    clearCardNumber: z.boolean().default(false),
  })
  .strict();
export const depositStatusSchema = z.object({ isActive: z.boolean() }).strict();
export const depositReorderSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            sortOrder: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type BusinessSettingsInput = z.infer<
  typeof businessSettingsUpdateSchema
>;
export type BusinessSettingsResponse = z.infer<
  typeof businessSettingsResponseSchema
>;
export type DepositSettingsInput = z.infer<typeof depositSettingsSchema>;
