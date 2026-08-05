import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  countPendingRegistrations,
  filterRegistrationsByStatus,
  REGISTRATION_STATUS_TABS,
  type RegistrationRequest,
} from "../../artifacts/web/pages/admin/Customers";

const customersSource = readFileSync("artifacts/web/pages/admin/Customers.tsx", "utf8");
const uiSource = readFileSync("artifacts/web/components/ui.tsx", "utf8");
const styles = readFileSync("artifacts/web/style.css", "utf8");
const decideRegistrationSource = customersSource.slice(
  customersSource.indexOf("async function decideRegistration"),
  customersSource.indexOf("async function save"),
);

function fixtureRequest(overrides: Partial<RegistrationRequest>): RegistrationRequest {
  return {
    reviewId: "a".repeat(64),
    reference: "MB-TEST0001",
    firstName: "Ana",
    lastName: "Prueba",
    status: "pending",
    createdAt: "2026-08-01T12:00:00.000Z",
    expiresAt: "2026-08-02T12:00:00.000Z",
    ...overrides,
  };
}

const MIXED_REQUESTS: RegistrationRequest[] = [
  fixtureRequest({ reviewId: "1".repeat(64), status: "pending" }),
  fixtureRequest({ reviewId: "2".repeat(64), status: "pending" }),
  fixtureRequest({ reviewId: "3".repeat(64), status: "approved" }),
  fixtureRequest({ reviewId: "4".repeat(64), status: "rejected" }),
  fixtureRequest({ reviewId: "5".repeat(64), status: "expired" }),
];

describe("panel de solicitudes de acceso — datos existentes, sin nuevos endpoints", () => {
  it("cuenta únicamente las solicitudes pendientes", () => {
    expect(countPendingRegistrations(MIXED_REQUESTS)).toBe(2);
    expect(countPendingRegistrations([])).toBe(0);
    expect(
      countPendingRegistrations(
        MIXED_REQUESTS.filter((request) => request.status !== "pending"),
      ),
    ).toBe(0);
  });

  it("expone las cuatro pestañas de estado ya soportadas por el esquema", () => {
    expect(REGISTRATION_STATUS_TABS.map((tab) => tab.id)).toEqual([
      "pending",
      "approved",
      "rejected",
      "expired",
    ]);
  });

  it("filtra cada pestaña sin perder ni duplicar solicitudes", () => {
    const partitioned = REGISTRATION_STATUS_TABS.flatMap((tab) =>
      filterRegistrationsByStatus(MIXED_REQUESTS, tab.id),
    );
    expect(partitioned).toHaveLength(MIXED_REQUESTS.length);
    expect(new Set(partitioned.map((request) => request.reviewId)).size).toBe(
      MIXED_REQUESTS.length,
    );
    for (const tab of REGISTRATION_STATUS_TABS) {
      const matches = filterRegistrationsByStatus(MIXED_REQUESTS, tab.id);
      expect(matches.every((request) => request.status === tab.id)).toBe(true);
    }
  });

  it("la fila compacta muestra nombre, referencia, fecha y estado — sin teléfono ni correo", () => {
    expect(customersSource).toContain("{request.firstName} {request.lastName}");
    expect(customersSource).toContain("{request.reference} · {new Date(request.createdAt)");
    expect(customersSource).toContain("<StatusBadge status={request.status} />");
    expect(customersSource).not.toMatch(/registration-row[\s\S]{0,400}request\.phone/);
    expect(customersSource).not.toMatch(/registration-row[\s\S]{0,400}request\.email/);
  });

  it("el detalle muestra teléfono, correo, fecha de solicitud y estado", () => {
    expect(customersSource).toContain("<dt>Teléfono</dt>");
    expect(customersSource).toContain("<dt>Correo</dt>");
    expect(customersSource).toContain("<dt>Fecha de solicitud</dt>");
    expect(customersSource).toContain("<StatusBadge status={registrationDetail.status} />");
  });

  it("ofrece contacto manual por tel: con texto accesible", () => {
    expect(customersSource).toContain("href={`tel:${registrationDetail.phone}`}");
    expect(customersSource).toMatch(/aria-label=\{`Llamar a \$\{registrationDetail\.firstName\}/);
  });

  it("conserva la confirmación manual del número antes de decidir", () => {
    expect(customersSource).toContain(
      "Antes de aprobar, confirma que el número registrado coincide con el remitente del mensaje de WhatsApp.",
    );
    expect(customersSource).toContain(
      "Confirmo que verifiqué manualmente este número y deseo preparar el enlace de activación.",
    );
    expect(customersSource).toContain("¿Confirmas que deseas rechazar esta solicitud?");
  });

  it("bloquea ambas acciones mientras se decide, para evitar doble envío", () => {
    expect(customersSource).toContain("if (!registrationDetail || deciding) return;");
    expect(customersSource).toContain('disabled={deciding} onClick={() => void decideRegistration("reject")}');
    expect(customersSource).toContain('disabled={deciding} onClick={() => void decideRegistration("approve")}');
    expect(customersSource).toContain("setDeciding(true)");
    expect(customersSource).toContain("setDeciding(false)");
  });

  it("tras aprobar refresca solicitudes y clientes, y cierra el detalle", () => {
    const approveBlock = customersSource.slice(
      customersSource.indexOf("async function decideRegistration"),
      customersSource.indexOf("async function save"),
    );
    expect(approveBlock).toContain("setRegistrationDetail(null)");
    expect(approveBlock).toContain(
      'await apiFetch<RegistrationRequest[]>("/api/admin/customer-registration-requests")',
    );
    expect(approveBlock).toContain("setRegistrationRequests(requests)");
    expect(approveBlock).toContain('if (action === "approve") {');
    expect(approveBlock).toContain("await load();");
  });

  it("no introduce OTP, SMS ni envío o activación automática", () => {
    const registrationBlock = customersSource.slice(
      customersSource.indexOf("async function openRegistration"),
      customersSource.indexOf("async function save"),
    );
    expect(registrationBlock).not.toMatch(/otp|sms|twilio|auto-?activat/i);
  });

  it("rechazar refresca solicitudes pero NO fuerza un refresco de la lista de clientes", () => {
    // load() (clientes) solo se invoca una vez en todo el flujo de decisión,
    // y está condicionado exclusivamente a la rama "approve".
    const loadCalls = decideRegistrationSource.match(/await load\(\)/g) ?? [];
    expect(loadCalls).toHaveLength(1);
    expect(decideRegistrationSource).toContain('if (action === "approve") {');
    // La rama de éxito refresca registrationRequests para ambas acciones.
    expect(decideRegistrationSource).toContain("setRegistrationRequests(requests)");
  });

  it("el enlace tel: solo aparece cuando la solicitud tiene teléfono", () => {
    expect(customersSource).toContain('{registrationDetail.phone || "Sin teléfono"}');
    expect(customersSource).toContain("{registrationDetail.phone && (");
  });

  it("'Revisar solicitudes' desplaza y mueve el foco a un destino accesible", () => {
    expect(customersSource).toContain('tabIndex={-1}');
    expect(customersSource).toContain('aria-label="Solicitudes de acceso"');
    expect(customersSource).toContain("section.scrollIntoView({ behavior: \"smooth\", block: \"start\" });");
    expect(customersSource).toContain("section.focus({ preventScroll: true });");
  });

  it("el estado 'expired' tiene una etiqueta en español y estilo neutral, distinto de 'rejected'", () => {
    expect(uiSource).toContain('rejected: "Rechazada"');
    expect(uiSource).toContain('expired: "Expirada"');
    // El grupo de color "peligro" (rojo) debe incluir rejected pero NO expired,
    // para que "expirada" no se lea como un rechazo o un error.
    const dangerGroup = styles.match(
      /\.status-badge--inactive,\s*\n\.status-badge--cancelled,\s*\n\.status-badge--rejected \{[^}]*color: var\(--color-danger\)/,
    );
    expect(dangerGroup).not.toBeNull();
    expect(styles).not.toMatch(/\.status-badge--expired\s*\{[^}]*color: var\(--color-danger\)/);
    expect(styles).not.toMatch(/\.status-badge--expired[,{]/);
  });

  it("las filas de solicitudes y sus acciones envuelven en lugar de recortarse en pantallas angostas (verificación estática de CSS; pendiente confirmar en navegador real)", () => {
    expect(styles).toMatch(/\.list-row \{[^}]*flex-wrap: wrap/);
    expect(styles).toMatch(/\.registration-row-actions \{[^}]*flex-wrap: wrap/);
    expect(styles).not.toMatch(/\.registration-review-list[^{]*\{[^}]*overflow-x: hidden/);
    expect(styles).not.toMatch(/\.registration-row[^{]*\{[^}]*white-space: nowrap/);
  });
});
