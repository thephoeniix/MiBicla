import type { HTMLAttributes, ReactNode } from "react";
import fullWhite from "../../../logo/letterslogoblaco.png";
import fullBlack from "../../../logo/letterslogonegro.png";
import fullPink from "../../../logo/letterslogopink.png";
import wordmarkWhite from "../../../logo/lettersblaco.png";
import wordmarkBlack from "../../../logo/lettersnegro.png";
import wordmarkPink from "../../../logo/letterspink.png";
import symbolWhite from "../../../logo/white-simple.png";
import symbolBlack from "../../../logo/black-simple.png";
import symbolPink from "../../../logo/pink-simple.png";
import chainImage from "../../../logo/cadena.png";

export function ChainDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`brand-chain ${className}`.trim()} aria-hidden="true">
      <img src={chainImage} alt="" width={2048} height={65} />
    </div>
  );
}

const LOGOS = {
  full: { white: fullWhite, black: fullBlack, pink: fullPink },
  wordmark: {
    white: wordmarkWhite,
    black: wordmarkBlack,
    pink: wordmarkPink,
  },
  symbol: { white: symbolWhite, black: symbolBlack, pink: symbolPink },
} as const;

export function BrandLogo({
  variant = "full",
  color = "auto",
  decorative = false,
  className = "",
}: {
  variant?: keyof typeof LOGOS;
  color?: "auto" | "pink" | "white" | "black";
  decorative?: boolean;
  className?: string;
}) {
  const alt = decorative ? "" : "Mi Bicla";
  if (color !== "auto") {
    return (
      <span
        className={`brand-logo brand-logo--${variant} ${className}`.trim()}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative || undefined}
      >
        <img
          src={LOGOS[variant][color]}
          width={320}
          height={320}
          alt=""
        />
      </span>
    );
  }
  return (
    <span
      className={`brand-logo brand-logo--${variant} brand-logo--auto ${className}`.trim()}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Mi Bicla"}
      aria-hidden={decorative || undefined}
    >
      <img
        className="brand-logo-light"
        src={LOGOS[variant].black}
        width={320}
        height={320}
        alt=""
      />
      <img
        className="brand-logo-dark"
        src={LOGOS[variant].white}
        width={320}
        height={320}
        alt=""
      />
    </span>
  );
}

export function BrandSectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="brand-section-heading">
      <div>
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </header>
  );
}

export function FeatureCard({
  tone = "black",
  icon,
  title,
  description,
  href,
  className = "",
}: {
  tone?: "black" | "pink" | "light" | "photo";
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  className?: string;
}) {
  return (
    <a
      className={`brand-feature brand-feature--${tone} ${className}`.trim()}
      href={href}
    >
      <span className="brand-feature-icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <i aria-hidden="true">→</i>
    </a>
  );
}

export function BrandPageHero({
  eyebrow,
  title,
  description,
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className={`brand-page-hero ${className}`.trim()} {...props}>
      <div>
        <p className="page-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </div>
    </header>
  );
}
