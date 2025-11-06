// prompt@play Event Types and Interfaces

export type PromptPlayEvent = {
  promptId: string;
  type: "signal_processing" | "abstraction_helper" | "ai_enrichment" | "automapper" | string;
  version?: string;
  template?: { system?: string; user?: string; tools?: any };
  variables?: Record<string, any>;
  resolvedPrompt?: string;
  model?: string;
  params?: Record<string, any>;
  output?: any;
  metrics?: { ttfbMs?: number; totalMs?: number; tokensIn?: number; tokensOut?: number };
  contextRef?: string;
  ts?: number;
  runId?: string;
};

export type PromptPlayState = {
  events: PromptPlayEvent[];
  activeRunId: string | null;
  drawerOpen: boolean;
  selectedContextRef: string | null;
  redactPHI: boolean;
};

export interface PromptPlayContextType {
  state: PromptPlayState;
  register: (event: Partial<PromptPlayEvent>) => string; // returns runId
  complete: (runId: string, completion: Partial<PromptPlayEvent>) => void;
  openDrawer: (contextRef?: string) => void;
  closeDrawer: () => void;
  toggleRedaction: () => void;
  replay: (runId: string) => Promise<void>;
  getEventsForContext: (contextRef: string) => PromptPlayEvent[];
  openFull: (resolved?: string, meta?: any) => void;
}