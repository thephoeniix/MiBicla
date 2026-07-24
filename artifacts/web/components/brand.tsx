import type { HTMLAttributes, ReactNode } from "react";

export function ChainDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`brand-chain ${className}`.trim()} aria-hidden="true">
      <span />
      <i>×</i>
      <span />
    </div>
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

