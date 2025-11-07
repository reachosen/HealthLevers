import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlanningProvider } from "@/lib/planningConfig";
import { PromptPlayProvider, PromptPlayDrawer } from "@/components/PromptPlay";

import { useAuth } from "@/hooks/useAuth";
import Home from "@/pages/home";
import IntakePage from "@/pages/intake";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/not-found";
import NavbarToggle from "@/components/NavbarToggle";
import PromptStorePage from "@/pages/promptstore";
import SetupPage from "@/pages/setup";
import MetricsPage from "@/pages/metrics";
import { useState, useEffect } from "react";
import { useSpecialties } from "@/hooks/useSpecialties";
import { ProvenancePanel } from "@/components/ProvenancePanel";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedSpecialty, setSelectedSpecialty] = useState("Orthopedics");
  const { specialties: availableSpecialties, isLoading: specialtiesLoading } = useSpecialties();

  if (isLoading || specialtiesLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return (
    <>
      {/* Single shared Navbar for authenticated users */}
      <NavbarToggle />
      
      <Switch>
        <Route path="/intake" component={() => <IntakePage
          selectedSpecialty={selectedSpecialty}
          onSpecialtyChange={setSelectedSpecialty}
          availableSpecialties={availableSpecialties}
        />} />
        <Route path="/promptstore" component={() => <PromptStorePage />} />
        <Route path="/setup" component={() => <SetupPage />} />
        <Route path="/metrics" component={() => <MetricsPage />} />
        <Route path="/" component={() => <Home
          selectedSpecialty={selectedSpecialty}
          onSpecialtyChange={setSelectedSpecialty}
          availableSpecialties={availableSpecialties}
        />} />
        <Route component={NotFound} />
      </Switch>
      
      {/* Provenance tracking panel - global access */}
      <ProvenancePanel />
    </>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <PlanningProvider>
            <PromptPlayProvider redactPHI={true} defaultOpen={false}>
              <Router />
              <Toaster />
              <PromptPlayDrawer />
            </PromptPlayProvider>
          </PlanningProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
