"use client";

import AppChrome from "@/components/AppChrome";
import { useViewerRank } from "@/hooks/useViewerRank";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Loader } from "react-feather";

/**
 * Renders children only for admins; otherwise redirects home (nav is hidden for these routes).
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useViewerRank();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) router.replace("/");
  }, [isAdmin, loading, router]);

  if (loading || !isAdmin) {
    return (
      <AppChrome>
        <main className="flex min-h-[40vh] flex-1 items-center justify-center px-4 md:px-6">
          <Loader className="rotating text-muted" />
        </main>
      </AppChrome>
    );
  }

  return <>{children}</>;
}
