"use client";

import AppChrome from "@/components/AppChrome";
import { navItems } from "@/config/nav";
import { useViewerRank } from "@/hooks/useViewerRank";
import Link from "next/link";
import { useMemo } from "react";

export default function Home() {
  const { isAdmin, loading } = useViewerRank();

  const cards = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.href === "/") return false;
        if (item.hideFromDashboard) return false;
        if (item.adminOnly) {
          if (loading) return false;
          return isAdmin;
        }
        return true;
      }),
    [isAdmin, loading],
  );

  return (
    <AppChrome>
      <main className="min-w-0 flex-1 px-4 md:px-6">
        <div className="mb-6 flex items-center border-b border-border pb-4 pt-6">
          <h1 className="m-0 text-lg font-bold text-brand">Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="block rounded-xl border border-border bg-card p-5 no-underline transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className={`mb-3.5 flex h-9 w-9 items-center justify-center rounded-lg ${card.bg} ${card.color}`}
                >
                  <Icon size={20} />
                </div>
                <div className="mb-1 text-[15px] font-bold text-brand">{card.label}</div>
                <div className="text-[13px] text-muted">{card.description}</div>
              </Link>
            );
          })}
        </div>
      </main>
    </AppChrome>
  );
}
