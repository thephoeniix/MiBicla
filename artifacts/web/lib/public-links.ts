export const MI_BICLA_MAPS_URL =
  "https://www.google.com/maps/place/Mi+Bicla/@20.6064534,-100.3317012,18z/data=!4m6!3m5!1s0x85d35dc726e59771:0xc65492c606f6db5b!8m2!3d20.606099!4d-100.3323425!16s%2Fg%2F11v5yqlglx?entry=ttu&g_ep=EgoyMDI2MDgwMy4wIKXMDSoASAFQAw%3D%3D";

export const MI_BICLA_CONTACT = {
  name: "Mi Bicla",
  description: "Taller y accesorios de ciclismo",
  primaryWhatsapp: "+52 442 830 6394",
  secondaryWhatsapp: "+52 442 749 6410",
  email: "mibiclaqro@gmail.com",
  address: "Calle Emiliano Zapata Ote. 10, El Jardín, La Cañada, Qro.",
  facebook: "https://www.facebook.com/MiBiclaQueretaro",
  instagram: "https://www.instagram.com/mibiclaqro",
  instagramHandle: "@mibiclaqro",
  weekdayHours: "12:00 PM a 8:00 PM",
} as const;

export function configuredWhatsappUrl(
  primaryWhatsapp?: string,
): string | null {
  const digits = primaryWhatsapp?.replace(/\D/g, "") ?? "";
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
}

export function whatsappContactUrl(phone: string): string {
  const base = configuredWhatsappUrl(phone)!;
  return `${base}?text=${encodeURIComponent("Hola Mi Bicla, quisiera información.")}`;
}

function vcardValue(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

export function businessContactVcard(contact: {
  name: string;
  primaryWhatsapp: string;
  secondaryWhatsapp?: string;
  email: string;
  address: string;
  website?: string;
}): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${vcardValue(contact.name)}`,
    `ORG:${vcardValue(contact.name)};${vcardValue(MI_BICLA_CONTACT.description)}`,
    `TEL;TYPE=CELL:${contact.primaryWhatsapp.replace(/\s/g, "")}`,
  ];
  if (contact.secondaryWhatsapp) lines.push(`TEL;TYPE=CELL:${contact.secondaryWhatsapp.replace(/\s/g, "")}`);
  lines.push(
    `EMAIL;TYPE=INTERNET:${vcardValue(contact.email)}`,
    `ADR;TYPE=WORK:;;${vcardValue(contact.address)};;;;México`,
  );
  if (contact.website) lines.push(`URL:${vcardValue(contact.website)}`);
  lines.push("END:VCARD");
  return `${lines.join("\r\n")}\r\n`;
}

// Vacío o ausente devuelven [] por igual, para que la UI caiga al mismo
// mensaje "Horario no disponible." sin inventar días ni horas.
export function openingHoursEntries(
  openingHours?: Record<string, string>,
): Array<[string, string]> {
  return openingHours ? Object.entries(openingHours) : [];
}
