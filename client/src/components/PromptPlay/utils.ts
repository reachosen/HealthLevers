// PHI Redaction and Utility Functions
import type { PromptPlayEvent } from './types';

const PHI_PATTERNS = [
  /\b\d{6,}\b/g, // MRN-like numbers
  /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/g, // Names like "John Smith"  
  /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, // Dates
  /\b\d{4}-\d{2}-\d{2}\b/g, // ISO dates
];

export function redactPHI(text: string, enabled: boolean = true): string {
  if (!enabled || typeof text !== 'string') return text;
  
  let redacted = text;
  PHI_PATTERNS.forEach(pattern => {
    redacted = redacted.replace(pattern, '[REDACTED]');
  });
  
  return redacted;
}

export function redactObject(obj: any, enabled: boolean = true): any {
  if (!enabled) return obj;
  if (typeof obj === 'string') return redactPHI(obj, enabled);
  if (Array.isArray(obj)) return obj.map(item => redactObject(item, enabled));
  if (obj && typeof obj === 'object') {
    const redacted: any = {};
    Object.keys(obj).forEach(key => {
      redacted[key] = redactObject(obj[key], enabled);
    });
    return redacted;
  }
  return obj;
}

export function highlightVariables(template: string, variables: Record<string, any> = {}): string {
  let highlighted = template;
  Object.keys(variables).forEach(varName => {
    const pattern = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    highlighted = highlighted.replace(pattern, `<mark data-var="${varName}">{{${varName}}}</mark>`);
  });
  return highlighted;
}

export function resolveTemplate(template: string, variables: Record<string, any> = {}): string {
  let resolved = template;
  Object.keys(variables).forEach(varName => {
    const pattern = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
    const value = JSON.stringify(variables[varName]);
    resolved = resolved.replace(pattern, value);
  });
  return resolved;
}

export function generateRunId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export function formatMetrics(metrics?: PromptPlayEvent['metrics']): string {
  if (!metrics) return 'No metrics';
  const parts = [];
  if (metrics.totalMs) parts.push(`${metrics.totalMs}ms`);
  if (metrics.tokensIn) parts.push(`${metrics.tokensIn} in`);
  if (metrics.tokensOut) parts.push(`${metrics.tokensOut} out`);
  return parts.join(' • ') || 'No metrics';
}