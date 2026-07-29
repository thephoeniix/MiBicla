import { describe, expect, it } from "vitest";
import {
  extractPublicToken,
  resolvePublicRoute,
} from "../../artifacts/web/lib/public-routes";
import { PUBLIC_NAV } from "../../artifacts/web/components/public/PublicShell";
import {
  AUTHORIZED_BRANDS,
  resolveRequestedWorkshopService,
  workshopServiceHref,
  WORKSHOP_SERVICES,
} from "../../artifacts/web/lib/public-content";
import brandSources from "../../artifacts/web/public/brands/sources.json";
import {
  ACCESS_REQUEST_MESSAGE,
  resolveAccessContact,
} from "../../artifacts/web/lib/public-contact";

describe("rutas públicas", () => {
  it("separa la landing del acceso administrativo", () => {
    expect(resolvePublicRoute("/")).toEqual({ route: "home" });
    expect(resolvePublicRoute("/marcas")).toEqual({ route: "brands-redirect" });
    expect(resolvePublicRoute("/admin")).toEqual({ route: "admin" });
    expect(resolvePublicRoute("/admin/workshop")).toEqual({ route: "admin" });
  });

  it("retira Marcas de la navegación y conserva la redirección interna", () => {
    expect(PUBLIC_NAV.some(([href, label]) => href === "/marcas" || label === "Marcas")).toBe(false);
    expect(resolvePublicRoute("/marcas")).toEqual({ route: "brands-redirect" });
  });

  it("conserva los 13 logos y su manifiesto", () => {
    expect(AUTHORIZED_BRANDS).toHaveLength(13);
    expect(brandSources).toHaveLength(13);
    expect(new Set(brandSources.map(({ file }) => file)).size).toBe(13);
  });

  it("solo preselecciona servicios públicos conocidos", () => {
    expect(resolveRequestedWorkshopService("?servicio=Tubeless")).toBe("Tubeless");
    expect(resolveRequestedWorkshopService("?servicio=Servicio%20completo")).toBe("Servicio completo");
    expect(resolveRequestedWorkshopService("?servicio=Orden%20creada")).toBe("");
  });

  it("conserva siete servicios y agrega tres con enlaces y preselección exactos", () => {
    const existing = [
      "Mantenimiento preventivo",
      "Servicio completo",
      "Reparaciones",
      "Suspensión",
      "Frenos y transmisión",
      "Tubeless",
      "Bike wash",
    ];
    const added = [
      "Diagnóstico",
      "Actualización de componentes",
      "Actualización de transmisión",
    ];
    expect(WORKSHOP_SERVICES).toHaveLength(10);
    expect(WORKSHOP_SERVICES).toEqual([...existing, ...added]);
    for (const service of added) {
      const href = workshopServiceHref(service as (typeof WORKSHOP_SERVICES)[number]);
      expect(href).toBe(`/taller/solicitud?servicio=${encodeURIComponent(service)}`);
      expect(resolveRequestedWorkshopService(new URL(href, "https://mibicla.test").search)).toBe(service);
    }
    expect(resolveRequestedWorkshopService("?servicio=diagn%C3%B3stico")).toBe("");
    expect(resolveRequestedWorkshopService("?servicio=Actualizaci%C3%B3n%20de%20transmisi%C3%B3n%20")).toBe("");
    expect(resolveRequestedWorkshopService("?servicio=Actualizaci%C3%B3n%20de%20motor")).toBe("");
  });

  it("construye la acción de acceso solo con configuración pública real", () => {
    expect(resolveAccessContact({ primaryWhatsapp: "+52 442 123 4567", address: "Tienda" }))
      .toBe(`https://wa.me/524421234567?text=${encodeURIComponent(ACCESS_REQUEST_MESSAGE).replace(/%20/g, "+")}`);
    expect(resolveAccessContact({ address: "Centro, Querétaro" }))
      .toBe("https://www.google.com/maps/search/?api=1&query=Centro%2C%20Quer%C3%A9taro");
    expect(resolveAccessContact({ primaryWhatsapp: "123", address: "" })).toBeNull();
    expect(resolveAccessContact(null)).toBeNull();
  });

  it("conserva rutas públicas con token", () => {
    expect(resolvePublicRoute("/taller/public_token_123")).toEqual({
      route: "workshop-tracking",
      token: "public_token_123",
    });
    expect(resolvePublicRoute("/c/card_token_123")).toEqual({
      route: "customer-card",
      token: "card_token_123",
    });
  });

  it("reconoce las vistas visuales del cliente sin mezclarlas con admin", () => {
    expect(resolvePublicRoute("/registro").route).toBe("customer-register");
    expect(resolvePublicRoute("/registro/verificar").route).toBe(
      "customer-verify",
    );
    expect(resolvePublicRoute("/iniciar-sesion").route).toBe("customer-login");
    expect(resolvePublicRoute("/recuperar-acceso").route).toBe(
      "customer-recovery",
    );
    expect(resolvePublicRoute("/cuenta/activar").route).toBe(
      "customer-activation",
    );
    expect(resolvePublicRoute("/cuenta/recuperar").route).toBe(
      "customer-recovery",
    );
    expect(resolvePublicRoute("/mi").route).toBe("customer-home");
    expect(resolvePublicRoute("/mi/tarjeta").route).toBe("customer-loyalty");
    expect(resolvePublicRoute("/mi/taller").route).toBe("customer-workshop");
    expect(resolvePublicRoute("/mi/bicicletas").route).toBe("customer-bikes");
    expect(resolvePublicRoute("/mi/perfil").route).toBe("customer-profile");
    expect(resolvePublicRoute("/admin").route).toBe("admin");
    expect(resolvePublicRoute("/mi/cualquier-ruta").route).toBe(
      "customer-home",
    );
  });
});

describe("accesos por token público", () => {
  it("acepta token directo y enlace completo", () => {
    expect(extractPublicToken("public_token_123", "workshop")).toBe(
      "public_token_123",
    );
    expect(
      extractPublicToken(
        "https://mibicla.example/c/card_token_123",
        "card",
      ),
    ).toBe("card_token_123");
  });

  it("rechaza rutas incorrectas, entradas inválidas y UUID internos", () => {
    expect(extractPublicToken("https://mibicla.example/c/card_token_123", "workshop")).toBeNull();
    expect(extractPublicToken("token con espacios", "card")).toBeNull();
    expect(
      extractPublicToken("5c893cf8-e537-4c4a-b82d-eca78fd6f05b", "card"),
    ).toBeNull();
  });
});
