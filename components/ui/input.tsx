import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full bg-[var(--color-bg-elevated)] text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)]",
          "border border-[var(--color-line-strong)] rounded-[var(--radius-md)] px-3",
          "outline-none focus:border-[var(--color-accent)]",
          "font-mono text-base",
          className,
        )}
        {...rest}
      />
    );
  },
);
