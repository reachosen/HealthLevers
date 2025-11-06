# Dynamic Metadata Implementation Examples

This document provides concrete code examples for implementing the dynamic metadata system described in METADATA_INTEGRATION_ANALYSIS.md.

---

## 1. Backend: Excel Parser Service

### A. Excel Parser (Node.js with xlsx)

**File:** `server/services/excelMetadataParser.ts`

```typescript
import * as XLSX from 'xlsx';
import { z } from 'zod';

// Zod schemas for validation
const MetricSchema = z.object({
  specialty: z.string(),
  specialty_id: z.string(),
  question_code: z.string(),
  metric_name: z.string(),
  priority: z.number(),
  threshold_hours: z.number().nullable(),
  definition_window: z.string(),
  active: z.boolean(),
  version: z.string(),
  domain: z.string(),
  metric_id: z.string(),
});

const SignalSchema = z.object({
  metric_id: z.string(),
  signal_code: z.string(),
  group_id: z.string(),
  trigger_expr: z.string(),
  severity: z.enum(['info', 'warn', 'error']),
});

const GroupSchema = z.object({
  metric_id: z.string(),
  group_id: z.string(),
  group_name: z.string(),
  display_order: z.number(),
  group_code: z.string(),
});

const FollowupSchema = z.object({
  metric_id: z.string(),
  followup_id: z.string(),
  when_cond: z.string(),
  question_text: z.string(),
  response_type: z.enum(['single-select', 'text', 'timestamp+text']),
});

const DisplayPlanSchema = z.object({
  metric_id: z.string(),
  display_tier: z.enum(['primary', 'secondary']),
  field_name: z.string(),
  order_in_tier: z.number(),
  visibility_cond: z.string().nullable(),
  field_label: z.string(),
});

const PromptSchema = z.object({
  metric_id: z.string(),
  prompt_type: z.enum(['intake', 'abstractor']),
  prompt_text: z.string(),
  prompt_version: z.number(),
  prompt_role: z.string(),
  prompt_notes: z.string().nullable(),
  last_changed_at: z.string(),
});

const ProvenanceRuleSchema = z.object({
  metric_id: z.string(),
  field_name: z.string(),
  source_table: z.string(),
  key_field: z.string(),
  require_author: z.boolean(),
  require_taken_instant: z.boolean(),
});

const VersionSchema = z.object({
  metric_id: z.string(),
  bundle_version: z.string(),
  schema_version: z.string(),
  prompts_version: z.string(),
  notes: z.string().nullable(),
  content_version: z.string(),
});

export type Metric = z.infer<typeof MetricSchema>;
export type Signal = z.infer<typeof SignalSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type Followup = z.infer<typeof FollowupSchema>;
export type DisplayPlan = z.infer<typeof DisplayPlanSchema>;
export type Prompt = z.infer<typeof PromptSchema>;
export type ProvenanceRule = z.infer<typeof ProvenanceRuleSchema>;
export type Version = z.infer<typeof VersionSchema>;

export interface MetadataBundle {
  metrics: Metric[];
  groups: Group[];
  signals: Signal[];
  followups: Followup[];
  displayPlan: DisplayPlan[];
  prompts: Prompt[];
  provenanceRules: ProvenanceRule[];
  versions: Version[];
  parsedAt: string;
  fileHash: string;
}

export class ExcelMetadataParser {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Parse Excel file and return validated metadata bundle
   */
  async parse(): Promise<MetadataBundle> {
    console.log(`📊 Parsing Excel metadata from: ${this.filePath}`);

    // Read workbook
    const workbook = XLSX.readFile(this.filePath);

    // Parse each sheet
    const metrics = this.parseSheet(workbook, 'metrics', MetricSchema);
    const groups = this.parseSheet(workbook, 'groups', GroupSchema);
    const signals = this.parseSheet(workbook, 'signals', SignalSchema);
    const followups = this.parseSheet(workbook, 'followups', FollowupSchema);
    const displayPlan = this.parseSheet(workbook, 'display_plan', DisplayPlanSchema);
    const prompts = this.parseSheet(workbook, 'prompts', PromptSchema);
    const provenanceRules = this.parseSheet(workbook, 'provenance_rules', ProvenanceRuleSchema);
    const versions = this.parseSheet(workbook, 'versions', VersionSchema);

    // Validate relationships
    this.validateRelationships(metrics, groups, signals, followups);

    // Compute file hash for cache invalidation
    const fileHash = await this.computeFileHash();

    const bundle: MetadataBundle = {
      metrics,
      groups,
      signals,
      followups,
      displayPlan,
      prompts,
      provenanceRules,
      versions,
      parsedAt: new Date().toISOString(),
      fileHash,
    };

    console.log(`✅ Successfully parsed metadata: ${metrics.length} metrics, ${signals.length} signals`);
    return bundle;
  }

  /**
   * Parse a single sheet with validation
   */
  private parseSheet<T>(workbook: XLSX.WorkBook, sheetName: string, schema: z.ZodSchema<T>): T[] {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in workbook`);
    }

    // Convert to JSON
    const raw = XLSX.utils.sheet_to_json(sheet);

    // Validate each row
    const validated: T[] = [];
    for (let i = 0; i < raw.length; i++) {
      try {
        const parsed = schema.parse(raw[i]);
        validated.push(parsed);
      } catch (error) {
        console.error(`❌ Validation error in ${sheetName}, row ${i + 2}:`, error);
        throw new Error(`Invalid data in ${sheetName} at row ${i + 2}`);
      }
    }

    return validated;
  }

  /**
   * Validate relationships between sheets
   */
  private validateRelationships(
    metrics: Metric[],
    groups: Group[],
    signals: Signal[],
    followups: Followup[]
  ): void {
    const metricIds = new Set(metrics.map(m => m.metric_id));

    // Validate groups reference valid metrics
    for (const group of groups) {
      if (!metricIds.has(group.metric_id)) {
        throw new Error(`Group "${group.group_id}" references unknown metric "${group.metric_id}"`);
      }
    }

    // Validate signals reference valid metrics and groups
    const groupIds = new Set(groups.map(g => g.group_id));
    for (const signal of signals) {
      if (!metricIds.has(signal.metric_id)) {
        throw new Error(`Signal "${signal.signal_code}" references unknown metric "${signal.metric_id}"`);
      }
      if (!groupIds.has(signal.group_id)) {
        throw new Error(`Signal "${signal.signal_code}" references unknown group "${signal.group_id}"`);
      }
    }

    // Validate followups reference valid metrics
    for (const followup of followups) {
      if (!metricIds.has(followup.metric_id)) {
        throw new Error(`Followup "${followup.followup_id}" references unknown metric "${followup.metric_id}"`);
      }
    }

    console.log('✅ All relationships validated successfully');
  }

  /**
   * Compute file hash for cache invalidation
   */
  private async computeFileHash(): Promise<string> {
    const crypto = await import('crypto');
    const fs = await import('fs');
    const buffer = fs.readFileSync(this.filePath);
    return crypto.createHash('md5').update(buffer).digest('hex');
  }
}
```

### B. Metadata API Routes

**File:** `server/routes/metadata.ts`

```typescript
import { Router } from 'express';
import { MetadataService } from '../services/metadataService';

const router = Router();
const metadataService = new MetadataService('/home/user/HealthLevers/USNWR_Master_AllMetrics_v4.xlsx');

/**
 * GET /api/metadata/metrics
 * Returns all metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const bundle = await metadataService.getMetadata();
    res.json({
      data: bundle.metrics,
      parsedAt: bundle.parsedAt,
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * GET /api/metadata/metrics/:metric_id
 * Returns a specific metric with all related data
 */
router.get('/metrics/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;
    const bundle = await metadataService.getMetadata();

    const metric = bundle.metrics.find(m => m.metric_id === metric_id);
    if (!metric) {
      return res.status(404).json({ error: 'Metric not found' });
    }

    const groups = bundle.groups.filter(g => g.metric_id === metric_id);
    const signals = bundle.signals.filter(s => s.metric_id === metric_id);
    const followups = bundle.followups.filter(f => f.metric_id === metric_id);
    const displayPlan = bundle.displayPlan.filter(d => d.metric_id === metric_id);
    const prompts = bundle.prompts.filter(p => p.metric_id === metric_id);

    res.json({
      metric,
      groups,
      signals,
      followups,
      displayPlan,
      prompts,
    });
  } catch (error) {
    console.error('Error fetching metric:', error);
    res.status(500).json({ error: 'Failed to fetch metric' });
  }
});

/**
 * GET /api/metadata/signals/:metric_id
 * Returns signals for a specific metric, grouped by category
 */
router.get('/signals/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;
    const bundle = await metadataService.getMetadata();

    const signals = bundle.signals.filter(s => s.metric_id === metric_id);
    const groups = bundle.groups.filter(g => g.metric_id === metric_id);

    // Group signals by group_id
    const signalsByGroup = groups.map(group => ({
      group_id: group.group_id,
      group_name: group.group_name,
      display_order: group.display_order,
      signals: signals.filter(s => s.group_id === group.group_id),
    })).sort((a, b) => a.display_order - b.display_order);

    res.json({
      metric_id,
      groups: signalsByGroup,
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

/**
 * GET /api/metadata/prompts/:metric_id/:prompt_type
 * Returns a specific prompt for a metric
 */
router.get('/prompts/:metric_id/:prompt_type', async (req, res) => {
  try {
    const { metric_id, prompt_type } = req.params;
    const bundle = await metadataService.getMetadata();

    const prompt = bundle.prompts.find(
      p => p.metric_id === metric_id && p.prompt_type === prompt_type
    );

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json(prompt);
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

/**
 * GET /api/metadata/versions
 * Returns version information
 */
router.get('/versions', async (req, res) => {
  try {
    const bundle = await metadataService.getMetadata();
    res.json({
      versions: bundle.versions,
      fileHash: bundle.fileHash,
      parsedAt: bundle.parsedAt,
    });
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

/**
 * POST /api/metadata/refresh
 * Force refresh metadata cache
 */
router.post('/refresh', async (req, res) => {
  try {
    await metadataService.refreshCache();
    res.json({ success: true, message: 'Metadata cache refreshed' });
  } catch (error) {
    console.error('Error refreshing metadata:', error);
    res.status(500).json({ error: 'Failed to refresh metadata' });
  }
});

export default router;
```

### C. Metadata Service with Caching

**File:** `server/services/metadataService.ts`

```typescript
import NodeCache from 'node-cache';
import { ExcelMetadataParser, MetadataBundle } from './excelMetadataParser';

export class MetadataService {
  private cache: NodeCache;
  private parser: ExcelMetadataParser;
  private cacheKey = 'metadata_bundle';

  constructor(excelFilePath: string) {
    this.parser = new ExcelMetadataParser(excelFilePath);
    // Cache for 24 hours
    this.cache = new NodeCache({ stdTTL: 60 * 60 * 24 });
  }

  /**
   * Get metadata, using cache if available
   */
  async getMetadata(): Promise<MetadataBundle> {
    // Check cache
    const cached = this.cache.get<MetadataBundle>(this.cacheKey);
    if (cached) {
      console.log('✅ Returning cached metadata');
      return cached;
    }

    // Parse fresh
    console.log('🔄 Cache miss, parsing Excel file...');
    const bundle = await this.parser.parse();

    // Store in cache
    this.cache.set(this.cacheKey, bundle);

    return bundle;
  }

  /**
   * Force refresh cache
   */
  async refreshCache(): Promise<MetadataBundle> {
    console.log('🔄 Force refreshing metadata cache...');
    this.cache.del(this.cacheKey);
    return this.getMetadata();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}
```

---

## 2. Frontend: Metadata Hooks

### A. Metadata Query Hook

**File:** `client/src/hooks/useMetadata.ts`

```typescript
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface Metric {
  specialty: string;
  specialty_id: string;
  question_code: string;
  metric_name: string;
  priority: number;
  threshold_hours: number | null;
  definition_window: string;
  active: boolean;
  version: string;
  domain: string;
  metric_id: string;
}

export interface Signal {
  metric_id: string;
  signal_code: string;
  group_id: string;
  trigger_expr: string;
  severity: 'info' | 'warn' | 'error';
}

export interface Group {
  metric_id: string;
  group_id: string;
  group_name: string;
  display_order: number;
  group_code: string;
}

export interface MetricDetail {
  metric: Metric;
  groups: Group[];
  signals: Signal[];
  followups: Followup[];
  displayPlan: DisplayPlan[];
  prompts: Prompt[];
}

export interface Followup {
  metric_id: string;
  followup_id: string;
  when_cond: string;
  question_text: string;
  response_type: 'single-select' | 'text' | 'timestamp+text';
}

export interface DisplayPlan {
  metric_id: string;
  display_tier: 'primary' | 'secondary';
  field_name: string;
  order_in_tier: number;
  visibility_cond: string | null;
  field_label: string;
}

export interface Prompt {
  metric_id: string;
  prompt_type: 'intake' | 'abstractor';
  prompt_text: string;
  prompt_version: number;
  prompt_role: string;
  prompt_notes: string | null;
  last_changed_at: string;
}

/**
 * Fetch all metrics
 */
export function useMetrics(): UseQueryResult<Metric[]> {
  return useQuery({
    queryKey: ['metadata', 'metrics'],
    queryFn: async () => {
      const response = await apiRequest<{ data: Metric[] }>('/api/metadata/metrics');
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Fetch detailed information for a specific metric
 */
export function useMetricDetail(metricId: string | null): UseQueryResult<MetricDetail> {
  return useQuery({
    queryKey: ['metadata', 'metric', metricId],
    queryFn: async () => {
      if (!metricId) throw new Error('Metric ID is required');
      return apiRequest<MetricDetail>(`/api/metadata/metrics/${metricId}`);
    },
    enabled: !!metricId,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Fetch signals for a specific metric, grouped by category
 */
export function useSignalsForMetric(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'signals', metricId],
    queryFn: async () => {
      if (!metricId) throw new Error('Metric ID is required');
      return apiRequest<{
        metric_id: string;
        groups: Array<{
          group_id: string;
          group_name: string;
          display_order: number;
          signals: Signal[];
        }>;
      }>(`/api/metadata/signals/${metricId}`);
    },
    enabled: !!metricId,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Get unique list of specialties from metrics
 */
export function useSpecialties(): UseQueryResult<string[]> {
  const { data: metrics, ...rest } = useMetrics();

  return {
    data: metrics ? [...new Set(metrics.map(m => m.specialty))].sort() : undefined,
    ...rest,
  } as UseQueryResult<string[]>;
}

/**
 * Get metrics for a specific specialty
 */
export function useMetricsForSpecialty(specialty: string | null) {
  const { data: metrics, ...rest } = useMetrics();

  return {
    data: metrics?.filter(m => m.specialty === specialty).sort((a, b) => a.priority - b.priority),
    ...rest,
  } as UseQueryResult<Metric[]>;
}
```

---

## 3. Dynamic UI Components

### A. Dynamic Specialty Selector

**File:** `client/src/components/DynamicSpecialtySelector.tsx`

```typescript
import React from 'react';
import { useSpecialties } from '@/hooks/useMetadata';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface DynamicSpecialtySelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function DynamicSpecialtySelector({ value, onChange }: DynamicSpecialtySelectorProps) {
  const { data: specialties, isLoading } = useSpecialties();

  if (isLoading) {
    return <Skeleton className="w-48 h-10" />;
  }

  if (!specialties || specialties.length === 0) {
    return <div className="text-sm text-red-600">No specialties available</div>;
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select specialty" />
      </SelectTrigger>
      <SelectContent>
        {specialties.map(specialty => (
          <SelectItem key={specialty} value={specialty}>
            {specialty}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### B. Dynamic Module Selector

**File:** `client/src/components/DynamicModuleSelector.tsx`

```typescript
import React from 'react';
import { useMetricsForSpecialty } from '@/hooks/useMetadata';
import ChipButton from '@/components/ui/ChipButton';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface DynamicModuleSelectorProps {
  specialty: string;
  selectedMetricId: string | null;
  onSelect: (metricId: string) => void;
}

export function DynamicModuleSelector({
  specialty,
  selectedMetricId,
  onSelect
}: DynamicModuleSelectorProps) {
  const { data: metrics, isLoading } = useMetricsForSpecialty(specialty);

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="w-32 h-10" />
        ))}
      </div>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No metrics available for {specialty}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {metrics.map(metric => (
        <ChipButton
          key={metric.metric_id}
          variant={selectedMetricId === metric.metric_id ? 'primary' : 'secondary'}
          onClick={() => onSelect(metric.metric_id)}
          className="relative"
        >
          {metric.metric_name}

          {metric.threshold_hours && (
            <span className="ml-2 text-xs opacity-70">
              ≤{metric.threshold_hours}h
            </span>
          )}

          {!metric.active && (
            <Badge variant="destructive" className="ml-2 text-xs">
              Inactive
            </Badge>
          )}
        </ChipButton>
      ))}
    </div>
  );
}
```

### C. Dynamic Signal Groups Display

**File:** `client/src/components/DynamicSignalGroups.tsx`

```typescript
import React, { useState } from 'react';
import { useSignalsForMetric } from '@/hooks/useMetadata';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface DynamicSignalGroupsProps {
  metricId: string;
  onSignalClick?: (signalCode: string, triggerExpr: string) => void;
}

export function DynamicSignalGroups({ metricId, onSignalClick }: DynamicSignalGroupsProps) {
  const { data, isLoading } = useSignalsForMetric(metricId);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['core', 'delay_drivers']) // Auto-expand first 2 groups
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="w-full h-20" />
        ))}
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-slate-500">No signals available</div>;
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'bg-red-100 text-red-800 border-red-300';
      case 'warn': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-3">
      {data.groups.map(group => {
        const isExpanded = expandedGroups.has(group.group_id);

        return (
          <div key={group.group_id} className="border rounded-lg overflow-hidden">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.group_id)}
              className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                )}
                <span className="font-medium text-slate-800">{group.group_name}</span>
                <Badge variant="secondary" className="text-xs">
                  {group.signals.length}
                </Badge>
              </div>
            </button>

            {/* Group Signals */}
            {isExpanded && (
              <div className="p-4 space-y-2 bg-white">
                {group.signals.map(signal => (
                  <div
                    key={signal.signal_code}
                    onClick={() => onSignalClick?.(signal.signal_code, signal.trigger_expr)}
                    className={`
                      px-3 py-2 rounded-md border cursor-pointer
                      transition hover:shadow-sm
                      ${getSeverityColor(signal.severity)}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{signal.signal_code}</span>
                      <Badge variant="outline" className="text-xs">
                        {signal.severity}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs font-mono text-slate-600">
                      {signal.trigger_expr}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

---

## 4. Expression Evaluator

**File:** `shared/expressionEvaluator.ts`

```typescript
import { Parser } from 'expr-eval';

export type ExpressionContext = Record<string, any>;

export class ExpressionEvaluator {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  /**
   * Evaluate a trigger expression
   * Example: "end_time - start_time < threshold"
   */
  evaluate(expr: string, context: ExpressionContext): boolean {
    try {
      // Handle special cases
      if (expr.includes('is null')) {
        return this.evaluateNullCheck(expr, context);
      }

      // Parse and evaluate
      const result = this.parser.evaluate(expr, context);
      return Boolean(result);
    } catch (error) {
      console.error('Expression evaluation error:', expr, error);
      return false;
    }
  }

  /**
   * Handle "is null" checks
   */
  private evaluateNullCheck(expr: string, context: ExpressionContext): boolean {
    const match = expr.match(/(\w+)\s+is\s+null/);
    if (!match) return false;

    const fieldName = match[1];
    return context[fieldName] === null || context[fieldName] === undefined;
  }

  /**
   * Evaluate conditional followup expression
   * Example: "imaging_delay OR extra_imaging"
   */
  evaluateCondition(cond: string, context: ExpressionContext): boolean {
    try {
      // Replace logical operators
      const normalized = cond
        .replace(/\bOR\b/gi, '||')
        .replace(/\bAND\b/gi, '&&')
        .replace(/\bNOT\b/gi, '!');

      return this.parser.evaluate(normalized, context);
    } catch (error) {
      console.error('Condition evaluation error:', cond, error);
      return false;
    }
  }

  /**
   * Test if expression is valid
   */
  isValid(expr: string): boolean {
    try {
      this.parser.parse(expr);
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const expressionEvaluator = new ExpressionEvaluator();
```

**Usage Example:**

```typescript
import { expressionEvaluator } from '@/lib/expressionEvaluator';

// Evaluate signal trigger
const context = {
  start_time: 1.5,
  end_time: 18.2,
  threshold: 18.0,
};

const isWithinThreshold = expressionEvaluator.evaluate(
  'end_time - start_time < threshold',
  context
); // true

// Evaluate conditional followup
const signalState = {
  imaging_delay: true,
  extra_imaging: false,
};

const shouldShowFollowup = expressionEvaluator.evaluateCondition(
  'imaging_delay OR extra_imaging',
  signalState
); // true
```

---

## 5. Updated Intake Page

**File:** `client/src/pages/intake.tsx` (Simplified example)

```typescript
import React, { useState } from 'react';
import { DynamicSpecialtySelector } from '@/components/DynamicSpecialtySelector';
import { DynamicModuleSelector } from '@/components/DynamicModuleSelector';
import { DynamicSignalGroups } from '@/components/DynamicSignalGroups';
import { useMetricDetail } from '@/hooks/useMetadata';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export default function DynamicIntakePage() {
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('Ortho');
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [patientJson, setPatientJson] = useState<string>('');

  const { data: metricDetail } = useMetricDetail(selectedMetricId);

  const handleProcessCase = async () => {
    if (!selectedMetricId || !patientJson) return;

    // Process case with AI using the dynamic prompt from metricDetail
    const prompt = metricDetail?.prompts.find(p => p.prompt_type === 'intake');

    // Call API to process case...
    console.log('Processing with prompt:', prompt?.prompt_text);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Specialty Selection */}
        <section className="bg-white rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-3">1. Select Specialty</h2>
          <DynamicSpecialtySelector
            value={selectedSpecialty}
            onChange={setSelectedSpecialty}
          />
        </section>

        {/* Module Selection */}
        <section className="bg-white rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-3">2. Select Quality Metric</h2>
          <DynamicModuleSelector
            specialty={selectedSpecialty}
            selectedMetricId={selectedMetricId}
            onSelect={setSelectedMetricId}
          />
        </section>

        {/* Patient Data Input */}
        {selectedMetricId && (
          <section className="bg-white rounded-lg border p-4">
            <h2 className="text-lg font-semibold mb-3">3. Enter Patient Data</h2>
            <Textarea
              value={patientJson}
              onChange={(e) => setPatientJson(e.target.value)}
              placeholder="Paste patient JSON data..."
              rows={10}
              className="font-mono text-sm"
            />
            <Button onClick={handleProcessCase} className="mt-3">
              Process Case
            </Button>
          </section>
        )}

        {/* Signal Groups */}
        {selectedMetricId && (
          <section className="bg-white rounded-lg border p-4">
            <h2 className="text-lg font-semibold mb-3">4. Review Signals</h2>
            <DynamicSignalGroups
              metricId={selectedMetricId}
              onSignalClick={(code, expr) => {
                console.log('Signal clicked:', code, expr);
              }}
            />
          </section>
        )}
      </div>
    </div>
  );
}
```

---

## 6. Testing Examples

### A. Expression Evaluator Tests

**File:** `tests/expressionEvaluator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { ExpressionEvaluator } from '../shared/expressionEvaluator';

describe('ExpressionEvaluator', () => {
  const evaluator = new ExpressionEvaluator();

  describe('evaluate()', () => {
    it('should evaluate simple comparison', () => {
      const result = evaluator.evaluate('end_time - start_time < threshold', {
        start_time: 2,
        end_time: 20,
        threshold: 19,
      });
      expect(result).toBe(true);
    });

    it('should evaluate borderline case', () => {
      const result = evaluator.evaluate('abs(end_time - start_time - threshold) <= 0.5', {
        start_time: 2,
        end_time: 18.7,
        threshold: 19,
      });
      expect(result).toBe(true);
    });

    it('should handle null checks', () => {
      const result = evaluator.evaluate('start_time is null', {
        start_time: null,
      });
      expect(result).toBe(true);
    });
  });

  describe('evaluateCondition()', () => {
    it('should evaluate OR condition', () => {
      const result = evaluator.evaluateCondition('imaging_delay OR extra_imaging', {
        imaging_delay: true,
        extra_imaging: false,
      });
      expect(result).toBe(true);
    });

    it('should evaluate AND condition', () => {
      const result = evaluator.evaluateCondition('imaging_delay AND extra_imaging', {
        imaging_delay: true,
        extra_imaging: false,
      });
      expect(result).toBe(false);
    });
  });

  describe('isValid()', () => {
    it('should validate correct expression', () => {
      expect(evaluator.isValid('a + b < c')).toBe(true);
    });

    it('should reject invalid expression', () => {
      expect(evaluator.isValid('a + + b')).toBe(false);
    });
  });
});
```

---

## 7. Migration Guide

### A. Migrating from Hardcoded to Dynamic

**Before:**
```typescript
import { SPECIALTY_METADATA, getModulesForSpecialty } from '@/data/specialtyMetadata';

const modules = getModulesForSpecialty('Orthopedics');
```

**After:**
```typescript
import { useMetricsForSpecialty } from '@/hooks/useMetadata';

const { data: metrics } = useMetricsForSpecialty('Ortho');
```

### B. LocalStorage Migration Script

**File:** `client/src/utils/migrateLocalStorage.ts`

```typescript
/**
 * Migrate old localStorage data to new format
 */
export function migrateAbstractionCases() {
  const key = 'abstraction.cases';
  const raw = localStorage.getItem(key);

  if (!raw) return;

  try {
    const cases = JSON.parse(raw);

    // Map old module IDs to new metric IDs
    const moduleIdMap: Record<string, string> = {
      'timeliness_sch': 'ORTHO_I25',
      'timeliness_urgent': 'ORTHO_I26',
      'ssi_assessment': 'ORTHO_I33',
      // ... add more mappings
    };

    const migrated = cases.map((c: any) => ({
      ...c,
      selectedMetricId: moduleIdMap[c.selectedModuleId] || c.selectedModuleId,
    }));

    localStorage.setItem(key, JSON.stringify(migrated));
    console.log('✅ Migrated', cases.length, 'cases to new format');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}
```

---

## Summary

These implementation examples provide:

1. ✅ **Complete backend infrastructure** for parsing Excel and serving metadata via REST API
2. ✅ **Frontend hooks** for fetching and caching metadata with React Query
3. ✅ **Dynamic UI components** that render based on metadata
4. ✅ **Expression evaluator** for trigger logic and conditional followups
5. ✅ **Updated Intake page** using all dynamic components
6. ✅ **Testing examples** for expression evaluation
7. ✅ **Migration guide** for transitioning from hardcoded to dynamic

Next step: Start implementing Phase 1 (Foundation) from the roadmap!
