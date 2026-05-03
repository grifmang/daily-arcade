// /cards/deuces-wild — server wrapper.
import * as React from "react";
import type { Metadata } from "next";
import { DeucesWildClient } from "./deuces-wild-client";

export const metadata: Metadata = {
  title: "Deuces Wild — Card Parlor — Daily Arcade",
  description: "NSUD Deuces Wild video poker, play money only.",
};

export const dynamic = "force-static";

export default function DeucesWildPage() {
  return <DeucesWildClient />;
}
