import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../lib/api-client";
import {
  ActionBar,
  Button,
  Card,
  Input,
  PageHeader,
  ResponsiveGrid,
} from "../../../components/ui";
import { ThemeSelector } from "../../../components/ThemeSelector";
export interface BusinessForm {
  businessName: string;
  address: string;
  phone: string;
  email: string;
  primaryWhatsapp: string;
  secondaryWhatsapp: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  website: string;
  openingHours: Record<string, string>;
  logoUrl: string;
  faviconUrl: string;
  themeColor: string;
}
export const EMPTY_BUSINESS: BusinessForm = {
  businessName: "",
  address: "",
  phone: "",
  email: "",
  primaryWhatsapp: "",
  secondaryWhatsapp: "",
  facebook: "",
  instagram: "",
  tiktok: "",
  website: "",
  openingHours: {},
  logoUrl: "",
  faviconUrl: "",
  themeColor: "#ec3d92",
};
export type BusinessResponse = Omit<
  BusinessForm,
  | "secondaryWhatsapp"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "website"
  | "logoUrl"
  | "faviconUrl"
> & {
  secondaryWhatsapp: string | null;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  website: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  id: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};
const cleanOptional = (value: string) => value.trim() || null;
export function hydrateBusiness(
  value: Partial<BusinessResponse>,
): BusinessForm {
  return {
    ...EMPTY_BUSINESS,
    ...value,
    secondaryWhatsapp: value.secondaryWhatsapp ?? "",
    facebook: value.facebook ?? "",
    instagram: value.instagram ?? "",
    tiktok: value.tiktok ?? "",
    website: value.website ?? "",
    logoUrl: value.logoUrl ?? "",
    faviconUrl: value.faviconUrl ?? "",
  };
}
export function buildGeneralPayload(data: BusinessForm) {
  return {
    businessName: data.businessName.trim(),
    address: data.address.trim(),
    phone: data.phone.trim(),
    email: data.email.trim(),
    primaryWhatsapp: data.primaryWhatsapp.trim(),
    secondaryWhatsapp: cleanOptional(data.secondaryWhatsapp),
    logoUrl: cleanOptional(data.logoUrl),
    faviconUrl: cleanOptional(data.faviconUrl),
    themeColor: data.themeColor,
    openingHours: data.openingHours,
  };
}
export function General() {
  const [data, setData] = useState(EMPTY_BUSINESS),
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
        body: JSON.stringify(buildGeneralPayload(data)),
      });
      setStatus("Guardado");
    } catch (error) {
      setStatus(
        error instanceof ApiError ? error.message : "No se pudo guardar",
      );
    }
  }
  return (
    <section className="admin-page general-settings">
      <PageHeader
        eyebrow="Configuración"
        title="Mi Bicla Querétaro"
        description="Administra la identidad y los datos de contacto visibles del negocio."
      />
      <form onSubmit={save}>
        <ResponsiveGrid className="settings-overview-grid">
          <Card className="settings-card">
            <div className="card-heading">
              <div>
                <p className="page-eyebrow">Negocio</p>
                <h2>Información general</h2>
              </div>
            </div>
            <div className="form-grid">
              {(
                [
                  ["businessName", "Nombre comercial"],
                  ["address", "Dirección"],
                  ["phone", "Teléfono"],
                  ["email", "Correo electrónico"],
                  ["primaryWhatsapp", "WhatsApp principal"],
                  ["secondaryWhatsapp", "WhatsApp secundario"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <Input
                    type={key === "email" ? "email" : "text"}
                    value={data[key]}
                    onChange={(event) =>
                      setData({ ...data, [key]: event.target.value })
                    }
                  />
                </label>
              ))}
            </div>
          </Card>
          <div className="settings-side-stack">
            <Card className="settings-card">
              <p className="page-eyebrow">Apariencia</p>
              <h2>Interfaz</h2>
              <ThemeSelector />
              <label>
                Color de marca
                <Input
                  type="color"
                  value={data.themeColor}
                  onChange={(event) =>
                    setData({ ...data, themeColor: event.target.value })
                  }
                />
              </label>
            </Card>
            <Card className="settings-card">
              <p className="page-eyebrow">Identidad</p>
              <h2>Recursos públicos</h2>
              <label>
                URL del logotipo
                <Input
                  type="url"
                  value={data.logoUrl}
                  onChange={(event) =>
                    setData({ ...data, logoUrl: event.target.value })
                  }
                />
              </label>
              <label>
                URL del favicon
                <Input
                  type="url"
                  value={data.faviconUrl}
                  onChange={(event) =>
                    setData({ ...data, faviconUrl: event.target.value })
                  }
                />
              </label>
            </Card>
          </div>
        </ResponsiveGrid>
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
