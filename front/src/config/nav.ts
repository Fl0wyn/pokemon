import {
  Home,
  Layers,
  Users,
} from "react-feather";

export type NavItem = {
  href: string;
  icon: typeof Home;
  label: string;
  description: string;
  color: string;
  bg: string;
  /** Hidden in sidebar / dashboard for non-admin users */
  adminOnly?: boolean;
  /** Omit from dashboard grid (sidebar link unchanged) */
  hideFromDashboard?: boolean;
};

export const navItemsPrimary: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home, description: "Vue d'ensemble de l'application", color: "text-blue-500", bg: "bg-blue-50" },
  { href: "/users", label: "Utilisateurs", icon: Users, description: "Liste des comptes ayant accédé à la toolbox", color: "text-indigo-500", bg: "bg-indigo-50" },
  {
    href: "/sandbox",
    label: "Sandbox",
    icon: Layers,
    description: "Espace partagé 2D (vue de dessus) pour expérimenter",
    color: "text-slate-600",
    bg: "bg-slate-50",
  },
];

export const navItemsSecondary: NavItem[] = [];

/** Full list (primary then secondary) for dashboard cards and other consumers. */
export const navItems: NavItem[] = [...navItemsPrimary, ...navItemsSecondary];
