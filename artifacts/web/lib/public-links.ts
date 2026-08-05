export const MI_BICLA_MAPS_URL =
  "https://www.google.com/maps/place/Mi+Bicla/@20.606104,-100.3349228,17z/data=!3m1!4b1!4m6!3m5!1s0x85d35dc726e59771:0xc65492c606f6db5b!8m2!3d20.606099!4d-100.3323425!16s%2Fg%2F11v5yqlglx?entry=ttu&g_ep=EgoyMDI2MDcyNi4wIKXMDSoASAFQAw%3D%3D";

export function configuredWhatsappUrl(
  primaryWhatsapp?: string,
): string | null {
  const digits = primaryWhatsapp?.replace(/\D/g, "") ?? "";
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
}

// Vacío o ausente devuelven [] por igual, para que la UI caiga al mismo
// mensaje "Horario no disponible." sin inventar días ni horas.
export function openingHoursEntries(
  openingHours?: Record<string, string>,
): Array<[string, string]> {
  return openingHours ? Object.entries(openingHours) : [];
}
