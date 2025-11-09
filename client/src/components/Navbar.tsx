import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText } from 'lucide-react';

interface NavbarProps {
  selectedSpecialty?: string;
  onSpecialtyChange?: (specialty: string) => void;
  availableSpecialties?: string[];
}

export default function Navbar({
  selectedSpecialty = "Orthopedics",
  onSpecialtyChange,
  availableSpecialties = ["Orthopedics", "Cardiology", "Neurology"]
}: NavbarProps) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();

  const getUserName = () => {
    if (!user) return 'User';
    const firstName = (user as any)?.firstName;
    const lastName = (user as any)?.lastName;
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    return 'Local Developer';
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-border/40 shadow-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Lurie Logo */}
            <a href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <div className="h-12 w-12 rounded-xl bg-lurie-purple flex items-center justify-center shadow-md">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="currentColor">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                  <path d="M10 17l-3-3 1.41-1.41L10 14.17l5.59-5.58L17 10l-7 7z" fill="white" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Lurie Children's</h1>
                <p className="text-sm text-muted-foreground">Clinical Case Review Helper</p>
              </div>
            </a>

            <nav className="hidden md:flex items-center gap-1 ml-6">
              <Button
                variant="ghost"
                size="sm"
                className={location === '/' ? 'text-lurie-purple font-medium' : ''}
                onClick={() => navigate('/')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Queue
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={location === '/metrics' ? 'text-lurie-purple font-medium' : ''}
                onClick={() => navigate('/metrics')}
              >
                Metrics
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={location === '/promptstore' ? 'text-lurie-purple font-medium' : ''}
                onClick={() => navigate('/promptstore')}
              >
                Config
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden md:inline">
              Welcome {getUserName()}
            </span>
            <Select value={selectedSpecialty} onValueChange={onSpecialtyChange}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableSpecialties.map((specialty) => (
                  <SelectItem key={specialty} value={specialty}>
                    {specialty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => navigate('/api/logout')}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}