import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { apiFetch } from "../../lib/api-client";
import "./customer-card.css";

const MAX_VISIBLE_LOYALTY_ICONS = 10;

interface Card {
  name: string;
  balance: { availableUnits: number; updatedAt: string };
  rewards: Array<{
    id: string;
    rewardName: string;
    rewardDiscountPercent: string;
    requiredUnits: number;
    status: string;
  }>;
  loyaltyProgram: {
    enabled: boolean;
    rewardUnits: number;
    rewardName: string;
    rewardDescription: string;
  } | null;
  updatedAt: string;
}

type LoadState = "loading" | "ready" | "error";

function BrandMark() {
  return (
    <div className="loyalty-brand">
      <img src="/white-simple.png" alt="" />
      <div>
        <strong>Mi Bicla</strong>
        <span>Querétaro</span>
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12m0-12L8 7m4-4 4 4M5 11v8h14v-8" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 8h11v11H8zM5 16H4V5h11v1" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h16v10H4zm-1-4h18v4H3zm9 0v14M12 6H8.5a2 2 0 1 1 2-2c0 2 1.5 2 1.5 2Zm0 0h3.5a2 2 0 1 0-2-2c0 2-1.5 2-1.5 2Z" />
    </svg>
  );
}

function Confetti() {
  return (
    <div className="loyalty-confetti" aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => (
        <i key={index} />
      ))}
    </div>
  );
}

export function CustomerCard({ token }: { token: string }) {
  const [data, setData] = useState<Card | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [qr, setQr] = useState("");
  const [notice, setNotice] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const previousPoints = useRef<number | null>(null);

  const loadCard = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const next = await apiFetch<Card>(
          `/api/public/customer/${encodeURIComponent(token)}`,
          { signal },
        );
        const previous = previousPoints.current;
        const current = next.balance.availableUnits;

        if (previous !== null && current > previous) {
          setNotice("¡Ganaste un nuevo punto!");
          setCelebrate(true);
          window.setTimeout(() => setCelebrate(false), 1800);
        }

        previousPoints.current = current;
        setData(next);
        setLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (previousPoints.current === null) {
          setLoadState("error");
        } else {
          setNotice("No pudimos actualizar tus puntos");
        }
      }
    },
    [token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadCard(controller.signal);
    QRCode.toDataURL(window.location.href, {
      width: 360,
      margin: 1,
      color: { dark: "#0b0b0d", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setQr)
      .catch(() => setQr(""));

    const refresh = () => void loadCard();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [loadCard]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function shareCard() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Mi Bicla Querétaro",
          text: "Mi tarjeta de fidelidad Mi Bicla",
          url: window.location.href,
        });
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      setNotice("Enlace copiado");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice("No fue posible compartir la tarjeta");
    }
  }

  async function copyCard() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice("Enlace copiado");
    } catch {
      setNotice("No fue posible copiar el enlace");
    }
  }

  if (loadState === "loading") {
    return (
      <main className="loyalty-page loyalty-state" aria-busy="true">
        <img
          className="loyalty-state-logo loyalty-state-logo--pulse"
          src="/pink-simple.png"
          alt=""
        />
        <p>Cargando tu tarjeta…</p>
      </main>
    );
  }

  if (loadState === "error" || !data) {
    return (
      <main className="loyalty-page loyalty-state">
        <img className="loyalty-state-logo" src="/white-simple.png" alt="" />
        <h1>Tarjeta no disponible</h1>
        <p>No pudimos abrir tu tarjeta de Mi Bicla.</p>
        <button type="button" onClick={() => void loadCard()}>
          Intentar de nuevo
        </button>
      </main>
    );
  }

  const loyaltyProgram = data.loyaltyProgram;
  const goal = loyaltyProgram?.rewardUnits ?? null;
  const availablePoints = data.balance.availableUnits;
  const progressPoints =
    goal === null ? 0 : Math.min(Math.max(availablePoints, 0), goal);
  const remainingPoints =
    goal === null ? 0 : Math.max(goal - availablePoints, 0);
  const iconCount =
    goal === null ? 0 : Math.min(goal, MAX_VISIBLE_LOYALTY_ICONS);
  const earnedIconCount =
    goal === null || goal <= 0
      ? 0
      : Math.min(iconCount, Math.floor((progressPoints / goal) * iconCount));
  const activeReward = data.rewards[0];
  const rewardReady = Boolean(activeReward);
  const loyaltyEnabled = Boolean(loyaltyProgram?.enabled && goal);

  return (
    <main className="loyalty-page">
      <div className="loyalty-shell">
        <header className="loyalty-header">
          <BrandMark />
          <div className="loyalty-header-actions">
            <button
              className="loyalty-icon-button"
              type="button"
              aria-label="Compartir tarjeta"
              onClick={() => void shareCard()}
            >
              <ShareIcon />
            </button>
            <button
              className="loyalty-wallet-button"
              type="button"
              onClick={() => void copyCard()}
            >
              <CopyIcon />
              <span>Copiar enlace</span>
            </button>
          </div>
        </header>

        <section className="loyalty-member-card" aria-labelledby="member-name">
          <div>
            <p className="loyalty-eyebrow">Miembro Mi Bicla</p>
            <h1 id="member-name">{data.name}</h1>
            <p className="loyalty-member-status">
              <i aria-hidden="true" />
              Membresía activa
            </p>
          </div>
          <img src="/pink-simple.png" alt="" />
        </section>

        {loyaltyEnabled && goal !== null ? (
          <section
            className="loyalty-points-card"
            aria-labelledby="points-title"
          >
            <div className="loyalty-section-heading">
              <div>
                <p className="loyalty-eyebrow">Tus puntos</p>
                <h2 id="points-title">Cada rodada cuenta</h2>
              </div>
              <strong aria-label={`${availablePoints} de ${goal} puntos`}>
                {availablePoints} <span>/ {goal}</span>
              </strong>
            </div>

            <div className="loyalty-grid" aria-hidden="true">
              {Array.from({ length: iconCount }, (_, index) => {
                const unlocked = index < earnedIconCount;
                const newlyUnlocked =
                  celebrate && index === earnedIconCount - 1;
                return (
                  <div
                    className={[
                      "loyalty-point",
                      unlocked ? "is-unlocked" : "is-locked",
                      newlyUnlocked ? "is-new" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={index}
                    style={{ "--point-index": index }}
                  >
                    <img
                      src={
                        unlocked ? "/pink-simple.png" : "/black-simple.png"
                      }
                      alt=""
                    />
                    {newlyUnlocked && <Confetti />}
                  </div>
                );
              })}
            </div>
            {goal > MAX_VISIBLE_LOYALTY_ICONS && (
              <p className="loyalty-grid-note">
                Vista proporcional de {availablePoints} de {goal} puntos
              </p>
            )}
            <p className="loyalty-points-summary">
              {rewardReady
                ? "Tu recompensa está lista"
                : `${remainingPoints} ${remainingPoints === 1 ? "punto" : "puntos"} para tu próxima recompensa`}
            </p>
          </section>
        ) : (
          <section className="loyalty-points-card loyalty-program-unavailable">
            <img src="/white-simple.png" alt="" />
            <div>
              <p className="loyalty-eyebrow">Programa de fidelidad</p>
              <h2>No disponible por el momento</h2>
              <p>Tu código de cliente sigue activo.</p>
            </div>
          </section>
        )}

        <section className="loyalty-qr-section" aria-labelledby="qr-title">
          <div className="loyalty-section-heading loyalty-section-heading--qr">
            <div>
              <p className="loyalty-eyebrow">Identificación rápida</p>
              <h2 id="qr-title">Tu código Mi Bicla</h2>
            </div>
          </div>
          <div className="loyalty-qr-wrap">
            <div className="loyalty-qr">
              {qr ? (
                <img src={qr} alt="Código QR de la tarjeta de cliente" />
              ) : (
                <span role="status">Generando código…</span>
              )}
            </div>
            <p>Muestra este código al registrar tu compra</p>
          </div>
        </section>

        {loyaltyEnabled && goal !== null && (
          <section
            className={`loyalty-reward-card${rewardReady ? " is-ready" : ""}`}
            aria-labelledby="reward-title"
          >
            <div className="loyalty-gift">
              <GiftIcon />
            </div>
            <div className="loyalty-reward-copy">
              {activeReward ? (
                <>
                  <span aria-hidden="true">🎉</span>
                  <h2 id="reward-title">¡Felicidades!</h2>
                  <p>Ya puedes reclamar tu recompensa.</p>
                  <small>
                    {activeReward.rewardName} ·{" "}
                    {Number(activeReward.rewardDiscountPercent)}% de descuento
                  </small>
                </>
              ) : (
                <>
                  <p className="loyalty-eyebrow">Tu próxima recompensa</p>
                  <h2 id="reward-title">{remainingPoints} puntos más</h2>
                  <p>{loyaltyProgram.rewardName}</p>
                  {loyaltyProgram.rewardDescription && (
                    <small>{loyaltyProgram.rewardDescription}</small>
                  )}
                </>
              )}
              <div
                className="loyalty-progress"
                role="progressbar"
                aria-label="Puntos acumulados"
                aria-valuemin={0}
                aria-valuemax={goal}
                aria-valuenow={progressPoints}
              >
                <i style={{ width: `${(progressPoints / goal) * 100}%` }} />
              </div>
            </div>
          </section>
        )}

        <footer className="loyalty-footer">
          <span>
            Actualizado{" "}
            {new Date(data.updatedAt).toLocaleString("es-MX", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          <span>Mi Bicla Querétaro</span>
        </footer>
      </div>

      {notice && (
        <div className="loyalty-toast" role="status">
          <img src="/pink-simple.png" alt="" />
          {notice}
        </div>
      )}
    </main>
  );
}
