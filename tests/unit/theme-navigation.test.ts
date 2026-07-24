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
  MOBILE_NAV,
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
  it("mantiene siempre los cuatro destinos requeridos", () => {
    expect(MOBILE_NAV.map((item) => item.short)).toEqual([
      "Inicio",
      "Clientes",
      "Taller",
      "Más",
    ]);
  });

  it("agrupa Fidelidad y Configuración dentro de Más", () => {
    expect(
      isMobileNavigationActive(
        "/admin/settings/loyalty",
        "/admin/settings/deposits",
      ),
    ).toBe(true);
    expect(
      isMobileNavigationActive(
        "/admin/settings/general",
        "/admin/settings/general",
      ),
    ).toBe(true);
  });
});

describe("superficies temáticas", () => {
  it("no fuerza el fondo oscuro en la página pública de depósitos", () => {
    const css = readFileSync(
      new URL(
        "../../artifacts/web/pages/public/deposits.css",
        import.meta.url,
      ),
      "utf8",
    );
    expect(css).toContain("background: var(--color-background)");
    expect(css).not.toMatch(
      /\.public-deposits-page\s*\{[^}]*background:\s*#0b0b0d/s,
    );
    expect(css).not.toMatch(
      /\.public-deposit-detail\s*\{[^}]*background:\s*#0b0b0d/s,
    );
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
