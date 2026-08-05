import { useRef, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api-client";
import { PublicShell } from "../../components/public/PublicShell";
import { Container } from "../../components/primitives";
import { BrandPageHero } from "../../components/brand";
import { Button, Input, Select, Textarea } from "../../components/ui";
import { resolveRequestedWorkshopService } from "../../lib/public-content";
import { findInvalidWorkshopFields } from "../../lib/workshop-request-validation";
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
type WorkshopField = keyof typeof EMPTY;
const FIELD_MESSAGES: Partial<Record<WorkshopField, string>> = {
  customerName: "Escribe un nombre de al menos 2 caracteres.",
  customerPhone: "Ingresa un teléfono mexicano válido de 10 dígitos.",
  customerEmail: "Ingresa un correo válido.",
  bikeBrand: "Escribe una marca válida.",
  bikeModel: "Escribe un modelo válido.",
  bikeType: "Escribe un tipo de bicicleta válido.",
  problemDescription: "Describe el servicio en al menos 10 caracteres.",
};
export function WorkshopRequest() {
  const [data, setData] = useState(() => ({
      ...EMPTY,
      problemDescription: resolveRequestedWorkshopService(
        window.location.search,
      ),
    })),
    [status, setStatus] = useState(""),
    [fieldErrors, setFieldErrors] = useState<Partial<Record<WorkshopField, string>>>({});
  const fieldRefs = useRef<Partial<Record<WorkshopField, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  function focusFirst(errors: Partial<Record<WorkshopField, string>>) {
    const first = Object.keys(errors)[0] as WorkshopField | undefined;
    if (first) requestAnimationFrame(() => fieldRefs.current[first]?.focus());
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalidFields = findInvalidWorkshopFields(data);
    if (invalidFields.length) {
      const localErrors: Partial<Record<WorkshopField, string>> = Object.fromEntries(
        invalidFields.map((field) => [field, FIELD_MESSAGES[field]]),
      );
      setFieldErrors(localErrors);
      setStatus("");
      focusFirst(localErrors);
      return;
    }
    setFieldErrors({});
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
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        const errors = Object.fromEntries(
          Object.keys(e.fieldErrors)
            .filter((field): field is WorkshopField => field in EMPTY)
            .map((field) => [field, FIELD_MESSAGES[field] ?? "Revisa este campo."]),
        );
        setFieldErrors(errors);
        setStatus("");
        focusFirst(errors);
      } else setStatus("No fue posible enviar la solicitud. Inténtalo nuevamente.");
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
                ref={(node) => { fieldRefs.current[k] = node; }}
                rows={4}
                aria-invalid={Boolean(fieldErrors[k])}
                aria-describedby={fieldErrors[k] ? `workshop-${k}-error` : undefined}
                value={data[k]}
                onChange={(e) => {
                  setData({ ...data, [k]: e.target.value });
                  if (fieldErrors[k]) setFieldErrors((current) => ({ ...current, [k]: undefined }));
                }}
              />
            ) : <Input
              ref={(node) => { fieldRefs.current[k] = node; }}
              type={k === "customerPhone" ? "tel" : undefined}
              inputMode={k === "customerPhone" ? "tel" : undefined}
              placeholder={k === "customerPhone" ? "442 000 0000" : undefined}
              aria-invalid={Boolean(fieldErrors[k])}
              aria-describedby={fieldErrors[k] ? `workshop-${k}-error` : undefined}
              value={data[k]}
              onChange={(e) => {
                setData({ ...data, [k]: e.target.value });
                if (fieldErrors[k]) setFieldErrors((current) => ({ ...current, [k]: undefined }));
              }}
            />}
            {fieldErrors[k] && <small className="field-error" id={`workshop-${k}-error`}>{fieldErrors[k]}</small>}
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
