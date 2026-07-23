import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api-client";
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
  const [data, setData] = useState(EMPTY),
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
      setStatus(`Solicitud recibida: ${x.requestNumber}`);
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
    <main>
      <h1>Solicitar servicio de taller</h1>
      <form onSubmit={submit}>
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
            {k}
            <input
              type={k === "customerPhone" ? "tel" : undefined}
              inputMode={k === "customerPhone" ? "tel" : undefined}
              placeholder={k === "customerPhone" ? "446 258 0377" : undefined}
              value={data[k]}
              onChange={(e) => setData({ ...data, [k]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Contacto
          <select
            value={data.preferredContactMethod}
            onChange={(e) =>
              setData({ ...data, preferredContactMethod: e.target.value })
            }
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Teléfono</option>
            <option value="email">Correo</option>
          </select>
        </label>
        <button>Enviar solicitud</button>
        <output>{status}</output>
      </form>
    </main>
  );
}
