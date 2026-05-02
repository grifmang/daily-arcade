// /cards/jacks-or-better — server wrapper.
import * as React from "react";
import type { Metadata } from "next";
import { JacksOrBetterClient } from "./jacks-or-better-client";

export const metadata: Metadata = {
  title: "Jacks or Better — Card Parlor — Daily Arcade",
  description: "9/6 Jacks or Better video poker, play money only.",
};

export const dynamic = "force-static";

export default function JacksOrBetterPage() {
  return <JacksOrBetterClient />;
}
