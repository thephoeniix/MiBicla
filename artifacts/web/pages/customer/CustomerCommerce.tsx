import {
  useEffect,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormDialog,
  Input,
  LoadingState,
  Select,
  StatusBadge,
  statusLabel,
  Textarea,
} from "../../components/ui";
import {
  createCustomerRequest,
  EVENT_CATEGORIES,
  formatMxn,
  discountedPriceCents,
  getCommerceWhatsapp,
  getCustomerRequests,
  getPublicEvents,
  getPublicProducts,
  SHIPPING_CARRIERS,
  whatsappMessageUrl,
  type CommerceEvent,
  type CommerceRequest,
  type Product,
} from "../../lib/commerce";
import type { CustomerIdentity } from "../../lib/customer-auth";
interface PortalShellProps {
  identity: CustomerIdentity | null;
  section:
    | "home"
    | "loyalty"
    | "bikes"
    | "workshop"
    | "profile"
    | "products"
    | "events"
    | "requests";
  title: string;
  description: string;
  children: ReactNode;
}

function CommerceNav() {
  return (
    <nav
      className="customer-commerce-nav"
      aria-label="Productos, eventos y solicitudes"
    >
      <a
        href="/mi/productos"
        aria-current={
          location.pathname === "/mi/productos" ? "page" : undefined
        }
      >
        Productos
      </a>
      <a
        href="/mi/eventos"
        aria-current={location.pathname === "/mi/eventos" ? "page" : undefined}
      >
        Eventos
      </a>
      <a
        href="/mi/solicitudes"
        aria-current={
          location.pathname === "/mi/solicitudes" ? "page" : undefined
        }
      >
        Solicitudes
      </a>
    </nav>
  );
}

function CustomerProductCard({
  product,
  onRequest,
}: {
  product: Product;
  onRequest: (product: Product) => void;
}) {
  const discounted = discountedPriceCents(product.priceCents, product.discountPercent);
  const hasDiscount = product.priceCents !== null && product.discountPercent > 0;
  return (
    <Card className="customer-commerce-card product-gear-card">
      <div className="product-gear-media">
        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <span className="product-gear-placeholder" aria-hidden="true">MI BICLA</span>}
        <b aria-hidden="true">EQUIPO / MB</b>
        {hasDiscount && <span className="product-discount-sticker">-{product.discountPercent}%</span>}
        <small>{statusLabel(product.availability)}</small>
      </div>
      <div className="product-gear-body">
        <header><div><p className="page-eyebrow">{product.category}</p><h2>{product.name}</h2></div><span className="commerce-price-block">{hasDiscount && <del>{formatMxn(product.priceCents)}</del>}<strong className="commerce-price">{formatMxn(discounted)}</strong></span></header>
        <p>{product.description}</p>
        {(product.sizes.length > 0 || product.colors.length > 0) && <dl className="commerce-variants">{product.sizes.length > 0 && <div><dt>Tallas</dt><dd>{product.sizes.join(", ")}</dd></div>}{product.colors.length > 0 && <div><dt>Colores</dt><dd>{product.colors.join(", ")}</dd></div>}</dl>}
        <footer><Button type="button" onClick={() => onRequest(product)}>Solicitar <span aria-hidden="true">→</span></Button></footer>
      </div>
    </Card>
  );
}

function CustomerEventCard({
  event,
  onRequest,
}: {
  event: CommerceEvent;
  onRequest: (productId?: string) => void;
}) {
  const starts = new Date(event.startsAt);
  const ends = event.endsAt ? new Date(event.endsAt) : null;
  return (
    <Card className="customer-event-card event-ticket">
      <div className="event-ticket-media">
        {event.imageUrl ? <img src={event.imageUrl} alt={event.title} /> : <span>MI BICLA</span>}
        <time className="event-ticket-date" dateTime={event.startsAt}><strong>{starts.getDate()}</strong><span>{starts.toLocaleDateString("es-MX", { month: "short" }).replace(".", "")}</span></time>
      </div>
      <div className="event-ticket-body">
        <p className="page-eyebrow">{event.category} · MI BICLA ASISTE</p>
        <h2>{event.title}</h2>
        <p>{event.description}</p>
        <dl className="event-details">
          <div><dt>Fecha</dt><dd><time dateTime={event.startsAt}>{starts.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</time></dd></div>
          <div><dt>Horario</dt><dd>{starts.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}{ends && ` a ${ends.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`}</dd></div>
          <div><dt>Lugar</dt><dd>{event.location}{event.mapUrl && <> · <a href={event.mapUrl} target="_blank" rel="noopener noreferrer">Ver en Google Maps</a></>}</dd></div>
        </dl>
        {event.products.length > 0 && <section className="event-ticket-products"><h3>Productos disponibles</h3><div>{event.products.map((product) => <button type="button" key={product.id} onClick={() => onRequest(product.id)}>{product.name}</button>)}</div></section>}
        <div className="commerce-event-actions event-ticket-stub">
          <Button onClick={() => onRequest()}>Pedir producto para este evento</Button>
          {event.infoUrl && <a className="ui-button ui-button--secondary" href={event.infoUrl} target="_blank" rel="noopener noreferrer">Más información</a>}
        </div>
      </div>
    </Card>
  );
}

function RequestEditor({
  products,
  events,
  initialProductId = "",
  initialEventId = "",
  onClose,
  onSaved,
}: {
  products: Product[];
  events: CommerceEvent[];
  initialProductId?: string;
  initialEventId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [source, setSource] = useState<"listed" | "custom">(
    initialProductId ? "listed" : "custom",
  );
  const [form, setForm] = useState({
    kind: "quote" as "quote" | "reservation",
    productId: initialProductId,
    eventId: initialEventId,
    customProductName: "",
    size: "",
    color: "",
    quantity: 1,
    comments: "",
    fulfillment: initialEventId
      ? ("event" as const)
      : ("store" as "store" | "event" | "shipping"),
    recipientName: "",
    shippingPhone: "",
    street: "",
    neighborhood: "",
    city: "",
    state: "",
    postalCode: "",
    shippingCarrier: "" as "" | (typeof SHIPPING_CARRIERS)[number],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = products.find((product) => product.id === form.productId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createCustomerRequest({
        ...form,
        productId: source === "listed" ? form.productId || null : null,
        customProductName:
          source === "custom" ? form.customProductName.trim() || null : null,
        eventId: form.eventId || null,
        size: form.size || null,
        color: form.color || null,
        comments: form.comments.trim() || null,
        recipientName:
          form.fulfillment === "shipping"
            ? form.recipientName.trim() || null
            : null,
        shippingPhone:
          form.fulfillment === "shipping"
            ? form.shippingPhone.trim() || null
            : null,
        street:
          form.fulfillment === "shipping" ? form.street.trim() || null : null,
        neighborhood:
          form.fulfillment === "shipping"
            ? form.neighborhood.trim() || null
            : null,
        city: form.fulfillment === "shipping" ? form.city.trim() || null : null,
        state:
          form.fulfillment === "shipping" ? form.state.trim() || null : null,
        postalCode:
          form.fulfillment === "shipping"
            ? form.postalCode.trim() || null
            : null,
        shippingCarrier:
          form.fulfillment === "shipping" ? form.shippingCarrier || null : null,
      });
      onSaved();
    } catch {
      setError("No fue posible enviar tu solicitud. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormDialog open aria-labelledby="commerce-request-title">
      <form className="commerce-dialog-form" onSubmit={submit}>
        <header className="form-dialog-header">
          <p className="page-eyebrow">SOLICITUD MI BICLA</p>
          <h2 id="commerce-request-title">Cotizar o reservar</h2>
        </header>
        <div className="form-dialog-body commerce-form-grid">
          <label>
            Tipo de solicitud
            <Select
              value={form.kind}
              onChange={(event) =>
                setForm({
                  ...form,
                  kind: event.target.value as typeof form.kind,
                })
              }
            >
              <option value="quote">Cotización</option>
              <option value="reservation">Reservación</option>
            </Select>
          </label>
          <fieldset>
            <legend>Producto</legend>
            <div className="commerce-choice">
              <label>
                <input
                  type="radio"
                  checked={source === "listed"}
                  onChange={() => setSource("listed")}
                />{" "}
                Del catálogo
              </label>
              <label>
                <input
                  type="radio"
                  checked={source === "custom"}
                  onChange={() => setSource("custom")}
                />{" "}
                No está en la lista
              </label>
            </div>
          </fieldset>
          {source === "listed" ? (
            <label>
              Producto
              <Select
                required
                value={form.productId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    productId: event.target.value,
                    size: "",
                    color: "",
                  })
                }
              >
                <option value="">Selecciona</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <label>
              Producto que buscas
              <Input
                required
                value={form.customProductName}
                onChange={(event) =>
                  setForm({ ...form, customProductName: event.target.value })
                }
                placeholder="Marca, modelo o descripción"
              />
            </label>
          )}
          <label>
            Evento opcional
            <Select
              value={form.eventId}
              onChange={(event) =>
                setForm({ ...form, eventId: event.target.value })
              }
            >
              <option value="">Sin evento</option>
              {events.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </Select>
          </label>
          <div className="commerce-form-row">
            <label>
              Talla
              {selected?.sizes.length ? (
                <Select
                  required
                  value={form.size}
                  onChange={(event) =>
                    setForm({ ...form, size: event.target.value })
                  }
                >
                  <option value="">Selecciona una talla</option>
                  {selected.sizes.map((size) => (
                    <option key={size}>{size}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={form.size}
                  onChange={(event) =>
                    setForm({ ...form, size: event.target.value })
                  }
                />
              )}
            </label>
            <label>
              Color
              {selected?.colors.length ? (
                <Select
                  required
                  value={form.color}
                  onChange={(event) =>
                    setForm({ ...form, color: event.target.value })
                  }
                >
                  <option value="">Selecciona un color</option>
                  {selected.colors.map((color) => (
                    <option key={color}>{color}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={form.color}
                  onChange={(event) =>
                    setForm({ ...form, color: event.target.value })
                  }
                />
              )}
            </label>
          </div>
          <div className="commerce-form-row">
            <label>
              Cantidad
              <Input
                type="number"
                min="1"
                max="99"
                required
                value={form.quantity}
                onChange={(event) =>
                  setForm({ ...form, quantity: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Entrega
              <Select
                value={form.fulfillment}
                onChange={(event) =>
                  setForm({
                    ...form,
                    fulfillment: event.target.value as typeof form.fulfillment,
                  })
                }
              >
                <option value="store">Recoger en tienda</option>
                <option value="event" disabled={!form.eventId}>
                  Recoger en evento
                </option>
                <option value="shipping">Envío por paquetería</option>
              </Select>
            </label>
          </div>
          {form.fulfillment === "shipping" && (
            <fieldset className="commerce-full-field commerce-shipping-fields">
              <legend>Datos de envío</legend>
              <p className="form-notice">
                El costo de envío lo paga el cliente de acuerdo con la
                paquetería seleccionada. No hay pago en línea.
              </p>
              <label>
                Nombre de quien recibe
                <Input
                  required
                  value={form.recipientName}
                  onChange={(event) =>
                    setForm({ ...form, recipientName: event.target.value })
                  }
                />
              </label>
              <label>
                Teléfono de envío
                <Input
                  required
                  type="tel"
                  value={form.shippingPhone}
                  onChange={(event) =>
                    setForm({ ...form, shippingPhone: event.target.value })
                  }
                />
              </label>
              <label>
                Calle y número
                <Input
                  required
                  value={form.street}
                  onChange={(event) =>
                    setForm({ ...form, street: event.target.value })
                  }
                />
              </label>
              <label>
                Colonia
                <Input
                  required
                  value={form.neighborhood}
                  onChange={(event) =>
                    setForm({ ...form, neighborhood: event.target.value })
                  }
                />
              </label>
              <label>
                Ciudad
                <Input
                  required
                  value={form.city}
                  onChange={(event) =>
                    setForm({ ...form, city: event.target.value })
                  }
                />
              </label>
              <label>
                Estado
                <Input
                  required
                  value={form.state}
                  onChange={(event) =>
                    setForm({ ...form, state: event.target.value })
                  }
                />
              </label>
              <label>
                Código postal
                <Input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                  maxLength={5}
                  value={form.postalCode}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      postalCode: event.target.value.replace(/\D/g, ""),
                    })
                  }
                />
              </label>
              <label>
                Paquetería
                <Select
                  required
                  value={form.shippingCarrier}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      shippingCarrier: event.target
                        .value as typeof form.shippingCarrier,
                    })
                  }
                >
                  <option value="">Selecciona</option>
                  {SHIPPING_CARRIERS.map((carrier) => (
                    <option key={carrier}>{carrier}</option>
                  ))}
                </Select>
              </label>
            </fieldset>
          )}
          <label>
            Comentarios
            <Textarea
              rows={4}
              value={form.comments}
              onChange={(event) =>
                setForm({ ...form, comments: event.target.value })
              }
              placeholder="Cuéntanos cualquier detalle importante"
            />
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
            {busy ? "Enviando…" : "Enviar solicitud"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

function RequestList({
  requests,
  whatsapp,
}: {
  requests: CommerceRequest[];
  whatsapp: string;
}) {
  return requests.length ? (
    <div className="customer-request-grid">
      {requests.map((request) => (
        <Card key={request.id} className="commerce-request-card">
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
          <dl>
            <div>
              <dt>Solicitud</dt>
              <dd>
                {request.kind === "reservation" ? "Reservación" : "Cotización"}
              </dd>
            </div>
            <div>
              <dt>Cantidad</dt>
              <dd>{request.quantity}</dd>
            </div>
            <div>
              <dt>Entrega</dt>
              <dd>
                {request.fulfillment === "event"
                  ? request.event?.title || request.eventTitle || "Evento"
                  : request.fulfillment === "shipping"
                    ? `Envío por ${request.shippingCarrier}`
                    : "Tienda"}
              </dd>
            </div>
            {request.quotedPriceCents !== null && (
              <div>
                <dt>Precio cotizado</dt>
                <dd>{formatMxn(request.quotedPriceCents)}</dd>
              </div>
            )}
          </dl>
          {request.adminMessage && (
            <p className="commerce-admin-message">
              <strong>Respuesta de Mi Bicla</strong>
              {request.adminMessage}
            </p>
          )}
          <a
            className="ui-button ui-button--secondary"
            href={whatsappMessageUrl(
              whatsapp,
              `Hola Mi Bicla, quiero consultar mi solicitud ${request.requestNumber}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contactar a Mi Bicla por WhatsApp
          </a>
          <small>
            Enviada {new Date(request.createdAt).toLocaleDateString("es-MX")}
          </small>
        </Card>
      ))}
    </div>
  ) : (
    <EmptyState
      title="Aún no tienes solicitudes"
      description="Pide una cotización o reserva un producto para comenzar."
    />
  );
}

export function CustomerCommerce({
  identity,
  page,
  Shell,
}: {
  identity: CustomerIdentity | null;
  page: "products" | "events" | "requests";
  Shell: ComponentType<PortalShellProps>;
}) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [events, setEvents] = useState<CommerceEvent[] | null>(null);
  const [requests, setRequests] = useState<CommerceRequest[] | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [eventCategory, setEventCategory] = useState("");
  const [error, setError] = useState(false);
  const query = new URLSearchParams(location.search);
  const [editor, setEditor] = useState<{
    productId?: string;
    eventId?: string;
  } | null>(
    page === "requests" && (query.get("productId") || query.get("eventId"))
      ? {
          productId: query.get("productId") ?? "",
          eventId: query.get("eventId") ?? "",
        }
      : null,
  );
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    Promise.all([
      getPublicProducts("", "", controller.signal),
      getPublicEvents(controller.signal),
      getCustomerRequests(controller.signal),
      getCommerceWhatsapp(),
    ])
      .then(([nextProducts, nextEvents, nextRequests, nextWhatsapp]) => {
        setProducts(nextProducts);
        setEvents(nextEvents);
        setRequests(nextRequests);
        setWhatsapp(nextWhatsapp);
      })
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError"))
          setError(true);
      });
    return () => controller.abort();
  }, [revision]);
  const heading =
    page === "products"
      ? ["Productos", "Encuentra equipo y solicita una cotización."]
      : page === "events"
        ? ["Eventos", "Pide productos para eventos donde estará Mi Bicla."]
        : ["Mis solicitudes", "Consulta cotizaciones y reservaciones."];
  return (
    <Shell
      identity={identity}
      section={page}
      title={heading[0]}
      description={heading[1]}
    >
      <CommerceNav />
      {error ? (
        <ErrorState
          message="No fue posible cargar productos y solicitudes."
          onRetry={() => setRevision((value) => value + 1)}
        />
      ) : !products || !events || !requests || !whatsapp ? (
        <LoadingState label="Preparando el catálogo…" />
      ) : (
        <>
          {page === "products" && (
            <div className="commerce-grid customer-commerce-grid">
              {products.map((product) => (
                <CustomerProductCard
                  key={product.id}
                  product={product}
                  onRequest={(item) => setEditor({ productId: item.id })}
                />
              ))}
            </div>
          )}
          {page === "events" && (
            <>
              <label className="commerce-event-filter">
                Categoría
                <Select
                  value={eventCategory}
                  onChange={(event) => setEventCategory(event.target.value)}
                >
                  <option value="">Todas</option>
                  {EVENT_CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </Select>
              </label>
              {events.filter(
                (event) => !eventCategory || event.category === eventCategory,
              ).length ? (
                <div className="customer-event-grid">
                  {events
                    .filter(
                      (event) =>
                        !eventCategory || event.category === eventCategory,
                    )
                    .map((event) => <CustomerEventCard key={event.id} event={event} onRequest={(productId) => setEditor({ eventId: event.id, productId })} />)}
                </div>
              ) : (
                <EmptyState
                  title="No hay eventos próximos"
                  description="Las nuevas fechas aparecerán aquí."
                />
              )}
            </>
          )}
          {page === "requests" && (
            <>
              <div className="customer-section-heading">
                <div>
                  <p className="page-eyebrow">COTIZACIONES Y RESERVAS</p>
                  <h2>Historial</h2>
                </div>
                <Button onClick={() => setEditor({})}>Nueva solicitud</Button>
              </div>
              <RequestList requests={requests} whatsapp={whatsapp} />
            </>
          )}
          {editor && (
            <RequestEditor
              products={products}
              events={events}
              initialProductId={editor.productId}
              initialEventId={editor.eventId}
              onClose={() => setEditor(null)}
              onSaved={() => {
                setEditor(null);
                history.replaceState(null, "", "/mi/solicitudes");
                setRevision((value) => value + 1);
              }}
            />
          )}
        </>
      )}
    </Shell>
  );
}
