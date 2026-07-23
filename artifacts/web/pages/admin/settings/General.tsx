import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../lib/api-client";
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
    <form onSubmit={save}>
      <h2>General</h2>
      {(
        [
          "businessName",
          "address",
          "phone",
          "email",
          "primaryWhatsapp",
          "secondaryWhatsapp",
          "logoUrl",
          "faviconUrl",
        ] as const
      ).map((k) => (
        <label key={k}>
          {k}
          <input
            value={data[k]}
            onChange={(e) => setData({ ...data, [k]: e.target.value })}
          />
        </label>
      ))}
      <label>
        Color
        <input
          type="color"
          value={data.themeColor}
          onChange={(e) => setData({ ...data, themeColor: e.target.value })}
        />
      </label>
      <button>Guardar</button>
      <output>{status}</output>
    </form>
  );
}
