import React, { useState, useMemo } from 'react';
import { useSignals, type SignalGroup, type SignalDef } from '@/hooks/useMetadataApi';
import { SignalChip } from './signal-chip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface DynamicSignalDisplayProps {
  metricId: string;
  signalValues?: Record<string, any>;
  onSignalClick?: (signalCode: string) => void;
  visibleGroups?: Record<string, boolean>;
  onVisibilityChange?: (groupName: string, visible: boolean) => void;
  showGroupControls?: boolean;
}

/**
 * Dynamic Signal Display Component
 *
 * Replaces hardcoded signal groups with dynamic metadata from v9.2 API
 *
 * Features:
 * - Loads signal groups and signals from metadata API
 * - Respects display_order for groups and signals within groups
 * - Toggle group visibility
 * - Shows signal status (pass/fail/caution) if values provided
 * - Click handlers for signal interaction
 * - Collapsible groups
 */
export function DynamicSignalDisplay({
  metricId,
  signalValues = {},
  onSignalClick,
  visibleGroups: externalVisibleGroups,
  onVisibilityChange,
  showGroupControls = true,
}: DynamicSignalDisplayProps) {
  // Internal state for visibility if not controlled externally
  const [internalVisibleGroups, setInternalVisibleGroups] = useState<Record<string, boolean>>({});

  // Fetch signals from metadata API
  const { data, isLoading, error } = useSignals(metricId);

  // Determine which visibility state to use
  const visibleGroups = externalVisibleGroups ?? internalVisibleGroups;

  // Sort signal groups by display_order
  const sortedGroups = useMemo(() => {
    if (!data?.signalGroups) return [];
    return [...data.signalGroups].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [data]);

  const handleVisibilityToggle = (groupName: string) => {
    const newVisible = !visibleGroups[groupName];

    if (onVisibilityChange) {
      onVisibilityChange(groupName, newVisible);
    } else {
      setInternalVisibleGroups((prev) => ({
        ...prev,
        [groupName]: newVisible,
      }));
    }
  };

  const getSignalStatus = (signalCode: string): string => {
    const value = signalValues[signalCode];

    if (value === undefined || value === null) return 'inactive';

    // Boolean signals
    if (typeof value === 'boolean') {
      return value ? 'pass' : 'fail';
    }

    // String signals - check for common values
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'yes' || lower === 'true' || lower === 'pass') return 'pass';
      if (lower === 'no' || lower === 'false' || lower === 'fail') return 'fail';
      if (lower === 'warning' || lower === 'caution') return 'caution';
      return 'pass'; // Non-empty string = pass
    }

    // Number signals - non-zero = pass
    if (typeof value === 'number') {
      return value !== 0 ? 'pass' : 'fail';
    }

    return 'inactive';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading signals...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-red-500">Error loading signals: {(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || sortedGroups.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-muted-foreground">No signals configured for this metric</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Signals</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {sortedGroups.length} group{sortedGroups.length !== 1 ? 's' : ''} •{' '}
                {sortedGroups.reduce((sum, g) => sum + g.signals.length, 0)} signal
                {sortedGroups.reduce((sum, g) => sum + g.signals.length, 0) !== 1 ? 's' : ''}
              </p>
            </div>

            {showGroupControls && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    sortedGroups.forEach((group) => handleVisibilityToggle(group.groupName));
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Show All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    sortedGroups.forEach((group) => {
                      if (visibleGroups[group.groupName] !== false) {
                        handleVisibilityToggle(group.groupName);
                      }
                    });
                  }}
                >
                  <EyeOff className="h-4 w-4 mr-1" />
                  Hide All
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Signal Groups */}
      {sortedGroups.map((group) => (
        <SignalGroupCard
          key={group.groupName}
          group={group}
          visible={visibleGroups[group.groupName] ?? true}
          onVisibilityToggle={() => handleVisibilityToggle(group.groupName)}
          signalValues={signalValues}
          onSignalClick={onSignalClick}
          getSignalStatus={getSignalStatus}
          showGroupControls={showGroupControls}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface SignalGroupCardProps {
  group: SignalGroup;
  visible: boolean;
  onVisibilityToggle: () => void;
  signalValues: Record<string, any>;
  onSignalClick?: (signalCode: string) => void;
  getSignalStatus: (signalCode: string) => string;
  showGroupControls: boolean;
}

function SignalGroupCard({
  group,
  visible,
  onVisibilityToggle,
  signalValues,
  onSignalClick,
  getSignalStatus,
  showGroupControls,
}: SignalGroupCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Count signal statuses
  const statusCounts = useMemo(() => {
    const counts = { pass: 0, fail: 0, caution: 0, inactive: 0 };
    group.signals.forEach((signal) => {
      const status = getSignalStatus(signal.signalCode);
      if (status === 'pass') counts.pass++;
      else if (status === 'fail') counts.fail++;
      else if (status === 'caution') counts.caution++;
      else counts.inactive++;
    });
    return counts;
  }, [group.signals, signalValues]);

  if (!visible) {
    return (
      <Card className="opacity-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground">
                {group.groupName}
              </h3>
              <Badge variant="outline" className="text-xs">
                {group.signals.length} signals hidden
              </Badge>
            </div>
            {showGroupControls && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onVisibilityToggle}
                className="h-8"
              >
                <Eye className="h-4 w-4 mr-1" />
                Show
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-70 transition-opacity">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <h3 className="font-semibold">{group.groupName}</h3>
              <Badge variant="secondary" className="text-xs">
                {group.signals.length}
              </Badge>
            </CollapsibleTrigger>

            <div className="flex items-center gap-4">
              {/* Status badges */}
              <div className="flex gap-2">
                {statusCounts.pass > 0 && (
                  <Badge variant="outline" className="text-xs bg-green-50 border-green-200">
                    ✓ {statusCounts.pass}
                  </Badge>
                )}
                {statusCounts.fail > 0 && (
                  <Badge variant="outline" className="text-xs bg-red-50 border-red-200">
                    ✗ {statusCounts.fail}
                  </Badge>
                )}
                {statusCounts.caution > 0 && (
                  <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-200">
                    ⚠ {statusCounts.caution}
                  </Badge>
                )}
              </div>

              {showGroupControls && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onVisibilityToggle}
                  className="h-8"
                >
                  <EyeOff className="h-4 w-4 mr-1" />
                  Hide
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {group.signals.map((signal) => {
                const status = getSignalStatus(signal.signalCode);
                return (
                  <button
                    key={signal.signalCode}
                    onClick={() => onSignalClick?.(signal.signalCode)}
                    className="transition-transform hover:scale-105"
                    disabled={!onSignalClick}
                  >
                    <SignalChip
                      label={signal.signalName}
                      status={status}
                      tooltip={signal.prompt || signal.signalCode}
                    />
                  </button>
                );
              })}
            </div>

            {/* Signal Details Table (optional, for debugging) */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Show signal details (dev only)
                </summary>
                <div className="mt-2 text-xs space-y-1 font-mono">
                  {group.signals.map((signal) => (
                    <div key={signal.signalCode} className="p-2 bg-muted rounded">
                      <div className="flex justify-between">
                        <span className="font-semibold">{signal.signalCode}</span>
                        <span className="text-muted-foreground">{signal.dataType}</span>
                      </div>
                      {signal.signalType && (
                        <div className="text-muted-foreground">Type: {signal.signalType}</div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default DynamicSignalDisplay;
