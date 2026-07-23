export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: Record<string, string> = {},
    public code = "",
    public requestId = "",
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const MUTABLE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export function messageForStatus(status: number): string {
  if (status === 401) return "Tu sesión expiró. Inicia sesión nuevamente.";
  if (status === 403)
    return "No tienes permiso o el token de seguridad expiró.";
  if (status === 400) return "La solicitud contiene datos inválidos.";
  return "No fue posible completar la solicitud.";
}
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase(),
    headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (MUTABLE.has(method)) {
    const csrf = sessionStorage.getItem("mb_csrf");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: {
        code?: string;
        fieldErrors?: Record<string, string>;
        requestId?: string;
      };
    } | null;
    if (response.status === 401) {
      sessionStorage.removeItem("mb_csrf");
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    const fields = payload?.error?.fieldErrors ?? {},
      detail = Object.entries(fields)[0];
    throw new ApiError(
      response.status,
      detail ? `${detail[0]}: ${detail[1]}` : messageForStatus(response.status),
      fields,
      payload?.error?.code ?? "",
      payload?.error?.requestId ?? "",
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
