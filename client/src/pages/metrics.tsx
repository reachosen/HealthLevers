import React, { useState } from 'react';
import { MetricSelector } from '@/components/MetricSelector';
import { DynamicSignalDisplay } from '@/components/DynamicSignalDisplay';
import { DynamicFollowupForms } from '@/components/DynamicFollowupForms';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompleteMetric } from '@/hooks/useMetadataApi';
import { formatMetricDisplay } from '@/lib/metricDisplay';

/**
 * Metrics Demo Page
 *
 * Demonstrates the dynamic MetricSelector and DynamicSignalDisplay components
 * replacing hardcoded USNWR_MATRIX with v9.2 metadata API
 */
export default function MetricsPage() {
  const [selectedMetricId, setSelectedMetricId] = useState<string>('');
  const [demoSignalValues, setDemoSignalValues] = useState<Record<string, any>>({});
  const [followupValues, setFollowupValues] = useState<Record<string, any>>({});

  const { data: completeConfig } = useCompleteMetric(selectedMetricId || null);

  const handleMetricSelect = (metricId: string) => {
    setSelectedMetricId(metricId);
    console.log('Selected metric:', metricId);
    // Reset demo values when changing metrics
    setDemoSignalValues({});
    setFollowupValues({});
  };

  const handleSignalClick = (signalCode: string) => {
    console.log('Signal clicked:', signalCode);
    // Toggle signal value for demo
    setDemoSignalValues((prev) => ({
      ...prev,
      [signalCode]: !prev[signalCode],
    }));
  };

  const simulateRandomValues = () => {
    if (!completeConfig) return;

    const newValues: Record<string, any> = {};
    completeConfig.signalGroups.forEach((group) => {
      group.signals.forEach((signal) => {
        // Randomly assign pass/fail/caution values
        const rand = Math.random();
        if (rand < 0.6) newValues[signal.signalCode] = true; // pass
        else if (rand < 0.9) newValues[signal.signalCode] = false; // fail
        else newValues[signal.signalCode] = 'caution'; // caution
      });
    });
    setDemoSignalValues(newValues);
  };

  const handleConfigure = () => {
    if (completeConfig) {
      console.log('Complete configuration:', completeConfig);
      const metricDisplay = formatMetricDisplay(completeConfig.metric);
      alert(`Metric configured: ${metricDisplay}\n\n` +
            `Signals: ${completeConfig.signalGroups.reduce((sum, g) => sum + g.signals.length, 0)}\n` +
            `Followups: ${completeConfig.followups.length}\n` +
            `Display Items: ${completeConfig.displayItems.length}\n` +
            `Prompts: ${completeConfig.prompts.length}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F7FBFE] to-[#FFFFFF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            Dynamic Metric Configuration
          </h1>
          <p className="text-slate-600 mt-2">
            Select and configure quality metrics using the v9.2 metadata API
          </p>
        </div>

        {/* Main Content with Tabs */}
        <Tabs defaultValue="selector" className="space-y-6">
          <TabsList>
            <TabsTrigger value="selector">Metric Selector</TabsTrigger>
            <TabsTrigger value="signals" disabled={!selectedMetricId}>
              Signal Display
            </TabsTrigger>
            <TabsTrigger value="followups" disabled={!selectedMetricId}>
              Followup Questions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="selector" className="space-y-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <MetricSelector
                  onMetricSelect={handleMetricSelect}
                  selectedMetricId={selectedMetricId}
                  showCompleteConfig={true}
                />
              </div>

          {/* Selected Metric Summary */}
          <div>
            <div className="sticky top-6">
              <div className="border rounded-lg p-6 bg-white shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Selected Metric</h2>

                {selectedMetricId && completeConfig ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">
                        Metric
                      </h3>
                      <p className="text-base">{formatMetricDisplay(completeConfig.metric)}</p>
                    </div>

                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">
                        Metric ID
                      </h3>
                      <p className="font-mono text-sm">{completeConfig.metric.metricId}</p>
                    </div>

                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">
                        Specialty
                      </h3>
                      <p className="text-base">{completeConfig.metric.specialty}</p>
                    </div>

                    {completeConfig.metric.domain && (
                      <div>
                        <h3 className="font-medium text-sm text-muted-foreground mb-1">
                          Domain
                        </h3>
                        <p className="text-base">{completeConfig.metric.domain}</p>
                      </div>
                    )}

                    {completeConfig.metric.thresholdHours && (
                      <div>
                        <h3 className="font-medium text-sm text-muted-foreground mb-1">
                          Threshold
                        </h3>
                        <p className="text-base">≤{completeConfig.metric.thresholdHours} hours</p>
                      </div>
                    )}

                    <div className="pt-4 border-t space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Signal Groups</span>
                        <span className="font-medium">
                          {completeConfig.signalGroups.length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Signals</span>
                        <span className="font-medium">
                          {completeConfig.signalGroups.reduce(
                            (sum, g) => sum + g.signals.length,
                            0
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Followups</span>
                        <span className="font-medium">
                          {completeConfig.followups.length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Prompts</span>
                        <span className="font-medium">
                          {completeConfig.prompts.length}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={handleConfigure}
                      className="w-full mt-4"
                    >
                      Configure Workflow
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Select a metric to view details
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="signals" className="space-y-6">
            {selectedMetricId && (
              <div className="space-y-4">
                {/* Demo Controls */}
                <div className="flex gap-2 items-center p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm text-amber-900">
                      <strong>Demo Mode:</strong> Click signals to toggle their status, or use the button to simulate random values.
                    </p>
                  </div>
                  <Button onClick={simulateRandomValues} variant="outline" size="sm">
                    Simulate Values
                  </Button>
                  <Button
                    onClick={() => setDemoSignalValues({})}
                    variant="outline"
                    size="sm"
                  >
                    Clear All
                  </Button>
                </div>

                {/* Dynamic Signal Display */}
                <DynamicSignalDisplay
                  metricId={selectedMetricId}
                  signalValues={demoSignalValues}
                  onSignalClick={handleSignalClick}
                  showGroupControls={true}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="followups" className="space-y-6">
            {selectedMetricId && (
              <div className="space-y-4">
                {/* Demo Info */}
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-900">
                    <strong>Conditional Followups:</strong> Some questions may only appear after answering others.
                    Answer questions to reveal dependent followups.
                  </p>
                </div>

                {/* Dynamic Followup Forms */}
                <DynamicFollowupForms
                  metricId={selectedMetricId}
                  followupValues={followupValues}
                  onFollowupChange={(name, value) => {
                    setFollowupValues((prev) => ({ ...prev, [name]: value }));
                  }}
                  onSubmit={(values) => {
                    console.log('Followup form submitted:', values);
                    alert(`Followup form submitted!\n\n${Object.keys(values).length} questions answered.`);
                  }}
                  showSubmit={true}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* API Info */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">
            🚀 Using v9.2 Metadata API
          </h3>
          <p className="text-sm text-blue-800">
            This page demonstrates dynamic components that replace hardcoded USNWR_MATRIX data:
            <br />
            • <strong>MetricSelector</strong>: Browse and select metrics from the database
            <br />
            • <strong>DynamicSignalDisplay</strong>: View signals grouped and ordered dynamically
            <br />
            • <strong>DynamicFollowupForms</strong>: Render followup questions with conditional logic
            <br />
            All data is loaded from the v9.2 metadata API and can be updated without code changes.
          </p>
        </div>
      </div>
    </div>
  );
}
