export function workshopTimelineMessage(
  message: string | null | undefined,
  translatedStatus: string,
) {
  const value = message?.trim();
  if (!value || /^estado actualizado\s*:/i.test(value)) return undefined;
  const normalize = (text: string) =>
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX");
  const normalized = normalize(value);
  const status = normalize(translatedStatus);
  if (normalized === status) return undefined;
  if (status === "recibida" && normalized === "bicicleta recibida") return undefined;
  return value;
}
