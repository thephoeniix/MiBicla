// Duplica intencionalmente packages/api-contract/src/phone.schema.ts
// (normalizeMexicanPhone / mexicanPhoneSchema). No se importa el paquete
// compartido porque @mi-bicla/web no depende de @mi-bicla/api-contract ni de
// zod en esta fase. Única fuente de esta regla en el frontend — tanto el
// login de cliente como el formulario público de taller la reutilizan desde
// aquí, para no mantener dos copias independientes que puedan divergir.

export function normalizeMexicanPhoneInput(value: string): string {
  const trimmed = value.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("521") && digits.length === 13) digits = digits.slice(3);
  else if (digits.startsWith("52") && digits.length === 12) digits = digits.slice(2);
  return digits.length === 10 ? `+52${digits}` : trimmed;
}

export function isValidMexicanPhone(value: string): boolean {
  return /^\+52\d{10}$/.test(normalizeMexicanPhoneInput(value));
}
