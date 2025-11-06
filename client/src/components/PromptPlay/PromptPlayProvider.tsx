import React, { createContext, useContext, useState, useCallback } from 'react';
import { PromptPlayContextType, PromptPlayState, PromptPlayEvent } from './types';
import { generateRunId } from './utils';
import { FullPromptOverlay } from './FullPromptOverlay';

const PromptPlayContext = createContext<PromptPlayContextType | null>(null);

interface PromptPlayProviderProps {
  children: React.ReactNode;
  redactPHI?: boolean;
  defaultOpen?: boolean;
}

export function PromptPlayProvider({ 
  children, 
  redactPHI = true, 
  defaultOpen = false 
}: PromptPlayProviderProps) {
  const [state, setState] = useState<PromptPlayState>({
    events: [],
    activeRunId: null,
    drawerOpen: defaultOpen,
    selectedContextRef: null,
    redactPHI
  });

  // State for full prompt overlay
  const [fullOpen, setFullOpen] = useState(false);
  const [lastRun, setLastRun] = useState<{
    resolvedPrompt?: string;
    meta?: { promptId?: string; type?: string; version?: string };
  }>({});

  const register = useCallback((event: Partial<PromptPlayEvent>): string => {
    const runId = generateRunId();
    const fullEvent: PromptPlayEvent = {
      promptId: '',
      type: 'unknown',
      ts: Date.now(),
      runId,
      ...event
    };

    setState(prev => ({
      ...prev,
      events: [...prev.events.slice(-19), fullEvent], // Keep last 20 events
      activeRunId: runId
    }));

    console.log('🎭 PromptPlay registered:', { runId, promptId: event.promptId, type: event.type });
    return runId;
  }, []);

  const complete = useCallback((runId: string, completion: Partial<PromptPlayEvent>) => {
    setState(prev => ({
      ...prev,
      events: prev.events.map(event => 
        event.runId === runId 
          ? { ...event, ...completion, ts: event.ts } // Preserve original timestamp
          : event
      )
    }));

    // Update last run for full prompt display
    if (completion.resolvedPrompt || completion.meta) {
      setLastRun(prev => ({
        resolvedPrompt: completion.resolvedPrompt ?? prev.resolvedPrompt,
        meta: completion.meta ?? prev.meta
      }));
    }

    console.log('🎭 PromptPlay completed:', { runId, hasOutput: !!completion.output });
  }, []);

  const openDrawer = useCallback((contextRef?: string) => {
    setState(prev => ({
      ...prev,
      drawerOpen: true,
      selectedContextRef: contextRef || prev.selectedContextRef
    }));
  }, []);

  const closeDrawer = useCallback(() => {
    setState(prev => ({
      ...prev,
      drawerOpen: false
    }));
  }, []);

  const toggleRedaction = useCallback(() => {
    setState(prev => ({
      ...prev,
      redactPHI: !prev.redactPHI
    }));
  }, []);

  const openFull = useCallback((resolved?: string, meta?: any) => {
    if (resolved || meta) {
      setLastRun(prev => ({
        resolvedPrompt: resolved ?? prev.resolvedPrompt,
        meta: meta ?? prev.meta
      }));
    }
    setFullOpen(true);
  }, []);

  const replay = useCallback(async (runId: string) => {
    const event = state.events.find(e => e.runId === runId);
    if (!event) return;

    console.log('🔄 Replaying prompt:', { runId, promptId: event.promptId });
    
    // Create new run with same parameters
    const newRunId = register({
      promptId: event.promptId,
      type: event.type,
      version: event.version,
      template: event.template,
      variables: event.variables,
      model: event.model,
      params: event.params,
      contextRef: event.contextRef
    });

    // Mock execution for demo (in real implementation, this would call the actual LLM)
    setTimeout(() => {
      complete(newRunId, {
        output: event.output, // For demo, return same output
        metrics: { 
          ...event.metrics,
          totalMs: Math.random() * 1000 + 500 // Simulated variation
        },
        resolvedPrompt: event.resolvedPrompt
      });
    }, 1000);
  }, [state.events, register, complete]);

  const getEventsForContext = useCallback((contextRef: string): PromptPlayEvent[] => {
    return state.events.filter(event => event.contextRef === contextRef);
  }, [state.events]);

  const contextValue: PromptPlayContextType = {
    state,
    register,
    complete,
    openDrawer,
    closeDrawer,
    toggleRedaction,
    replay,
    getEventsForContext,
    openFull
  };

  return (
    <PromptPlayContext.Provider value={contextValue}>
      {children}
      <FullPromptOverlay
        open={fullOpen}
        text={lastRun.resolvedPrompt || "No prompt available"}
        meta={lastRun.meta}
        onClose={() => setFullOpen(false)}
      />
    </PromptPlayContext.Provider>
  );
}

export function usePromptPlay(): PromptPlayContextType {
  const context = useContext(PromptPlayContext);
  if (!context) {
    throw new Error('usePromptPlay must be used within a PromptPlayProvider');
  }
  return context;
}