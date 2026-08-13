export function buildWhatsappMessage(template: string, variables: Record<string, string>) {
  return template.replace(/\{([a-z_]+)\}/g, (_match, key: string) => variables[key] ?? "").trim();
}

export function buildWhatsappUrl(phoneOrBaseUrl: string, message: string) {
  const parsed = phoneOrBaseUrl.startsWith("http")
    ? new URL(phoneOrBaseUrl)
    : new URL(`https://wa.me/${phoneOrBaseUrl.replace(/\D/g, "")}`);
  parsed.searchParams.set("text", message);
  return parsed.toString();
}
