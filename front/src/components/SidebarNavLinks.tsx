"use client";

import { navItemsPrimary, navItemsSecondary } from "@/config/nav";
import { useViewerRank } from "@/hooks/useViewerRank";
import Link from "next/link";
import { LogOut } from "react-feather";

type SidebarNavLinksProps = {
  pathname: string;
  /** Close mobile drawer after navigation */
  onNavigate?: () => void;
  /** `drawer` omits the top logo link (drawer has its own header). */
  variant?: "sidebar" | "drawer";
};

/**
 * Shared nav list for desktop Sidebar and mobile drawer (same links & active states).
 */
export function SidebarNavLinks({
  pathname,
  onNavigate,
  variant = "sidebar",
}: SidebarNavLinksProps) {
  const { isAdmin, loading } = useViewerRank();

  const itemClass = (active: boolean) =>
    [
      "flex items-center gap-2.5 mx-2.5 my-0.5 px-3 py-2 rounded-lg",
      "text-[13px] font-medium no-underline transition-colors duration-150",
      active
        ? "bg-sidebar-active text-white"
        : "text-sidebar-text hover:bg-sidebar-hover hover:text-slate-100",
    ].join(" ");

  return (
    <div className="flex h-full flex-col">
      {variant === "sidebar" ? (
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center px-4 py-5 no-underline"
        >
          <span className="text-sm font-semibold text-white">Acs2i – Toolbox</span>
        </Link>
      ) : null}
      <div className={`flex-1 ${variant === "drawer" ? "pt-2" : "pt-1"}`}>
        <p className="m-0 px-4 pb-1 text-[11px] font-semibold uppercase tracking-widest text-indigo-300/50">
          Navigation
        </p>
        <ul className="m-0 list-none p-0">
          {navItemsPrimary.map((item) => {
            if (item.adminOnly) {
              if (loading) return null;
              if (!isAdmin) return null;
            }
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={itemClass(active)}
                >
                  <Icon
                    size={15}
                    className={active ? "text-white" : "text-sidebar-icon"}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li aria-hidden className="mx-4 my-2 border-t border-indigo-400/25" />
          {navItemsSecondary.map((item) => {
            if (item.adminOnly) {
              if (loading) return null;
              if (!isAdmin) return null;
            }
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={itemClass(active)}
                >
                  <Icon
                    size={15}
                    className={active ? "text-white" : "text-sidebar-icon"}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="pb-3">
        <Link
          href="/logout"
          onClick={onNavigate}
          className="mx-2.5 my-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-text no-underline transition-colors hover:bg-sidebar-hover hover:text-slate-100"
        >
          <LogOut size={15} className="text-sidebar-icon" />
          Sign out
        </Link>
      </div>
    </div>
  );
}
