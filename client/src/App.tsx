import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlanningProvider } from "@/lib/planningConfig";
import { PromptPlayProvider, PromptPlayDrawer } from "@/components/PromptPlay";

import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/not-found";
import NavbarToggle from "@/components/NavbarToggle";
import PromptStorePage from "@/pages/promptstore";
import ReviewWorkbench from "@/pages/review-workbench";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
        <Route path="/" component={Dashboard} />
        <Route path="/review-workbench" component={ReviewWorkbench} />
        <Route path="/promptstore" component={PromptStorePage} />
        <Route component={NotFound} />
      </Switch>
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
