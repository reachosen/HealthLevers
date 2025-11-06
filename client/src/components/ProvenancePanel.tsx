import { useState, useEffect } from "react";
import { useProv, clearProv, isProvEnabled, toggleProv } from "@/lib/provenance";
import { X, Eye, EyeOff, Trash2 } from "lucide-react";

export const ProvenancePanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<string>('');
  const events = useProv();
  
  // Keyboard shortcut: Ctrl+Alt+P to toggle provenance
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key === 'p') {
        e.preventDefault();
        toggleProv();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  if (!isProvEnabled()) {
    return (
      <div className="fixed bottom-4 right-4">
        <button
          onClick={toggleProv}
          className="bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700"
          title="Enable provenance tracking"
        >
          <EyeOff className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const filteredEvents = events.filter(e => 
    !filter || e.source.includes(filter) || e.key.includes(filter) || e.page.includes(filter)
  );

  return (
    <>
      {/* Toggle button */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700"
          title={`${isOpen ? 'Close' : 'Open'} provenance panel`}
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-16 right-4 w-96 h-96 bg-white border shadow-lg rounded-lg z-40">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-medium">Data Provenance</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={clearProv}
                className="p-1 hover:bg-gray-100 rounded"
                title="Clear events"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={toggleProv}
                className="p-1 hover:bg-gray-100 rounded"
                title="Disable tracking"
              >
                <EyeOff className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="p-3">
            <input
              type="text"
              placeholder="Filter by source, key, or page..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-2 py-1 text-sm border rounded"
            />
          </div>

          <div className="h-64 overflow-y-auto">
            {filteredEvents.slice().reverse().map((event, i) => {
              const uiAnchor = (event.detail as any)?.uiAnchor;
              
              const handleClick = () => {
                console.log('📋 Provenance Details:', event);
                
                // Try to scroll to UI anchor if available
                if (uiAnchor && typeof uiAnchor === 'string') {
                  const el = document.querySelector(uiAnchor) as HTMLElement | null;
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.style.outline = '2px solid #7c3aed';
                    setTimeout(() => (el.style.outline = ''), 1200);
                  } else {
                    console.log(`📍 UI anchor ${uiAnchor} not found`);
                  }
                } else {
                  console.log('📍 No UI anchor available for this event');
                }
              };

              return (
                <div 
                  key={i} 
                  className={`px-3 py-2 border-b text-xs hover:bg-gray-50 ${uiAnchor ? 'cursor-pointer' : ''}`}
                  onClick={uiAnchor ? handleClick : undefined}
                  title={uiAnchor ? `Click to scroll to ${uiAnchor}` : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-1 rounded text-xs ${
                      event.source === 'api' ? 'bg-blue-100 text-blue-700' :
                      event.source === 'local' ? 'bg-green-100 text-green-700' :
                      event.source === 'static' ? 'bg-gray-100 text-gray-700' :
                      event.source === 'computed' ? 'bg-yellow-100 text-yellow-700' :
                      event.source === 'url' ? 'bg-orange-100 text-orange-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {event.source}
                    </span>
                    <span className="font-mono">{event.key}</span>
                    {uiAnchor && <span className="text-blue-500">🎯</span>}
                  </div>
                  <div className="text-gray-500 mt-1">
                    {new Date(event.ts).toLocaleTimeString()} • {event.page}
                    {event.detail && (
                      <span className="ml-2">{JSON.stringify(event.detail)}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredEvents.length === 0 && (
              <div className="p-4 text-center text-gray-500">
                No events {filter ? 'matching filter' : 'recorded yet'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};