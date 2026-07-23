import { useEffect, useState, type FormEvent } from "react";
import {
  EMPTY_BUSINESS,
  hydrateBusiness,
  type BusinessForm,
  type BusinessResponse,
} from "./General";
import { apiFetch, ApiError } from "../../../lib/api-client";
export function Social() {
  const [data, setData] = useState<BusinessForm>(EMPTY_BUSINESS),
    [status, setStatus] = useState("");
  useEffect(() => {
    apiFetch<BusinessResponse | null>("/api/admin/settings")
      .then((v) => v && setData(hydrateBusiness(v)))
      .catch((e) =>
        setStatus(e instanceof ApiError ? e.message : "No se pudo cargar"),
      );
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildSocialPayload(data)),
      });
      setStatus("Guardado");
    } catch (error) {
      setStatus(
        error instanceof ApiError ? error.message : "No se pudo guardar",
      );
    }
  }
  return (
    <form onSubmit={save}>
      <h2>Redes sociales</h2>
      {(["facebook", "instagram", "tiktok", "website"] as const).map((k) => (
        <label key={k}>
          {k}
          <input
            type="url"
            value={data[k]}
            onChange={(e) => setData({ ...data, [k]: e.target.value })}
          />
        </label>
      ))}
      <button>Guardar</button>
      <output>{status}</output>
    </form>
  );
}
const optional = (value: string) => value.trim() || null;
export function buildSocialPayload(data: BusinessForm) {
  return {
    facebook: optional(data.facebook),
    instagram: optional(data.instagram),
    tiktok: optional(data.tiktok),
    website: optional(data.website),
  };
}
