import { Dialog, DialogContent } from "@/components/ui/dialog";

interface LoadingOverlayProps {
  isOpen: boolean;
  message?: string;
}

export function LoadingOverlay({ isOpen, message = "Processing LLM inference..." }: LoadingOverlayProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <div className="flex items-center space-x-3 p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="text-slate-700">{message}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
