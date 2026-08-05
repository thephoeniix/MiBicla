export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export function canonicalFinancialValue(value: string) {
  if (!/^[\d\s]*$/.test(value))
    throw new Error("FINANCIAL_VALUE_NON_NUMERIC");
  return value.replace(/\s/g, "");
}

export function formatFinancialNumber(value: string, groupSize = 4) {
  const digits = digitsOnly(value);
  return digits.match(new RegExp(`.{1,${groupSize}}`, "g"))?.join(" ") ?? "";
}

export function formatFinancialInput(value: string, groupSize = 4) {
  return /^[\d\s]*$/.test(value)
    ? formatFinancialNumber(value, groupSize)
    : value;
}

export function isValidClabe(value: string) {
  if (!/^\d{18}$/.test(value)) return false;
  const weights = [3, 7, 1] as const;
  const sum = value
    .slice(0, 17)
    .split("")
    .reduce(
      (total, digit, index) =>
        total + ((digit.charCodeAt(0) - 48) * weights[index % weights.length]!) % 10,
      0,
    );
  return (10 - (sum % 10)) % 10 === value.charCodeAt(17) - 48;
}

export type FinancialFieldErrors = Partial<
  Record<"accountNumber" | "clabe" | "cardNumber", string>
>;

export function validateFinancialFields(input: {
  accountNumber: string;
  clabe: string;
  cardNumber: string;
}): FinancialFieldErrors {
  const errors: FinancialFieldErrors = {};
  let accountNumber = "";
  let clabe = "";
  let cardNumber = "";
  try {
    accountNumber = canonicalFinancialValue(input.accountNumber);
  } catch {
    errors.accountNumber = "Ingresa únicamente dígitos.";
  }
  try {
    clabe = canonicalFinancialValue(input.clabe);
  } catch {
    errors.clabe = "Ingresa una CLABE válida de 18 dígitos.";
  }
  try {
    cardNumber = canonicalFinancialValue(input.cardNumber);
  } catch {
    errors.cardNumber = "Ingresa únicamente dígitos.";
  }
  if (!errors.accountNumber && accountNumber && accountNumber.length > 30)
    errors.accountNumber = "Ingresa hasta 30 dígitos.";
  if (!errors.clabe && clabe && !isValidClabe(clabe))
    errors.clabe = "Ingresa una CLABE válida de 18 dígitos.";
  if (
    !errors.cardNumber &&
    cardNumber &&
    (cardNumber.length < 13 || cardNumber.length > 19)
  )
    errors.cardNumber = "Ingresa entre 13 y 19 dígitos.";
  return errors;
}

export function maskedFinancialSummary(value?: string) {
  const digits = digitsOnly(value ?? "");
  return digits ? `•••• ${digits.slice(-4)}` : "";
}

export async function copyFinancialValue(
  value: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined =
    typeof navigator === "undefined" ? undefined : navigator.clipboard,
  documentObject: Pick<
    Document,
    "createElement" | "body" | "execCommand"
  > | undefined = typeof document === "undefined" ? undefined : document,
) {
  const digits = digitsOnly(value);
  if (!digits) throw new Error("No hay un valor para copiar");
  if (clipboard?.writeText) {
    await clipboard.writeText(digits);
    return;
  }
  if (!documentObject) throw new Error("No fue posible copiar");
  const area = documentObject.createElement("textarea");
  area.value = digits;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  documentObject.body.append(area);
  area.select();
  const copied = documentObject.execCommand("copy");
  area.remove();
  if (!copied) throw new Error("No fue posible copiar");
}
