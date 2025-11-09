/**
 * React hooks for case review preparation and AI-powered clinical reasoning
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface ClinicalSummarySection {
  title: string;
  emoji: string;
  content: string[];
  citations: string[];
}

export interface ClinicalSummary {
  patient: ClinicalSummarySection;
  presentation: ClinicalSummarySection;
  assessment: ClinicalSummarySection;
  timeline: ClinicalSummarySection;
  keyConsiderations: ClinicalSummarySection;
  rawText: string;
}

export interface Evidence {
  source: string;
  text: string | null;
  supports: string;
}

export interface ReasoningQuestion {
  questionId: string;
  category: 'inclusion' | 'exclusion' | 'context';
  questionText: string;
  rationale: string;
  evidence: Evidence[];
  answerOptions?: string[];
  suggestedAnswer?: string;
  suggestedInterpretation?: string;
  confidence?: number;
}

export interface ReasoningQuestions {
  ruleInQuestions: ReasoningQuestion[];
  ruleOutQuestions: ReasoningQuestion[];
  clinicalInsightQuestions: ReasoningQuestion[];
}

export interface MetricContext {
  metric_id: string;
  metric_name: string;
  threshold_hours?: number;
  domain: string;
  question_code: string;
}

export interface CaseReviewPreparation {
  case: {
    caseId: string;
    encounterId: string;
    metricId: string;
    metricName: string;
    patientMrn?: string;
  };
  clinicalSummary: ClinicalSummary;
  reasoningQuestions: ReasoningQuestions;
  groupedSignals: Record<string, any[]>;
  quickSummary: string;
  timestamp: string;
}

/**
 * Prepare a complete case review package
 */
export function usePrepareReview(caseId: string) {
  return useMutation({
    mutationFn: async ({
      encounterPayload,
      metricContext,
      signals
    }: {
      encounterPayload: any;
      metricContext: MetricContext;
      signals?: any[];
    }) => {
      const response = await apiRequest<CaseReviewPreparation>(
        `/api/cases/${caseId}/prepare-review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encounterPayload, metricContext, signals })
        }
      );
      return response;
    }
  });
}

/**
 * Generate just the clinical summary
 */
export function useGenerateSummary(caseId: string) {
  return useMutation({
    mutationFn: async ({
      encounterPayload,
      metricContext
    }: {
      encounterPayload: any;
      metricContext: MetricContext;
    }) => {
      const response = await apiRequest<{ caseId: string; summary: ClinicalSummary }>(
        `/api/cases/${caseId}/generate-summary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encounterPayload, metricContext })
        }
      );
      return response.summary;
    }
  });
}

/**
 * Generate reasoning questions
 */
export function useGenerateQuestions(caseId: string) {
  return useMutation({
    mutationFn: async ({
      encounterPayload,
      signals,
      metricId,
      focusArea
    }: {
      encounterPayload: any;
      signals?: any[];
      metricId: string;
      focusArea?: 'rule_in' | 'rule_out' | 'insight';
    }) => {
      const response = await apiRequest<{ caseId: string; questions: ReasoningQuestions }>(
        `/api/cases/${caseId}/generate-questions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encounterPayload, signals, metricId, focusArea })
        }
      );
      return response.questions;
    }
  });
}

/**
 * Generate quick preview
 */
export function useQuickPreview(caseId: string) {
  return useMutation({
    mutationFn: async ({
      encounterPayload,
      metricContext
    }: {
      encounterPayload: any;
      metricContext: MetricContext;
    }) => {
      const response = await apiRequest<{
        caseId: string;
        quickSummary: string;
        metricResult: string;
      }>(
        `/api/cases/${caseId}/quick-preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encounterPayload, metricContext })
        }
      );
      return response;
    }
  });
}

/**
 * Answer validation helper
 */
export function useValidateAnswer() {
  return (question: ReasoningQuestion, clinicianAnswer: string) => {
    const agreesWithAI = clinicianAnswer === question.suggestedAnswer;
    const confidence = question.confidence || 0;

    return {
      isValid: true,
      agreesWithAI,
      requiresJustification: !agreesWithAI && confidence > 0.8
    };
  };
}
