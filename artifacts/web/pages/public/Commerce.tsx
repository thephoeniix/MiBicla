import { useEffect, useState, type FormEvent } from "react";
import { PublicShell } from "../../components/public/PublicShell";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
  statusLabel,
} from "../../components/ui";
import {
  formatMxn,
  discountedPriceCents,
  EVENT_CATEGORIES,
  getPublicEvents,
  getPublicProducts,
  type CommerceEvent,
  type Product,
} from "../../lib/commerce";

function ProductCard({
  product,
  eventId,
}: {
  product: Product;
  eventId?: string;
}) {
  const request = new URLSearchParams({ productId: product.id });
  if (eventId) request.set("eventId", eventId);
  const discounted = discountedPriceCents(product.priceCents, product.discountPercent);
  const hasDiscount = product.priceCents !== null && product.discountPercent > 0;
  return (
    <article className="commerce-card product-gear-card">
      <div className="commerce-card-media product-gear-media">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" />
        ) : (
          <span className="product-gear-placeholder" aria-hidden="true">MI BICLA</span>
        )}
        <b aria-hidden="true">EQUIPO / MB</b>
        {hasDiscount && <span className="product-discount-sticker">-{product.discountPercent}%</span>}
        <small>{statusLabel(product.availability)}</small>
      </div>
      <div className="commerce-card-body product-gear-body">
        <header><div><p className="page-eyebrow">{product.category}</p><h2>{product.name}</h2></div><span className="commerce-price-block">{hasDiscount && <del>{formatMxn(product.priceCents)}</del>}<strong className="commerce-price">{formatMxn(discounted)}</strong></span></header>
        <p>{product.description}</p>
        {(product.sizes.length > 0 || product.colors.length > 0) && (
          <dl className="commerce-variants">
            {product.sizes.length > 0 && (
              <div>
                <dt>Tallas</dt>
                <dd>{product.sizes.join(", ")}</dd>
              </div>
            )}
            {product.colors.length > 0 && (
              <div>
                <dt>Colores</dt>
                <dd>{product.colors.join(", ")}</dd>
              </div>
            )}
          </dl>
        )}
        <footer><a className="ui-button ui-button--primary" href={`/iniciar-sesion?next=${encodeURIComponent(`/mi/solicitudes?${request}`)}`}>Solicitar o reservar <span aria-hidden="true">→</span></a></footer>
      </div>
    </article>
  );
}

export function PublicProducts() {
  const initial = new URLSearchParams(location.search);
  const [search, setSearch] = useState(initial.get("search") ?? "");
  const [category, setCategory] = useState(initial.get("category") ?? "");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getPublicProducts(search, category, controller.signal)
      .then(setProducts)
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError"))
          setError("No fue posible consultar los productos.");
      });
    return () => controller.abort();
  }, [search, category, revision]);
  const categories = [
    ...new Set((products ?? []).map((product) => product.category)),
  ].sort();
  function submit(event: FormEvent) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (category) query.set("category", category);
    history.replaceState(
      null,
      "",
      `${location.pathname}${query.size ? `?${query}` : ""}`,
    );
    setRevision((value) => value + 1);
  }
  return (
    <PublicShell>
      <section className="commerce-page public-commerce-page">
        <header className="commerce-hero">
          <p className="page-eyebrow">EQUIPO PARA RODAR</p>
          <h1>Productos Mi Bicla</h1>
          <p>
            Explora piezas, accesorios y equipo. Inicia sesión para pedir una
            cotización o reservar.
          </p>
        </header>
        <form className="commerce-filters" onSubmit={submit} role="search">
          <label>
            Buscar
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre o descripción"
            />
          </label>
          <label>
            Categoría
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Todas</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </label>
          <Button>Aplicar filtros</Button>
        </form>
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => setRevision((value) => value + 1)}
          />
        ) : products === null ? (
          <LoadingState label="Consultando productos…" />
        ) : products.length ? (
          <div className="commerce-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No encontramos productos"
            description="Prueba con otro término o categoría."
          />
        )}
      </section>
    </PublicShell>
  );
}

function EventCard({ event }: { event: CommerceEvent }) {
  const starts = new Date(event.startsAt);
  const ends = event.endsAt ? new Date(event.endsAt) : null;
  return (
    <article className="commerce-event-card event-ticket">
      <div className="event-ticket-media">
        {event.imageUrl ? <img src={event.imageUrl} alt={event.title} loading="lazy" /> : <span>MI BICLA</span>}
        <time className="event-ticket-date" dateTime={event.startsAt}><strong>{starts.getDate()}</strong><span>{starts.toLocaleDateString("es-MX", { month: "short" }).replace(".", "")}</span></time>
      </div>
      <div className="event-ticket-body">
        <p className="page-eyebrow">{event.category} · MI BICLA ASISTE</p>
        <h2>{event.title}</h2>
        <p>{event.description}</p>
        <dl className="event-details">
          <div>
            <dt>Fecha</dt>
            <dd>
              <time dateTime={event.startsAt}>
                {starts.toLocaleDateString("es-MX", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </time>
            </dd>
          </div>
          <div>
            <dt>Horario</dt>
            <dd>
              {starts.toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {ends &&
                ` a ${ends.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`}
            </dd>
          </div>
          <div>
            <dt>Lugar</dt>
            <dd>
              {event.location}
              {event.mapUrl && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={event.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver en Google Maps
                  </a>
                </>
              )}
            </dd>
          </div>
        </dl>
        {event.products.length > 0 && (
          <section className="event-ticket-products">
            <h3>Productos disponibles</h3>
            <div>
              {event.products.map((product) => (
                <a key={product.id} href={`/iniciar-sesion?next=${encodeURIComponent(`/mi/solicitudes?eventId=${event.id}&productId=${product.id}`)}`}>{product.name}</a>
              ))}
            </div>
          </section>
        )}
        <div className="commerce-event-actions event-ticket-stub">
          <a
            className="ui-button ui-button--primary"
            href={`/iniciar-sesion?next=${encodeURIComponent(`/mi/solicitudes?eventId=${event.id}`)}`}
          >
            Pedir producto para este evento
          </a>
          {event.infoUrl && (
            <a
              className="ui-button ui-button--secondary"
              href={event.infoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Más información
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function PublicEvents() {
  const initial = new URLSearchParams(location.search);
  const [category, setCategory] = useState(initial.get("category") ?? "");
  const [events, setEvents] = useState<CommerceEvent[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getPublicEvents(controller.signal, category)
      .then(setEvents)
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError"))
          setError("No fue posible consultar los eventos.");
      });
    return () => controller.abort();
  }, [category, revision]);
  return (
    <PublicShell>
      <section className="commerce-page public-commerce-page">
        <header className="commerce-hero">
          <p className="page-eyebrow">COMUNIDAD SOBRE RUEDAS</p>
          <h1>Eventos y rodadas</h1>
          <p>
            Conoce los eventos donde Mi Bicla estará presente y pide productos
            para recibirlos ahí.
          </p>
        </header>
        <label className="commerce-event-filter">
          Categoría
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Todas</option>
            {EVENT_CATEGORIES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </label>
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => setRevision((value) => value + 1)}
          />
        ) : events === null ? (
          <LoadingState label="Consultando eventos…" />
        ) : events.length ? (
          <div className="event-list">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No hay eventos publicados"
            description="Vuelve pronto para conocer las próximas rodadas."
          />
        )}
      </section>
    </PublicShell>
  );
}
