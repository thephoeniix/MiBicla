/* global Buffer, process */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const candidates = [
  path.join(root, "recursos", "catalogo-uniformes.html"),
  path.join(root, "catalogo-mibicla.html"),
];
let sourcePath;
for (const candidate of candidates) {
  try {
    await readFile(candidate);
    sourcePath = candidate;
    break;
  } catch {
    // Prueba la siguiente ubicación conocida del artifact.
  }
}
if (!sourcePath)
  throw new Error("Falta recursos/catalogo-uniformes.html (o catalogo-mibicla.html como respaldo local).");

const outputRoot = path.join(root, "artifacts", "web", "public", "uniformes");
const imageRoot = path.join(outputRoot, "img");
await rm(outputRoot, { recursive: true, force: true });
await mkdir(imageRoot, { recursive: true });

let html = await readFile(sourcePath, "utf8");
const imageByHash = new Map();
const dimensionsByUrl = new Map();

function slug(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 58);
}

function dimensions(filePath) {
  const [width, height] = execFileSync("identify", ["-format", "%w %h", filePath], { encoding: "utf8" })
    .trim().split(" ").map(Number);
  return { width, height };
}

const embeddedPattern = /<img\b[^>]*\bsrc="(data:image\/([^;]+);base64,([^"]+))"[^>]*>/g;
let imageIndex = 0;
const embeddedTags = [...html.matchAll(embeddedPattern)];
for (const match of embeddedTags) {
  const [tag, dataUrl, extension, encoded] = match;
  const bytes = Buffer.from(encoded, "base64");
  const hash = createHash("sha256").update(bytes).digest("hex");
  let image = imageByHash.get(hash);
  if (!image) {
    imageIndex += 1;
    const key = tag.match(/data-k="([^"]+)"/)?.[1];
    const alt = tag.match(/alt="([^"]*)"/)?.[1];
    const label = key === "plogo" ? "logo-mi-bicla" : slug(alt || key || `catalogo-${imageIndex}`);
    const filename = `${String(imageIndex).padStart(2, "0")}-${label || `catalogo-${imageIndex}`}.webp`;
    const temporary = path.join(imageRoot, `${hash}.${extension === "jpeg" ? "jpg" : extension}`);
    const destination = path.join(imageRoot, filename);
    await writeFile(temporary, bytes);
    execFileSync("convert", [temporary, "-auto-orient", "-resize", "1600x>", "-quality", "80", destination]);
    await unlink(temporary);
    image = { url: `/uniformes/img/${filename}`, ...dimensions(destination) };
    imageByHash.set(hash, image);
    dimensionsByUrl.set(image.url, image);
  }
  html = html.replace(dataUrl, image.url);
}

const sitePhotos = [
  ["13.webp", "jersey-comunidad-mi-bicla.webp"],
  ["ASN03155.webp", "jersey-competencia-mtb-queretaro.webp"],
  ["gio1.webp", "jersey-ruta-montana-mi-bicla.webp"],
];
for (const [source, filename] of sitePhotos) {
  const destination = path.join(imageRoot, filename);
  await copyFile(path.join(root, "recursos", "webp", source), destination);
  const url = `/uniformes/img/${filename}`;
  dimensionsByUrl.set(url, { url, ...dimensions(destination) });
}

const description = "Hacemos jerseys y uniformes de ciclismo personalizados para equipos y clubes. Desde 12 piezas, diseño opcional. Cotiza por WhatsApp 442 749 6410.";
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BicycleStore",
      "@id": "https://mibiclaqro.com/#negocio",
      name: "Mi Bicla Querétaro",
      slogan: "Rodamos contigo, desde el primer pedalazo.",
      description: "Tienda de ciclismo y taller de bicicletas en La Cañada, El Marqués, Querétaro. Bicicletas KRBO, refacciones, nutrición deportiva y uniformes de ciclismo personalizados.",
      url: "https://mibiclaqro.com/",
      logo: "https://mibiclaqro.com/pink-simple.png",
      image: "https://mibiclaqro.com/og-mi-bicla-queretaro.jpg",
      telephone: "+52 442 749 6410",
      priceRange: "$$",
      address: { "@type": "PostalAddress", addressLocality: "La Cañada, El Marqués", addressRegion: "Querétaro", addressCountry: "MX" },
      areaServed: ["Querétaro", "El Marqués", "Corregidora"],
      sameAs: ["https://www.instagram.com/mibiclaqro/"],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Productos y servicios Mi Bicla",
        itemListElement: [
          { "@type": "Offer", itemOffered: { "@type": "Service", name: "Taller y mantenimiento de bicicletas" } },
          { "@type": "Offer", itemOffered: { "@type": "Service", name: "Jerseys y uniformes de ciclismo personalizados", url: "https://mibiclaqro.com/uniformes" } },
          { "@type": "Offer", itemOffered: { "@type": "Product", name: "Bicicletas KRBO" } },
          { "@type": "Offer", itemOffered: { "@type": "Product", name: "Geles GU, SIS y Ruts" } },
        ],
      },
    },
    {
      "@type": "Service",
      "@id": "https://mibiclaqro.com/uniformes#servicio",
      name: "Jerseys y uniformes de ciclismo personalizados",
      serviceType: "Diseño y fabricación de uniformes de ciclismo personalizados",
      provider: { "@id": "https://mibiclaqro.com/#negocio" },
      areaServed: { "@type": "State", name: "Querétaro" },
      url: "https://mibiclaqro.com/uniformes",
      description,
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        ["¿Y si no tengo diseño?", "Nosotros lo hacemos con los colores y logos de tu equipo. El diseño de tu playera tiene un costo extra de $700."],
        ["¿Cuánto tarda en estar listo?", "Depende de la cantidad y del producto. Te confirmamos la fecha de entrega al cotizar, antes de que pagues."],
        ["¿Cómo sé qué talla pedir?", "Revisa la guía de tallas. Si te gusta holgado, elige una talla más; si te gusta ajustado, una menos. Si tienes duda, pregúntanos por WhatsApp."],
        ["¿Cuánto cuesta poner el nombre en el jersey?", "$50 por pieza en jerseys de enduro y ciclismo, y $132 en la línea Pro-Biker."],
        ["¿Las tallas grandes cuestan más?", "En jerseys de enduro y ciclismo, las tallas 2XL y 3XL tienen un costo extra de $25 por pieza."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    },
  ],
};

html = html.replace('<html lang="es">', '<html lang="es-MX">')
  .replace(/<title>[^<]*<\/title>/, "<title>Uniformes y Jerseys de Ciclismo Personalizados en Querétaro | Mi Bicla</title>")
  .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/png" href="/pink-simple.png">')
  .replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${description}">\n<link rel="canonical" href="https://mibiclaqro.com/uniformes">\n<meta property="og:type" content="website">\n<meta property="og:locale" content="es_MX">\n<meta property="og:title" content="Uniformes y Jerseys de Ciclismo Personalizados en Querétaro | Mi Bicla">\n<meta property="og:description" content="${description}">\n<meta property="og:url" content="https://mibiclaqro.com/uniformes">\n<meta property="og:image" content="https://mibiclaqro.com/og-mi-bicla-queretaro.jpg">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="Uniformes y Jerseys de Ciclismo Personalizados en Querétaro | Mi Bicla">\n<meta name="twitter:description" content="${description}">\n<meta name="twitter:image" content="https://mibiclaqro.com/og-mi-bicla-queretaro.jpg">\n<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`)
  .replace(/<nav aria-label="Secciones">[\s\S]*?<\/nav>/, `<nav aria-label="Navegación principal"><div class="wrap"><a class="logo" href="/"><img src="${imageByHash.values().next().value.url}" alt="Mi Bicla"></a><div class="links"><a href="/">Inicio</a><a href="/taller">Taller</a><a href="/productos">Productos</a><a href="/marcas">Marcas</a><a href="/uniformes" aria-current="page">Uniformes</a><a href="/eventos">Eventos</a></div><a class="btn" href="https://wa.me/524427496410?text=Hola%20Mi%20Bicla%2C%20quiero%20cotizar%20jerseys" target="_blank" rel="noopener">WhatsApp</a></div></nav>`)
  .replace(/<span class="eye">Catálogo · Jerseys personalizados<\/span>\s*<h1>[\s\S]*?<\/h1>/, '<span class="eye">Uniformes Mi Bicla · Querétaro</span>\n    <h1>Jerseys de ciclismo personalizados</h1>')
  .replace("Diseñamos contigo jerseys de ciclismo y enduro, bandanas y ropa Pro-Biker con impresión sublimada completa. Pedido mínimo de 12 piezas.", "Diseñamos en Querétaro jerseys de ciclismo y enduro, bandanas y ropa Pro-Biker con impresión sublimada completa. Pedido mínimo de 12 piezas.")
  .replace(/<div class="gal" id="gal"[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/, `<div class="gal" id="gal" tabindex="0" aria-label="Galería de fotos"><figure><img src="/uniformes/img/jersey-comunidad-mi-bicla.webp" alt="Equipo con jerseys de ciclismo personalizados Mi Bicla en Querétaro"></figure><figure><img src="/uniformes/img/jersey-competencia-mtb-queretaro.webp" alt="Jersey personalizado durante una competencia MTB en Querétaro"></figure><figure><img src="/uniformes/img/jersey-ruta-montana-mi-bicla.webp" alt="Ciclista con uniforme Mi Bicla en una ruta de montaña"></figure></div></div></section>`)
  .replace(/<footer>[\s\S]*?<\/footer>/, `<footer><img class="flogo" src="${imageByHash.values().next().value.url}" alt="Mi Bicla"><div class="footer-links"><a href="/">Inicio</a><a href="/taller">Taller</a><a href="/productos">Productos</a><a href="/marcas">Marcas</a><a href="/uniformes">Uniformes</a><a href="/eventos">Eventos</a></div><p>Mi Bicla · La Cañada, El Marqués, Querétaro · <a href="https://wa.me/524427496410" target="_blank" rel="noopener">WhatsApp 442 749 6410</a></p><p>Precios en pesos mexicanos, por pieza.</p></footer>`);

const originalHeroUrl = html.match(/<header class="hero"[\s\S]*?<img src="([^"]+)"/)?.[1];
if (originalHeroUrl)
  html = html.replace(originalHeroUrl, "/uniformes/img/jersey-comunidad-mi-bicla.webp");
const ctaBackground = html.match(/<section class="band cta">[\s\S]*?<img src="([^"]+)"/)?.[1];
if (ctaBackground)
  html = html.replace(ctaBackground, "/uniformes/img/jersey-ruta-montana-mi-bicla.webp");

html = html.replace(/h1,h2,h3\{[^}]*\}/, 'h1,h2,h3{font-family:"Barlow Condensed",Impact,sans-serif;font-weight:700;text-transform:uppercase;line-height:.92;text-wrap:balance;margin:0}')
  .replace(/\.hero h1\{[^}]*\}/, '.hero h1{font-size:clamp(48px,7vw,88px);font-weight:700;letter-spacing:-.015em;max-width:18ch;overflow-wrap:anywhere}')
  .replace(/\.qq\{font:800/, ".qq{font:700")
  .replace(/\.rcard h4\{font:800/, ".rcard h4{font:700")
  .replace(/\.trust b\{display:block;font:800/, ".trust b{display:block;font:700")
  .replace(/\.quick b\{font:800/, ".quick b{font:700")
  .replace("@media(max-width:960px){.links{display:none}nav .wrap{justify-content:space-between}}", "@media(max-width:960px){nav .wrap{justify-content:space-between;flex-wrap:wrap}.links{order:3;flex-basis:100%;justify-content:flex-start}.links a{padding-inline:9px}nav .btn{display:none}}")
  .replace("</style>", `.catalog-nav{display:flex;max-width:100vw;gap:6px;overflow-x:auto;scrollbar-width:none;padding:9px max(4vw,16px);position:sticky;top:73px;z-index:19;background:#101014;border-bottom:1px solid var(--line)}.catalog-nav::-webkit-scrollbar{display:none}.catalog-nav a{flex:none;color:var(--mute);font:700 13px Manrope,sans-serif;text-decoration:none;padding:7px 10px}.catalog-nav a:hover{color:var(--rosa2)}.links a[aria-current=page]{color:var(--rosa2)}.footer-links{display:flex;justify-content:center;gap:8px 18px;flex-wrap:wrap;margin:8px 0 14px}.footer-links a{text-decoration:none}footer p+ p{margin-top:4px}@media(max-width:960px){nav .wrap{width:100%;max-width:100vw;overflow:hidden}.links{width:100%;max-width:calc(100vw - 32px);flex:none}.catalog-nav{top:125px}}@media(max-width:600px){nav .wrap{gap:8px;padding-block:10px}.logo img{height:27px}.catalog-nav{top:116px}.hero{min-height:620px}.hero h1{max-width:10ch}}\n</style>`);

html = html.replace(/<img\b[^>]*>/g, (tag) => {
  const src = tag.match(/src="([^"]+)"/)?.[1];
  if (!src) return tag;
  const image = dimensionsByUrl.get(src);
  let next = tag.replace(/\s(?:loading|width|height|fetchpriority)="[^"]*"/g, "");
  if (image) next = next.replace(/>$/, ` width="${image.width}" height="${image.height}">`);
  const isHero = src === "/uniformes/img/jersey-comunidad-mi-bicla.webp" && next.includes("Ciclista rodando");
  return next.replace(/>$/, isHero ? ' fetchpriority="high">' : ' loading="lazy">');
});

if (/data:image\//.test(html)) throw new Error("El HTML todavía contiene imágenes base64.");
await writeFile(path.join(outputRoot, "index.html"), html, "utf8");
process.stdout.write(`Catálogo generado: ${path.join(outputRoot, "index.html")} (${Buffer.byteLength(html)} bytes, ${imageByHash.size + sitePhotos.length} imágenes)\n`);
