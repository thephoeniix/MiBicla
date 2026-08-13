import { useState } from "react";
import { apiFetch } from "../../lib/api-client";
import { PublicShell } from "../../components/public/PublicShell";
import { Container } from "../../components/primitives";
import { BrandPageHero } from "../../components/brand";
import { WorkshopRequestFlow } from "../../components/WorkshopRequestFlow";
import { publicWorkshopPayload, type WorkshopRequestDraft } from "../../lib/workshop-request";
import { buildWhatsappUrl } from "../../lib/whatsapp";

export function WorkshopRequest() {
  const [result, setResult] = useState<{ requestNumber: string; publicUrl: string } | null>(null);
  const requestedService = new URLSearchParams(location.search).get("servicio") ?? "";
  if (result) {
    const message = `Mi solicitud de taller ${result.requestNumber}: ${result.publicUrl}`;
    return <PublicShell><Container><section className="workshop-request-success"><p className="page-eyebrow">SOLICITUD RECIBIDA</p><h1>{result.requestNumber}</h1><p>El taller revisará la disponibilidad y te enviará una confirmación. Aún no es una cita ni una orden.</p><a className="ui-button" href={result.publicUrl}>Ver resumen y estado</a><a className="ui-button secondary" href={buildWhatsappUrl("https://wa.me/", message)} target="_blank" rel="noreferrer">Enviar resumen por WhatsApp</a></section></Container></PublicShell>;
  }
  async function submit(draft: WorkshopRequestDraft) {
    const created = await apiFetch<{ requestNumber: string; publicUrl: string }>("/api/public/workshop/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(publicWorkshopPayload(draft)) });
    setResult(created);
  }
  return <PublicShell><Container><BrandPageHero className="workshop-request-hero" eyebrow="TALLER MI BICLA" title="SOLICITA TU SERVICIO" description="Cuéntanos qué necesita tu bicicleta. El taller confirmará disponibilidad." /><section className="workshop-request-page"><a href="/taller">Volver al taller</a><WorkshopRequestFlow initial={{ serviceName: requestedService }} onSubmit={submit} /></section></Container></PublicShell>;
}
