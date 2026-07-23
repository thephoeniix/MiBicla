import type {
  CSSProperties,
  ComponentPropsWithoutRef,
  ElementType,
} from "react";

type InlineProps<T extends ElementType = "div"> = {
  as?: T;
  gap?: CSSProperties["gap"];
} & Omit<ComponentPropsWithoutRef<T>, "as">;

export function Inline<T extends ElementType = "div">({
  as,
  className,
  gap,
  style,
  ...props
}: InlineProps<T>) {
  const Component = as ?? "div";
  const classes = ["mb-inline", className].filter(Boolean).join(" ");
  const customProperties = {
    ...style,
    ...(gap ? { "--mb-inline-gap": gap } : {}),
  } as CSSProperties;

  return <Component className={classes} style={customProperties} {...props} />;
}
