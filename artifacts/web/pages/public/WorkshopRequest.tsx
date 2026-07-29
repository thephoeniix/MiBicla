import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api-client";
import { PublicShell } from "../../components/public/PublicShell";
import { Container } from "../../components/primitives";
import { BrandPageHero } from "../../components/brand";
import { Button, Input, Select, Textarea } from "../../components/ui";
import { resolveRequestedWorkshopService } from "../../lib/public-content";
const EMPTY = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  bikeBrand: "",
  bikeModel: "",
  bikeType: "",
  problemDescription: "",
  preferredContactMethod: "whatsapp",
};
export function WorkshopRequest() {
  const [data, setData] = useState(() => {
      return { ...EMPTY, problemDescription: resolveRequestedWorkshopService(window.location.search) };
    }),
    [status, setStatus] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const x = await apiFetch<{ requestNumber: string }>(
        "/api/public/workshop/requests",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      setStatus(`Solicitud recibida: ${x.requestNumber}. El taller confirmará disponibilidad.`);
      setData(EMPTY);
    } catch (e) {
      setStatus(
        e instanceof ApiError
          ? e.message
          : "No fue posible enviar la solicitud",
      );
    }
  }
  return (
    <PublicShell><Container><BrandPageHero className="workshop-request-hero" eyebrow="TALLER MI BICLA" title="SOLICITA TU SERVICIO" description="Cuéntanos qué necesita tu bicicleta. El taller confirmará disponibilidad." /><section className="workshop-request-page">
      <a href="/taller">← Volver al taller</a>
      <h2>DATOS DE TU BICI</h2>
      <p>Esta solicitud no confirma una cita ni crea una orden automáticamente.</p>
      <form className="workshop-request-form" onSubmit={submit}>
        {(
          [
            "customerName",
            "customerPhone",
            "customerEmail",
            "bikeBrand",
            "bikeModel",
            "bikeType",
            "problemDescription",
          ] as const
        ).map((k) => (
          <label key={k}>
            {{
              customerName: "Nombre",
              customerPhone: "Teléfono",
              customerEmail: "Correo de contacto",
              bikeBrand: "Marca de la bicicleta",
              bikeModel: "Modelo",
              bikeType: "Tipo",
              problemDescription: "¿Qué servicio necesita?",
            }[k]}
            {k === "problemDescription" ? (
              <Textarea
                rows={4}
                value={data[k]}
                onChange={(e) => setData({ ...data, [k]: e.target.value })}
              />
            ) : <Input
              type={k === "customerPhone" ? "tel" : undefined}
              inputMode={k === "customerPhone" ? "tel" : undefined}
              placeholder={k === "customerPhone" ? "446 258 0377" : undefined}
              value={data[k]}
              onChange={(e) => setData({ ...data, [k]: e.target.value })}
            />}
          </label>
        ))}
        <label>
          Contacto
          <Select
            value={data.preferredContactMethod}
            onChange={(e) =>
              setData({ ...data, preferredContactMethod: e.target.value })
            }
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Teléfono</option>
            <option value="email">Correo</option>
          </Select>
        </label>
        <Button>Enviar solicitud</Button>
        <output>{status}</output>
      </form>
    </section></Container></PublicShell>
  );
}
