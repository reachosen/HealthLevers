import React, { useState, useMemo } from 'react';
import { useFollowups, type Followup } from '@/hooks/useMetadataApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export interface DynamicFollowupFormsProps {
  metricId: string;
  followupValues?: Record<string, any>;
  onFollowupChange?: (followupName: string, value: any) => void;
  onSubmit?: (values: Record<string, any>) => void;
  showSubmit?: boolean;
  readOnly?: boolean;
}

/**
 * Dynamic Followup Forms Component
 *
 * Renders followup questions dynamically from v9.2 metadata API
 *
 * Features:
 * - Loads followups from metadata API
 * - Renders appropriate input type based on followup_type
 * - Handles conditional followups (depends_on)
 * - Form validation
 * - Read-only mode for display
 */
export function DynamicFollowupForms({
  metricId,
  followupValues = {},
  onFollowupChange,
  onSubmit,
  showSubmit = true,
  readOnly = false,
}: DynamicFollowupFormsProps) {
  const [internalValues, setInternalValues] = useState<Record<string, any>>(followupValues);

  // Fetch followups from metadata API
  const { data, isLoading, error } = useFollowups(metricId);

  // Determine which values to use
  const values = onFollowupChange ? followupValues : internalValues;

  // Filter followups based on dependencies
  const visibleFollowups = useMemo(() => {
    if (!data?.followups) return [];

    return data.followups.filter((followup) => {
      // If no dependency, always show
      if (!followup.dependsOn) return true;

      // Check if dependency is met
      const dependencyValue = values[followup.dependsOn];

      // Show if dependency has a truthy value
      return !!dependencyValue;
    });
  }, [data, values]);

  const handleChange = (followupName: string, value: any) => {
    if (readOnly) return;

    if (onFollowupChange) {
      onFollowupChange(followupName, value);
    } else {
      setInternalValues((prev) => ({ ...prev, [followupName]: value }));
    }
  };

  const handleSubmitClick = () => {
    if (onSubmit) {
      onSubmit(values);
    }
  };

  // Validate form
  const isComplete = useMemo(() => {
    return visibleFollowups.every((followup) => {
      const value = values[followup.followupName];
      return value !== undefined && value !== null && value !== '';
    });
  }, [visibleFollowups, values]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading followups...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="h-5 w-5" />
            <span>Error loading followups: {(error as Error).message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.followups.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-muted-foreground text-center">
            No followup questions configured for this metric
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Followup Questions</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {visibleFollowups.length} of {data.followups.length} question
              {data.followups.length !== 1 ? 's' : ''}
              {visibleFollowups.length !== data.followups.length && ' (some hidden by dependencies)'}
            </p>
          </div>

          {isComplete && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Complete</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitClick();
          }}
          className="space-y-6"
        >
          {visibleFollowups.map((followup) => (
            <FollowupField
              key={followup.followupName}
              followup={followup}
              value={values[followup.followupName]}
              onChange={(value) => handleChange(followup.followupName, value)}
              readOnly={readOnly}
            />
          ))}

          {showSubmit && !readOnly && (
            <div className="pt-4 border-t">
              <Button
                type="submit"
                className="w-full"
                disabled={!isComplete}
              >
                Submit Followups
              </Button>
            </div>
          )}
        </form>

        {/* Hidden followups info */}
        {visibleFollowups.length < data.followups.length && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>{data.followups.length - visibleFollowups.length} hidden question
              {data.followups.length - visibleFollowups.length !== 1 ? 's' : ''}:</strong>
              {' '}These will appear when their dependencies are met.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-2">
                <summary className="text-xs text-blue-700 cursor-pointer">
                  Show hidden questions (dev only)
                </summary>
                <ul className="mt-2 text-xs space-y-1">
                  {data.followups
                    .filter((f) => !visibleFollowups.includes(f))
                    .map((f) => (
                      <li key={f.followupName}>
                        <span className="font-mono">{f.followupName}</span>
                        {f.dependsOn && (
                          <span className="text-blue-600"> (depends on: {f.dependsOn})</span>
                        )}
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface FollowupFieldProps {
  followup: Followup;
  value: any;
  onChange: (value: any) => void;
  readOnly: boolean;
}

function FollowupField({ followup, value, onChange, readOnly }: FollowupFieldProps) {
  const renderInput = () => {
    const type = followup.followupType?.toLowerCase() || 'text';

    // Determine input type based on followup_type
    switch (type) {
      case 'boolean':
      case 'yes/no':
      case 'yn':
        return (
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={followup.followupName}
                value="yes"
                checked={value === 'yes' || value === true}
                onChange={() => onChange('yes')}
                disabled={readOnly}
                className="w-4 h-4"
              />
              <span>Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={followup.followupName}
                value="no"
                checked={value === 'no' || value === false}
                onChange={() => onChange('no')}
                disabled={readOnly}
                className="w-4 h-4"
              />
              <span>No</span>
            </label>
          </div>
        );

      case 'textarea':
      case 'longtext':
      case 'multiline':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            placeholder="Enter your answer..."
            rows={4}
            className="resize-none"
          />
        );

      case 'number':
      case 'numeric':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            disabled={readOnly}
            placeholder="Enter a number..."
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
          />
        );

      case 'time':
        return (
          <Input
            type="time"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
          />
        );

      case 'select':
      case 'choice':
        // For now, render as text input
        // In production, would parse options from followupText or additional field
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            placeholder="Enter your selection..."
          />
        );

      case 'text':
      case 'string':
      default:
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            placeholder="Enter your answer..."
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Label htmlFor={followup.followupName} className="text-base font-medium">
          {followup.followupText || followup.followupName}
          {followup.dependsOn && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              (conditional)
            </span>
          )}
        </Label>

        {followup.followupType && (
          <Badge variant="outline" className="text-xs">
            {followup.followupType}
          </Badge>
        )}
      </div>

      {renderInput()}

      {value && !readOnly && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Answered
        </p>
      )}
    </div>
  );
}

export default DynamicFollowupForms;
