"use client";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";

const AppChromeContext = createContext(false);

/**
 * Authenticated app layout: desktop sidebar + mobile header with drawer + main content.
 */
export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const insideChrome = useContext(AppChromeContext);

  // Some routes should not show the authenticated app shell.
  const noChrome =
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/logout";

  // If already wrapped by a parent AppChrome, keep children only.
  if (insideChrome) {
    return <>{children}</>;
  }

  if (noChrome) {
    return <AppChromeContext.Provider value>{children}</AppChromeContext.Provider>;
  }

  return (
    <AppChromeContext.Provider value>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Header />
          {children}
        </div>
      </div>
    </AppChromeContext.Provider>
  );
}
