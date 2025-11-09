/**
 * Case Review Preparer
 *
 * Orchestrates the preparation of a case for clinician review by:
 * 1. Generating clinical summary
 * 2. Generating reasoning questions
 * 3. Organizing signals by group
 * 4. Preparing all necessary context
 */

import { clinicalSummaryGenerator, type ClinicalSummary, type MetricContext } from './clinicalSummaryGenerator';
import { reasoningQuestionGenerator, type ReasoningQuestions } from './reasoningQuestionGenerator';

export interface GroupedSignals {
  [groupName: string]: any[];
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
  groupedSignals: GroupedSignals;
  quickSummary: string;
  timestamp: string;
}

export class CaseReviewPreparer {
  /**
   * Prepare a complete case review package
   */
  async prepareCase(
    caseId: string,
    encounterPayload: any,
    metricContext: MetricContext,
    signals: any[]
  ): Promise<CaseReviewPreparation> {
    console.log(`Preparing case ${caseId} for metric ${metricContext.metric_id}`);

    try {
      // Generate all components in parallel for efficiency
      const [clinicalSummary, reasoningQuestions, quickSummary] = await Promise.all([
        clinicalSummaryGenerator.generateSummary(encounterPayload, metricContext),
        reasoningQuestionGenerator.generateQuestions(encounterPayload, signals, metricContext.metric_id),
        clinicalSummaryGenerator.generateQuickSummary(encounterPayload, metricContext)
      ]);

      // Group signals by category
      const groupedSignals = this.groupSignals(signals);

      return {
        case: {
          caseId,
          encounterId: encounterPayload.encounter_id || caseId,
          metricId: metricContext.metric_id,
          metricName: metricContext.metric_name,
          patientMrn: encounterPayload.patient?.mrn || encounterPayload.mrn
        },
        clinicalSummary,
        reasoningQuestions,
        groupedSignals,
        quickSummary,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error preparing case for review:', error);
      throw new Error('Failed to prepare case for review');
    }
  }

  /**
   * Group signals by their category/group
   */
  private groupSignals(signals: any[]): GroupedSignals {
    const grouped: GroupedSignals = {};

    for (const signal of signals) {
      const group = signal.group || signal.group_name || 'Other';
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(signal);
    }

    // Sort groups by display order if available
    const orderedGroups: GroupedSignals = {};
    const groupOrder = ['Core', 'Demographics', 'Clinical', 'Timing', 'Delay Drivers', 'Documentation', 'Ruleouts', 'Overrides', 'Other'];

    for (const groupName of groupOrder) {
      if (grouped[groupName]) {
        orderedGroups[groupName] = grouped[groupName];
      }
    }

    // Add any remaining groups not in the standard order
    for (const groupName in grouped) {
      if (!orderedGroups[groupName]) {
        orderedGroups[groupName] = grouped[groupName];
      }
    }

    return orderedGroups;
  }

  /**
   * Prepare a lightweight version for quick preview
   */
  async prepareQuickPreview(
    caseId: string,
    encounterPayload: any,
    metricContext: MetricContext
  ): Promise<{
    caseId: string;
    quickSummary: string;
    metricResult: string;
  }> {
    const quickSummary = await clinicalSummaryGenerator.generateQuickSummary(
      encounterPayload,
      metricContext
    );

    return {
      caseId,
      quickSummary,
      metricResult: 'Pending review'
    };
  }

  /**
   * Re-generate reasoning questions only (useful when clinician needs more context)
   */
  async regenerateQuestions(
    encounterPayload: any,
    signals: any[],
    metricId: string,
    focusArea?: 'rule_in' | 'rule_out' | 'insight'
  ): Promise<ReasoningQuestions> {
    const questions = await reasoningQuestionGenerator.generateQuestions(
      encounterPayload,
      signals,
      metricId
    );

    // Filter by focus area if specified
    if (focusArea) {
      return {
        ruleInQuestions: focusArea === 'rule_in' ? questions.ruleInQuestions : [],
        ruleOutQuestions: focusArea === 'rule_out' ? questions.ruleOutQuestions : [],
        clinicalInsightQuestions: focusArea === 'insight' ? questions.clinicalInsightQuestions : []
      };
    }

    return questions;
  }
}

// Export singleton instance
export const caseReviewPreparer = new CaseReviewPreparer();
