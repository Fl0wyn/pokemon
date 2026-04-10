"use client";

import Breadcrumb from "@/components/Breadcrumb";
import { SidebarNavLinks } from "@/components/SidebarNavLinks";
import { dataImageUrl } from "@/lib/dataImageUrl";
import axiosInstance from "@/utils/axiosInstance";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Menu, User, X } from "react-feather";

/**
 * Top bar: breadcrumb (left) + burger menu (mobile) or user link to profile (desktop).
 */
export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profilePreviewKey, setProfilePreviewKey] = useState<string | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      setUserEmail(localStorage.getItem("userEmail"));
    } catch {
      setUserEmail(null);
    }
  }, [pathname]);

  const fetchProfilePreview = useCallback(async () => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setProfilePreviewKey(null);
      return;
    }
    try {
      const response = await axiosInstance.get<{
        profileImage: { previewStorageKey: string } | null;
      }>("/user/me", {
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      });
      setProfilePreviewKey(response.data.profileImage?.previewStorageKey ?? null);
    } catch {
      setProfilePreviewKey(null);
    }
  }, []);

  useEffect(() => {
    void fetchProfilePreview();
  }, [pathname, fetchProfilePreview]);

  useEffect(() => {
    const onAvatar = () => {
      void fetchProfilePreview();
    };
    window.addEventListener("acs2i-profile-image-changed", onAvatar);
    return () => window.removeEventListener("acs2i-profile-image-changed", onAvatar);
  }, [fetchProfilePreview]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-60 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3 md:px-4">
        <Breadcrumb />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-0 bg-soft text-brand transition-colors hover:bg-border cursor-pointer md:hidden"
          aria-expanded={open}
          aria-controls="mobile-app-nav"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>
        <Link
          href="/profile"
          className="ml-auto hidden min-w-0 max-w-[min(16rem,40vw)] shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 no-underline transition-colors hover:bg-soft md:flex"
          aria-label="Mon profil"
        >
          {profilePreviewKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataImageUrl(profilePreviewKey)}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <User size={18} className="shrink-0 text-muted" aria-hidden />
          )}
          <span className="truncate text-sm font-medium text-brand">
            {userEmail ?? "Profil"}
          </span>
        </Link>
      </header>

      {open ? (
        <div
          className="fixed inset-0 z-70 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <button
            type="button"
            className="absolute inset-0 border-0 bg-brand/40 p-0 cursor-pointer"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
          />
          <nav
            id="mobile-app-nav"
            className="absolute right-0 top-0 flex h-full w-[min(20rem,100vw)] flex-col overflow-y-auto bg-sidebar shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sidebar-sep/60 px-3 py-2">
              <span className="truncate text-sm font-semibold text-white">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-0 bg-sidebar-hover text-white transition-colors hover:bg-sidebar-active cursor-pointer"
                aria-label="Fermer le menu"
              >
                <X size={20} />
              </button>
            </div>
            <SidebarNavLinks
              variant="drawer"
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </nav>
        </div>
      ) : null}
    </>
  );
}
