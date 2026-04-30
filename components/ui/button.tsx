import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:brightness-110 active:scale-[0.98]",
  secondary: "bg-[var(--color-bg-elevated)] text-[var(--color-fg)] hover:bg-[var(--color-bg-overlay)] border border-[var(--color-line)]",
  ghost: "bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-bg-elevated)]",
  outline: "bg-transparent border border-[var(--color-line-strong)] text-[var(--color-fg)] hover:bg-[var(--color-bg-elevated)]",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm rounded-[var(--radius-sm)]",
  md: "h-11 px-5 text-base rounded-[var(--radius-md)]",
  lg: "h-14 px-7 text-lg rounded-[var(--radius-lg)]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-display font-medium tracking-tight",
        "transition-[background,transform,filter] duration-[var(--motion-fast)] ease-[var(--ease-arcade)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    />
  );
});
