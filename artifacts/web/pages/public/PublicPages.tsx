import { useEffect, useState } from "react";
import { Card, EmptyState } from "../../components/ui";
import { Container } from "../../components/primitives";
import { openTokenDialog, PublicShell, type PublicBusiness } from "../../components/public/PublicShell";
import { BrandCarousel } from "../../components/public/BrandCarousel";
import { apiFetch } from "../../lib/api-client";
import {
  AUTHORIZED_BRANDS,
  WORKSHOP_SERVICES,
  workshopServiceHref,
} from "../../lib/public-content";
import {
  configuredWhatsappUrl,
  MI_BICLA_MAPS_URL,
  openingHoursEntries,
} from "../../lib/public-links";
import {
  BrandPageHero,
  BrandSectionHeading,
  ChainDivider,
  FeatureCard,
} from "../../components/brand";

function useBusiness() {
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  useEffect(() => { apiFetch<PublicBusiness>("/api/public/business").then(setBusiness).catch(() => setBusiness(null)); }, []);
  return business;
}

const DialogButton = ({ kind, children }: { kind: "workshop" | "card"; children: string }) =>
  <button className="ui-button ui-button--secondary" type="button" onClick={() => openTokenDialog(kind)}>{children}</button>;

function WhatsappIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.7a8 8 0 0 1-11.8 7L4 20l1.3-4.1A8 8 0 1 1 20 11.7Z" /><path d="M9 8.2c.2-.4.4-.4.7-.4h.3l.8 1.9c.1.2.1.4-.1.6l-.6.8c-.1.2 0 .4.1.6.7 1.2 1.6 2 2.8 2.6.3.1.5.1.7-.1l.8-1c.2-.2.4-.3.7-.2l1.8.9c.3.1.4.3.4.5 0 .4-.2 1.3-.8 1.8-.6.5-1.4.8-2.4.5-1.1-.3-2.5-.8-4.2-2.3-1.4-1.3-2.4-2.9-2.7-4-.3-1 .1-1.8.5-2.2.4-.4.8-.5 1.2-.5Z" /></svg>;
}

function InstagramIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.7" r=".8" className="social-icon-fill" /></svg>;
}

function LocationIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.3 6-12a6 6 0 1 0-12 0c0 6.7 6 12 6 12Z" /><circle cx="12" cy="9" r="2.2" /></svg>;
}

function BusinessInfo({ business }: { business: PublicBusiness | null }) {
  const whatsapp = configuredWhatsappUrl(business?.primaryWhatsapp);
  const instagram = business?.social?.instagram;
  const socials = [["Facebook", business?.social?.facebook], ["TikTok", business?.social?.tiktok], ["Sitio web", business?.social?.website]].filter((x): x is string[] => Boolean(x[1]));
  const openingHours = openingHoursEntries(business?.openingHours);
  return <section className="public-section public-business" id="ubicacion">
    <div><p className="page-eyebrow">Visítanos</p><h2>Horarios y ubicación</h2></div>
    <div className="public-business-grid">
      <Card><h3>Ubicación</h3>{business?.address && <p>{business.address}</p>}<div className="public-contact-actions"><a href={MI_BICLA_MAPS_URL} target="_blank" rel="noopener noreferrer" aria-label="Cómo llegar a la ubicación de Mi Bicla en Google Maps (abre en una pestaña nueva)"><LocationIcon /><span>Cómo llegar</span></a></div></Card>
      <Card id="horarios"><h3>Horarios</h3>{openingHours.length ? <dl>{openingHours.map(([day, hours]) => <div key={day}><dt>{day}</dt><dd>{hours}</dd></div>)}</dl> : <p>Horario no disponible.</p>}</Card>
      <Card id="redes" className="public-contact-card"><h3>Contacto</h3><div className="public-contact-actions">{whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Contactar a Mi Bicla por WhatsApp (abre en una pestaña nueva)"><WhatsappIcon /><span>WhatsApp</span></a>}{instagram && <a href={instagram} target="_blank" rel="noopener noreferrer" aria-label="Visitar Instagram de Mi Bicla (abre en una pestaña nueva)"><InstagramIcon /><span>Instagram</span></a>}</div></Card>
      {socials.length > 0 && <Card><h3>Más información</h3>{socials.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)}</Card>}
    </div>
  </section>;
}

export function Landing() {
  const business = useBusiness();
  return <PublicShell business={business}><Container>
    <section className="public-hero">
      <div className="public-hero-copy"><p className="page-eyebrow">QUERÉTARO · MTB · TALLER</p><h1>VIVE TU BICI</h1><p>Taller, comunidad y recompensas para seguir rodando.</p><div className="public-actions"><a className="ui-button" href="/taller/solicitud">Agendar taller</a><a className="ui-button ui-button--outline" href="/registro">Activar mi cuenta</a></div></div>
      <ChainDivider className="hero-chain" />
    </section>
    <section className="public-section brand-features">
      <BrandSectionHeading title="TODO PARA SEGUIR RODANDO" />
      <div className="home-brands" id="marcas">
        <p>Conoce algunas de las marcas que puedes encontrar o solicitar en Mi Bicla. La disponibilidad puede variar.</p>
        <BrandCarousel brands={AUTHORIZED_BRANDS} />
      </div>
      <div className="brand-feature-grid">
        <FeatureCard className="feature-workshop-photo" tone="photo" icon="⚒" title="TALLER MECÁNICO" description="Servicio preventivo, reparaciones y mantenimiento profesional." href="/taller" />
        <FeatureCard tone="pink" icon="☆" title="MI TARJETA" description="Acumula puntos, consigue beneficios y recompensas." href="/fidelidad" />
        <FeatureCard tone="black" icon="♧" title="MIS BICICLETAS" description="Registra, administra y da seguimiento a tus bicis." href="/mi/bicicletas" />
      </div>
    </section>
    <section className="quick-actions" aria-label="Acciones rápidas"><a href="/taller/solicitud">Agendar taller <i>↗</i></a><DialogButton kind="workshop">Consultar mi orden</DialogButton><DialogButton kind="card">Mi tarjeta</DialogButton><a href="/depositos">Ver depósitos <i>↗</i></a></section>
    <section className="public-section editorial" id="conocenos"><ChainDivider /><p className="page-eyebrow">COMUNIDAD MI BICLA</p><h2>MÁS QUE UNA TIENDA, SOMOS UNA COMUNIDAD SOBRE RUEDAS.</h2><p>Rodadas, competencias, eventos y taller: un punto de encuentro para la comunidad MTB de Querétaro.</p></section>
    <BusinessInfo business={business} />
  </Container></PublicShell>;
}

export function WorkshopInfo() {
  const business = useBusiness();
  return <PublicShell business={business}><Container><BrandPageHero className="workshop-photo-hero" eyebrow="TALLER MI BICLA" title="TU BICI MERECE LA MEJOR RUTA" description="Servicio profesional para mantenerla segura, precisa y lista para rodar."><div className="public-actions"><a className="ui-button" href="/taller/solicitud">Solicitar servicio</a><DialogButton kind="workshop">Consultar mi orden</DialogButton></div></BrandPageHero><section className="public-section"><BrandSectionHeading eyebrow="SERVICIO PROFESIONAL" title="TODO LO QUE TU BICI NECESITA" /><div className="service-grid">{WORKSHOP_SERVICES.map((service, i) => <a className="service-card" key={service} href={workshopServiceHref(service)} aria-label={`Solicitar servicio: ${service}`}><span>{String(i + 1).padStart(2, "0")}</span><h3>{service}</h3><small>Solicitar este servicio <span aria-hidden="true">→</span></small></a>)}</div><small>Selecciona un servicio para preparar tu solicitud. Podrás revisarla antes de enviarla.</small></section></Container></PublicShell>;
}

export function LoyaltyInfo() {
  const business = useBusiness();
  return <PublicShell business={business}><Container><header className="public-page-hero"><p className="page-eyebrow">Fidelidad Mi Bicla</p><h1>Cada rodada cuenta</h1><p>Acumula bicicletas con tus compras y obtén recompensas.</p><DialogButton kind="card">Mi tarjeta</DialogButton></header><section className="demo-wallet"><div><small>MIEMBRO MI BICLA</small><h2>Tu próxima recompensa</h2><p>Una experiencia demostrativa del programa.</p></div><img src="/pink-simple.png" alt="" /><div className="demo-points">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < 6 ? "earned" : ""}><img src="/pink-simple.png" alt="" /></i>)}</div></section><section className="public-section"><h2>¿Cómo funciona?</h2><div className="public-card-grid"><Card><span>01</span><h3>Compra y acumula</h3><p>Tus compras participantes suman bicicletas a tu tarjeta.</p></Card><Card><span>02</span><h3>Sigue tu progreso</h3><p>Consulta tu enlace personal cuando quieras.</p></Card><Card><span>03</span><h3>Obtén recompensas</h3><p>Las condiciones dependen del programa vigente en tienda.</p></Card></div></section></Container></PublicShell>;
}

export function Brands() {
  const business = useBusiness();
  const whatsapp = configuredWhatsappUrl(business?.primaryWhatsapp);
  const action = whatsapp
    ? <a className="ui-button" href={whatsapp} target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a>
    : business?.address
      ? <a className="ui-button" href={MI_BICLA_MAPS_URL} target="_blank" rel="noopener noreferrer">Visitar tienda</a>
      : null;
  return <PublicShell business={business}><Container className="brands-page"><header className="public-page-hero"><p className="page-eyebrow">Selección Mi Bicla</p><h1>Marcas</h1></header><section className="public-section brands-empty"><EmptyState title="Consulta en tienda las marcas disponibles" description="Nuestro equipo puede ayudarte a encontrar equipo para tu próxima rodada." />{action}</section></Container></PublicShell>;
}
