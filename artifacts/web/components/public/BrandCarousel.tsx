import { useRef } from "react";
import type { AuthorizedBrand } from "../../lib/public-content";

export function BrandCarousel({ brands }: { brands: AuthorizedBrand[] }) {
  const trackRef = useRef<HTMLUListElement>(null);

  const move = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    track.scrollBy({
      left: direction * Math.min(track.clientWidth * 0.8, 720),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className="brand-carousel">
      <div
        className="brand-carousel-controls"
        aria-label="Controles del carrusel de marcas"
      >
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="Ver marcas anteriores"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="Ver marcas siguientes"
        >
          →
        </button>
      </div>
      <ul
        ref={trackRef}
        className="brand-carousel-track"
        aria-label="Marcas disponibles"
      >
        {brands.map((brand) => (
          <li key={brand.name} className="brand-carousel-card">
            <img
              src={brand.logoUrl}
              alt={`Logo de ${brand.name}`}
              width={brand.width}
              height={brand.height}
              loading="lazy"
              decoding="async"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
