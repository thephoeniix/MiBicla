import { useRef } from "react";
import type { AuthorizedBrand } from "../../lib/public-content";

interface BrandCarouselProps {
  brands: AuthorizedBrand[];
}

export function BrandCarousel({ brands }: BrandCarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);

  const move = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.min(track.clientWidth * 0.8, 720), behavior: "smooth" });
  };

  return (
    <div className="brand-carousel">
      <div className="brand-carousel-controls" aria-label="Controles del carrusel de marcas">
        <button type="button" onClick={() => move(-1)} aria-label="Ver marcas anteriores">←</button>
        <button type="button" onClick={() => move(1)} aria-label="Ver marcas siguientes">→</button>
      </div>
      <ul ref={trackRef} className="brand-carousel-track" aria-label="Marcas disponibles">
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
