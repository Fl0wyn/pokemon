import {
    Home,
    Layers,
    Users,
} from "react-feather";

export type NavItem = {
  href: string;
  icon: typeof Home;
  /** Optional image path (public/) to use instead of the icon */
  image?: string;
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
  { href: "/users", label: "Utilisateurs", icon: Users, description: "Liste des comptes ayant accédé à la game", color: "text-indigo-500", bg: "bg-indigo-50", hideFromDashboard: true },
];

export const navItemsSecondary: NavItem[] = [
  {
    href: "/pokemon",
    label: "Pokemon",
    icon: Layers,
    image: "/pokemon/pokemon.png",
    description: "Jeu Pokemon multijoueur en vue de dessus",
    color: "text-green-600",
    bg: "bg-green-50",
  },
];

/** Full list (primary then secondary) for dashboard cards and other consumers. */
export const navItems: NavItem[] = [...navItemsPrimary, ...navItemsSecondary];
