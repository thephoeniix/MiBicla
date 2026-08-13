import spinLogo from "../../../logo_banks/logo.svg";
import mercadoPagoLogo from "../../../logo_banks/mercadopago.png";
import bancoAztecaLogo from "../../../logo_banks/banco-azteca.png";

const BANK_LOGOS = [
  { terms: ["spin", "oxxo"], src: spinLogo },
  { terms: ["mercado pago", "mercadopago"], src: mercadoPagoLogo },
  { terms: ["banco azteca", "azteca"], src: bancoAztecaLogo },
] as const;

export function bankLogo(name: string) {
  const normalized = name.trim().toLocaleLowerCase("es-MX");
  return BANK_LOGOS.find(({ terms }) => terms.some((term) => normalized.includes(term)))?.src;
}
