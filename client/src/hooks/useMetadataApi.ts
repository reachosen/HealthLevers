import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Types for v9.2 Metadata API
// ============================================================================

export interface Metric {
  metricId: string;
  specialty: string;
  metricName: string;
  domain: string | null;
  thresholdHours: string | null;
  contentVersion: string | null;
}

export interface SignalGroup {
  groupName: string;
  displayOrder: number;
  signals: SignalDef[];
}

export interface SignalDef {
  signalCode: string;
  signalName: string;
  signalGroup: string;
  dataType: string | null;
  prompt: string | null;
  signalType: string | null;
}

export interface Followup {
  followupName: string;
  followupType: string | null;
  dependsOn: string | null;
  followupText: string | null;
}

export interface DisplayItem {
  displayName: string;
  displayOrder: number;
  bindSignal: string | null;
  bindFollowup: string | null;
}

export interface Provenance {
  signalCode: string;
  sourceSystem: string | null;
  sourceTable: string | null;
  sourceField: string | null;
  sourceFieldPath: string | null;
  extractionMethod: string | null;
}

export interface Prompt {
  promptName: string;
  promptText: string;
  boundSignals: Array<{
    signalCode: string;
    signalName: string;
  }>;
}

export interface CompleteMetricConfig {
  metric: Metric;
  signalGroups: SignalGroup[];
  followups: Followup[];
  displayItems: DisplayItem[];
  provenance: Provenance[];
  prompts: Prompt[];
}

export interface MetricsResponse {
  metrics: Record<string, Metric[]>;
  totalCount: number;
}

export interface SpecialtiesResponse {
  specialties: string[];
}

export interface SearchResult {
  metricId: string;
  metricName: string;
  specialty: string;
  domain: string | null;
  matchType: 'name' | 'specialty' | 'domain';
}

export interface SearchResponse {
  results: SearchResult[];
  count: number;
  query: string;
}

// ============================================================================
// API Fetch Functions
// ============================================================================

const API_BASE = '/api/metadata';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function postJson<T>(url: string, data?: any): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const metadataApi = {
  getSpecialties: () =>
    fetchJson<SpecialtiesResponse>(`${API_BASE}/specialties`),

  getMetrics: (specialty?: string, domain?: string) => {
    const params = new URLSearchParams();
    if (specialty) params.append('specialty', specialty);
    if (domain) params.append('domain', domain);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchJson<MetricsResponse>(`${API_BASE}/metrics${query}`);
  },

  getMetric: (metricId: string) =>
    fetchJson<{ metric: Metric }>(`${API_BASE}/metrics/${metricId}`),

  getSignals: (metricId: string) =>
    fetchJson<{ metricId: string; signalGroups: SignalGroup[] }>(
      `${API_BASE}/signals/${metricId}`
    ),

  getFollowups: (metricId: string) =>
    fetchJson<{ metricId: string; followups: Followup[] }>(
      `${API_BASE}/followups/${metricId}`
    ),

  getDisplayPlan: (metricId: string) =>
    fetchJson<{ metricId: string; displayItems: DisplayItem[] }>(
      `${API_BASE}/display-plan/${metricId}`
    ),

  getProvenance: (metricId: string) =>
    fetchJson<{ metricId: string; provenance: Provenance[] }>(
      `${API_BASE}/provenance/${metricId}`
    ),

  getPrompts: (metricId: string) =>
    fetchJson<{ metricId: string; prompts: Prompt[] }>(
      `${API_BASE}/prompts/${metricId}`
    ),

  getComplete: (metricId: string) =>
    fetchJson<CompleteMetricConfig>(`${API_BASE}/complete/${metricId}`),

  search: (query: string, specialty?: string) => {
    const params = new URLSearchParams({ q: query });
    if (specialty) params.append('specialty', specialty);
    return fetchJson<SearchResponse>(`${API_BASE}/search?${params.toString()}`);
  },

  clearCache: () => postJson<{ message: string; clearedCount: number }>(
    `${API_BASE}/cache/clear`
  ),

  getCacheStats: () =>
    fetchJson<{ stats: any; cacheSize: number; uptime: number }>(
      `${API_BASE}/cache/stats`
    ),
};

// ============================================================================
// React Query Hooks
// ============================================================================

export function useSpecialties() {
  return useQuery({
    queryKey: ['metadata', 'specialties'],
    queryFn: metadataApi.getSpecialties,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useMetrics(specialty?: string, domain?: string) {
  return useQuery({
    queryKey: ['metadata', 'metrics', specialty, domain],
    queryFn: () => metadataApi.getMetrics(specialty, domain),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMetric(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'metric', metricId],
    queryFn: () => metadataApi.getMetric(metricId!),
    enabled: !!metricId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSignals(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'signals', metricId],
    queryFn: () => metadataApi.getSignals(metricId!),
    enabled: !!metricId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFollowups(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'followups', metricId],
    queryFn: () => metadataApi.getFollowups(metricId!),
    enabled: !!metricId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDisplayPlan(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'display-plan', metricId],
    queryFn: () => metadataApi.getDisplayPlan(metricId!),
    enabled: !!metricId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProvenance(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'provenance', metricId],
    queryFn: () => metadataApi.getProvenance(metricId!),
    enabled: !!metricId,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePrompts(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'prompts', metricId],
    queryFn: () => metadataApi.getPrompts(metricId!),
    enabled: !!metricId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompleteMetric(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'complete', metricId],
    queryFn: () => metadataApi.getComplete(metricId!),
    enabled: !!metricId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMetricSearch(query: string, specialty?: string) {
  return useQuery({
    queryKey: ['metadata', 'search', query, specialty],
    queryFn: () => metadataApi.search(query, specialty),
    enabled: query.length >= 2, // Only search when query is at least 2 characters
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useClearCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: metadataApi.clearCache,
    onSuccess: () => {
      // Invalidate all metadata queries when cache is cleared
      queryClient.invalidateQueries({ queryKey: ['metadata'] });
    },
  });
}

export function useCacheStats() {
  return useQuery({
    queryKey: ['metadata', 'cache-stats'],
    queryFn: metadataApi.getCacheStats,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}
