export const WORKSHOP_SERVICES = [
  "Mantenimiento preventivo",
  "Servicio completo",
  "Reparaciones",
  "Suspensión",
  "Frenos y transmisión",
  "Tubeless",
  "Bike wash",
] as const;

export interface AuthorizedBrand {
  name: string;
  logoUrl?: string;
  website?: string;
}

// Add only authorized commercial relationships here. A public catalog can
// replace this configuration when a dedicated endpoint exists.
export const AUTHORIZED_BRANDS: AuthorizedBrand[] = [];

