import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "primary" | "secondary" | "danger";
}

export function Button({
  className = "",
  tone = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`aurora-button aurora-button--${tone} ${className}`.trim()}
      type={type}
      {...props}
    />
  );
}
