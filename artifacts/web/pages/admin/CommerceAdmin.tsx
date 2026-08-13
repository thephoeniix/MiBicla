import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormDialog,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
  statusLabel,
  Textarea,
} from "../../components/ui";
import { apiFetch, ApiError } from "../../lib/api-client";
import {
  formatMxn,
  discountedPriceCents,
  googleMapsSearchUrl,
  getAdminEvents,
  getAdminProducts,
  getAdminRequests,
  mxnToCents,
  EVENT_CATEGORIES,
  PRODUCT_CATEGORIES,
  PRODUCT_COLORS,
  saveAdminEvent,
  saveAdminProduct,
  setAdminEventProducts,
  uploadAdminImage,
  updateAdminRequest,
  whatsappMessageUrl,
  type CommerceEvent,
  type CommerceRequest,
  type EventPayload,
  type Product,
  type ProductPayload,
} from "../../lib/commerce";

function useAdminList<T>(loader: (signal: AbortSignal) => Promise<T[]>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    loader(controller.signal)
      .then(setItems)
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError"))
          setError(
            caught instanceof ApiError
              ? caught.message
              : "No fue posible cargar la información.",
          );
      });
    return () => controller.abort();
  }, [revision]);
  return { items, error, reload: () => setRevision((value) => value + 1) };
}

const splitValues = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const datetimeLocal = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  const part = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
};

function AdminImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange((await uploadAdminImage(file)).url);
    } catch {
      setError(
        "No fue posible subir la imagen. Usa JPG, PNG o WebP de máximo 8 MB.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="commerce-image-field">
      <label>
        Subir foto
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </label>
      {busy && <small>Subiendo imagen…</small>}
      {value && (
        <div>
          <img src={value} alt="Vista previa" />
          <button type="button" onClick={() => onChange("")}>
            Quitar
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    category: product?.category ?? PRODUCT_CATEGORIES[0],
    imageUrl: product?.imageUrl ?? "",
    price:
      product?.priceCents === null || product?.priceCents === undefined
        ? ""
        : String(product.priceCents / 100),
    discountPercent: String(product?.discountPercent ?? 0),
    sizes: product?.sizes.join(", ") ?? "",
    colors: product?.colors ?? [],
    availability: product?.availability ?? "available",
    isPublished: product?.isPublished ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const discountPercent = Number(form.discountPercent || 0);
    if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      setError("El descuento debe ser un porcentaje entero entre 0 y 100.");
      setBusy(false);
      return;
    }
    const payload: ProductPayload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      imageUrl: form.imageUrl.trim() || null,
      priceCents: mxnToCents(form.price),
      discountPercent: form.price ? discountPercent : 0,
      sizes: splitValues(form.sizes),
      colors: form.colors,
      availability: form.availability,
      isPublished: form.isPublished,
    };
    try {
      await saveAdminProduct(payload, product?.id);
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No fue posible guardar el producto.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormDialog open aria-labelledby="admin-product-title">
      <form className="commerce-dialog-form" onSubmit={submit}>
        <header className="form-dialog-header">
          <p className="page-eyebrow">CATÁLOGO</p>
          <h2 id="admin-product-title">
            {product ? "Editar producto" : "Nuevo producto"}
          </h2>
        </header>
        <div className="form-dialog-body commerce-form-grid">
          <label>
            Nombre
            <Input
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>
          <label>
            Categoría
            <Select
              required
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
            >
              {product &&
                !(PRODUCT_CATEGORIES as readonly string[]).includes(
                  product.category,
                ) && <option>{product.category}</option>}
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </Select>
          </label>
          <label className="commerce-full-field">
            Descripción
            <Textarea
              required
              rows={4}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </label>
          <div className="commerce-full-field">
            <AdminImageField
              value={form.imageUrl}
              onChange={(imageUrl) => setForm({ ...form, imageUrl })}
            />
          </div>
          <label>
            Precio en MXN
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: event.target.value })
              }
              placeholder="Vacío para cotizar"
            />
          </label>
          <label>
            Disponibilidad
            <Select
              value={form.availability}
              onChange={(event) =>
                setForm({ ...form, availability: event.target.value })
              }
            >
              <option value="available">Disponible</option>
              <option value="on_request">Sobre pedido</option>
              <option value="unavailable">No disponible</option>
            </Select>
          </label>
          <label>
            Descuento <small>(porcentaje)</small>
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={form.discountPercent}
              disabled={!form.price}
              onChange={(event) => setForm({ ...form, discountPercent: event.target.value })}
              placeholder="0"
            />
            <small>{form.price ? "Usa 0 para mostrar el precio normal." : "Agrega un precio para activar el descuento."}</small>
          </label>
          <label>
            Tallas <small>(separadas por coma)</small>
            <Input
              value={form.sizes}
              onChange={(event) =>
                setForm({ ...form, sizes: event.target.value })
              }
            />
          </label>
          <fieldset className="commerce-full-field">
            <legend>Colores disponibles</legend>
            <div className="commerce-product-checks">
              {PRODUCT_COLORS.map((color) => (
                <label key={color}>
                  <input
                    type="checkbox"
                    checked={form.colors.includes(color)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        colors: event.target.checked
                          ? [...form.colors, color]
                          : form.colors.filter((item) => item !== color),
                      })
                    }
                  />
                  {color}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="commerce-check">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(event) =>
                setForm({ ...form, isPublished: event.target.checked })
              }
            />{" "}
            Publicado
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="form-dialog-actions">
          <Button
            type="button"
            data-dialog-close
            variant="ghost"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button disabled={busy}>
            {busy ? "Guardando…" : "Guardar producto"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

export function AdminProducts({ permissions }: { permissions: string[] }) {
  const list = useAdminList(getAdminProducts);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const canManage = permissions.includes("manage_products");
  return (
    <section className="admin-page commerce-admin-page">
      <PageHeader
        eyebrow="Comercio"
        title="Productos"
        description="Publica el catálogo que clientes y visitantes pueden consultar."
        action={
          canManage ? (
            <Button onClick={() => setEditing("new")}>Nuevo producto</Button>
          ) : undefined
        }
      />
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.items ? (
        <LoadingState label="Consultando productos…" />
      ) : list.items.length ? (
        <div className="admin-commerce-grid">
          {list.items.map((product) => (
            <Card key={product.id} className="admin-commerce-card">
              {product.imageUrl && <img src={product.imageUrl} alt="" />}
              <div>
                <header>
                  <p className="page-eyebrow">{product.category}</p>
                  <StatusBadge
                    status={product.isPublished ? "published" : "draft"}
                  />
                </header>
                <h2>{product.name}</h2>
                <strong>{formatMxn(discountedPriceCents(product.priceCents, product.discountPercent))}</strong>
                {product.discountPercent > 0 && product.priceCents !== null && <small>{product.discountPercent}% de descuento · antes {formatMxn(product.priceCents)}</small>}
                <p>{product.description}</p>
                <small>{statusLabel(product.availability)}</small>
                {canManage && (
                  <Button
                    variant="secondary"
                    onClick={() => setEditing(product)}
                  >
                    Editar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Sin productos"
          description="Crea el primer producto del catálogo."
        />
      )}
      {editing && (
        <ProductEditor
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      )}
    </section>
  );
}

function EventEditor({
  event,
  products,
  onClose,
  onSaved,
}: {
  event: CommerceEvent | null;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialStart = datetimeLocal(event?.startsAt ?? "");
  const initialEnd = datetimeLocal(event?.endsAt ?? "");
  const [form, setForm] = useState({
    title: event?.title ?? "",
    category: event?.category ?? EVENT_CATEGORIES[0],
    description: event?.description ?? "",
    location: event?.location ?? "",
    mapUrl: event?.mapUrl ?? "",
    startDate: initialStart.slice(0, 10),
    startTime: initialStart.slice(11, 16),
    endDate: initialEnd.slice(0, 10),
    endTime: initialEnd.slice(11, 16),
    imageUrl: event?.imageUrl ?? "",
    infoUrl: event?.infoUrl ?? "",
    isPublished: event?.isPublished ?? false,
    productIds: event?.products.map((product) => product.id) ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(submitEvent: FormEvent) {
    submitEvent.preventDefault();
    setBusy(true);
    setError("");
    if (!form.title.trim() || !form.location.trim()) {
      setError("Escribe el título y la ubicación del evento.");
      setBusy(false);
      return;
    }
    if (!form.startDate || !form.startTime) {
      setError("Selecciona la fecha y la hora de inicio.");
      setBusy(false);
      return;
    }
    if ((form.endDate && !form.endTime) || (!form.endDate && form.endTime)) {
      setError("Para indicar el término, completa fecha y hora.");
      setBusy(false);
      return;
    }
    if (form.imageUrl.trim()) {
      try {
        const image = new URL(form.imageUrl.trim());
        if (!["http:", "https:"].includes(image.protocol))
          throw new Error("invalid");
      } catch {
        setError(
          "La imagen debe ser un enlace completo que comience con http:// o https://.",
        );
        setBusy(false);
        return;
      }
    }
    if (form.infoUrl.trim()) {
      try {
        const info = new URL(form.infoUrl.trim());
        if (!["http:", "https:"].includes(info.protocol))
          throw new Error("invalid");
      } catch {
        setError(
          "El enlace de más información debe comenzar con http:// o https://.",
        );
        setBusy(false);
        return;
      }
    }
    if (form.mapUrl.trim()) {
      try {
        const map = new URL(form.mapUrl.trim());
        if (!["http:", "https:"].includes(map.protocol))
          throw new Error("invalid");
      } catch {
        setError(
          "El enlace de Google Maps debe comenzar con http:// o https://.",
        );
        setBusy(false);
        return;
      }
    }
    const startsAt = new Date(`${form.startDate}T${form.startTime}`);
    const endsAt =
      form.endDate && form.endTime
        ? new Date(`${form.endDate}T${form.endTime}`)
        : null;
    if (endsAt && endsAt <= startsAt) {
      setError("La fecha de término debe ser posterior al inicio.");
      setBusy(false);
      return;
    }
    const payload: EventPayload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim(),
      category: form.category,
      mapUrl: form.mapUrl.trim() || null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt?.toISOString() ?? null,
      imageUrl: form.imageUrl.trim() || null,
      infoUrl: form.infoUrl.trim() || null,
      isPublished: form.isPublished,
    };
    try {
      const saved = await saveAdminEvent(payload, event?.id);
      await setAdminEventProducts(saved.id, form.productIds);
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No fue posible guardar el evento.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormDialog open aria-labelledby="admin-event-title">
      <form className="commerce-dialog-form" noValidate onSubmit={submit}>
        <header className="form-dialog-header">
          <p className="page-eyebrow">EVENTOS</p>
          <h2 id="admin-event-title">
            {event ? "Editar evento" : "Nuevo evento"}
          </h2>
        </header>
        <div className="form-dialog-body commerce-form-grid">
          <label>
            Título
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Categoría
            <Select
              value={form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value as typeof form.category,
                })
              }
            >
              {EVENT_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </Select>
          </label>
          <label>
            Ubicación
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </label>
          <div className="commerce-map-helper commerce-full-field">
            <a
              className="ui-button ui-button--secondary"
              href={googleMapsSearchUrl(form.location)}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!form.location.trim()}
            >
              Buscar ubicación en Google Maps
            </a>
            <small>
              Verifica el estado y el lugar, luego pega el enlace correcto.
            </small>
          </div>
          <label className="commerce-full-field">
            Enlace de Google Maps <small>(opcional)</small>
            <Input
              type="url"
              value={form.mapUrl}
              onChange={(e) => setForm({ ...form, mapUrl: e.target.value })}
              placeholder="https://maps.google.com/..."
            />
          </label>
          <fieldset className="commerce-date-time">
            <legend>Inicia</legend>
            <label>
              Fecha
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
              />
            </label>
            <label>
              Hora
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
              />
            </label>
          </fieldset>
          <fieldset className="commerce-date-time">
            <legend>
              Termina <small>(opcional)</small>
            </legend>
            <label>
              Fecha
              <Input
                type="date"
                min={form.startDate}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </label>
            <label>
              Hora
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </label>
          </fieldset>
          <label className="commerce-full-field">
            Descripción
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <div className="commerce-full-field">
            <AdminImageField
              value={form.imageUrl}
              onChange={(imageUrl) => setForm({ ...form, imageUrl })}
            />
          </div>
          <label className="commerce-full-field">
            Instagram, Facebook o web del evento <small>(opcional)</small>
            <Input
              type="url"
              value={form.infoUrl}
              onChange={(e) => setForm({ ...form, infoUrl: e.target.value })}
              placeholder="https://instagram.com/..."
            />
          </label>
          <fieldset className="commerce-full-field">
            <legend>Productos asociados</legend>
            <div className="commerce-product-checks">
              {products.map((product) => (
                <label key={product.id}>
                  <input
                    type="checkbox"
                    checked={form.productIds.includes(product.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        productIds: e.target.checked
                          ? [...form.productIds, product.id]
                          : form.productIds.filter((id) => id !== product.id),
                      })
                    }
                  />{" "}
                  {product.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="commerce-check">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) =>
                setForm({ ...form, isPublished: e.target.checked })
              }
            />{" "}
            Publicado
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="form-dialog-actions">
          <Button
            type="button"
            data-dialog-close
            variant="ghost"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button disabled={busy}>
            {busy ? "Guardando…" : "Guardar evento"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

export function AdminEvents({ permissions }: { permissions: string[] }) {
  const events = useAdminList(getAdminEvents);
  const products = useAdminList(getAdminProducts);
  const [editing, setEditing] = useState<CommerceEvent | "new" | null>(null);
  const canManage = permissions.includes("manage_events");
  return (
    <section className="admin-page commerce-admin-page">
      <PageHeader
        eyebrow="Comunidad"
        title="Eventos"
        description="Administra fechas y productos disponibles en cada evento."
        action={
          canManage ? (
            <Button onClick={() => setEditing("new")}>Nuevo evento</Button>
          ) : undefined
        }
      />
      {events.error ? (
        <ErrorState message={events.error} onRetry={events.reload} />
      ) : !events.items || !products.items ? (
        <LoadingState label="Consultando eventos…" />
      ) : events.items.length ? (
        <div className="admin-commerce-grid">
          {events.items.map((event) => (
            <Card key={event.id} className="admin-event-card">
              <header>
                <div>
                  <p className="page-eyebrow">
                    {event.category} ·{" "}
                    {new Date(event.startsAt).toLocaleDateString("es-MX")}
                  </p>
                  <h2>{event.title}</h2>
                </div>
                <StatusBadge
                  status={event.isPublished ? "published" : "draft"}
                />
              </header>
              <p>{event.location}</p>
              {event.mapUrl && (
                <a
                  href={event.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir mapa
                </a>
              )}
              <p>{event.description}</p>
              <small>{event.products.length} productos asociados</small>
              {canManage && (
                <Button variant="secondary" onClick={() => setEditing(event)}>
                  Editar
                </Button>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Sin eventos"
          description="Crea el primer evento o rodada."
        />
      )}
      {editing && products.items && (
        <EventEditor
          event={editing === "new" ? null : editing}
          products={products.items}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            events.reload();
          }}
        />
      )}
    </section>
  );
}

function RequestResponse({
  request,
  onClose,
  onSaved,
}: {
  request: CommerceRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    status: request.status,
    price:
      request.quotedPriceCents === null
        ? ""
        : String(request.quotedPriceCents / 100),
    adminMessage: request.adminMessage ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateAdminRequest(request.id, {
        status: form.status,
        quotedPriceCents: mxnToCents(form.price),
        adminMessage: form.adminMessage.trim() || null,
      });
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No fue posible responder.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormDialog open aria-labelledby="request-response-title">
      <form className="commerce-dialog-form" onSubmit={submit}>
        <header className="form-dialog-header">
          <p className="page-eyebrow">{request.requestNumber}</p>
          <h2 id="request-response-title">Responder solicitud</h2>
        </header>
        <div className="form-dialog-body commerce-form-grid">
          <label>
            Estado y disponibilidad
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="submitted">Recibida</option>
              <option value="reviewing">En revisión</option>
              <option value="quoted">Cotizada</option>
              <option value="confirmed">Confirmada / disponible</option>
              <option value="unavailable">No disponible</option>
              <option value="ready">Lista para recoger</option>
              <option value="completed">Entregada</option>
              <option value="cancelled">Cancelada</option>
            </Select>
          </label>
          <label>
            Precio en MXN
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </label>
          <label className="commerce-full-field">
            Mensaje para el cliente
            <Textarea
              required
              rows={5}
              value={form.adminMessage}
              onChange={(e) =>
                setForm({ ...form, adminMessage: e.target.value })
              }
            />
          </label>
          {request.customerPhone && (
            <a
              className="ui-button ui-button--secondary commerce-full-field"
              href={whatsappMessageUrl(
                `https://wa.me/${request.customerPhone.replace(/\D/g, "")}`,
                `Hola, te contactamos de Mi Bicla sobre tu solicitud ${request.requestNumber}. ${form.adminMessage}`.trim(),
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              Responder al cliente por WhatsApp
            </a>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="form-dialog-actions">
          <Button
            type="button"
            data-dialog-close
            variant="ghost"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button disabled={busy}>
            {busy ? "Enviando…" : "Guardar respuesta"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

export function AdminRequests({ permissions }: { permissions: string[] }) {
  const list = useAdminList(getAdminRequests);
  const [selected, setSelected] = useState<CommerceRequest | null>(null);
  const canManage = permissions.includes("manage_catalog_requests");
  return (
    <section className="admin-page commerce-admin-page">
      <PageHeader
        eyebrow="Atención al cliente"
        title="Solicitudes y cotizaciones"
        description="Responde disponibilidad, precio y próximos pasos."
      />
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.items ? (
        <LoadingState label="Consultando solicitudes…" />
      ) : list.items.length ? (
        <div className="admin-request-list">
          {list.items.map((request) => (
            <Card key={request.id} className="admin-request-card">
              <header>
                <div>
                  <p className="page-eyebrow">{request.requestNumber}</p>
                  <h2>
                    {request.product?.name ||
                      request.productName ||
                      request.customProductName ||
                      "Producto"}
                  </h2>
                </div>
                <StatusBadge status={request.status} />
              </header>
              {request.customerName && <strong>{request.customerName}</strong>}
              {request.customerPhone && (
                <a href={`tel:${request.customerPhone}`}>
                  {request.customerPhone}
                </a>
              )}
              <p>
                {request.kind === "reservation" ? "Reservación" : "Cotización"}{" "}
                · {request.quantity} pieza(s) ·{" "}
                {request.fulfillment === "event"
                  ? request.event?.title || request.eventTitle || "Evento"
                  : request.fulfillment === "shipping"
                    ? "Envío"
                    : "Tienda"}
              </p>
              {request.fulfillment === "shipping" && (
                <dl className="commerce-shipping-details">
                  <div>
                    <dt>Destinatario</dt>
                    <dd>{request.recipientName}</dd>
                  </div>
                  <div>
                    <dt>Teléfono de envío</dt>
                    <dd>{request.shippingPhone}</dd>
                  </div>
                  <div>
                    <dt>Domicilio</dt>
                    <dd>
                      {request.street}, {request.neighborhood}, {request.city},{" "}
                      {request.state}, C.P. {request.postalCode}
                    </dd>
                  </div>
                  <div>
                    <dt>Paquetería</dt>
                    <dd>{request.shippingCarrier}</dd>
                  </div>
                </dl>
              )}
              {request.comments && <blockquote>{request.comments}</blockquote>}
              <small>
                {new Date(request.createdAt).toLocaleString("es-MX")}
              </small>
              {canManage && (
                <Button onClick={() => setSelected(request)}>Responder</Button>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Sin solicitudes"
          description="Las nuevas solicitudes de clientes aparecerán aquí."
        />
      )}
      {selected && (
        <RequestResponse
          request={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            list.reload();
          }}
        />
      )}
    </section>
  );
}

interface DashboardData {
  counts?: {
    workshopPending: number;
    workshopUpdateNeeds: number;
    catalogRequests: number;
    upcomingEvents: number;
  };
  upcomingEvents?: CommerceEvent[];
  recentLoyaltyMovements?: Array<{
    id: string;
    customerFirstName: string;
    customerLastName: string;
    units: number;
    reason: string;
    createdAt: string;
  }>;
  workshopUpdateNeeds?: Array<{
    id: string;
    orderNumber: string;
    status: string;
    updatedAt: string;
  }>;
}
export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<DashboardData>("/api/admin/dashboard", {
      signal: controller.signal,
    })
      .then(setData)
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError"))
          setError(
            caught instanceof ApiError
              ? caught.message
              : "No fue posible cargar el dashboard.",
          );
      });
    return () => controller.abort();
  }, []);
  if (error)
    return (
      <section className="admin-page">
        <PageHeader title="Inicio" />
        <ErrorState message={error} />
      </section>
    );
  if (!data) return <LoadingState label="Preparando pendientes…" />;
  const counts = data.counts ?? {
    workshopPending: 0,
    workshopUpdateNeeds: 0,
    catalogRequests: 0,
    upcomingEvents: 0,
  };
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return (
    <section className="admin-page commerce-dashboard">
      <PageHeader
        eyebrow="Hoy"
        title="Inicio"
        description="Sólo lo que requiere atención del equipo."
      />
      <div className="dashboard-actions">
        {counts.workshopPending > 0 && (
          <a href="/admin/workshop">
            <span>{counts.workshopPending}</span>
            <div>
              <strong>Solicitudes de taller</strong>
              <small>Revisar solicitudes pendientes</small>
            </div>
          </a>
        )}
        {counts.workshopUpdateNeeds > 0 && (
          <a href="/admin/workshop">
            <span>{counts.workshopUpdateNeeds}</span>
            <div>
              <strong>Órdenes sin actualización</strong>
              <small>Informar avances al cliente</small>
            </div>
          </a>
        )}
        {counts.catalogRequests > 0 && (
          <a href="/admin/requests">
            <span>{counts.catalogRequests}</span>
            <div>
              <strong>Solicitudes por responder</strong>
              <small>Revisar cotizaciones y reservaciones</small>
            </div>
          </a>
        )}
        {counts.upcomingEvents > 0 && (
          <a href="/admin/events">
            <span>{counts.upcomingEvents}</span>
            <div>
              <strong>Eventos próximos</strong>
              <small>Confirmar fechas y productos</small>
            </div>
          </a>
        )}
        {total === 0 && (
          <EmptyState
            title="Todo al día"
            description="No hay acciones pendientes."
          />
        )}
      </div>
      <div className="dashboard-detail-grid">
        {Boolean(data.workshopUpdateNeeds?.length) && (
          <section>
            <header>
              <p className="page-eyebrow">SEGUIMIENTO</p>
              <h2>Alertas de órdenes</h2>
            </header>
            <div className="dashboard-compact-list">
              {data.workshopUpdateNeeds!.map((order) => (
                <a href="/admin/workshop" key={order.id}>
                  <div>
                    <strong>{order.orderNumber}</strong>
                    <small>{statusLabel(order.status)}</small>
                  </div>
                  <span>Actualizar →</span>
                </a>
              ))}
            </div>
          </section>
        )}
        {Boolean(data.upcomingEvents?.length) && (
          <section>
            <header>
              <p className="page-eyebrow">AGENDA</p>
              <h2>Próximos eventos</h2>
            </header>
            <div className="dashboard-compact-list">
              {data.upcomingEvents!.map((event) => (
                <a href="/admin/events" key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <small>
                      {new Date(event.startsAt).toLocaleString("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                  </div>
                  <span>Revisar →</span>
                </a>
              ))}
            </div>
          </section>
        )}
        {Boolean(data.recentLoyaltyMovements?.length) && (
          <section>
            <header>
              <p className="page-eyebrow">LOYALTY</p>
              <h2>Movimientos recientes</h2>
            </header>
            <div className="dashboard-compact-list">
              {data.recentLoyaltyMovements!.map((movement) => (
                <a href="/admin/loyalty" key={movement.id}>
                  <div>
                    <strong>
                      {movement.customerFirstName} {movement.customerLastName}
                    </strong>
                    <small>{movement.reason}</small>
                  </div>
                  <span className={movement.units >= 0 ? "is-positive" : ""}>
                    {movement.units >= 0 ? "+" : ""}
                    {movement.units}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
