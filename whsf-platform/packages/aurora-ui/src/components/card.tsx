import type { HTMLAttributes } from "react";

export type CardProps = HTMLAttributes<HTMLElement>;

export function Card({ className = "", ...props }: CardProps) {
  return <article className={`aurora-card ${className}`.trim()} {...props} />;
}
