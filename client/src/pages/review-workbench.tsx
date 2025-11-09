/**
 * Case Review Workbench
 *
 * AI-Powered Clinical Abstraction Workbench
 * Intelligent Summary + Guided Review + Dynamic Reasoning
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  FileJson
} from 'lucide-react';
import ClinicalSummaryCard from '@/components/ClinicalSummaryCard';
import ReasoningQuestionsPanel from '@/components/ReasoningQuestionsPanel';
import CollapsibleGroup from '@/components/ui/CollapsibleGroup';
import { usePrepareReview, type MetricContext, type ReasoningQuestion } from '@/hooks/useCaseReview';
import { useToast } from '@/hooks/use-toast';

// Sample case data
import sampleSCH from '@/data/sampleCase.USNWR_SCH.json';

export default function ReviewWorkbench() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [caseId] = useState('case_sch_001');
  const [encounterPayload, setEncounterPayload] = useState<any>(sampleSCH);
  const [metricContext] = useState<MetricContext>({
    metric_id: 'ORTHO_I25',
    metric_name: 'In OR <18 hrs – Supracondylar fracture',
    threshold_hours: 18,
    domain: 'timeliness',
    question_code: 'I25'
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finalDecision, setFinalDecision] = useState<string>('');
  const [showRawJSON, setShowRawJSON] = useState(false);

  const prepareReview = usePrepareReview(caseId);

  // Auto-prepare on mount
  useEffect(() => {
    if (encounterPayload && metricContext) {
      prepareReview.mutate({
        encounterPayload,
        metricContext,
        signals: []
      });
    }
  }, []);

  const handleAnswerQuestion = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    toast({
      title: 'Answer Saved',
      description: `Your answer for ${questionId} has been saved.`,
    });
  };

  const handleAskAI = (question: ReasoningQuestion) => {
    toast({
      title: 'AI Assistance',
      description: 'This would open the LLM chat panel with context for this question.',
    });
  };

  const handleSubmitAbstraction = () => {
    if (!finalDecision) {
      toast({
        title: 'Missing Decision',
        description: 'Please select a final classification before submitting.',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Abstraction Submitted',
      description: 'Case has been submitted for review.',
    });

    // Would save to database here
    navigate('/');
  };

  if (prepareReview.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-lg font-medium">Preparing case review...</p>
          <p className="text-sm text-muted-foreground mt-2">
            AI is generating clinical summary and reasoning questions
          </p>
        </div>
      </div>
    );
  }

  if (prepareReview.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error Preparing Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Failed to prepare case review. This may be due to missing OpenAI API key or service error.
            </p>
            <Button onClick={() => navigate('/')}>Return Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const reviewData = prepareReview.data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cases
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Case Review Workbench</h1>
              <p className="text-muted-foreground mt-1">
                AI-Powered Clinical Abstraction: {reviewData?.case.metricName}
              </p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="mb-2">
                {reviewData?.case.caseId}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Patient MRN: {reviewData?.case.patientMrn || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Summary Banner */}
        {reviewData && (
          <Card className="mb-6 border-l-4 border-l-blue-600">
            <CardContent className="pt-6">
              <p className="text-lg font-medium">{reviewData.quickSummary}</p>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="space-y-6">
          {/* Clinical Summary */}
          {reviewData?.clinicalSummary && (
            <ClinicalSummaryCard
              summary={reviewData.clinicalSummary}
              onViewRawJSON={() => setShowRawJSON(!showRawJSON)}
            />
          )}

          {/* Raw JSON View */}
          {showRawJSON && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  Raw Encounter JSON
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(encounterPayload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Reasoning Questions */}
          {reviewData?.reasoningQuestions && (
            <ReasoningQuestionsPanel
              questions={reviewData.reasoningQuestions}
              onAnswerQuestion={handleAnswerQuestion}
              onAskAI={handleAskAI}
            />
          )}

          {/* Grouped Signals (Collapsible) */}
          {reviewData?.groupedSignals && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Structured Signals (From Excel Groups)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Detailed signal-level data organized by group
                </p>
              </CardHeader>
              <CardContent>
                {Object.entries(reviewData.groupedSignals).map(([groupName, signals]) => (
                  <CollapsibleGroup
                    key={groupName}
                    title={`${groupName} (${signals.length} signals)`}
                    defaultOpen={groupName === 'Core'}
                  >
                    <div className="space-y-2">
                      {signals.map((signal: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                        >
                          <div>
                            <p className="font-medium text-sm">{signal.label || signal.id}</p>
                            {signal.definition && (
                              <p className="text-xs text-gray-600">{signal.definition}</p>
                            )}
                          </div>
                          <Badge variant="outline">{signal.status || 'inactive'}</Badge>
                        </div>
                      ))}
                    </div>
                  </CollapsibleGroup>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Final Decision */}
          <Card className="border-2 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl">⚖️</span>
                Abstraction Decision
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Metric Result:</p>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm">
                    • Time to OR: <strong>8.5 hours</strong>
                  </p>
                  <p className="text-sm">
                    • Threshold: <strong>&lt;18 hours</strong>
                  </p>
                  <p className="text-sm">
                    • Numerical result: <strong className="text-green-600">PASS ✓</strong>
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Your Final Classification:</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="final-decision"
                      value="include-meets"
                      checked={finalDecision === 'include-meets'}
                      onChange={(e) => setFinalDecision(e.target.value)}
                      className="h-4 w-4"
                    />
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm flex-1">Include - Meets Standard</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="final-decision"
                      value="include-fails"
                      checked={finalDecision === 'include-fails'}
                      onChange={(e) => setFinalDecision(e.target.value)}
                      className="h-4 w-4"
                    />
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="text-sm flex-1">Include - Fails Standard</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="final-decision"
                      value="exclude"
                      checked={finalDecision === 'exclude'}
                      onChange={(e) => setFinalDecision(e.target.value)}
                      className="h-4 w-4"
                    />
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <span className="text-sm flex-1">Exclude from Analysis</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Notes:</label>
                <Textarea
                  placeholder="Add any notes about your decision..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSubmitAbstraction}
                  className="flex-1"
                  disabled={!finalDecision}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit Abstraction
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                  Save Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
