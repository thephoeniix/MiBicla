import type {
  CSSProperties,
  ComponentPropsWithoutRef,
  ElementType,
} from "react";

type StackProps<T extends ElementType = "div"> = {
  as?: T;
  gap?: CSSProperties["gap"];
} & Omit<ComponentPropsWithoutRef<T>, "as">;

export function Stack<T extends ElementType = "div">({
  as,
  className,
  gap,
  style,
  ...props
}: StackProps<T>) {
  const Component = as ?? "div";
  const classes = ["mb-stack", className].filter(Boolean).join(" ");
  const customProperties = {
    ...style,
    ...(gap ? { "--mb-stack-gap": gap } : {}),
  } as CSSProperties;

  return <Component className={classes} style={customProperties} {...props} />;
}
