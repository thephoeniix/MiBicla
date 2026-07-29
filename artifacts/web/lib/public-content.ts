export const WORKSHOP_SERVICES = [
  "Mantenimiento preventivo",
  "Servicio completo",
  "Reparaciones",
  "Suspensión",
  "Frenos y transmisión",
  "Tubeless",
  "Bike wash",
  "Diagnóstico",
  "Actualización de componentes",
  "Actualización de transmisión",
] as const;

export function workshopServiceHref(service: (typeof WORKSHOP_SERVICES)[number]): string {
  return `/taller/solicitud?servicio=${encodeURIComponent(service)}`;
}

export interface AuthorizedBrand {
  name: string;
  logoUrl: string;
  width: number;
  height: number;
}

// This list describes brands customers can find or request. It does not imply
// an official distributorship or commercial partnership.
export const AUTHORIZED_BRANDS: AuthorizedBrand[] = [
  { name: "SRAM", logoUrl: "/brands/sram.png", width: 1374, height: 177 },
  { name: "RockShox", logoUrl: "/brands/rockshox.png", width: 2180, height: 547 },
  { name: "Maxxis", logoUrl: "/brands/maxxis.svg", width: 454, height: 73 },
  { name: "Continental", logoUrl: "/brands/continental.jpg", width: 1280, height: 349 },
  { name: "Wahoo", logoUrl: "/brands/wahoo.png", width: 201, height: 50 },
  { name: "KMC", logoUrl: "/brands/kmc.png", width: 114, height: 65 },
  { name: "Crankbrothers", logoUrl: "/brands/crankbrothers.svg", width: 220, height: 30 },
  { name: "Muc-Off", logoUrl: "/brands/muc-off.png", width: 500, height: 182 },
  { name: "Lezyne", logoUrl: "/brands/lezyne.png", width: 1471, height: 273 },
  { name: "Jagwire", logoUrl: "/brands/jagwire.svg", width: 451, height: 34 },
  { name: "Stan’s", logoUrl: "/brands/stans.png", width: 2268, height: 850 },
  { name: "CushCore", logoUrl: "/brands/cushcore.png", width: 300, height: 300 },
  { name: "ROCKBROS", logoUrl: "/brands/rockbros.png", width: 350, height: 175 },
];

export function resolveRequestedWorkshopService(search: string): string {
  const selected = new URLSearchParams(search).get("servicio");
  return WORKSHOP_SERVICES.find((service) => service === selected) ?? "";
}
