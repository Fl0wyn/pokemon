"use client";

import {
  breadcrumbFromPath,
  type BreadcrumbItem,
} from "@/lib/breadcrumbFromPath";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { ChevronRight } from "react-feather";

function breadcrumbItemsForPath(pathname: string): BreadcrumbItem[] {
  const path = pathname.split("?")[0] ?? pathname;
  if (path === "/profile") {
    return [
      { href: "/", label: "Game" },
      { href: "/profile", label: "Mon profil", current: true },
    ];
  }
  return breadcrumbFromPath(pathname);
}

/**
 * Horizontal breadcrumb for the app shell (mobile header + optional reuse elsewhere).
 */
export default function Breadcrumb() {
  const pathname = usePathname();
  const items = useMemo(() => breadcrumbItemsForPath(pathname), [pathname]);

  return (
    <nav aria-label="Fil d'Ariane" className="min-w-0 flex-1">
      <ol className="m-0 flex list-none items-center gap-0.5 overflow-hidden text-[13px] leading-tight">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const isCurrent = Boolean(item.current) || isLast;

          return (
            <li key={`${item.href}-${i}`} className="flex min-w-0 shrink items-center gap-0.5">
              {i > 0 ? (
                <ChevronRight
                  size={14}
                  className="shrink-0 text-muted opacity-70"
                  aria-hidden
                />
              ) : null}
              {isCurrent ? (
                <span
                  className="truncate font-semibold text-brand"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="truncate font-medium text-muted no-underline transition-colors hover:text-brand"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
