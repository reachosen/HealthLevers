// Single source of truth for navigation links
export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "📋 Queue" },
  { href: "/metrics", label: "📊 Metrics" },
  { href: "/promptstore", label: "⚙️ Config" },
];