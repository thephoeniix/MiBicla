import type { ComponentPropsWithoutRef, ElementType } from "react";

type ContainerProps<T extends ElementType = "div"> = {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

export function Container<T extends ElementType = "div">({
  as,
  className,
  ...props
}: ContainerProps<T>) {
  const Component = as ?? "div";
  const classes = ["mb-container", className].filter(Boolean).join(" ");

  return <Component className={classes} {...props} />;
}
