import { describe, expect, it } from "vitest";
import {
  extractPublicToken,
  resolvePublicRoute,
} from "../../artifacts/web/lib/public-routes";

describe("rutas públicas", () => {
  it("separa la landing del acceso administrativo", () => {
    expect(resolvePublicRoute("/")).toEqual({ route: "home" });
    expect(resolvePublicRoute("/admin")).toEqual({ route: "admin" });
    expect(resolvePublicRoute("/admin/workshop")).toEqual({ route: "admin" });
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
    expect(resolvePublicRoute("/mi").route).toBe("customer-home");
    expect(resolvePublicRoute("/mi/tarjeta").route).toBe("customer-loyalty");
    expect(resolvePublicRoute("/mi/taller").route).toBe("customer-workshop");
    expect(resolvePublicRoute("/mi/bicicletas").route).toBe("customer-bikes");
    expect(resolvePublicRoute("/mi/perfil").route).toBe("customer-profile");
    expect(resolvePublicRoute("/admin").route).toBe("admin");
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
