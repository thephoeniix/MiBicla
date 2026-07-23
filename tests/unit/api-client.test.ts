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
});
