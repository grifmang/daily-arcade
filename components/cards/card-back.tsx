"use client";
// Face-down card back, used during card-flip animations.
import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardBackProps {
  className?: string;
  motif?: "classic" | "deuce";
}

export function CardBack({ className, motif = "classic" }: CardBackProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "card-back relative aspect-[2/3] w-full rounded-md border bg-[var(--card-back-bg)]",
        motif === "deuce" && "card-back-deuce",
        className,
      )}
    />
  );
}
