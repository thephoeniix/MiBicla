import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api-client";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
  Stepper,
  statusLabel,
} from "../../components/ui";
import { Timeline } from "../../components/domain";
import "./workshop-tracking.css";

interface Tracking {
  orderNumber: string;
  bicycle: { nickname?: string; brand?: string; model?: string };
  publicStatus: string;
  customerVisibleSummary?: string;
  estimatedCompletionAt?: string;
  readyAt?: string;
  updates: Array<{
    id: string;
    title: string;
    message: string;
    progressPercent?: number;
    createdAt: string;
  }>;
  visibleServices: Array<{ id: string; serviceName: string; status: string }>;
  visibleParts: Array<{ id: string; partName: string; status: string }>;
  history: Array<{
    id: string;
    status: string;
    publicMessage?: string;
    createdAt: string;
  }>;
  updatedAt: string;
}

export function WorkshopTracking({ token }: { token: string }) {
  const [data, setData] = useState<Tracking | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  function load(signal?: AbortSignal) {
    setState("loading");
    apiFetch<Tracking>(`/api/public/workshop/${encodeURIComponent(token)}`, {
      signal,
    })
      .then((result) => {
        setData(result);
        setState("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
  }

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [token]);

  if (state === "loading")
    return (
      <main className="tracking-page tracking-state">
        <meta name="robots" content="noindex,nofollow" />
        <LoadingState label="Consultando tu orden…" />
      </main>
    );
  if (state === "error" || !data)
    return (
      <main className="tracking-page tracking-state">
        <meta name="robots" content="noindex,nofollow" />
        <ErrorState
          message="Verifica el enlace o inténtalo nuevamente."
          onRetry={() => load()}
        />
      </main>
    );

  const bicycleName =
    data.bicycle.nickname ||
    [data.bicycle.brand, data.bicycle.model].filter(Boolean).join(" ") ||
    "Tu bicicleta";

  return (
    <main className="tracking-page">
      <meta name="robots" content="noindex,nofollow" />
      <div className="tracking-shell">
        <header className="tracking-header">
          <a href="/" aria-label="Mi Bicla Querétaro">
            <img src="/pink-simple.png" alt="" />
            <span><strong>Mi Bicla</strong><small>Querétaro</small></span>
          </a>
          <span>Seguimiento</span>
        </header>

        <section className="tracking-hero">
          <p className="page-eyebrow">Orden {data.orderNumber}</p>
          <div>
            <h1>{bicycleName}</h1>
            <StatusBadge status={data.publicStatus} />
          </div>
          {data.customerVisibleSummary && <p>{data.customerVisibleSummary}</p>}
          {data.readyAt && (
            <strong className="tracking-ready">Tu bicicleta está lista para recoger.</strong>
          )}
        </section>

        <section className="tracking-card">
          <div className="tracking-section-heading">
            <div><p className="page-eyebrow">Estado actual</p><h2>{statusLabel(data.publicStatus)}</h2></div>
            <small>
              Actualizado {new Date(data.updatedAt).toLocaleString("es-MX", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </small>
          </div>
          <Stepper status={data.publicStatus} />
          {data.estimatedCompletionAt && (
            <div className="tracking-estimate">
              <span aria-hidden="true">⌁</span>
              <div><small>Fecha estimada</small><strong>{new Date(data.estimatedCompletionAt).toLocaleDateString("es-MX", { dateStyle: "long" })}</strong></div>
            </div>
          )}
        </section>

        <div className="tracking-grid">
          <section className="tracking-card">
            <div className="tracking-section-heading"><div><p className="page-eyebrow">Trabajo visible</p><h2>Servicios</h2></div><span>{data.visibleServices.length}</span></div>
            {data.visibleServices.length ? (
              <ul className="tracking-list">
                {data.visibleServices.map((service) => (
                  <li key={service.id}><span>{service.serviceName}</span><StatusBadge status={service.status} /></li>
                ))}
              </ul>
            ) : <EmptyState title="Sin servicios publicados" description="El taller actualizará esta sección cuando corresponda." />}
          </section>
          <section className="tracking-card">
            <div className="tracking-section-heading"><div><p className="page-eyebrow">Componentes</p><h2>Piezas</h2></div><span>{data.visibleParts.length}</span></div>
            {data.visibleParts.length ? (
              <ul className="tracking-list">
                {data.visibleParts.map((part) => (
                  <li key={part.id}><span>{part.partName}</span><StatusBadge status={part.status} /></li>
                ))}
              </ul>
            ) : <EmptyState title="Sin piezas publicadas" description="No hay piezas visibles para esta orden." />}
          </section>
        </div>

        <section className="tracking-card">
          <div className="tracking-section-heading"><div><p className="page-eyebrow">Bitácora</p><h2>Últimas actualizaciones</h2></div></div>
          {data.updates.length || data.history.length ? (
            <Timeline items={
              [...data.updates.map((update) => ({
                id: update.id,
                title: update.title,
                message: update.message,
                createdAt: update.createdAt,
              })), ...data.history.map((event) => ({
                id: event.id,
                title: statusLabel(event.status),
                message: event.publicMessage || "La orden cambió de estado.",
                createdAt: event.createdAt,
              }))]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            } />
          ) : <EmptyState title="Aún no hay actualizaciones" description="Los avances del taller aparecerán aquí." />}
        </section>

        <footer className="tracking-footer">
          <img src="/white-simple.png" alt="" />
          <p><strong>¿Tienes alguna duda?</strong><span>Comunícate directamente con Mi Bicla Querétaro.</span></p>
        </footer>
      </div>
    </main>
  );
}
