export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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
    if (response.status === 401) {
      sessionStorage.removeItem("mb_csrf");
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    throw new ApiError(response.status, messageForStatus(response.status));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
