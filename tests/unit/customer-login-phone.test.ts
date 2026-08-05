import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isValidMexicanPhone,
  normalizeMexicanPhoneInput,
} from "../../artifacts/web/lib/mexican-phone";
import { mexicanPhoneSchema } from "../../packages/api-contract/src/phone.schema";

const customerAuthSource = readFileSync(
  "artifacts/web/pages/customer/CustomerAuth.tsx",
  "utf8",
);

// Aísla exactamente el cuerpo de submit() dentro de CustomerLogin (no el de
// PasswordTokenForm ni CustomerRegistrationInfo, que comparten firma).
const loginStart = customerAuthSource.indexOf("export function CustomerLogin");
const loginSubmitStart = customerAuthSource.indexOf(
  "async function submit(event: FormEvent<HTMLFormElement>) {",
  loginStart,
);
const loginSubmitEnd = customerAuthSource.indexOf(
  'return <AuthFrame title="INICIA TU RUTA"',
  loginSubmitStart,
);
const loginSubmitBody = customerAuthSource.slice(loginSubmitStart, loginSubmitEnd);
const loginFunctionBody = customerAuthSource.slice(
  loginStart,
  customerAuthSource.indexOf(
    "function PasswordTokenForm",
    loginStart,
  ),
);

describe("validación de teléfono en login de cliente — misma regla que mexicanPhoneSchema", () => {
  it("normaliza igual que normalizeMexicanPhone del contrato", () => {
    expect(normalizeMexicanPhoneInput("442 000 0000")).toBe("+524420000000");
    expect(normalizeMexicanPhoneInput("+52 442 000 0000")).toBe("+524420000000");
    expect(normalizeMexicanPhoneInput("521 442 000 0000")).toBe("+524420000000");
  });

  it("acepta y rechaza exactamente los mismos casos que el contrato compartido (verificación cruzada real)", () => {
    // Casos generados sistemáticamente por longitud de dígitos (8 a 13) y
    // formato, más los que un usuario real podría escribir. Si alguna de las
    // dos implementaciones cambia (p. ej. el contrato empieza a aceptar 11
    // dígitos, o esta copia deja de manejar el prefijo "521"), al menos uno
    // de estos casos hará que isValidMexicanPhone y mexicanPhoneSchema
    // diverjan y la prueba falle.
    const digitCounts = [0, 7, 8, 9, 10, 11, 12, 13, 14];
    const generated = digitCounts.flatMap((count) => {
      const digits = "4".repeat(count);
      return [
        digits,
        `52${digits}`,
        `521${digits}`,
        `+52${digits}`,
        `+52 ${digits}`,
      ];
    });
    const handwritten = [
      "442 000 0000",
      "442-000-0000",
      "(442) 000 0000",
      "  442 000 0000  ",
      "123",
      "",
      "   ",
      "cliente@example.com",
      "4420000000",
      "+524420000000",
      "+52 442 000 0000",
      "521 442 000 0000",
      "52 442 000 0000",
      "0000000000",
      "44200000000000",
      "abcdefghij",
      "442.000.0000",
    ];
    const cases = [...new Set([...generated, ...handwritten])];
    const mismatches = cases.filter(
      (value) =>
        isValidMexicanPhone(value) !== mexicanPhoneSchema.safeParse(value).success,
    );
    expect(mismatches).toEqual([]);
  });

  it("no acepta un correo como teléfono (no se agrega soporte de email)", () => {
    expect(isValidMexicanPhone("cliente@example.com")).toBe(false);
  });
});

describe("CustomerLogin — bloqueo real antes de auth.signIn, sin tocar el contrato", () => {
  it("aísla correctamente el submit de CustomerLogin (no el de otros formularios del archivo)", () => {
    expect(loginSubmitStart).toBeGreaterThan(loginStart);
    expect(loginSubmitEnd).toBeGreaterThan(loginSubmitStart);
    expect(loginSubmitBody).toContain("form.get(\"phone\")");
  });

  it("valida con isValidMexicanPhone antes de llamar a auth.signIn, y no envía si es inválido", () => {
    expect(loginSubmitBody).toContain("isValidMexicanPhone(phone)");
    expect(loginSubmitBody.indexOf("isValidMexicanPhone(phone)")).toBeLessThan(
      loginSubmitBody.indexOf("auth.signIn"),
    );
    const guardBlock = loginSubmitBody.slice(
      loginSubmitBody.indexOf("if (!isValidMexicanPhone(phone))"),
      loginSubmitBody.indexOf("auth.signIn"),
    );
    expect(guardBlock).toContain("return;");
    expect(guardBlock).not.toContain("auth.signIn");
  });

  it("asocia el error al campo con aria-invalid/aria-describedby y enfoca el teléfono", () => {
    expect(customerAuthSource).toContain("aria-invalid={Boolean(phoneError)}");
    expect(customerAuthSource).toContain(
      'aria-describedby={phoneError ? "customer-login-phone-error" : undefined}',
    );
    expect(customerAuthSource).toContain("phoneRef.current?.focus()");
  });

  it("mantiene type=tel, inputMode=tel y autoComplete=tel; el formulario de login no acepta correo", () => {
    expect(loginFunctionBody).toMatch(/name="phone"[\s\S]{0,160}type="tel"/);
    expect(loginFunctionBody).toContain('inputMode="tel"');
    expect(loginFunctionBody).toContain('autoComplete="tel"');
    expect(loginFunctionBody).not.toContain('type="email"');
    expect(loginFunctionBody).not.toContain('name="email"');
  });

  it("limpia el error del teléfono al corregirlo", () => {
    expect(customerAuthSource).toContain(
      'onChange={() => { if (phoneError) setPhoneError(""); }}',
    );
  });
});
