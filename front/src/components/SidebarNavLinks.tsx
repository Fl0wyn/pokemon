"use client";

import { navItemsPrimary, navItemsSecondary } from "@/config/nav";
import { useViewerRank } from "@/hooks/useViewerRank";
import Image from "next/image";
import Link from "next/link";
import { LogOut } from "react-feather";

type SidebarNavLinksProps = {
  pathname: string;
  onNavigate?: () => void;
  variant?: "sidebar" | "drawer";
};

export function SidebarNavLinks({
  pathname,
  onNavigate,
  variant = "sidebar",
}: SidebarNavLinksProps) {
  const { isAdmin, loading } = useViewerRank();

  const itemClass = (active: boolean) =>
    [
      "flex items-center gap-2.5 mx-2 my-0.5 px-3 py-2 rounded-lg",
      "text-[13px] font-medium no-underline transition-colors duration-150",
      active
        ? "bg-sidebar-active text-white shadow-sm"
        : "text-sidebar-text hover:bg-sidebar-hover hover:text-white",
    ].join(" ");

  const sectionLabel = (text: string) => (
    <p className="m-0 px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-label/70">
      {text}
    </p>
  );

  return (
    <div className="flex h-full flex-col">
      {variant === "sidebar" ? (
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 px-4 py-4 no-underline border-b border-sidebar-sep/50"
        >
          <span className="text-sm font-bold text-white tracking-wide">Acs2i</span>
          <span className="text-sm font-light text-sidebar-text">Game</span>
        </Link>
      ) : null}

      <div className={`flex-1 overflow-y-auto py-2 ${variant === "drawer" ? "pt-3" : "pt-3"}`}>
        {sectionLabel("Navigation")}
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
                <Link href={item.href} onClick={onNavigate} className={itemClass(active)}>
                  {item.image ? (
                    <Image src={item.image} alt={item.label} width={15} height={15} className="shrink-0 opacity-80" />
                  ) : (
                    <Icon size={15} className={active ? "text-white" : "text-sidebar-icon"} />
                  )}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mx-3 my-3 border-t border-sidebar-sep/60" />

        {sectionLabel("Jeux")}
        <ul className="m-0 list-none p-0">
          {navItemsSecondary.map((item) => {
            if (item.adminOnly) {
              if (loading) return null;
              if (!isAdmin) return null;
            }
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link href={item.href} onClick={onNavigate} className={itemClass(active)}>
                  {item.image ? (
                    <Image src={item.image} alt={item.label} width={15} height={15} className="shrink-0 opacity-80" />
                  ) : (
                    <Icon size={15} className={active ? "text-white" : "text-sidebar-icon"} />
                  )}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-sidebar-sep/60 py-2">
        <Link
          href="/logout"
          onClick={onNavigate}
          className="mx-2 my-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-text no-underline transition-colors hover:bg-sidebar-hover hover:text-white"
        >
          <LogOut size={15} className="text-sidebar-icon" />
          Sign out
        </Link>
      </div>
    </div>
  );
}
