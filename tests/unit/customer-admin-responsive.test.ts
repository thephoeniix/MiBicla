import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCustomerPayload } from "../../artifacts/web/pages/admin/Customers";

const customersSource = readFileSync("artifacts/web/pages/admin/Customers.tsx", "utf8");
const bicycleFormSource = readFileSync("artifacts/web/components/BicycleForm.tsx", "utf8");
const portalSource = readFileSync("artifacts/web/pages/customer/CustomerPortal.tsx", "utf8");
const uiSource = readFileSync("artifacts/web/components/ui.tsx", "utf8");
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
    const flowSource = readFileSync("artifacts/web/components/WorkshopRequestFlow.tsx", "utf8");
    expect(flowSource).toContain("Completa los campos requeridos de este paso.");
    expect(flowSource).toContain("isValidMexicanPhone(draft.customerPhone)");
    expect(flowSource).toContain("heading.current?.focus()");
    expect(requestSource).not.toContain("customerName: String must contain");
  });

  it("limita la tipografía y no reserva espacio para una barra pública", () => {
    expect(styles).toContain("-webkit-text-size-adjust: 100%");
    expect(styles).toMatch(/@media \(max-width: 600px\)[\s\S]*\.public-hero h1\s*\{[^}]*font-size:\s*clamp\(3\.7rem, 19vw, 5\.3rem\)/);
    expect(styles).toContain("min-height: 650px");
    expect(styles).toMatch(/\.public-shell\s*\{[^}]*padding-bottom:\s*0/s);
    expect(styles).toContain("env(safe-area-inset-bottom)");
  });

  it("mantiene formularios modales completos en cualquier celular", () => {
    expect(uiSource).toContain("export function FormDialog");
    expect(bicycleFormSource).toContain("<FormDialog");
    expect(bicycleFormSource).toContain('className="form-dialog-body"');
    expect(portalSource).toContain("<FormDialog");
    expect(styles).toContain(".ui-form-dialog");
    expect(styles).toContain("height: 100dvh");
    expect(styles).toContain("grid-template-rows: auto minmax(0, 1fr) auto");
    expect(styles).toContain("env(safe-area-inset-bottom)");
  });

  it("centra el estado activo y los iconos del seguimiento", () => {
    expect(portalSource).toContain('className="customer-home-bike-copy"');
    expect(styles).toContain(
      ".customer-home-service .customer-home-bike-copy .status-badge",
    );
    expect(styles).toContain(
      ".customer-order-detail .ui-stepper li > span",
    );
    expect(styles).toContain(
      ".customer-order-detail .ui-stepper i > .ui-stepper-icon",
    );
  });
});
