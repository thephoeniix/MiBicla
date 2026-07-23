import { describe, expect, it, vi } from "vitest";
import {
  cameraErrorMessage,
  canShowCustomerScanner,
  createScanGate,
  extractCustomerToken,
  stopMediaStream,
} from "../../artifacts/web/components/scanner/scanner-utils";
import { customerScanTokenSchema } from "@mi-bicla/api-contract";

const TOKEN = "a".repeat(64);

describe("escáner administrativo de clientes", () => {
  it("extrae el token desde una URL pública completa", () => {
    expect(
      extractCustomerToken(`https://mibicla.example/c/${TOKEN}`),
    ).toBe(TOKEN);
  });

  it("acepta un token directo", () => {
    expect(extractCustomerToken(TOKEN.toUpperCase())).toBe(TOKEN);
    expect(customerScanTokenSchema.parse({ token: TOKEN })).toEqual({
      token: TOKEN,
    });
  });

  it.each([
    "https://mibicla.example/client/not-valid",
    "javascript:alert(1)",
    "https://mibicla.example/c/short",
    `https://mibicla.example/c/${TOKEN}/extra`,
  ])("rechaza un valor inválido: %s", (value) => {
    expect(extractCustomerToken(value)).toBeNull();
  });

  it("el contrato administrativo rechaza tokens mal formados", () => {
    expect(() => customerScanTokenSchema.parse({ token: "short" })).toThrow();
  });

  it("se pausa después de detectar y no procesa duplicados", () => {
    const gate = createScanGate();
    expect(gate.accept(TOKEN)).toBe(true);
    expect(gate.paused).toBe(true);
    expect(gate.accept(TOKEN)).toBe(false);
    expect(gate.accept("b".repeat(64))).toBe(false);
    gate.reset();
    expect(gate.accept(TOKEN)).toBe(true);
  });

  it("detiene todos los tracks de la cámara", () => {
    const first = { stop: vi.fn() };
    const second = { stop: vi.fn() };
    stopMediaStream({
      getTracks: () => [first, second] as unknown as MediaStreamTrack[],
    });
    expect(first.stop).toHaveBeenCalledOnce();
    expect(second.stop).toHaveBeenCalledOnce();
  });

  it("muestra fallback específico cuando se deniega el permiso", () => {
    expect(
      cameraErrorMessage(
        new DOMException("Permission denied", "NotAllowedError"),
      ),
    ).toContain("permiso");
  });

  it("oculta la acción sin adjust_loyalty o fuera de sus rutas", () => {
    expect(canShowCustomerScanner("/admin/customers", [])).toBe(false);
    expect(
      canShowCustomerScanner("/admin/customers", ["adjust_loyalty"]),
    ).toBe(true);
    expect(
      canShowCustomerScanner("/admin/workshop", ["adjust_loyalty"]),
    ).toBe(false);
    expect(
      canShowCustomerScanner("/admin/settings/loyalty", ["adjust_loyalty"]),
    ).toBe(false);
  });
});
