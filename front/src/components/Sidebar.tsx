"use client";

import { SidebarNavLinks } from "@/components/SidebarNavLinks";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const email = localStorage.getItem("userEmail");
        if (email == null) router.push("/login");
      } catch (error) {}
    })();
  }, [router]);

  return (
    <nav className="hidden h-screen w-48 shrink-0 sticky top-0 bg-sidebar md:flex md:flex-col">
      <SidebarNavLinks pathname={pathname} />
    </nav>
  );
}
