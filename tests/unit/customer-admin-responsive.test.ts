import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCustomerPayload } from "../../artifacts/web/pages/admin/Customers";

const customersSource = readFileSync("artifacts/web/pages/admin/Customers.tsx", "utf8");
const bicycleFormSource = readFileSync("artifacts/web/components/BicycleForm.tsx", "utf8");
const requestSource = readFileSync("artifacts/web/pages/public/WorkshopRequest.tsx", "utf8");
const styles = readFileSync("artifacts/web/style.css", "utf8");

describe("edición administrativa de clientes y bicicletas", () => {
  it("envía únicamente los campos editables del cliente", () => {
    const payload = buildCustomerPayload({
      id: "no-debe-salir",
      firstName: " Ana ",
      lastName: " López ",
      phone: " 4420000000 ",
      email: " ",
      birthDate: "",
      notes: " nota ",
      status: "active",
    } as Parameters<typeof buildCustomerPayload>[0] & { id: string });

    expect(payload).toEqual({
      firstName: "Ana",
      lastName: "López",
      phone: "4420000000",
      email: null,
      birthDate: null,
      notes: "nota",
      status: "active",
    });
    expect(payload).not.toHaveProperty("id");
  });

  it("refresca el detalle y presenta confirmación después de editar", () => {
    expect(customersSource).toContain("if (editedId && detail?.customer.id === editedId) await view(editedId)");
    expect(customersSource).toContain("Cambios del cliente guardados.");
  });

  it("muestra marca, modelo y tipo por separado y reutiliza BicycleForm", () => {
    for (const label of ["<dt>Marca</dt>", "<dt>Modelo</dt>", "<dt>Tipo</dt>"]) {
      expect(customersSource).toContain(label);
    }
    expect(customersSource).toContain("bicycle={editingBicycle}");
    expect(bicycleFormSource).toContain('method: bicycle ? "PUT" : "POST"');
    expect(bicycleFormSource).toContain('bicycle ? "Editar bicicleta" : "Registrar bicicleta"');
  });
});

describe("errores comprensibles y presentación móvil", () => {
  it("traduce el error de nombre y lo asocia al campo", () => {
    expect(requestSource).toContain("Escribe un nombre de al menos 2 caracteres.");
    expect(requestSource).toContain("aria-invalid={Boolean(fieldErrors[k])}");
    expect(requestSource).toContain("fieldRefs.current[first]?.focus()");
    expect(requestSource).not.toContain("customerName: String must contain");
  });

  it("limita la tipografía y reserva espacio para navegación y safe areas", () => {
    expect(styles).toContain("-webkit-text-size-adjust: 100%");
    expect(styles).toMatch(/\.public-hero h1\s*\{[^}]*font-size:\s*clamp\(3\.75rem, 16vw, 5\.25rem\)/);
    expect(styles).toContain("min-height: max(520px, calc(100dvh - 80px))");
    expect(styles).toContain("padding-bottom: calc(92px + env(safe-area-inset-bottom))");
    expect(styles).toContain("right: max(8px, env(safe-area-inset-right))");
    expect(styles).toContain("left: max(8px, env(safe-area-inset-left))");
  });
});
