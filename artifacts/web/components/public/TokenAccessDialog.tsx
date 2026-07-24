import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "../ui";
import { extractPublicToken } from "../../lib/public-routes";

export function TokenAccessDialog({
  open,
  kind,
  onClose,
}: {
  open: boolean;
  kind: "workshop" | "card";
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [open]);
  if (!open) return null;
  const label = kind === "workshop" ? "Consultar mi orden" : "Abrir mi tarjeta";
  return (
    <Modal
      ref={dialogRef}
      className="public-dialog"
      aria-modal="true"
      aria-labelledby="token-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const token = extractPublicToken(value, kind);
          if (!token) {
            setError("Ingresa un enlace de Mi Bicla o un token público válido.");
            return;
          }
          window.location.assign(`${kind === "workshop" ? "/taller" : "/c"}/${encodeURIComponent(token)}`);
        }}
      >
        <header className="modal-header">
          <div>
            <p className="page-eyebrow">Acceso seguro</p>
            <h2 id="token-dialog-title">{label}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <p>
          {kind === "workshop"
            ? "Pega el enlace que recibiste del equipo de Mi Bicla o su token público."
            : "Pega tu enlace personal o token público. Si aún no lo tienes, solicítalo directamente en Mi Bicla."}
        </p>
        <label>
          Enlace o token
          <input
            className="ui-input"
            ref={inputRef}
            value={value}
            maxLength={500}
            autoComplete="off"
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{label}</Button>
        </div>
      </form>
    </Modal>
  );
}
