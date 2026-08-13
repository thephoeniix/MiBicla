import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  },
  configurable: true,
});
Object.defineProperty(globalThis, "window", {
  value: { dispatchEvent: vi.fn() },
  configurable: true,
});
describe("cliente API autenticado", () => {
  beforeEach(() => {
    storage.clear();
    vi.restoreAllMocks();
  });
  it("clasifica un fallo de red sin exponer detalles del transporte", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED secret-host")),
    );
    const { apiFetch } = await import("../../artifacts/web/lib/api-client");
    await expect(
      apiFetch("/api/public/customer-registration", { method: "POST" }),
    ).rejects.toMatchObject({
      status: 0,
      code: "API_UNREACHABLE",
      message: "No fue posible conectar con el servicio.",
    });
  });
  it("envía cookie y CSRF en PUT", async () => {
    sessionStorage.setItem("mb_csrf", "csrf-test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiFetch } = await import("../../artifacts/web/lib/api-client");
    await apiFetch("/api/admin/settings/deposits", {
      method: "PUT",
      body: "{}",
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("X-CSRF-Token")).toBe("csrf-test");
  });
  it("envía cookie y CSRF en el ajuste manual del escáner", async () => {
    sessionStorage.setItem("mb_csrf", "csrf-scanner");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ availableUnits: 3, rewardsCreated: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiFetch } = await import("../../artifacts/web/lib/api-client");
    await apiFetch("/api/admin/customers/customer-id/loyalty-adjustments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ units: 1, reason: "Compra en tienda" }),
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("X-CSRF-Token")).toBe("csrf-scanner");
  });
  it("restaura el CSRF administrativo obsoleto y reintenta una sola vez", async () => {
    sessionStorage.setItem("mb_csrf", "csrf-obsoleto");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: "CSRF_TOKEN" },
      }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        authenticated: true,
        csrfToken: "csrf-restaurado",
        administrator: {},
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const { apiFetch } = await import("../../artifacts/web/lib/api-client");
    await apiFetch("/api/admin/customer-registration-requests/review/approve", {
      method: "POST",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/auth/session");
    const [, retry] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(new Headers(retry.headers).get("X-CSRF-Token")).toBe("csrf-restaurado");
  });
  it.each([
    [400, "datos inválidos"],
    [401, "sesión expiró"],
    [403, "No tienes permiso"],
  ] as const)("maneja %i", async (status, text) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status })),
    );
    const { apiFetch } = await import("../../artifacts/web/lib/api-client");
    await expect(apiFetch("/api/admin/settings")).rejects.toThrow(text);
  });
  it("conserva el requestId de un error administrativo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "INVALID",
              requestId: "request-test",
            },
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );
    const { apiFetch, ApiError } =
      await import("../../artifacts/web/lib/api-client");
    const error = await apiFetch("/api/admin/customers/resolve-token", {
      method: "POST",
    }).catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as InstanceType<typeof ApiError>).requestId).toBe(
      "request-test",
    );
  });
});
