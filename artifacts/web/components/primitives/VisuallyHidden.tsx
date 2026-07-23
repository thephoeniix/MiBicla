import type { ComponentPropsWithoutRef, ElementType } from "react";

type VisuallyHiddenProps<T extends ElementType = "span"> = {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

export function VisuallyHidden<T extends ElementType = "span">({
  as,
  className,
  ...props
}: VisuallyHiddenProps<T>) {
  const Component = as ?? "span";
  const classes = ["mb-sr-only", className].filter(Boolean).join(" ");

  return <Component className={classes} {...props} />;
}
