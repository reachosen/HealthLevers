// Client-side prompt routing hook
import { useCallback, useMemo } from 'react';

interface PromptRoutingConfig {
  specialty: string;
  module: string;
  type: 'abstraction_help' | 'signal_processing' | 'default';
}

interface UsePromptRoutingReturn {
  buildPromptKey: (config: PromptRoutingConfig) => string;
  getOptimalPrompt: (config: PromptRoutingConfig) => Promise<any>;
  validateEvidenceScope: (cites: string[], allowedPaths: string[]) => boolean;
}

export function usePromptRouting(): UsePromptRoutingReturn {
  const buildPromptKey = useCallback((config: PromptRoutingConfig): string => {
    return `${config.specialty}:${config.module}:${config.type}`;
  }, []);

  const getOptimalPrompt = useCallback(async (config: PromptRoutingConfig) => {
    const promptKey = buildPromptKey(config);
    
    // Try primary prompt key first
    try {
      const response = await fetch(`/api/prompts/routed?key=${encodeURIComponent(promptKey)}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Primary prompt failed, trying fallbacks');
    }

    // Fallback chain
    const fallbacks = [
      `${config.specialty}:${config.module}:default`,
      `${config.specialty}:default:default`,
      'global:default:default'
    ];

    for (const fallbackKey of fallbacks) {
      try {
        const response = await fetch(`/api/prompts/routed?key=${encodeURIComponent(fallbackKey)}`);
        if (response.ok) {
          const result = await response.json();
          console.log(`Used fallback prompt: ${fallbackKey}`);
          return result;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('No suitable prompt found in routing chain');
  }, [buildPromptKey]);

  const validateEvidenceScope = useCallback((cites: string[], allowedPaths: string[]): boolean => {
    const patterns = allowedPaths.map(pattern => 
      new RegExp(pattern.replace(/\[\*\]/g, '\\[\\d+\\]').replace(/\./g, '\\.'))
    );
    
    return cites.every(cite => 
      patterns.some(pattern => pattern.test(cite))
    );
  }, []);

  return {
    buildPromptKey,
    getOptimalPrompt, 
    validateEvidenceScope
  };
}

// Preset configurations for common routing scenarios
export const ROUTING_PRESETS = {
  SCH_ABSTRACTION: {
    specialty: 'Orthopedics',
    module: 'Timeliness – SCH',
    type: 'abstraction_help' as const
  },
  SCH_SIGNAL_PROCESSING: {
    specialty: 'Orthopedics', 
    module: 'Timeliness – SCH',
    type: 'signal_processing' as const
  },
  SSI_ABSTRACTION: {
    specialty: 'Orthopedics',
    module: 'Surgical Site Infection (SSI)', 
    type: 'abstraction_help' as const
  },
  RTO_ABSTRACTION: {
    specialty: 'Orthopedics',
    module: 'Return to OR (Unplanned)',
    type: 'abstraction_help' as const
  }
};