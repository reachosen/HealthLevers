// Single source of truth for navigation links
export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/review-workbench", label: "🤖 AI Review" },
  { href: "/cases", label: "Case List" },
  { href: "/intake", label: "Manual Intake" },
  { href: "/promptstore", label: "PromptStore" },
  { href: "/case-view", label: "Settings" },
];