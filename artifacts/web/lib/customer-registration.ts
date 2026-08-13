export function buildRegistrationWhatsappUrl(
  whatsapp: string,
  input: { name: string; reference: string; adminReviewUrl: string },
): string | null {
  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const message = [
    "Hola, solicito verificar mi cuenta Mi Bicla.",
    "",
    `Nombre: ${input.name}`,
    `Referencia: ${input.reference}`,
    "",
    "Revisar solicitud:",
    input.adminReviewUrl,
  ].join("\n");
  return buildWhatsappUrl(digits, message);
}
import { buildWhatsappUrl } from "./whatsapp";
