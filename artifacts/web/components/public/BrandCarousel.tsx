import type { AuthorizedBrand } from "../../lib/public-content";

export function BrandCarousel({ brands }: { brands: AuthorizedBrand[] }) {
  return (
    <div className="brand-carousel" role="region" aria-label="Marcas disponibles">
      <div className="brand-carousel-track">
        {[false, true].map((duplicate) => (
          <ul className="brand-carousel-group" aria-hidden={duplicate || undefined} key={String(duplicate)}>
            {brands.map((brand) => (
              <li key={brand.name} className="brand-carousel-card">
                <img
                  src={brand.logoUrl}
                  alt={duplicate ? "" : `Logo de ${brand.name}`}
                  width={brand.width}
                  height={brand.height}
                  loading="lazy"
                  decoding="async"
                />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
