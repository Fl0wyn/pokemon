"use client";

import AppChrome from "@/components/AppChrome";
import dynamic from "next/dynamic";

const SandboxCanvas = dynamic(() => import("./SandboxCanvas"), { ssr: false });

export default function SandboxPage() {
  return (
    <AppChrome>
      <main className="min-w-0 flex-1 px-4 pt-6 pb-8 md:px-6">
        <div className="mx-auto max-w-5xl">
          <SandboxCanvas />
        </div>
      </main>
    </AppChrome>
  );
}
