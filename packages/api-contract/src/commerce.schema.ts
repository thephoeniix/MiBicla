import { z } from "zod";

const id = z.string().uuid();
const nullableUrl = z.string().trim().url().max(2048).nullable();
const nullableText = (max: number) =>
  z.string().trim().min(1).max(max).nullable();
const stringList = z.array(z.string().trim().min(1).max(80)).max(50);

export const productAvailabilitySchema = z.enum([
  "available",
  "on_request",
  "unavailable",
]);
export const catalogRequestKindSchema = z.enum(["quote", "reservation"]);
export const catalogRequestFulfillmentSchema = z.enum([
  "store",
  "event",
  "shipping",
]);
export const eventCategorySchema = z.enum([
  "XCO",
  "XCC",
  "Reto",
  "Autogestiva",
  "Ruta",
]);
export const shippingCarrierSchema = z.enum([
  "DHL",
  "FedEx",
  "Estafeta",
  "Paquetexpress",
  "Otra",
]);
export const catalogRequestStatusSchema = z.enum([
  "submitted",
  "reviewing",
  "quoted",
  "confirmed",
  "unavailable",
  "ready",
  "completed",
  "cancelled",
]);

export const productCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
    category: z.string().trim().min(1).max(100),
    imageUrl: nullableUrl.default(null),
    priceCents: z.number().int().nonnegative().nullable().default(null),
    discountPercent: z.number().int().min(0).max(100).default(0),
    sizes: stringList.default([]),
    colors: stringList.default([]),
    availability: productAvailabilitySchema.default("available"),
    isPublished: z.boolean().default(false),
  })
  .strict();
export const productUpdateSchema = productCreateSchema
  .partial()
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Se requiere al menos un campo",
  );

const eventInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: nullableText(5000).default(null),
    location: z.string().trim().min(1).max(300),
    category: eventCategorySchema,
    mapUrl: nullableUrl.default(null),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }).nullable().default(null),
    imageUrl: nullableUrl.default(null),
    infoUrl: nullableUrl.default(null),
    isPublished: z.boolean().default(false),
  })
  .strict();
export const eventCreateSchema = eventInputSchema.refine(
  (value) => !value.endsAt || new Date(value.endsAt) > new Date(value.startsAt),
  { path: ["endsAt"], message: "La fecha final debe ser posterior al inicio" },
);
export const eventUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: nullableText(5000).optional(),
    location: z.string().trim().min(1).max(300).optional(),
    category: eventCategorySchema.optional(),
    mapUrl: nullableUrl.optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    imageUrl: nullableUrl.optional(),
    infoUrl: nullableUrl.optional(),
    isPublished: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Se requiere al menos un campo",
  )
  .refine(
    (value) =>
      !value.startsAt ||
      !value.endsAt ||
      new Date(value.endsAt) > new Date(value.startsAt),
    {
      path: ["endsAt"],
      message: "La fecha final debe ser posterior al inicio",
    },
  );
export const eventProductsUpdateSchema = z
  .object({ productIds: z.array(id).max(500) })
  .strict()
  .transform((value) => ({ productIds: [...new Set(value.productIds)] }));

export const publicProductQuerySchema = z
  .object({
    search: z.string().trim().max(200).optional().default(""),
    category: z.string().trim().max(100).optional().default(""),
  })
  .strict();

export const publicEventQuerySchema = z
  .object({
    category: eventCategorySchema.or(z.literal("")).optional().default(""),
  })
  .strict();

export const catalogRequestCreateSchema = z
  .object({
    kind: catalogRequestKindSchema,
    productId: id.nullable().default(null),
    eventId: id.nullable().default(null),
    customProductName: nullableText(200).default(null),
    size: nullableText(80).default(null),
    color: nullableText(80).default(null),
    comments: nullableText(3000).default(null),
    quantity: z.number().int().positive().max(100),
    fulfillment: catalogRequestFulfillmentSchema,
    recipientName: nullableText(200).default(null),
    shippingPhone: nullableText(20).default(null),
    street: nullableText(300).default(null),
    neighborhood: nullableText(200).default(null),
    city: nullableText(150).default(null),
    state: nullableText(150).default(null),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "El código postal debe tener 5 dígitos")
      .nullable()
      .default(null),
    shippingCarrier: shippingCarrierSchema.nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.productId && !value.customProductName)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customProductName"],
        message: "Selecciona un producto o indica el producto solicitado",
      });
    if (value.fulfillment === "event" && !value.eventId)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventId"],
        message: "El evento es requerido para entrega en evento",
      });
    if (value.fulfillment === "shipping") {
      for (const field of [
        "recipientName",
        "shippingPhone",
        "street",
        "neighborhood",
        "city",
        "state",
        "postalCode",
        "shippingCarrier",
      ] as const) {
        if (!value[field])
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: "Este dato es requerido para envío",
          });
      }
    }
  });

export const catalogRequestPatchSchema = z
  .object({
    status: catalogRequestStatusSchema.optional(),
    quotedPriceCents: z.number().int().nonnegative().nullable().optional(),
    adminMessage: nullableText(3000).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Se requiere al menos un campo",
  );

export const productSchema = productCreateSchema
  .extend({
    id,
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .strict();
export const eventSchema = eventInputSchema
  .extend({
    id,
    products: z.array(productSchema).optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .strict();
export const catalogRequestSchema = z
  .object({
    id,
    requestNumber: z.string(),
    customerId: id,
    kind: catalogRequestKindSchema,
    productId: id.nullable(),
    eventId: id.nullable(),
    customProductName: z.string().nullable(),
    size: z.string().nullable(),
    color: z.string().nullable(),
    comments: z.string().nullable(),
    quantity: z.number().int().positive(),
    fulfillment: catalogRequestFulfillmentSchema,
    recipientName: z.string().nullable(),
    shippingPhone: z.string().nullable(),
    street: z.string().nullable(),
    neighborhood: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    postalCode: z.string().nullable(),
    shippingCarrier: shippingCarrierSchema.nullable(),
    status: catalogRequestStatusSchema,
    quotedPriceCents: z.number().int().nonnegative().nullable(),
    adminMessage: z.string().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .strict();

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type CatalogRequestCreateInput = z.infer<
  typeof catalogRequestCreateSchema
>;
export type CatalogRequestPatchInput = z.infer<
  typeof catalogRequestPatchSchema
>;
