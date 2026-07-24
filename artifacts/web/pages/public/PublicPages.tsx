import { useEffect, useState } from "react";
import { Card, EmptyState } from "../../components/ui";
import { Container } from "../../components/primitives";
import { openTokenDialog, PublicShell, type PublicBusiness } from "../../components/public/PublicShell";
import { apiFetch } from "../../lib/api-client";
import { AUTHORIZED_BRANDS, WORKSHOP_SERVICES } from "../../lib/public-content";
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

function BusinessInfo({ business }: { business: PublicBusiness | null }) {
  const socials = [["Instagram", business?.instagram], ["Facebook", business?.facebook], ["TikTok", business?.tiktok], ["Sitio web", business?.website]].filter((x): x is string[] => Boolean(x[1]));
  return <section className="public-section public-business" id="ubicacion">
    <div><p className="page-eyebrow">Visítanos</p><h2>Horarios y ubicación</h2></div>
    <div className="public-business-grid">
      {business?.address && <Card><h3>Ubicación</h3><p>{business.address}</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`} target="_blank" rel="noreferrer">Cómo llegar</a></Card>}
      {business?.openingHours && Object.keys(business.openingHours).length > 0 && <Card id="horarios"><h3>Horarios</h3><dl>{Object.entries(business.openingHours).map(([day, hours]) => <div key={day}><dt>{day}</dt><dd>{hours}</dd></div>)}</dl></Card>}
      {(business?.phone || business?.primaryWhatsapp) && <Card><h3>Contacto</h3>{business.phone && <a href={`tel:${business.phone}`}>{business.phone}</a>}{business.primaryWhatsapp && <a href={`https://wa.me/${business.primaryWhatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}</Card>}
      {socials.length > 0 && <Card id="redes"><h3>Redes</h3>{socials.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer">{label}</a>)}</Card>}
    </div>
  </section>;
}

export function Landing() {
  const business = useBusiness();
  return <PublicShell business={business}><Container>
    <section className="public-hero">
      <div className="public-hero-copy"><p className="page-eyebrow">QUERÉTARO · MTB · TALLER</p><h1>VIVE TU BICI</h1><p>Taller, comunidad y recompensas para seguir rodando.</p><div className="public-actions"><a className="ui-button" href="/taller/solicitud">Agendar taller</a><a className="ui-button ui-button--outline" href="/registro">Crear mi cuenta</a></div></div>
      <div className="hero-status-card"><span aria-hidden="true">⚒</span><div><small>EJEMPLO · TU BICI ESTÁ</small><strong>LISTA</strong><p>Así puede verse tu seguimiento</p></div><i aria-hidden="true">✓</i></div>
      <ChainDivider className="hero-chain" />
    </section>
    <section className="public-section brand-features">
      <BrandSectionHeading title="TODO PARA SEGUIR RODANDO" />
      <div className="brand-feature-grid">
        <FeatureCard className="feature-workshop-photo" tone="photo" icon="⚒" title="TALLER MECÁNICO" description="Servicio preventivo, reparaciones y mantenimiento profesional." href="/taller" />
        <FeatureCard tone="pink" icon="☆" title="MI TARJETA" description="Acumula puntos, consigue beneficios y recompensas." href="/fidelidad" />
        <FeatureCard tone="black" icon="♧" title="MIS BICICLETAS" description="Registra, administra y da seguimiento a tus bicis." href="/mi/bicicletas" />
      </div>
    </section>
    <section className="quick-actions" aria-label="Acciones rápidas"><a href="/taller/solicitud">Agendar taller <i>↗</i></a><DialogButton kind="workshop">Consultar mi orden</DialogButton><DialogButton kind="card">Mi tarjeta</DialogButton><a href="/depositos">Ver depósitos <i>↗</i></a></section>
    <section className="public-section editorial" id="conocenos"><ChainDivider /><p className="page-eyebrow">COMUNIDAD MI BICLA</p><h2>MÁS QUE UNA TIENDA, SOMOS UNA COMUNIDAD SOBRE RUEDAS.</h2><p>Rodadas, competencias, eventos y taller: un punto de encuentro para la comunidad MTB de Querétaro.</p></section>
    {AUTHORIZED_BRANDS.length > 0 && <section className="public-section"><h2>Marcas</h2></section>}
    <BusinessInfo business={business} />
  </Container></PublicShell>;
}

export function WorkshopInfo() {
  const business = useBusiness();
  return <PublicShell business={business}><Container><BrandPageHero className="workshop-photo-hero" eyebrow="TALLER MI BICLA" title="TU BICI MERECE LA MEJOR RUTA" description="Servicio profesional para mantenerla segura, precisa y lista para rodar."><div className="public-actions"><a className="ui-button" href="/taller/solicitud">Solicitar servicio</a><DialogButton kind="workshop">Consultar mi orden</DialogButton></div></BrandPageHero><section className="public-section"><BrandSectionHeading eyebrow="SERVICIO PROFESIONAL" title="TODO LO QUE TU BICI NECESITA" /><div className="service-grid">{WORKSHOP_SERVICES.map((service, i) => <Card key={service}><span>0{i + 1}</span><h3>{service}</h3></Card>)}</div><small>Este contenido comercial podrá conectarse a un catálogo público en una fase posterior.</small></section></Container></PublicShell>;
}

export function LoyaltyInfo() {
  const business = useBusiness();
  return <PublicShell business={business}><Container><header className="public-page-hero"><p className="page-eyebrow">Fidelidad Mi Bicla</p><h1>Cada rodada cuenta</h1><p>Acumula bicicletas con tus compras y obtén recompensas.</p><DialogButton kind="card">Mi tarjeta</DialogButton></header><section className="demo-wallet"><div><small>MIEMBRO MI BICLA</small><h2>Tu próxima recompensa</h2><p>Una experiencia demostrativa del programa.</p></div><img src="/pink-simple.png" alt="" /><div className="demo-points">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < 6 ? "earned" : ""}><img src="/pink-simple.png" alt="" /></i>)}</div></section><section className="public-section"><h2>¿Cómo funciona?</h2><div className="public-card-grid"><Card><span>01</span><h3>Compra y acumula</h3><p>Tus compras participantes suman bicicletas a tu tarjeta.</p></Card><Card><span>02</span><h3>Sigue tu progreso</h3><p>Consulta tu enlace personal cuando quieras.</p></Card><Card><span>03</span><h3>Obtén recompensas</h3><p>Las condiciones dependen del programa vigente en tienda.</p></Card></div></section></Container></PublicShell>;
}

export function Brands() {
  const business = useBusiness();
  const action = business?.primaryWhatsapp
    ? <a className="ui-button" href={`https://wa.me/${business.primaryWhatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
    : business?.address
      ? <a className="ui-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`} target="_blank" rel="noreferrer">Visitar tienda</a>
      : null;
  return <PublicShell business={business}><Container className="brands-page"><header className="public-page-hero"><p className="page-eyebrow">Selección Mi Bicla</p><h1>Marcas</h1></header><section className="public-section brands-empty">{AUTHORIZED_BRANDS.length === 0 ? <><EmptyState title="Consulta en tienda las marcas disponibles" description="Nuestro equipo puede ayudarte a encontrar equipo para tu próxima rodada." />{action}</> : null}</section></Container></PublicShell>;
}
