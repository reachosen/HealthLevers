import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";

interface EvidenceDrawerProps {
  title: string;
  items: Array<{ path: string; item: any }>;
  showAll?: boolean;
  onClose: () => void;
  onToggleShowAll?: () => void;
}

export function EvidenceDrawer({ title, items, showAll = false, onClose, onToggleShowAll }: EvidenceDrawerProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          {/* Show scoped evidence items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 dark:text-white">
                Signal-Specific Evidence ({items.length} items)
              </h3>
              {onToggleShowAll && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onToggleShowAll}
                  className="text-xs"
                >
                  {showAll ? "Show scoped only" : "Show all case context"}
                </Button>
              )}
            </div>
            
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                      {item.path}
                    </div>
                    <ExternalLink className="h-3 w-3 text-gray-400" />
                  </div>
                  
                  {item.item?.text && (
                    <div className="text-sm text-gray-800 dark:text-gray-200 mb-2">
                      {item.item.text}
                    </div>
                  )}
                  
                  {item.item?.ts && (
                    <div className="text-xs text-gray-500">
                      {item.item.source && `${item.item.source} • `}
                      {new Date(item.item.ts).toLocaleString()}
                    </div>
                  )}
                  
                  {typeof item.item === 'string' && (
                    <div className="text-sm text-gray-800 dark:text-gray-200">
                      {item.item}
                    </div>
                  )}
                  
                  {item.item && typeof item.item === 'object' && !item.item.text && !item.item.ts && (
                    <div className="text-sm text-gray-800 dark:text-gray-200">
                      <pre className="whitespace-pre-wrap font-mono text-xs">
                        {JSON.stringify(item.item, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {items.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No evidence items found for this signal.
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center mt-6">
          <div className="text-xs text-gray-500">
            Showing evidence scoped to this specific signal
          </div>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}