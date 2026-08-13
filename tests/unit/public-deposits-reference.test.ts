import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("artifacts/web/pages/public/Depositos.tsx", "utf8");
const styles = readFileSync("artifacts/web/pages/public/deposits.css", "utf8");
const bankLogos = readFileSync("artifacts/web/lib/bank-logos.ts", "utf8");

describe("depósitos con identidad de la página informativa", () => {
  it("asocia los logos locales con los tres bancos configurados", () => {
    for (const bank of ["spin", "mercado pago", "banco azteca"])
      expect(bankLogos).toContain(`"${bank}"`);
    expect(source).toContain("bankLogo(option.bankName || option.displayName)");
  });

  it("conserva métodos dinámicos y no fija datos financieros", () => {
    expect(source).toContain('apiFetch<{ items: PublicDepositOption[] }>("/api/public/depositos")');
    expect(source).toContain("items.map((option)");
    expect(source).not.toMatch(/\b\d{16,18}\b/);
  });

  it("presenta pestañas, panel activo, copiado y WhatsApp", () => {
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain("copyFinancialValue(value)");
    expect(source).toContain("Enviar comprobante por WhatsApp");
  });

  it("incluye el panel de pago seguro y responde en móvil", () => {
    expect(source).toContain("Tu comprobante nos ayuda a confirmar el pago.");
    expect(styles).toContain(".deposit-safety-note");
    expect(styles).toContain("@media (min-width: 1024px)");
    expect(styles).toContain("@media (max-width: 420px)");
  });
});
