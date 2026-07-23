export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export function formatFinancialNumber(value: string, groupSize = 4) {
  const digits = digitsOnly(value);
  return digits.match(new RegExp(`.{1,${groupSize}}`, "g"))?.join(" ") ?? "";
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
