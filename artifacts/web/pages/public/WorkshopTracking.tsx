import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api-client";
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
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<Tracking>(`/api/public/workshop/${encodeURIComponent(token)}`, {
      signal: controller.signal,
    })
      .then(setData)
      .catch(() => setData(null));
    return () => controller.abort();
  }, [token]);
  if (!data)
    return (
      <main>
        <meta name="robots" content="noindex,nofollow" />
        <h1>Seguimiento no disponible</h1>
      </main>
    );
  const progress = [...data.updates]
    .reverse()
    .find((x) => x.progressPercent != null)?.progressPercent;
  return (
    <main>
      <meta name="robots" content="noindex,nofollow" />
      <h1>Orden {data.orderNumber}</h1>
      <p>
        {data.bicycle.nickname ||
          [data.bicycle.brand, data.bicycle.model].filter(Boolean).join(" ")}
      </p>
      <h2>{data.publicStatus}</h2>
      {progress != null && (
        <progress max="100" value={progress}>
          {progress}%
        </progress>
      )}
      <p>{data.customerVisibleSummary}</p>
      {data.readyAt && <strong>Tu bicicleta está lista.</strong>}
      <h3>Avances</h3>
      {data.updates.map((x) => (
        <article key={x.id}>
          <strong>{x.title}</strong>
          <p>{x.message}</p>
        </article>
      ))}
      <h3>Servicios</h3>
      <ul>
        {data.visibleServices.map((x) => (
          <li key={x.id}>
            {x.serviceName} — {x.status}
          </li>
        ))}
      </ul>
      <h3>Piezas</h3>
      <ul>
        {data.visibleParts.map((x) => (
          <li key={x.id}>
            {x.partName} — {x.status}
          </li>
        ))}
      </ul>
      <h3>Historial</h3>
      <ul>
        {data.history.map((x) => (
          <li key={x.id}>
            {x.status} {x.publicMessage}
          </li>
        ))}
      </ul>
    </main>
  );
}
