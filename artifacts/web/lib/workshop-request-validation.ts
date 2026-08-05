// Estas reglas duplican intencionalmente, campo por campo, el contrato en
// packages/api-contract/src/workshop.schema.ts (workshopRequestSchema). No se
// importa el paquete compartido porque @mi-bicla/web no depende hoy de
// @mi-bicla/api-contract ni de zod, y agregar esa dependencia queda fuera de
// alcance en esta fase. Si el contrato cambia, estas funciones deben
// actualizarse junto con workshop.schema.ts. La regla de teléfono vive en
// mexican-phone.ts (única copia, reutilizada también por el login de cliente).

import { isValidMexicanPhone } from "./mexican-phone";

export interface WorkshopRequestFields {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  bikeBrand: string;
  bikeModel: string;
  bikeType: string;
  problemDescription: string;
}

export type WorkshopRequestField = keyof WorkshopRequestFields;

export { normalizeMexicanPhoneInput as normalizeWorkshopPhone } from "./mexican-phone";

// Mismo refine que mexicanPhoneSchema: trim -> normalizeMexicanPhone -> /^\+52\d{10}$/.
export const isValidWorkshopPhone = isValidMexicanPhone;

// Regex activa de zod v3 para z.string().email() (node_modules/zod/v3/types.js).
// customerEmail = opt(z.string().email().max(254)): vacío (tras trim) es válido
// porque el campo es opcional; si no está vacío, el valor SIN recortar debe
// cumplir el formato y el límite de longitud (opt() no recorta antes de validar).
const EMAIL_FORMAT = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;

export function isValidWorkshopEmail(value: string): boolean {
  if (value.trim() === "") return true;
  return value.length <= 254 && EMAIL_FORMAT.test(value);
}

// Mismo comportamiento que safe(max, min) del contrato: trim, límites de
// longitud y sin "<" ni ">".
function isValidRequiredText(value: string, min: number, max: number): boolean {
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max && !/[<>]/.test(trimmed);
}

// Mismo comportamiento que opt(safe(max)): vacío (tras trim) es válido porque
// el campo es opcional; si no, aplican los mismos límites que arriba.
function isValidWorkshopOptionalText(value: string, max: number): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  return trimmed.length <= max && !/[<>]/.test(trimmed);
}

export function isValidWorkshopCustomerName(value: string): boolean {
  return isValidRequiredText(value, 2, 150); // safe(150, 2)
}

export function isValidWorkshopBikeField(value: string): boolean {
  return isValidWorkshopOptionalText(value, 100); // opt(safe(100))
}

export function isValidWorkshopProblemDescription(value: string): boolean {
  return isValidRequiredText(value, 10, 3000); // safe(3000, 10)
}

export function findInvalidWorkshopFields(
  data: WorkshopRequestFields,
): WorkshopRequestField[] {
  const invalid: WorkshopRequestField[] = [];
  if (!isValidWorkshopCustomerName(data.customerName)) invalid.push("customerName");
  if (!isValidWorkshopPhone(data.customerPhone)) invalid.push("customerPhone");
  if (!isValidWorkshopEmail(data.customerEmail)) invalid.push("customerEmail");
  if (!isValidWorkshopBikeField(data.bikeBrand)) invalid.push("bikeBrand");
  if (!isValidWorkshopBikeField(data.bikeModel)) invalid.push("bikeModel");
  if (!isValidWorkshopBikeField(data.bikeType)) invalid.push("bikeType");
  if (!isValidWorkshopProblemDescription(data.problemDescription)) invalid.push("problemDescription");
  return invalid;
}
