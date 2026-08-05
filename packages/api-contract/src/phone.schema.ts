import { z } from "zod";

export function normalizeMexicanPhone(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("521") && digits.length === 13) {
    digits = digits.slice(3);
  } else if (digits.startsWith("52") && digits.length === 12) {
    digits = digits.slice(2);
  }

  return digits.length === 10 ? `+52${digits}` : value;
}

export const mexicanPhoneSchema = z
  .string()
  .trim()
  .transform(normalizeMexicanPhone)
  .refine(
    (value) => /^\+52\d{10}$/.test(value),
    "Ingresa un teléfono mexicano de 10 dígitos, por ejemplo 442 000 0000",
  );
