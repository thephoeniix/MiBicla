import { API_BASE_URL, ApiError } from "./api-client";

export interface CustomerIdentity {
  id: string;
  firstName?: string;
  lastName?: string;
  name: string;
  phone: string;
  email?: string | null;
  birthDate?: string | null;
  accountStatus: "active";
  updatedAt?: string;
}
export interface CustomerLoyalty {
  name: string;
  balance: { availableUnits: number; pendingUnits: number; lifetimeUnits: number; updatedAt: string };
  rewards: Array<{ id: string; rewardName: string; rewardDiscountPercent: string; requiredUnits: number; status: string; createdAt: string; expiresAt?: string | null }>;
  movements: Array<{ id: string; units: number; balanceAfter: number; reason: string; movementType: string; createdAt: string }>;
  loyaltyProgram: { enabled: boolean; rewardUnits: number; rewardName: string; rewardDescription: string } | null;
  updatedAt: string;
}
export interface CustomerBicycle {
  id: string;
  nickname?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  bikeType?: string | null;
  color?: string | null;
  wheelSize?: string | null;
  brakeType?: string | null;
  suspensionType?: string | null;
  drivetrain?: string | null;
  generalCondition?: string | null;
  serialNumber?: string | null;
  frameNumber?: string | null;
  photoUrl?: string | null;
  status: string;
  updatedAt: string;
}
export interface CustomerOrderSummary {
  orderNumber: string;
  bicycle: { id: string; nickname?: string | null; brand?: string | null; model?: string | null; photoUrl?: string | null };
  publicStatus: string;
  customerVisibleSummary?: string | null;
  estimatedCompletionAt?: string | null;
  readyAt?: string | null;
  deliveredAt?: string | null;
  totalCents: number;
  paymentStatus: string;
  isActive: boolean;
  updatedAt: string;
}
export interface CustomerOrderTracking {
  orderNumber: string;
  bicycle: { nickname?: string | null; brand?: string | null; model?: string | null; bikeType?: string | null; color?: string | null; photoUrl?: string | null };
  publicStatus: string;
  customerVisibleSummary?: string | null;
  estimatedCompletionAt?: string | null;
  readyAt?: string | null;
  updates: Array<{ id: string; title: string; message: string; progressPercent?: number | null; photoUrl?: string | null; createdAt: string }>;
  visibleServices: Array<{ id: string; serviceName: string; description?: string | null; status: string }>;
  visibleParts: Array<{ id: string; partName: string; brand?: string | null; description?: string | null; status: string }>;
  history: Array<{ id: string; status: string; publicMessage?: string | null; createdAt: string }>;
  updatedAt: string;
  totalCents?: number;
  paymentStatus?: string;
}
export interface CustomerWorkshopRequestSummary {
  requestNumber: string;
  bicycleId: string | null;
  problemDescription: string;
  status: string;
  createdAt: string;
  convertedOrderId?: string | null;
}
export type CustomerBicyclePayload = Omit<CustomerBicycle, "id" | "status" | "updatedAt">;

export interface CustomerSession {
  authenticated: true;
  csrfToken: string;
  customer: CustomerIdentity;
}

export interface CustomerAuthLink {
  expiresAt: string;
  link: string;
  whatsappUrl: string;
}

let customerCsrf = "";
let restoreInFlight: Promise<CustomerSession> | null = null;
const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CUSTOMER_AUTH_CHANNEL = "mb_customer_auth";

export function getCustomerCsrfForTest() {
  return customerCsrf;
}

export function clearCustomerCsrf() {
  customerCsrf = "";
}

export function setCustomerCsrf(value: string) {
  customerCsrf = /^[a-f0-9]{64}$/.test(value) ? value : "";
}

type CustomerAuthMessage =
  | { type: "csrf"; csrfToken: string }
  | { type: "logout" };

export function createCustomerAuthSync(onLogout: () => void) {
  if (typeof BroadcastChannel === "undefined") return null;
  const channel = new BroadcastChannel(CUSTOMER_AUTH_CHANNEL);
  channel.onmessage = ({ data }: MessageEvent<unknown>) => {
    if (!data || typeof data !== "object" || !("type" in data)) return;
    const message = data as CustomerAuthMessage;
    if (message.type === "csrf" && typeof message.csrfToken === "string")
      setCustomerCsrf(message.csrfToken);
    if (message.type === "logout") {
      clearCustomerCsrf();
      onLogout();
    }
  };
  return {
    publishCsrf(csrfToken: string) {
      if (/^[a-f0-9]{64}$/.test(csrfToken))
        channel.postMessage({
          type: "csrf",
          csrfToken,
        } satisfies CustomerAuthMessage);
    },
    publishLogout() {
      channel.postMessage({ type: "logout" } satisfies CustomerAuthMessage);
    },
    close() {
      channel.close();
    },
  };
}

function customerMessage(status: number) {
  if (status === 401) return "No fue posible completar la autenticación.";
  if (status === 403) return "La sesión de seguridad expiró. Intenta nuevamente.";
  if (status === 429) return "Demasiados intentos. Espera un momento antes de continuar.";
  return "No fue posible completar la solicitud.";
}

export async function customerFetch<T>(
  path: string,
  init: RequestInit = {},
  authenticatedMutation = false,
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const execute = () => {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (authenticatedMutation && MUTATIONS.has(method) && customerCsrf)
      headers.set("X-CSRF-Token", customerCsrf);
    return fetch(`${API_BASE_URL}${path}`, {
      ...init,
      method,
      headers,
      credentials: "include",
    });
  };
  let response = await execute();
  if (response.status === 403 && authenticatedMutation) {
    const payload = (await response.clone().json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    if (payload?.error?.code === "CUSTOMER_CSRF_TOKEN") {
      await restoreCustomerSession();
      response = await execute();
    }
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; requestId?: string };
    } | null;
    if (response.status === 401 && authenticatedMutation) clearCustomerCsrf();
    throw new ApiError(
      response.status,
      customerMessage(response.status),
      {},
      payload?.error?.code ?? "",
      payload?.error?.requestId ?? "",
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function restoreCustomerSession() {
  if (restoreInFlight) return restoreInFlight;
  restoreInFlight = customerFetch<CustomerSession>("/api/customer/session")
    .then((result) => {
      setCustomerCsrf(result.csrfToken);
      return result;
    })
    .finally(() => {
      restoreInFlight = null;
    });
  return restoreInFlight;
}

export async function loginCustomer(phone: string, password: string) {
  const result = await customerFetch<{
    authenticated: true;
    csrfToken: string;
  }>("/api/customer/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  setCustomerCsrf(result.csrfToken);
  return result;
}

export const getCustomerMe = () =>
  customerFetch<CustomerIdentity>("/api/customer/me");
export const getMyLoyalty = (signal?: AbortSignal) =>
  customerFetch<CustomerLoyalty>("/api/customer/loyalty", { signal });
export const createMyCardLink = () =>
  customerFetch<{ cardUrl: string }>("/api/customer/card-link", {
    method: "POST",
  }, true);
export const getMyBicycles = (signal?: AbortSignal) =>
  customerFetch<CustomerBicycle[]>("/api/customer/bicycles", { signal });
export const getMyOrders = (signal?: AbortSignal) =>
  customerFetch<CustomerOrderSummary[]>("/api/customer/orders", { signal });
export const getMyOrder = (orderNumber: string, signal?: AbortSignal) =>
  customerFetch<CustomerOrderTracking>(
    `/api/customer/orders/${encodeURIComponent(orderNumber)}`,
    { signal },
  );
export const getMyWorkshopRequests = (signal?: AbortSignal) =>
  customerFetch<CustomerWorkshopRequestSummary[]>("/api/customer/workshop-requests", { signal });
export const createMyBicycle = (input: CustomerBicyclePayload) =>
  customerFetch<CustomerBicycle>("/api/customer/bicycles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }, true);
export const updateMyBicycle = (id: string, input: Partial<CustomerBicyclePayload>) =>
  customerFetch<CustomerBicycle>(`/api/customer/bicycles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }, true);
export const updateMyProfile = (input: {
  firstName: string;
  lastName: string;
  email: string | null;
  birthDate: string | null;
}) => customerFetch<CustomerIdentity>("/api/customer/profile", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(input),
}, true);
export const changeMyPassword = (currentPassword: string, newPassword: string) =>
  customerFetch<void>("/api/customer/password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  }, true);
export const createMyWorkshopRequest = (input: {
  bicycleId: string;
  serviceName: string | null;
  problemDescription: string;
  preferredContactMethod: "whatsapp" | "phone" | "email";
}) => customerFetch<{ requestNumber: string; status: string; createdAt: string }>(
  "/api/customer/workshop-requests",
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  },
  true,
);

export async function logoutCustomer() {
  try {
    await customerFetch<void>(
      "/api/customer/auth/logout",
      { method: "POST" },
      true,
    );
  } finally {
    clearCustomerCsrf();
  }
}

export const validateActivation = (token: string, signal?: AbortSignal) =>
  customerFetch<{ valid: boolean }>("/api/customer/auth/activation/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
    signal,
  });

export const activateCustomer = (token: string, password: string) =>
  customerFetch<void>("/api/customer/auth/activate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password }),
  });

export const recoverCustomer = (token: string, password: string) =>
  customerFetch<void>("/api/customer/auth/recovery/reset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password }),
  });

export function takeTokenFromLocation(
  locationLike: Pick<Location, "href" | "pathname" | "hash">,
  historyLike: Pick<History, "replaceState">,
) {
  const url = new URL(locationLike.href);
  const token = url.searchParams.get("token");
  historyLike.replaceState(null, "", `${locationLike.pathname}${locationLike.hash}`);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function safeInternalDestination(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/mi";
  try {
    const url = new URL(value, "https://mibicla.invalid");
    return url.origin === "https://mibicla.invalid" &&
      (url.pathname === "/mi" || url.pathname.startsWith("/mi/"))
      ? `${url.pathname}${url.search}${url.hash}`
      : "/mi";
  } catch {
    return "/mi";
  }
}
