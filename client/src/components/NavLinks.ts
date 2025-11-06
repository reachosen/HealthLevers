// Single source of truth for navigation links
export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Abstraction Helper" },
  { href: "/intake", label: "AI Signal Intake" },
  { href: "/promptstore", label: "PromptStore" },
  { href: "/case-view", label: "Case View Setup" },
];