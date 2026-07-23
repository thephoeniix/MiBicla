import type { ReactNode } from "react";
import { Button, Card, StatusBadge } from "./ui";

export function LoyaltyCard({
  current,
  goal,
  rewardName,
}: {
  current: number;
  goal: number;
  rewardName: string;
}) {
  const iconCount = Math.min(Math.max(goal, 0), 10);
  const earned =
    goal > 0 ? Math.floor((Math.max(current, 0) / goal) * iconCount) : 0;
  return (
    <div className="preview-pass">
      <header>
        <img src="/white-simple.png" alt="" />
        <span>Mi Bicla</span>
      </header>
      <div>
        <small>Cliente Mi Bicla</small>
        <strong>{current} / {goal}</strong>
      </div>
      <div className="preview-points" aria-hidden="true">
        {Array.from({ length: iconCount }, (_, index) => (
          <img
            key={index}
            src={index < earned ? "/pink-simple.png" : "/black-simple.png"}
            alt=""
          />
        ))}
      </div>
      <footer>{rewardName || "Tu recompensa"}</footer>
    </div>
  );
}

export function WorkshopOrderCard({
  folio,
  title,
  status,
  action,
  actionLabel = "Abrir orden",
}: {
  folio: string;
  title: string;
  status: string;
  action: () => void;
  actionLabel?: string;
}) {
  return (
    <Card className="workshop-order-card">
      <button
        type="button"
        className="order-open"
        onClick={action}
        aria-label={`${actionLabel}: ${folio}`}
      >
        <span>
          <small>{folio}</small>
          <strong>{title}</strong>
        </span>
        <StatusBadge status={status} />
        <i aria-hidden="true">›</i>
      </button>
    </Card>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <dialog open className="ui-drawer" aria-labelledby="drawer-title">
      <section>
        <header className="modal-header">
          <h2 id="drawer-title">{title}</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>
        {children}
        <Button type="button" onClick={onClose}>Ver resultados</Button>
      </section>
    </dialog>
  );
}

export function Timeline({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string;
  }>;
}) {
  return (
    <ol className="tracking-timeline">
      {items.map((item) => (
        <li key={item.id}>
          <i aria-hidden="true" />
          <div>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
            <small>
              {new Date(item.createdAt).toLocaleString("es-MX", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}
