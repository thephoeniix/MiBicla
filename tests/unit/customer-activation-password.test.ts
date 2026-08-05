import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isRegistrationPasswordValid,
  registrationPasswordStatus,
} from "../../artifacts/web/lib/registration-password";

const customerAuthSource = readFileSync(
  "artifacts/web/pages/customer/CustomerAuth.tsx",
  "utf8",
);

const passwordTokenFormSource = customerAuthSource.slice(
  customerAuthSource.indexOf("function PasswordTokenForm"),
  customerAuthSource.indexOf("export const CustomerActivation"),
);

describe("PasswordTokenForm reutiliza exactamente el contrato real de contraseña", () => {
  it("usa isRegistrationPasswordValid y registrationPasswordStatus (mismas funciones que el registro)", () => {
    expect(passwordTokenFormSource).toContain("isRegistrationPasswordValid(password)");
    expect(passwordTokenFormSource).toContain("isRegistrationPasswordValid(next)");
    expect(passwordTokenFormSource).toContain("registrationPasswordStatus(password)");
  });

  it("no define ninguna regla de contraseña propia (sin comparaciones de longitud duplicadas)", () => {
    expect(passwordTokenFormSource).not.toMatch(/password\.length\s*[<>]=?\s*\d+/);
  });

  it("las funciones reales validan lo que el formulario espera mostrar", () => {
    expect(isRegistrationPasswordValid("corta")).toBe(false);
    expect(isRegistrationPasswordValid("Fictional-Password1!")).toBe(true);
    const status = registrationPasswordStatus("");
    expect(status.length).toBeGreaterThan(0);
    expect(status.every((requirement) => requirement.met === false)).toBe(true);
  });
});

describe("PasswordTokenForm — experiencia visual reutilizada del registro", () => {
  it("tiene mostrar/ocultar contraseña y confirmación", () => {
    expect(passwordTokenFormSource).toContain('aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}');
    expect(passwordTokenFormSource).toContain('aria-label={showConfirmation ? "Ocultar confirmación" : "Mostrar confirmación"}');
    expect(passwordTokenFormSource).toContain('type={showPassword ? "text" : "password"}');
    expect(passwordTokenFormSource).toContain('type={showConfirmation ? "text" : "password"}');
  });

  it("muestra la lista de requisitos y se actualiza mientras se escribe", () => {
    expect(passwordTokenFormSource).toContain("passwordRequirements.map((requirement)");
    expect(passwordTokenFormSource).toContain('className="password-requirements"');
    expect(passwordTokenFormSource).toContain("registrationPasswordStatus(password)");
  });

  it("asocia el error al campo y enfoca el primero inválido antes de enviar", () => {
    expect(passwordTokenFormSource).toContain("aria-invalid={Boolean(passwordError)}");
    expect(passwordTokenFormSource).toContain("aria-invalid={Boolean(confirmationError)}");
    expect(passwordTokenFormSource).toContain("passwordRef.current?.focus();");
    expect(passwordTokenFormSource).toContain("confirmationRef.current?.focus();");
    // El foco de contraseña se evalúa antes que el de confirmación (mismo orden que el registro).
    expect(passwordTokenFormSource.indexOf("if (!validPassword)")).toBeLessThan(
      passwordTokenFormSource.indexOf("if (!matches)"),
    );
  });

  it("la acción principal de activación dice 'Activar mi cuenta'", () => {
    expect(passwordTokenFormSource).toContain(
      'purpose === "activation" ? "Activar mi cuenta" : "Cambiar contraseña"',
    );
  });

  it("no crea sesión ni guarda la contraseña — solo llama a activateCustomer/recoverCustomer y redirige", () => {
    expect(passwordTokenFormSource).toContain("await activateCustomer(token, password);");
    expect(passwordTokenFormSource).toContain("await recoverCustomer(token, password);");
    expect(passwordTokenFormSource).toContain('location.replace(`/iniciar-sesion?result=${purpose}`);');
    expect(passwordTokenFormSource).not.toMatch(/setCustomerCsrf|customer\.signIn|restoreCustomerSession/);
  });
});

describe("mensaje tras activar y enlace de login", () => {
  it("muestra el texto exacto pedido tras activar", () => {
    expect(customerAuthSource).toContain("Tu cuenta está lista. Ya puedes iniciar sesión.");
  });

  it("el login ofrece 'Crear cuenta' hacia /registro con explicación corta", () => {
    expect(customerAuthSource).toContain(
      "¿Aún no tienes cuenta? Solicítala y verificaremos tu número.",
    );
    expect(customerAuthSource).toMatch(/<a href="\/registro">Crear cuenta<\/a>/);
    expect(customerAuthSource).not.toContain("¿Cómo activo mi cuenta?");
  });
});

describe("placeholder telefónico ficticio, nunca un número real", () => {
  const files = [
    "artifacts/web/pages/customer/CustomerAuth.tsx",
    "artifacts/web/pages/admin/Customers.tsx",
    "artifacts/web/pages/public/WorkshopRequest.tsx",
  ].map((path) => ({ path, source: readFileSync(path, "utf8") }));

  it("ningún formulario usa 446 258 0377 (u otro número real) como placeholder", () => {
    for (const { path, source } of files) {
      expect(source, `${path} no debe contener el número real`).not.toContain("446 258 0377");
      expect(source, `${path} no debe contener el número real`).not.toContain("4462580377");
    }
  });

  it("el login usa el placeholder ficticio 442 000 0000", () => {
    const loginSource = files.find((f) => f.path.includes("CustomerAuth"))!.source;
    expect(loginSource).toContain('placeholder="442 000 0000"');
  });

  it("el placeholder nunca se usa como value/defaultValue del input (no se envía si el usuario no escribe)", () => {
    for (const { path, source } of files) {
      // Un placeholder solo es seguro si el campo sigue siendo controlado por
      // su propio value (o no controlado y vacío) — nunca placeholder+value
      // apuntando al mismo texto fijo, que simularía un valor precargado.
      expect(
        source,
        `${path}: el placeholder no debe ir acompañado de value="442 000 0000"`,
      ).not.toMatch(/value="442 000 0000"/);
    }
  });
});
