// Single source of truth for navigation links
export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/review-workbench", label: "🤖 AI Review Workbench" },
  { href: "/promptstore", label: "Settings" },
];