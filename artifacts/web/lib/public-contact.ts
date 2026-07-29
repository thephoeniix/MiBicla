export interface PublicContact {
  primaryWhatsapp?: string;
  address?: string;
}

export const ACCESS_REQUEST_MESSAGE =
  "Hola, quiero solicitar acceso a mi cuenta de Mi Bicla.";

export function resolveAccessContact(contact: PublicContact | null): string | null {
  const whatsapp = contact?.primaryWhatsapp?.replace(/\D/g, "") ?? "";
  if (whatsapp.length >= 7) {
    const query = new URLSearchParams({ text: ACCESS_REQUEST_MESSAGE });
    return `https://wa.me/${whatsapp}?${query.toString()}`;
  }
  const address = contact?.address?.trim();
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
}
