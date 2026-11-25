import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  applyTheme,
  persistThemePreference,
  readThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
} from "../../artifacts/web/lib/theme";
import {
  isMobileNavigationActive,
  persistSidebarCollapsed,
  readSidebarCollapsed,
  SIDEBAR_STORAGE_KEY,
} from "../../artifacts/web/components/AppShell";

describe("tema global", () => {
  it("usa Sistema cuando no existe una preferencia persistida", () => {
    expect(readThemePreference({ getItem: () => null })).toBe("system");
  });

  it.each([
    ["light", "light"],
    ["dark", "dark"],
  ] as const)("respeta y persiste conceptualmente la selección %s", (value, expected) => {
    const storage = new Map([[THEME_STORAGE_KEY, value]]);
    expect(readThemePreference({ getItem: (key) => storage.get(key) ?? null })).toBe(
      expected,
    );
  });

  it("persiste únicamente la preferencia global", () => {
    const values = new Map<string, string>();
    persistThemePreference("dark", {
      setItem: (key, value) => values.set(key, value),
    });
    expect([...values.entries()]).toEqual([[THEME_STORAGE_KEY, "dark"]]);
  });

  it("reacciona al sistema sólo con la preferencia Sistema", () => {
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("aplica data-theme y conserva la preferencia elegida", () => {
    const root = { dataset: {} as DOMStringMap };
    expect(applyTheme("system", true, root)).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
    expect(root.dataset.themePreference).toBe("system");
  });
});

describe("navegación móvil autenticada", () => {
  it("inicia expandida y persiste la preferencia del sidebar", () => {
    expect(readSidebarCollapsed({ getItem: () => null })).toBe(false);
    expect(readSidebarCollapsed({ getItem: () => "true" })).toBe(true);
    const values = new Map<string, string>();
    persistSidebarCollapsed(true, {
      setItem: (key, value) => values.set(key, value),
    });
    expect([...values.entries()]).toEqual([[SIDEBAR_STORAGE_KEY, "true"]]);
  });

  it("activa destinos fijos y vistas hijas sin activar Inicio en todo admin", () => {
    expect(
      isMobileNavigationActive(
        "/admin/workshop/detail",
        "/admin/workshop",
      ),
    ).toBe(true);
    expect(
      isMobileNavigationActive(
        "/admin/products",
        "/admin",
      ),
    ).toBe(false);
    expect(
      isMobileNavigationActive(
        "/admin",
        "/admin",
      ),
    ).toBe(true);
    expect(
      isMobileNavigationActive("/admin/workshop/orden", "/admin/workshop"),
    ).toBe(true);
  });

  it("agrupa todos los destinos disponibles en un drawer", () => {
    const source = readFileSync(
      new URL("../../artifacts/web/components/AppShell.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('aria-label="Navegación principal"');
    expect(source).toContain('group: "Operación"');
    expect(source).toContain('group: "Comunidad"');
    expect(source).toContain('group: "Administración"');
    expect(source).toContain('group: "Configuración"');
    expect(source).toContain('label: "Solicitudes y cotizaciones"');
  });

  it("usa iconos administrativos consistentes en lugar de símbolos provisionales", () => {
    const source = readFileSync(
      new URL("../../artifacts/web/components/AppShell.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("<AdminHomeIcon />");
    expect(source).toContain("<LoyaltyAdminIcon />");
    expect(source).toContain("<WorkshopAdminIcon />");
    expect(source).toContain("<EventsIcon />");
    expect(source).toContain("<ProductsIcon />");
    expect(source).toContain("<RequestsIcon />");
    expect(source).not.toContain(">◇<");
    expect(source).not.toContain(">□<");
    expect(source).not.toContain(">≡<");
  });
});

describe("superficies temáticas", () => {
  it("comparte la superficie oscura de la página informativa en depósitos", () => {
    const css = readFileSync(
      new URL(
        "../../artifacts/web/pages/public/deposits.css",
        import.meta.url,
      ),
      "utf8",
    );
    expect(css).toMatch(/\.public-deposits-page\s*\{[^}]*background:\s*#070709/s);
    expect(css).toContain(".deposit-bank-tabs");
    expect(css).toContain(".deposit-safety-note");
    expect(css).not.toContain(".public-deposit-detail");
  });

  it("centraliza containers fluidos y activa escritorio desde 1024 px", () => {
    const css = readFileSync(
      new URL("../../artifacts/web/style.css", import.meta.url),
      "utf8",
    );
    expect(css).toContain("max-width: var(--page-max-width)");
    expect(css).toContain("@media (min-width: 1024px)");
    expect(css).not.toContain("@media (min-width: 960px)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("mantiene Crear orden como flujo enfocado y tabs móviles en Taller", () => {
    const source = readFileSync(
      new URL("../../artifacts/web/pages/admin/Workshop.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('className="workshop-mobile-tabs"');
    expect(source).toContain('className="create-order-modal"');
    expect(source).not.toContain('className="create-order-card"');
  });
});
