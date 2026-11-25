import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api-client";
import { ErrorState, LoadingState, StatusBadge } from "../../components/ui";
import { PublicShell } from "../../components/public/PublicShell";
import { Container } from "../../components/primitives";
import { CustomerCard } from "./CustomerCard";
import { WorkshopTracking } from "./WorkshopTracking";
import { PasswordTokenForm } from "../customer/CustomerAuth";

type Resolution = { state: string; purpose: string; message?: string; data?: RequestSummary };
type RequestSummary = {
  requestNumber: string; status: string; customerName: string; customerPhone: string; customerEmail: string | null;
  bicycle: { brand: string | null; model: string | null; type: string | null; color: string | null };
  serviceName: string | null; problemDescription: string; requestedDate: string | null; requestedTime: string | null;
  createdAt: string; updatedAt: string; order: unknown;
};
const STATUS: Record<string, string> = { pending: "Recibida", reviewing: "En revisión", awaiting_contact: "Pendiente de contacto", confirmed: "Confirmada", reschedule_proposed: "Reprogramación propuesta", converted: "Convertida en orden", rejected: "Rechazada", cancelled: "Cancelada" };

export function PublicLink({ code }: { code: string }) {
  const endpoint = `/api/public/links/${encodeURIComponent(code)}`;
  const [result, setResult] = useState<Resolution | null>(null), [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); apiFetch<Resolution>(endpoint, { signal: controller.signal }).then(setResult).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Enlace no disponible."); }); return () => controller.abort(); }, [code]);
  if (error) return <PublicShell><Container><main className="tracking-state"><ErrorState message={error} /></main></Container></PublicShell>;
  if (!result) return <main className="tracking-state"><LoadingState label="Abriendo enlace seguro…" /></main>;
  if (result.purpose === "workshop_tracking") return <WorkshopTracking token={code} endpoint={endpoint} />;
  if (result.purpose === "customer_card") return <CustomerCard token={code} endpoint={endpoint} />;
  if (["customer_activation", "customer_verification", "password_recovery"].includes(result.purpose)) return <PasswordTokenForm purpose={result.purpose === "password_recovery" ? "recovery" : "activation"} linkCode={code} />;
  if (result.purpose === "workshop_request" && result.data) {
    const request = result.data;
    return <PublicShell><Container><main className="workshop-request-summary"><p className="page-eyebrow">SOLICITUD {request.requestNumber}</p><h1>{STATUS[request.status] ?? request.status}</h1><StatusBadge status={request.status} /><p>Última actualización: {new Date(request.updatedAt).toLocaleString("es-MX")}</p><dl><div><dt>Contacto</dt><dd>{request.customerName} · {request.customerPhone}{request.customerEmail ? ` · ${request.customerEmail}` : ""}</dd></div><div><dt>Bicicleta</dt><dd>{[request.bicycle.brand, request.bicycle.model, request.bicycle.type, request.bicycle.color].filter(Boolean).join(" · ")}</dd></div><div><dt>Servicio</dt><dd>{request.serviceName || "Diagnóstico"}</dd></div><div><dt>Problema</dt><dd>{request.problemDescription}</dd></div><div><dt>Recepción preferida</dt><dd>{request.requestedDate ? `${request.requestedDate} · ${request.requestedTime}` : "Por acordar"}</dd></div></dl>{request.order && <p>La solicitud ya se convirtió en orden. El seguimiento de la orden aparece asociado a este mismo acceso.</p>}</main></Container></PublicShell>;
  }
  return <PublicShell><Container><main className="tracking-state"><ErrorState message={result.message || "Enlace no disponible."} /></main></Container></PublicShell>;
}
