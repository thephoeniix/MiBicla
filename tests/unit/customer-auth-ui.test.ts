import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const customerAuthComponentSource = readFileSync(
  "artifacts/web/pages/customer/CustomerAuth.tsx",
  "utf8",
);
const customerPortalSource = readFileSync(
  "artifacts/web/pages/customer/CustomerPortal.tsx",
  "utf8",
);

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
  configurable: true,
});
Object.defineProperty(globalThis, "window", {
  value: { dispatchEvent: vi.fn() },
  configurable: true,
});

describe("cliente HTTP de autenticación", () => {
  beforeEach(async () => {
    storage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    const { clearCustomerCsrf } =
      await import("../../artifacts/web/lib/customer-auth");
    clearCustomerCsrf();
  });

  it("incluye credenciales y mantiene separado el CSRF administrativo", async () => {
    storage.set("mb_csrf", "admin-csrf");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        authenticated: true,
        csrfToken: "c".repeat(64),
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { loginCustomer, logoutCustomer } =
      await import("../../artifacts/web/lib/customer-auth");
    await loginCustomer("+524420000001", "Fictional-Password1!");
    await logoutCustomer();
    const [, loginInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [, logoutInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(loginInit.credentials).toBe("include");
    expect(new Headers(loginInit.headers).has("X-CSRF-Token")).toBe(false);
    expect(new Headers(logoutInit.headers).get("X-CSRF-Token")).toBe("c".repeat(64));
    expect(storage.get("mb_csrf")).toBe("admin-csrf");
  });

  it("restaura el CSRF del cliente después de recargar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      authenticated: true,
      csrfToken: "b".repeat(64),
      customer: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Cliente Ficticio",
        phone: "+524420000001",
        accountStatus: "active",
      },
    }), { status: 200 })));
    const { getCustomerCsrfForTest, restoreCustomerSession } =
      await import("../../artifacts/web/lib/customer-auth");
    await restoreCustomerSession();
    expect(getCustomerCsrfForTest()).toBe("b".repeat(64));
  });

  it("deduplica restauraciones concurrentes dentro de la misma pestaña", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async () => {
      await pending;
      return new Response(JSON.stringify({
        authenticated: true,
        csrfToken: "d".repeat(64),
        customer: {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Cliente Ficticio",
          phone: "+524420000001",
          accountStatus: "active",
        },
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { restoreCustomerSession } =
      await import("../../artifacts/web/lib/customer-auth");
    const first = restoreCustomerSession();
    const second = restoreCustomerSession();
    release();
    expect(await first).toEqual(await second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recupera un CSRF obsoleto y reintenta logout una sola vez", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: "CUSTOMER_CSRF_TOKEN" },
      }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        authenticated: true,
        csrfToken: "e".repeat(64),
        customer: {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Cliente Ficticio",
          phone: "+524420000001",
          accountStatus: "active",
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { logoutCustomer, setCustomerCsrf } =
      await import("../../artifacts/web/lib/customer-auth");
    setCustomerCsrf("a".repeat(64));
    await logoutCustomer();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, retry] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(new Headers(retry.headers).get("X-CSRF-Token")).toBe("e".repeat(64));
  });

  it("sincroniza CSRF y logout en memoria, sin rebotes, y cierra el canal", async () => {
    class FakeChannel {
      static instance: FakeChannel;
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
      postMessage = vi.fn();
      close = vi.fn();
      constructor(public name: string) {
        FakeChannel.instance = this;
      }
    }
    vi.stubGlobal("BroadcastChannel", FakeChannel);
    const onLogout = vi.fn();
    const { createCustomerAuthSync, getCustomerCsrfForTest } =
      await import("../../artifacts/web/lib/customer-auth");
    const sync = createCustomerAuthSync(onLogout);
    FakeChannel.instance.onmessage?.({
      data: { type: "csrf", csrfToken: "f".repeat(64) },
    } as MessageEvent);
    expect(getCustomerCsrfForTest()).toBe("f".repeat(64));
    expect(FakeChannel.instance.postMessage).not.toHaveBeenCalled();
    FakeChannel.instance.onmessage?.({
      data: { type: "logout" },
    } as MessageEvent);
    expect(onLogout).toHaveBeenCalledOnce();
    sync?.close();
    expect(FakeChannel.instance.close).toHaveBeenCalledOnce();
  });

  it("elimina el token de la URL y nunca lo persiste", async () => {
    const token = "a".repeat(64);
    const replaceState = vi.fn();
    const { takeTokenFromLocation } =
      await import("../../artifacts/web/lib/customer-auth");
    expect(takeTokenFromLocation({
      href: `https://mibicla.example/cuenta/activar?token=${token}`,
      pathname: "/cuenta/activar",
      hash: "",
    } as Location, { replaceState } as unknown as History)).toBe(token);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/cuenta/activar");
    expect(storage.size).toBe(0);
  });

  it("solo conserva destinos internos bajo /mi", async () => {
    const { safeInternalDestination } =
      await import("../../artifacts/web/lib/customer-auth");
    expect(safeInternalDestination("/mi/perfil?tab=cuenta")).toBe(
      "/mi/perfil?tab=cuenta",
    );
    expect(safeInternalDestination("//evil.example/mi")).toBe("/mi");
    expect(safeInternalDestination("https://evil.example/mi")).toBe("/mi");
    expect(safeInternalDestination("/mievil")).toBe("/mi");
    expect(safeInternalDestination("\\\\evil.example\\mi")).toBe("/mi");
    expect(safeInternalDestination("/%2f%2fevil.example")).toBe("/mi");
  });

  it("rechaza esquemas (javascript:, data:) y variantes codificadas o nulas", async () => {
    const { safeInternalDestination } =
      await import("../../artifacts/web/lib/customer-auth");
    expect(safeInternalDestination(null)).toBe("/mi");
    expect(safeInternalDestination("")).toBe("/mi");
    expect(safeInternalDestination("javascript:alert(1)")).toBe("/mi");
    expect(safeInternalDestination("data:text/html,<script>alert(1)</script>")).toBe("/mi");
    expect(safeInternalDestination("http://evil.example/mi")).toBe("/mi");
    expect(safeInternalDestination("ftp://evil.example/mi")).toBe("/mi");
    // "/" + esquema no es un escape real: se resuelve como ruta bajo el
    // origen interno, así que se acepta la forma /mi/... y se descarta el
    // resto — no ejecuta nada como esquema.
    expect(safeInternalDestination("/\tjavascript:alert(1)")).toBe("/mi");
    expect(safeInternalDestination("/mi/../../../evil")).toBe("/mi");
  });

  it("restoreCustomerSession rechaza cuando el servidor ya no reconoce la sesión (401)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "CUSTOMER_UNAUTHORIZED" },
    }), { status: 401 })));
    const { restoreCustomerSession, getCustomerCsrfForTest } =
      await import("../../artifacts/web/lib/customer-auth");
    await expect(restoreCustomerSession()).rejects.toMatchObject({ status: 401 });
    expect(getCustomerCsrfForTest()).toBe("");
  });
});

describe("restauración de sesión tras bfcache (navegación atrás/adelante)", () => {
  it("CustomerAuthProvider vuelve a validar la sesión cuando pageshow llega con persisted, sin recargar la página", () => {
    const providerBody = customerAuthComponentSource.slice(
      customerAuthComponentSource.indexOf("export function CustomerAuthProvider"),
      customerAuthComponentSource.indexOf("function useCustomerAuth"),
    );
    expect(providerBody).toContain('window.addEventListener("pageshow", onPageShow)');
    expect(providerBody).toContain("if (event.persisted) void restore();");
    expect(providerBody).toContain('window.removeEventListener("pageshow", onPageShow)');
    // No debe existir una recarga forzada indiscriminada.
    expect(providerBody).not.toContain("location.reload");
  });

  it("restore() pasa primero por 'loading' (invalida la vista privada) antes de resolver autenticado o anónimo", () => {
    const restoreBody = customerAuthComponentSource.slice(
      customerAuthComponentSource.indexOf("const restore = useCallback"),
      customerAuthComponentSource.indexOf("useEffect(() => {\n    syncRef.current"),
    );
    expect(restoreBody).toContain('setState("loading");');
    expect(restoreBody.indexOf('setState("loading");')).toBeLessThan(
      restoreBody.indexOf("restoreCustomerSession()"),
    );
  });

  it("CustomerPortal redirige con replace (no push) cuando la sesión resulta anónima tras revalidar", () => {
    const portalBody = customerPortalSource.slice(
      customerPortalSource.indexOf("export function CustomerPortal"),
    );
    expect(portalBody).toContain('if (auth.state === "anonymous")');
    expect(portalBody).toContain("location.replace(`/iniciar-sesion?next=");
    expect(portalBody).not.toMatch(/if \(auth\.state === "anonymous"\)[\s\S]{0,120}location\.href/);
  });

  it("conecta cada sección privada con endpoints derivados de la sesión", () => {
    expect(customerPortalSource).toContain("getMyLoyalty");
    expect(customerPortalSource).toContain("getMyBicycles");
    expect(customerPortalSource).toContain("getMyOrders");
    expect(customerPortalSource).toContain("getMyOrder");
    expect(customerPortalSource).not.toMatch(/customerId[=:]/);
  });
});
