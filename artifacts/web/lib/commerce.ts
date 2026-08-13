import { apiFetch } from "./api-client";
import { customerFetch } from "./customer-auth";
import { configuredWhatsappUrl, MI_BICLA_CONTACT } from "./public-links";
import { buildWhatsappUrl } from "./whatsapp";

export const PRODUCT_CATEGORIES = [
  "Bicicletas",
  "Cascos",
  "Ropa",
  "Calzado",
  "Lentes",
  "Guantes",
  "Protecciones",
  "Componentes",
  "Refacciones",
  "Herramientas",
  "Accesorios",
  "Hidratación",
  "Nutrición",
  "Electrónica",
  "Transporte",
] as const;
export const PRODUCT_COLORS = [
  "Blanco",
  "Negro",
  "Gris",
  "Rojo",
  "Azul",
  "Rosa",
  "Morado",
  "Naranja",
  "Verde",
  "Amarillo",
  "Café",
  "Dorado",
  "Plateado",
] as const;
export const EVENT_CATEGORIES = [
  "XCO",
  "XCC",
  "Reto",
  "Autogestiva",
  "Ruta",
] as const;
export const SHIPPING_CARRIERS = [
  "DHL",
  "FedEx",
  "Estafeta",
  "Paquetexpress",
  "Otra",
] as const;

export function discountedPriceCents(
  priceCents: number | null,
  discountPercent: number,
) {
  if (priceCents === null) return null;
  const discount = Number.isFinite(discountPercent)
    ? Math.max(0, Math.min(discountPercent, 100))
    : 0;
  if (discount === 0) return priceCents;
  return Math.round(priceCents * (100 - discount) / 100);
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  priceCents: number | null;
  discountPercent: number;
  sizes: string[];
  colors: string[];
  availability: string;
  isPublished: boolean;
}

export interface CommerceEvent {
  id: string;
  title: string;
  description: string | null;
  location: string;
  category: (typeof EVENT_CATEGORIES)[number];
  mapUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  imageUrl: string | null;
  infoUrl: string | null;
  isPublished: boolean;
  products: Product[];
}

export interface CommerceRequest {
  id: string;
  requestNumber: string;
  kind: string;
  product: Product | null;
  event: CommerceEvent | null;
  customProductName: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  comments: string | null;
  fulfillment: string;
  recipientName: string | null;
  shippingPhone: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  shippingCarrier: (typeof SHIPPING_CARRIERS)[number] | null;
  status: string;
  quotedPriceCents: number | null;
  adminMessage: string | null;
  createdAt: string;
  productName?: string | null;
  eventTitle?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
}

export interface ProductPayload {
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  priceCents: number | null;
  discountPercent: number;
  sizes: string[];
  colors: string[];
  availability: string;
  isPublished: boolean;
}

export interface EventPayload {
  title: string;
  description: string | null;
  location: string;
  category: (typeof EVENT_CATEGORIES)[number];
  mapUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  imageUrl: string | null;
  infoUrl: string | null;
  isPublished: boolean;
}

export interface CustomerRequestPayload {
  kind: "quote" | "reservation";
  productId: string | null;
  eventId: string | null;
  customProductName: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  comments: string | null;
  fulfillment: "store" | "event" | "shipping";
  recipientName: string | null;
  shippingPhone: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  shippingCarrier: (typeof SHIPPING_CARRIERS)[number] | null;
}

export function mxnToCents(value: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export function formatMxn(cents: number | null) {
  return cents === null
    ? "Solicita cotización"
    : new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
      }).format(cents / 100);
}

export const getPublicProducts = (
  search = "",
  category = "",
  signal?: AbortSignal,
) =>
  apiFetch<Product[]>(
    `/api/public/commerce/products?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`,
    { signal },
  );

export const getPublicEvents = (signal?: AbortSignal, category = "") =>
  apiFetch<CommerceEvent[]>(
    `/api/public/commerce/events?category=${encodeURIComponent(category)}`,
    { signal },
  );

export const getCommerceWhatsapp = () =>
  apiFetch<{ primaryWhatsapp?: string }>("/api/public/business")
    .then(
      (business) =>
        configuredWhatsappUrl(business.primaryWhatsapp) ??
        configuredWhatsappUrl(MI_BICLA_CONTACT.primaryWhatsapp)!,
    )
    .catch(() => configuredWhatsappUrl(MI_BICLA_CONTACT.primaryWhatsapp)!);

export function whatsappMessageUrl(baseUrl: string, message: string) {
  return buildWhatsappUrl(baseUrl, message);
}

export const googleMapsSearchUrl = (location: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;

export const getCustomerRequests = (signal?: AbortSignal) =>
  customerFetch<CommerceRequest[] | RequestRow[]>(
    "/api/customer/commerce/requests",
    { signal },
  ).then(normalizeRequests);

export const createCustomerRequest = (payload: CustomerRequestPayload) =>
  customerFetch<CommerceRequest>(
    "/api/customer/commerce/requests",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    true,
  );

export const getAdminProducts = (signal?: AbortSignal) =>
  apiFetch<Product[]>("/api/admin/commerce/products", { signal });

export const saveAdminProduct = (payload: ProductPayload, id?: string) =>
  apiFetch<Product>(
    id ? `/api/admin/commerce/products/${id}` : "/api/admin/commerce/products",
    {
      method: id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

export const getAdminEvents = (signal?: AbortSignal) =>
  apiFetch<CommerceEvent[]>("/api/admin/commerce/events", { signal });

export const saveAdminEvent = (payload: EventPayload, id?: string) =>
  apiFetch<CommerceEvent>(
    id ? `/api/admin/commerce/events/${id}` : "/api/admin/commerce/events",
    {
      method: id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

export const setAdminEventProducts = (id: string, productIds: string[]) =>
  apiFetch<CommerceEvent>(`/api/admin/commerce/events/${id}/products`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productIds }),
  });

export const getAdminRequests = (signal?: AbortSignal) =>
  apiFetch<CommerceRequest[] | RequestRow[]>("/api/admin/commerce/requests", {
    signal,
  }).then(normalizeRequests);

export const updateAdminRequest = (
  id: string,
  payload: {
    status: string;
    quotedPriceCents: number | null;
    adminMessage: string | null;
  },
) =>
  apiFetch<CommerceRequest>(`/api/admin/commerce/requests/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

export const uploadAdminImage = (file: File) =>
  apiFetch<{ url: string }>("/api/admin/commerce/uploads", {
    method: "POST",
    headers: { "content-type": file.type },
    body: file,
  });

interface RequestRow {
  request: Omit<CommerceRequest, "product" | "event">;
  productName: string | null;
  eventTitle: string | null;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
}

function normalizeRequests(
  rows: CommerceRequest[] | RequestRow[],
): CommerceRequest[] {
  return rows.map((row) => {
    if (!("request" in row)) return row;
    return {
      ...row.request,
      product: null,
      event: null,
      productName: row.productName,
      eventTitle: row.eventTitle,
      customerName:
        [row.customerFirstName, row.customerLastName]
          .filter(Boolean)
          .join(" ") || null,
      customerPhone: row.customerPhone ?? null,
    };
  });
}
