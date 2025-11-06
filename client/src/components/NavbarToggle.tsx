import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { DemoResetButton } from "@/components/DemoResetButton";

export default function NavbarToggle({ userName }: { userName?: string }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const isHome = location === "/";

  const pill = (active: boolean) =>
    [
      "px-3 py-1.5 rounded-md border text-sm transition-colors shrink-0 whitespace-nowrap",
      active ? "bg-sky-100 border-sky-300 text-sky-800" : "bg-white hover:bg-gray-50 border-gray-200",
    ].join(" ");

  const btn = (enabled: boolean) =>
    [
      "px-3 py-1.5 rounded-md border text-sm shrink-0 whitespace-nowrap transition-colors",
      enabled ? "bg-white hover:bg-gray-50 border-gray-200 cursor-pointer text-gray-700" : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed",
    ].join(" ");

  const toggle = (name: string) => {
    console.log('Dispatching event:', name);
    window.dispatchEvent(new CustomEvent(name));
  };

  // Get user display name
  const displayName = userName || (() => {
    if (!user) return "User";
    const firstName = (user as any)?.firstName;
    const lastName = (user as any)?.lastName;
    const email = (user as any)?.email;
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (email) {
      return email.split('@')[0];
    } else {
      return 'User';
    }
  })();

  return (
    <header className="w-full h-14 border-b bg-white/70 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-7xl h-full px-4 flex items-center gap-6">
        <a href="/" className="font-extrabold text-xl text-lurie-blue shrink-0">
          USNWR Abstraction Helper
        </a>

        <nav className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <a href="/intake" className={pill(location === "/intake")}>
            AI Signal Intake
          </a>
          <a href="/" className={pill(isHome)}>
            Abstraction Helper
          </a>
          <a href="/promptstore" className={pill(location === "/promptstore")}>
            PromptStore
          </a>
          <a href="/setup" className={pill(location === "/setup")}>
            Case View Setup
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <DemoResetButton />
          <span className="text-sm text-gray-600">Welcome {displayName}</span>
          <a href="/logout" className="text-sm text-gray-600 hover:text-gray-900">
            Sign Out
          </a>
        </div>
      </div>
    </header>
  );
}