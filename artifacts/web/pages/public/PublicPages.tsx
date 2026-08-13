import { useEffect, useState } from "react";
import { Card, EmptyState } from "../../components/ui";
import { Container } from "../../components/primitives";
import { PublicShell, type PublicBusiness } from "../../components/public/PublicShell";
import { BrandCarousel } from "../../components/public/BrandCarousel";
import { apiFetch } from "../../lib/api-client";
import {
  AUTHORIZED_BRANDS,
  WORKSHOP_SERVICES,
  workshopServiceHref,
} from "../../lib/public-content";
import {
  businessContactVcard,
  configuredWhatsappUrl,
  MI_BICLA_CONTACT,
  MI_BICLA_MAPS_URL,
  openingHoursEntries,
  whatsappContactUrl,
} from "../../lib/public-links";
import {
  BrandLogo,
  BrandPageHero,
  BrandSectionHeading,
  ChainDivider,
  FeatureCard,
} from "../../components/brand";
import contactPhoto from "../../../../recursos/webp/car3.webp";
import { BicyclesIcon, DepositsIcon, EventsIcon, FidelityAssetIcon, ProductsIcon, TallerAssetIcon } from "../../components/nav-icons";

function useBusiness() {
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  useEffect(() => { apiFetch<PublicBusiness>("/api/public/business").then(setBusiness).catch(() => setBusiness(null)); }, []);
  return business;
}

const DialogButton = ({ kind, children }: { kind: "workshop" | "card"; children: string }) =>
  <a className="ui-button ui-button--secondary" href={kind === "workshop" ? "/mi/taller" : "/mi/tarjeta"}>{children}</a>;

function WhatsappIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.7a8 8 0 0 1-11.8 7L4 20l1.3-4.1A8 8 0 1 1 20 11.7Z" /><path d="M9 8.2c.2-.4.4-.4.7-.4h.3l.8 1.9c.1.2.1.4-.1.6l-.6.8c-.1.2 0 .4.1.6.7 1.2 1.6 2 2.8 2.6.3.1.5.1.7-.1l.8-1c.2-.2.4-.3.7-.2l1.8.9c.3.1.4.3.4.5 0 .4-.2 1.3-.8 1.8-.6.5-1.4.8-2.4.5-1.1-.3-2.5-.8-4.2-2.3-1.4-1.3-2.4-2.9-2.7-4-.3-1 .1-1.8.5-2.2.4-.4.8-.5 1.2-.5Z" /></svg>;
}

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.4 2.1L8 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.7.5 2.6.6a2 2 0 0 1 2 2.3Z" /></svg>;
}

function InstagramIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.7" r=".8" className="social-icon-fill" /></svg>;
}

function LocationIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.3 6-12a6 6 0 1 0-12 0c0 6.7 6 12 6 12Z" /><circle cx="12" cy="9" r="2.2" /></svg>;
}

function FacebookIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v6h4v-6h3l1-4h-4V9c0-.7.3-1 1-1Z" /></svg>;
}

function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

function SaveContactIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.5-4 2.3-6 5.5-6 1.8 0 3.2.6 4.1 1.8M18 12v7m-3.5-3.5h7" /></svg>;
}

function BusinessInfo({ business }: { business: PublicBusiness | null }) {
  const name = business?.businessName || MI_BICLA_CONTACT.name;
  const primaryWhatsapp = business?.primaryWhatsapp || MI_BICLA_CONTACT.primaryWhatsapp;
  const secondaryWhatsapp = business?.secondaryWhatsapp || MI_BICLA_CONTACT.secondaryWhatsapp;
  const email = business?.email || MI_BICLA_CONTACT.email;
  const address = business?.address || MI_BICLA_CONTACT.address;
  const facebook = business?.social?.facebook || MI_BICLA_CONTACT.facebook;
  const instagram = business?.social?.instagram || MI_BICLA_CONTACT.instagram;
  const configuredHours = openingHoursEntries(business?.openingHours);
  const openingHours = configuredHours.length ? configuredHours : [["Lunes a viernes", MI_BICLA_CONTACT.weekdayHours]];
  const saveContact = () => {
    const vcard = businessContactVcard({ name, primaryWhatsapp, secondaryWhatsapp, email, address, website: business?.social?.website });
    const url = URL.createObjectURL(new Blob([vcard], { type: "text/vcard;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mi-bicla.vcf";
    link.click();
    URL.revokeObjectURL(url);
  };
  return <section className="public-section public-business" id="contacto">
    <div className="public-contact-heading">
      <div><p className="page-eyebrow">Estamos para rodar contigo</p><h2><span>Mi Bicla <em>siempre</em></span><em>cerca.</em></h2></div>
      <p>Guarda nuestros datos o contáctanos por el medio que prefieras. Te ayudamos con tu bicicleta, accesorios y servicio.</p>
    </div>
    <div className="public-contact-layout" id="ubicacion">
      <article className="public-contact-panel">
        <div className="public-contact-brand"><BrandLogo variant="symbol" color="pink" decorative /><div><strong>{name}</strong><span>{MI_BICLA_CONTACT.description}</span></div></div>
        <div className="public-contact-socials" id="redes"><span>Síguenos <strong>{MI_BICLA_CONTACT.instagramHandle}</strong></span><div><a href={facebook} target="_blank" rel="noopener noreferrer" aria-label="Mi Bicla Querétaro en Facebook (abre en una pestaña nueva)"><FacebookIcon /></a><a href={instagram} target="_blank" rel="noopener noreferrer" aria-label="Visitar Instagram de Mi Bicla (abre en una pestaña nueva)"><InstagramIcon /></a></div></div>
        <div className="public-contact-list">
          <a href={whatsappContactUrl(primaryWhatsapp)} target="_blank" rel="noopener noreferrer" aria-label="Contactar al WhatsApp principal de Mi Bicla (abre en una pestaña nueva)"><i><WhatsappIcon /></i><span><small>WhatsApp principal</small><strong>{primaryWhatsapp}</strong></span><b aria-hidden="true">↗</b></a>
          <a href={whatsappContactUrl(secondaryWhatsapp)} target="_blank" rel="noopener noreferrer" aria-label="Contactar al WhatsApp alterno de Mi Bicla (abre en una pestaña nueva)"><i><WhatsappIcon /></i><span><small>WhatsApp alterno</small><strong>{secondaryWhatsapp}</strong></span><b aria-hidden="true">↗</b></a>
          <a href={`mailto:${email}`}><i><MailIcon /></i><span><small>Correo electrónico</small><strong>{email}</strong></span><b aria-hidden="true">↗</b></a>
          <a href={MI_BICLA_MAPS_URL} target="_blank" rel="noopener noreferrer" aria-label="Cómo llegar a la ubicación de Mi Bicla en Google Maps (abre en una pestaña nueva)"><i><LocationIcon /></i><span><small>Visítanos</small><strong>{address}</strong></span><b aria-hidden="true">↗</b></a>
          <div className="public-contact-hours" id="horarios"><i><ClockIcon /></i><span><small>Horario</small>{openingHours.map(([day, hours]) => <strong key={day}>{day}: {hours}</strong>)}</span></div>
        </div>
        <button className="ui-button public-save-contact" type="button" onClick={saveContact}><SaveContactIcon />Guardar contacto</button>
      </article>
      <div className="public-contact-visual"><img src={contactPhoto} alt="Ciclista Mi Bicla recorriendo una ruta de montaña" loading="lazy" /><div><span>Pasión que</span><strong>te mueve.</strong></div></div>
    </div>
  </section>;
}

export function Landing() {
  const business = useBusiness();
  const primaryWhatsapp = business?.primaryWhatsapp || MI_BICLA_CONTACT.primaryWhatsapp;
  return <PublicShell business={business}>
    <section className="public-hero">
      <div className="public-hero-copy"><p className="page-eyebrow">Taller · accesorios · comunidad</p><h1>Tu bicicleta.<br /><em>Tu aventura.</em></h1><p>Servicio, accesorios y pasión por el ciclismo en el corazón de La Cañada.</p><div className="public-actions"><a className="ui-button" href={whatsappContactUrl(primaryWhatsapp)} target="_blank" rel="noopener noreferrer"><WhatsappIcon />Hablar por WhatsApp</a><a className="ui-button ui-button--outline" href={`tel:${primaryWhatsapp.replace(/\s/g, "")}`}><PhoneIcon />Llamar ahora</a></div></div>
      <a className="public-scroll-cue" href="#contacto"><span>Conócenos</span><b aria-hidden="true">↓</b></a>
    </section>
    <Container>
    <section className="public-section brand-features">
      <BrandSectionHeading title="TODO PARA SEGUIR RODANDO" />
      <div className="home-brands" id="marcas">
        <p>Conoce algunas de las marcas que puedes encontrar o solicitar en Mi Bicla. La disponibilidad puede variar.</p>
        <BrandCarousel brands={AUTHORIZED_BRANDS} />
      </div>
      <div className="brand-feature-grid">
        <FeatureCard className="feature-workshop-photo" tone="photo" icon={<TallerAssetIcon />} title="TALLER MECÁNICO" description="Servicio preventivo, reparaciones y mantenimiento profesional." href="/taller" />
        <FeatureCard tone="pink" icon={<FidelityAssetIcon />} title="MI TARJETA" description="Acumula puntos, consigue beneficios y recompensas." href="/fidelidad" />
        <FeatureCard tone="black" icon={<BicyclesIcon />} title="MIS BICICLETAS" description="Registra, administra y da seguimiento a tus bicis." href="/mi/bicicletas" />
        <FeatureCard className="feature-events-photo" tone="photo" icon={<EventsIcon />} title="EVENTOS" description="Consulta próximas rodadas, fechas y puntos de encuentro." href="/eventos" />
        <FeatureCard className="feature-products-photo" tone="photo" icon={<ProductsIcon />} title="PRODUCTOS" description="Explora equipo, accesorios y productos para tu próxima ruta." href="/productos" />
        <FeatureCard className="feature-payments-photo" tone="photo" icon={<DepositsIcon />} title="MÉTODOS DE PAGO" description="Consulta las cuentas y opciones disponibles para realizar tu pago." href="/depositos" />
      </div>
    </section>
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
  return <PublicShell business={business}><Container><BrandPageHero className="loyalty-photo-hero" eyebrow="FIDELIDAD MI BICLA" title="CADA RODADA CUENTA" description="Acumula bicicletas con tus compras y obtén recompensas."><DialogButton kind="card">Mi tarjeta</DialogButton></BrandPageHero><section className="demo-wallet"><div><small>MIEMBRO MI BICLA</small><h2>Tu próxima recompensa</h2><p>Una experiencia demostrativa del programa.</p></div><img src="/pink-simple.png" alt="" /><div className="demo-points">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < 6 ? "earned" : ""}><img src="/pink-simple.png" alt="" /></i>)}</div></section><section className="public-section"><h2>¿Cómo funciona?</h2><div className="public-card-grid"><Card><span>01</span><h3>Compra y acumula</h3><p>Tus compras participantes suman bicicletas a tu tarjeta.</p></Card><Card><span>02</span><h3>Sigue tu progreso</h3><p>Inicia sesión y consulta tu tarjeta cuando quieras.</p></Card><Card><span>03</span><h3>Obtén recompensas</h3><p>Las condiciones dependen del programa vigente en tienda.</p></Card></div></section></Container></PublicShell>;
}

export function Brands() {
  const business = useBusiness();
  const whatsapp = configuredWhatsappUrl(business?.primaryWhatsapp);
  const action = whatsapp
    ? <a className="ui-button" href={whatsapp} target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a>
    : business?.address
      ? <a className="ui-button" href={MI_BICLA_MAPS_URL} target="_blank" rel="noopener noreferrer">Visitar tienda</a>
      : <a className="ui-button" href="/#ubicacion">Ver contacto y ubicación</a>;
  return <PublicShell business={business}><Container className="brands-page"><header className="public-page-hero"><p className="page-eyebrow">Selección Mi Bicla</p><h1>Marcas</h1></header><section className="public-section brands-empty"><EmptyState title="Consulta en tienda las marcas disponibles" description="Nuestro equipo puede ayudarte a encontrar equipo para tu próxima rodada." />{action}</section></Container></PublicShell>;
}
