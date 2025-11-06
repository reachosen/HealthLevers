import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { NAV_LINKS } from './NavLinks';
import { DemoResetButton } from './DemoResetButton';

interface NavbarProps {
  selectedSpecialty?: string;
  onSpecialtyChange?: (specialty: string) => void;
  availableSpecialties?: string[];
  onTogglePromptStore?: () => void;
  onTogglePlanningConfig?: () => void;
}

export default function Navbar({
  selectedSpecialty = "Orthopedics",
  onSpecialtyChange,
  availableSpecialties = ["Orthopedics"],
  onTogglePromptStore,
  onTogglePlanningConfig
}: NavbarProps) {
  const { user } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  return (
    <header className="w-full border-b bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-6">
        <a href="/" className="font-extrabold text-lg text-lurie-blue">
          USNWR Abstraction Helper
        </a>

        <nav className="flex items-center gap-2 flex-wrap overflow-x-auto whitespace-nowrap snap-x">
          {NAV_LINKS.map(link => {
            // Handle special cases for buttons that aren't real pages
            if (link.href === "/promptstore") {
              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('PromptStore button clicked - handlers available:', !!onTogglePromptStore);
                    if (onTogglePromptStore) {
                      console.log('Calling onTogglePromptStore...');
                      onTogglePromptStore();
                    } else {
                      console.log('No onTogglePromptStore handler provided');
                    }
                  }}
                  className="px-3 py-1.5 rounded-md border transition text-sm bg-white hover:bg-gray-50 border-gray-200 shrink-0 whitespace-nowrap cursor-pointer"
                >
                  {link.label}
                </button>
              );
            }
            if (link.href === "/case-view") {
              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Case View Setup button clicked - handlers available:', !!onTogglePlanningConfig);
                    if (onTogglePlanningConfig) {
                      console.log('Calling onTogglePlanningConfig...');
                      onTogglePlanningConfig();
                    } else {
                      console.log('No onTogglePlanningConfig handler provided');
                    }
                  }}
                  className="px-3 py-1.5 rounded-md border transition text-sm bg-white hover:bg-gray-50 border-gray-200 shrink-0 whitespace-nowrap cursor-pointer"
                >
                  {link.label}
                </button>
              );
            }
            
            // Regular navigation links
            return (
              <a
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md border transition text-sm shrink-0 whitespace-nowrap ${
                  isActive(link.href) 
                    ? "bg-sky-100 border-sky-300 text-sky-800" 
                    : "bg-white hover:bg-gray-50 border-gray-200"
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* User Welcome */}
          {user && (
            <span className="text-sm text-gray-600">
              Welcome {(() => {
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
              })() as string}
            </span>
          )}
          
          <DemoResetButton />
          
          <label className="text-sm text-gray-600">Specialty:</label>
          <select 
            className="rounded-md border px-2 py-1 text-sm"
            value={selectedSpecialty}
            onChange={(e) => onSpecialtyChange?.(e.target.value)}
          >
            {availableSpecialties.map((specialty) => (
              <option key={specialty} value={specialty}>
                {specialty}
              </option>
            ))}
          </select>
          <a href="/api/logout" className="text-sm text-gray-600 hover:text-gray-900">
            Sign Out
          </a>
        </div>
      </div>
    </header>
  );
}