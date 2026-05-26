"use client";

import { Children, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  steps?: number;
  as?: keyof React.JSX.IntrinsicElements;
};

export function Stagger({ children, className, steps = 5, as: As = "div" }: Props) {
  const wrapped = Children.toArray(children).map((child, i) => {
    const cls = `fade-up-${(i % steps) + 1}`;
    if (isValidElement<{ className?: string }>(child)) {
      return cloneElement(child, {
        className: cn(child.props.className, cls),
      });
    }
    return (
      <span key={i} className={cls}>
        {child}
      </span>
    );
  });
  const Component = As as React.ElementType;
  return <Component className={className}>{wrapped}</Component>;
}
