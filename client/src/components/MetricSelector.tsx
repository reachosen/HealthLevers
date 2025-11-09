import React, { useState, useMemo } from 'react';
import { useSpecialties, useMetrics, useCompleteMetric, type Metric } from '@/hooks/useMetadataApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatMetricDisplay, formatMetricSubtitle } from '@/lib/metricDisplay';

export interface MetricSelectorProps {
  onMetricSelect?: (metricId: string, config: any) => void;
  selectedMetricId?: string;
  showCompleteConfig?: boolean;
}

/**
 * Dynamic Metric Selector Component
 *
 * Replaces hardcoded USNWR_MATRIX with dynamic metadata from v9.2 API
 *
 * Features:
 * - Loads specialties and metrics from metadata API
 * - Filter by specialty and domain
 * - Search metrics by name
 * - Lazy-load complete metric configuration on selection
 * - Display metric details (threshold, domain, version)
 */
export function MetricSelector({
  onMetricSelect,
  selectedMetricId,
  showCompleteConfig = false,
}: MetricSelectorProps) {
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data from metadata API
  const { data: specialtiesData, isLoading: loadingSpecialties } = useSpecialties();
  const { data: metricsData, isLoading: loadingMetrics } = useMetrics(
    selectedSpecialty === 'all' ? undefined : selectedSpecialty,
    selectedDomain === 'all' ? undefined : selectedDomain
  );

  // Load complete configuration when a metric is selected
  const { data: completeConfig, isLoading: loadingComplete } = useCompleteMetric(
    showCompleteConfig ? selectedMetricId || null : null
  );

  // Extract unique domains from loaded metrics
  const domains = useMemo(() => {
    if (!metricsData?.metrics) return [];
    const allMetrics = Object.values(metricsData.metrics).flat();
    const uniqueDomains = Array.from(
      new Set(allMetrics.map((m) => m.domain).filter(Boolean))
    ) as string[];
    return uniqueDomains.sort();
  }, [metricsData]);

  // Filter metrics by search query
  const filteredMetrics = useMemo(() => {
    if (!metricsData?.metrics) return [];

    let allMetrics = Object.values(metricsData.metrics).flat();

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      allMetrics = allMetrics.filter(
        (m) =>
          m.metricName.toLowerCase().includes(query) ||
          m.metricId.toLowerCase().includes(query) ||
          m.specialty.toLowerCase().includes(query) ||
          m.questionCode?.toLowerCase().includes(query) ||
          m.domain?.toLowerCase().includes(query)
      );
    }

    return allMetrics;
  }, [metricsData, searchQuery]);

  // Group filtered metrics by specialty
  const groupedMetrics = useMemo(() => {
    const groups: Record<string, Metric[]> = {};
    filteredMetrics.forEach((metric) => {
      if (!groups[metric.specialty]) {
        groups[metric.specialty] = [];
      }
      groups[metric.specialty].push(metric);
    });
    return groups;
  }, [filteredMetrics]);

  const handleMetricClick = (metricId: string) => {
    if (onMetricSelect) {
      // If showing complete config, wait for it to load
      if (showCompleteConfig) {
        // Config will be loaded by useCompleteMetric hook
        onMetricSelect(metricId, null);
      } else {
        onMetricSelect(metricId, null);
      }
    }
  };

  if (loadingSpecialties) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading specialties...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Quality Metric</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose a metric to configure for your abstraction workflow
        </p>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="space-y-4 mb-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search metrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Specialty and Domain Filters */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Specialty</label>
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
              >
                <option value="all">All Specialties</option>
                {specialtiesData?.specialties.map((specialty) => (
                  <option key={specialty} value={specialty}>
                    {specialty}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Domain</label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                disabled={domains.length === 0}
              >
                <option value="all">All Domains</option>
                {domains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-muted-foreground">
          {loadingMetrics ? (
            <span className="flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading metrics...
            </span>
          ) : (
            <span>
              Found {filteredMetrics.length} metric{filteredMetrics.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Metrics List */}
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            {Object.keys(groupedMetrics).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No metrics found matching your criteria</p>
              </div>
            ) : (
              Object.entries(groupedMetrics).map(([specialty, metrics]) => (
                <div key={specialty}>
                  <h3 className="font-semibold text-lg mb-3">{specialty}</h3>
                  <div className="space-y-2">
                    {metrics.map((metric) => (
                      <MetricCard
                        key={metric.metricId}
                        metric={metric}
                        isSelected={selectedMetricId === metric.metricId}
                        onClick={() => handleMetricClick(metric.metricId)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Complete Configuration Display */}
        {showCompleteConfig && selectedMetricId && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold text-lg mb-3">Configuration Details</h3>
            {loadingComplete ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2">Loading configuration...</span>
              </div>
            ) : completeConfig ? (
              <MetricConfigDisplay config={completeConfig} />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface MetricCardProps {
  metric: Metric;
  isSelected: boolean;
  onClick: () => void;
}

function MetricCard({ metric, isSelected, onClick }: MetricCardProps) {
  const displayName = formatMetricDisplay(metric);
  const subtitle = formatMetricSubtitle(metric);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border transition-all ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/50 hover:bg-accent'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{displayName}</h4>
            {isSelected && (
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            {metric.specialtyId && (
              <Badge variant="secondary" className="text-xs">
                {metric.specialtyId}
              </Badge>
            )}
            {metric.priority && (
              <Badge variant="outline" className="text-xs">
                Priority {metric.priority}
              </Badge>
            )}
            {metric.active === false && (
              <Badge variant="destructive" className="text-xs">
                Inactive
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

interface MetricConfigDisplayProps {
  config: any;
}

function MetricConfigDisplay({ config }: MetricConfigDisplayProps) {
  return (
    <Tabs defaultValue="signals" className="w-full">
      <TabsList>
        <TabsTrigger value="signals">
          Signals ({config.signalGroups?.reduce((sum: number, g: any) => sum + g.signals.length, 0) || 0})
        </TabsTrigger>
        <TabsTrigger value="followups">
          Followups ({config.followups?.length || 0})
        </TabsTrigger>
        <TabsTrigger value="display">
          Display ({config.displayItems?.length || 0})
        </TabsTrigger>
        <TabsTrigger value="prompts">
          Prompts ({config.prompts?.length || 0})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="signals">
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {config.signalGroups?.map((group: any) => (
              <div key={group.groupName}>
                <h4 className="font-medium mb-2">{group.groupName}</h4>
                <div className="space-y-1 pl-4">
                  {group.signals.map((signal: any) => (
                    <div key={signal.signalCode} className="text-sm">
                      <span className="font-mono text-xs text-muted-foreground">
                        {signal.signalCode}
                      </span>
                      {' - '}
                      <span>{signal.signalName}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="followups">
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {config.followups?.map((followup: any, idx: number) => (
              <div key={idx} className="p-2 border rounded">
                <p className="font-medium text-sm">{followup.followupName}</p>
                {followup.followupText && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {followup.followupText}
                  </p>
                )}
                {followup.followupType && (
                  <Badge variant="outline" className="text-xs mt-1">
                    {followup.followupType}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="display">
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {config.displayItems?.map((item: any, idx: number) => (
              <div key={idx} className="p-2 border rounded text-sm">
                <span className="font-medium">{item.displayName}</span>
                <span className="text-muted-foreground ml-2">
                  (order: {item.displayOrder})
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="prompts">
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {config.prompts?.map((prompt: any, idx: number) => (
              <div key={idx} className="p-3 border rounded">
                <h4 className="font-medium text-sm mb-2">{prompt.promptName}</h4>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {prompt.promptText}
                </p>
                {prompt.boundSignals?.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {prompt.boundSignals.map((signal: any) => (
                      <Badge key={signal.signalCode} variant="secondary" className="text-xs">
                        {signal.signalCode}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

export default MetricSelector;
