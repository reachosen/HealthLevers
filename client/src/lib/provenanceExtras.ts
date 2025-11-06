// Enhanced provenance helpers for richer debugging
export const snap = {
  groupCounts: (g: Record<string, any[]>) =>
    Object.fromEntries(Object.entries(g).map(([k, arr]) => [k, arr.length])),
  
  previewText: (s?: string, n = 80) => (s ?? "").slice(0, n),
  
  patientName: (patient: any) => patient?.name ? `${patient.name.split(' ')[0]} ${patient.name.split(' ')[1]?.[0] || ''}` : "—",
  
  formatTime: (iso?: string) => iso ? new Date(iso).toLocaleString('en-US', { 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  }) : "—",
  
  redactMRN: (mrn?: string) => mrn ? `***${mrn.slice(-3)}` : "—"
};

// Enhanced record function with page context
export const recordWithContext = (event: {
  source: 'local' | 'static' | 'computed' | 'api';
  key: string;
  detail?: any;
  uiAnchor?: string;
}) => {
  // Use the existing provenance system but enhance with context
  const { withComputed } = require('./provenance');
  
  withComputed(event.key, () => ({
    ...event.detail,
    uiAnchor: event.uiAnchor,
    page: window.location.pathname,
    timestamp: new Date().toISOString()
  }), [event.detail]);
};