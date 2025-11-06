import PlanningConfigPanel from "@/components/PlanningConfigPanel";
import { useLocation } from "wouter";

export default function SetupPage() {
  const [, setLocation] = useLocation();
  
  const handleClose = () => {
    // Navigate back to the main Abstraction Helper page
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F7FBFE] to-[#FFFFFF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="panel-container mt-6 p-6 border rounded-lg bg-white shadow-sm">
          <div className="panel-header text-lg font-semibold text-slate-900 mb-4">
            Case View Setup
          </div>
          <PlanningConfigPanel onClose={handleClose} />
        </div>
      </div>
    </div>
  );
}