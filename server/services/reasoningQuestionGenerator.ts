/**
 * Reasoning Question Generator
 *
 * Generates dynamic, context-aware reasoning questions to help clinicians
 * make informed decisions about case inclusion, exclusion, and clinical context.
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface Evidence {
  source: string; // JSON path
  text: string | null;
  supports: string; // What this evidence supports
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

export interface QuestionTemplate {
  metric_id: string;
  category: 'rule_in' | 'rule_out' | 'insight';
  question_template: string;
  rationale: string;
  priority: number;
}

export class ReasoningQuestionGenerator {
  /**
   * Generate reasoning questions for a case
   */
  async generateQuestions(
    encounterPayload: any,
    signals: any[],
    metricId: string
  ): Promise<ReasoningQuestions> {
    const templates = await this.getQuestionTemplates(metricId);
    const prompt = this.buildPrompt(encounterPayload, signals, metricId, templates);

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a medical quality abstraction assistant. You generate reasoning questions that help clinicians make informed decisions about case classification.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return this.structureQuestions(result);
    } catch (error) {
      console.error('Error generating reasoning questions:', error);
      throw new Error('Failed to generate reasoning questions');
    }
  }

  /**
   * Build prompt for question generation
   */
  private buildPrompt(
    encounterPayload: any,
    signals: any[],
    metricId: string,
    templates: QuestionTemplate[]
  ): string {
    const encounterJSON = JSON.stringify(encounterPayload, null, 2);
    const signalsJSON = JSON.stringify(signals, null, 2);

    const ruleInTemplates = templates
      .filter(t => t.category === 'rule_in')
      .map(t => `- ${t.question_template} (${t.rationale})`)
      .join('\n');

    const ruleOutTemplates = templates
      .filter(t => t.category === 'rule_out')
      .map(t => `- ${t.question_template} (${t.rationale})`)
      .join('\n');

    const insightTemplates = templates
      .filter(t => t.category === 'insight')
      .map(t => `- ${t.question_template} (${t.rationale})`)
      .join('\n');

    return `
You are helping a clinician review a case for quality metric ${metricId}.

ENCOUNTER DATA:
\`\`\`json
${encounterJSON}
\`\`\`

EXTRACTED SIGNALS:
\`\`\`json
${signalsJSON}
\`\`\`

Generate reasoning questions based on these templates to help the clinician determine:

1. RULE IN (Inclusion Criteria) - Does this case qualify?
${ruleInTemplates || '- Generate appropriate inclusion questions based on the metric'}

2. RULE OUT (Exclusion Criteria) - Should this be excluded?
${ruleOutTemplates || '- Generate appropriate exclusion questions based on the metric'}

3. CLINICAL INSIGHT (Context) - What context matters?
${insightTemplates || '- Generate appropriate contextual questions'}

For EACH question:

1. Write a clear, specific question text
2. Explain WHY you're asking (rationale)
3. Search the encounter data for relevant evidence
4. Cite sources using JSON paths (e.g., "encounter.ed_notes.arrival")
5. Provide answer options (for rule in/out) or interpretation guidance (for insight)
6. Suggest an answer based on the evidence you found
7. Indicate confidence level (0.0-1.0)

IMPORTANT:
- Search thoroughly through the encounter data for evidence
- If evidence is NOT found, explicitly state "None found" with the source path you checked
- Be specific with citations - use actual JSON paths
- For rule in/out questions, provide clear answer options
- For clinical insight questions, provide interpretation guidance

Return JSON in this exact format:
{
  "ruleInQuestions": [
    {
      "questionId": "q1",
      "category": "inclusion",
      "questionText": "...",
      "rationale": "...",
      "evidence": [
        {
          "source": "encounter.radiology.findings",
          "text": "Actual text found in data",
          "supports": "yes/no/unclear"
        }
      ],
      "answerOptions": ["Option 1", "Option 2", "Option 3"],
      "suggestedAnswer": "Option 1",
      "confidence": 0.95
    }
  ],
  "ruleOutQuestions": [...],
  "clinicalInsightQuestions": [
    {
      "questionId": "q3",
      "category": "context",
      "questionText": "...",
      "rationale": "...",
      "evidence": [...],
      "suggestedInterpretation": "Clinical interpretation based on evidence",
      "confidence": 0.85
    }
  ]
}
`.trim();
  }

  /**
   * Get question templates for a metric
   */
  private async getQuestionTemplates(metricId: string): Promise<QuestionTemplate[]> {
    // For now, return hardcoded templates for ORTHO_I25
    // TODO: Load from database or Excel metadata
    if (metricId === 'ORTHO_I25') {
      return [
        {
          metric_id: 'ORTHO_I25',
          category: 'rule_in',
          question_template: 'Is this a true supracondylar fracture requiring urgent surgical intervention?',
          rationale: 'Case classification depends on fracture type and surgical urgency',
          priority: 1
        },
        {
          metric_id: 'ORTHO_I25',
          category: 'rule_in',
          question_template: 'Is the fracture classification documented (Gartland type)?',
          rationale: 'Gartland classification determines urgency and treatment approach',
          priority: 2
        },
        {
          metric_id: 'ORTHO_I25',
          category: 'rule_out',
          question_template: 'Was this patient transferred from an outside facility after initial treatment?',
          rationale: 'Transfers are excluded from metric (time clock starts at original facility)',
          priority: 1
        },
        {
          metric_id: 'ORTHO_I25',
          category: 'rule_out',
          question_template: 'Is this a re-operation for the same injury?',
          rationale: 'Re-operations are excluded from initial timeliness metric',
          priority: 2
        },
        {
          metric_id: 'ORTHO_I25',
          category: 'insight',
          question_template: 'What was the clinical justification for any delay to surgery?',
          rationale: 'Understanding delay context helps determine if this represents a quality gap',
          priority: 1
        },
        {
          metric_id: 'ORTHO_I25',
          category: 'insight',
          question_template: 'Were there documented contraindications to immediate surgery?',
          rationale: 'Contraindications may explain and justify delays',
          priority: 2
        }
      ];
    }

    // Default templates for other metrics
    return [
      {
        metric_id: metricId,
        category: 'rule_in',
        question_template: 'Does this case meet the inclusion criteria for the metric?',
        rationale: 'Verify case qualifies for metric evaluation',
        priority: 1
      },
      {
        metric_id: metricId,
        category: 'rule_out',
        question_template: 'Are there any exclusion criteria that apply to this case?',
        rationale: 'Check for standard exclusions',
        priority: 1
      },
      {
        metric_id: metricId,
        category: 'insight',
        question_template: 'What is the clinical context that matters for this case?',
        rationale: 'Understand clinical reasoning and justifications',
        priority: 1
      }
    ];
  }

  /**
   * Structure the AI response into typed questions
   */
  private structureQuestions(result: any): ReasoningQuestions {
    return {
      ruleInQuestions: result.ruleInQuestions || [],
      ruleOutQuestions: result.ruleOutQuestions || [],
      clinicalInsightQuestions: result.clinicalInsightQuestions || []
    };
  }

  /**
   * Validate a clinician's answer to a reasoning question
   */
  validateAnswer(question: ReasoningQuestion, clinicianAnswer: string): {
    isValid: boolean;
    agreesWithAI: boolean;
    requiresJustification: boolean;
  } {
    const agreesWithAI = clinicianAnswer === question.suggestedAnswer;
    const confidence = question.confidence || 0;

    return {
      isValid: true, // All answers are valid - clinician has final say
      agreesWithAI,
      requiresJustification: !agreesWithAI && confidence > 0.8 // Require justification if disagreeing with high-confidence AI
    };
  }
}

// Export singleton instance
export const reasoningQuestionGenerator = new ReasoningQuestionGenerator();
