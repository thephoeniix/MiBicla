export async function copyText(
  value: string,
  navigatorObject: Pick<Navigator, "clipboard"> = navigator,
): Promise<void> {
  if (navigatorObject.clipboard?.writeText)
    return navigatorObject.clipboard.writeText(value);
  const area = document.createElement("textarea");
  area.value = value;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}
export function whatsappUrl(
  number: string,
  template: string,
  values: Record<"nombre" | "monto" | "concepto" | "pedido" | "banco", string>,
): string {
  return buildWhatsappUrl(number, buildWhatsappMessage(template, values));
}
import { buildWhatsappMessage, buildWhatsappUrl } from "./whatsapp";
