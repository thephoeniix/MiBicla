import { useEffect, useState, type FormEvent } from "react";
import {
  EMPTY_BUSINESS,
  hydrateBusiness,
  type BusinessForm,
  type BusinessResponse,
} from "./General";
import { apiFetch, ApiError } from "../../../lib/api-client";
import {
  ActionBar,
  Button,
  Card,
  Input,
  PageHeader,
} from "../../../components/ui";
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
    <section className="admin-page social-settings">
      <PageHeader
        eyebrow="Configuración"
        title="Presencia digital"
        description="Mantén actualizados los enlaces públicos de Mi Bicla."
      />
      <form onSubmit={save}>
        <Card className="settings-card settings-reading-card">
          <div className="card-heading">
            <div>
              <p className="page-eyebrow">Canales públicos</p>
              <h2>Redes sociales</h2>
            </div>
          </div>
          <div className="form-grid">
            {(
              [
                ["facebook", "Facebook"],
                ["instagram", "Instagram"],
                ["tiktok", "TikTok"],
                ["website", "Sitio web"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <Input
                  type="url"
                  value={data[key]}
                  onChange={(event) =>
                    setData({ ...data, [key]: event.target.value })
                  }
                />
              </label>
            ))}
          </div>
        </Card>
        <ActionBar className="sticky-save">
          <output aria-live="polite">
            {status || "Los cambios se aplicarán al guardar."}
          </output>
          <Button>Guardar cambios</Button>
        </ActionBar>
      </form>
    </section>
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
