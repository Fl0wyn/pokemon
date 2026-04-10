import { navItems } from "@/config/nav";

export type BreadcrumbItem = {
  href: string;
  label: string;
  /** Last segment — rendered as text, not a link */
  current?: boolean;
};

/**
 * Builds breadcrumb trail from pathname. Keeps labels in sync with nav config where possible.
 */
export function breadcrumbFromPath(pathname: string): BreadcrumbItem[] {
  const path = pathname.split("?")[0] ?? pathname;

  if (path.startsWith("/login")) {
    return [{ href: "/login", label: "Connexion", current: true }];
  }
  if (path.startsWith("/logout")) {
    return [{ href: "/logout", label: "Déconnexion", current: true }];
  }

  const items: BreadcrumbItem[] = [{ href: "/", label: "Toolbox" }];

  if (path === "/" || path === "") {
    items.push({ href: "/", label: "Dashboard", current: true });
    return items;
  }

  const taskMatch = /^\/task\/([^/]+)$/.exec(path);
  if (taskMatch) {
    items.push({ href: "/tasks", label: "Interventions" });
    items.push({ href: path, label: "Détail", current: true });
    return items;
  }

  const navItem = navItems.find((n) => n.href === path);
  if (navItem) {
    items.push({ href: navItem.href, label: navItem.label, current: true });
    return items;
  }

  const segments = path.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "Page";
  items.push({
    href: path,
    label: last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    current: true,
  });
  return items;
}
