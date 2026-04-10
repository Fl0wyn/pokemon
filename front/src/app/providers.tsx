"use client";

import { AppSocketProvider } from "@/providers/AppSocketProvider";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <AppSocketProvider>{children}</AppSocketProvider>;
}
