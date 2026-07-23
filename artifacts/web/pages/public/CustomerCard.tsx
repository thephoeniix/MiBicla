import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { apiFetch } from "../../lib/api-client";
interface Card {
  name: string;
  balance: { availableUnits: number; updatedAt: string };
  rewards: Array<{
    id: string;
    rewardName: string;
    rewardDiscountPercent: string;
    status: string;
  }>;
  updatedAt: string;
}
export function CustomerCard({ token }: { token: string }) {
  const [data, setData] = useState<Card | null>(null),
    [qr, setQr] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<Card>(`/api/public/customer/${encodeURIComponent(token)}`, {
      signal: controller.signal,
    })
      .then(setData)
      .catch(() => setData(null));
    QRCode.toDataURL(location.href, { width: 220 }).then(setQr);
    return () => controller.abort();
  }, [token]);
  if (!data)
    return (
      <main>
        <h1>Tarjeta no disponible</h1>
      </main>
    );
  return (
    <main>
      <h1>{data.name}</h1>
      {qr && <img src={qr} alt="Código QR de la tarjeta de cliente" />}
      <p>
        <strong>{data.balance.availableUnits}</strong> unidades disponibles
      </p>
      <h2>Recompensas</h2>
      {data.rewards.length ? (
        data.rewards.map((r) => (
          <article key={r.id}>
            <strong>{r.rewardName}</strong>
            <p>{r.rewardDiscountPercent}% de descuento</p>
          </article>
        ))
      ) : (
        <p>Sin recompensas disponibles.</p>
      )}
      <small>
        Actualizado: {new Date(data.updatedAt).toLocaleString("es-MX")}
      </small>
    </main>
  );
}
