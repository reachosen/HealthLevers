/**
 * Clinical Summary Generator
 *
 * Generates AI-powered clinical summaries from raw encounter JSON payloads.
 * Extracts the "critical 20%" - the most important clinical information
 * relevant to the specific quality metric being reviewed.
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

export interface MetricContext {
  metric_id: string;
  metric_name: string;
  threshold_hours?: number;
  domain: string;
  question_code: string;
}

export class ClinicalSummaryGenerator {
  /**
   * Generate a clinical summary for a case
   */
  async generateSummary(
    encounterPayload: any,
    metricContext: MetricContext
  ): Promise<ClinicalSummary> {
    const prompt = this.buildPrompt(encounterPayload, metricContext);

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a medical chart abstraction assistant. You extract concise, clinically relevant summaries from encounter data.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000,
      });

      const rawText = response.choices[0].message.content || '';
      return this.parseSummary(rawText, encounterPayload);
    } catch (error) {
      console.error('Error generating clinical summary:', error);
      throw new Error('Failed to generate clinical summary');
    }
  }

  /**
   * Build the prompt for clinical summary generation
   */
  private buildPrompt(encounterPayload: any, metricContext: MetricContext): string {
    const encounterJSON = JSON.stringify(encounterPayload, null, 2);

    return `
You are extracting a clinical summary from an encounter record for quality metric review.

METRIC CONTEXT:
- Metric ID: ${metricContext.metric_id}
- Metric Name: ${metricContext.metric_name}
- Question Code: ${metricContext.question_code}
- Domain: ${metricContext.domain}
${metricContext.threshold_hours ? `- Threshold: ${metricContext.threshold_hours} hours` : ''}

ENCOUNTER DATA:
\`\`\`json
${encounterJSON}
\`\`\`

Extract the most important clinical information relevant to this metric. Create a narrative summary with these sections:

1. 🧒 PATIENT
   - Age, weight, gender, relevant demographics
   - Keep to 3-4 bullet points

2. 📋 PRESENTATION
   - Chief complaint
   - Mechanism of injury/illness
   - Timeline to ED arrival
   - Keep to 4-5 bullet points

3. 🦴 INJURY/CONDITION ASSESSMENT (or 🫀 for cardiology, 🧠 for neuro, etc.)
   - Primary diagnosis
   - Severity/classification
   - Key clinical findings (neurovascular status, vital signs, etc.)
   - Complications or concerns
   - Keep to 5-7 bullet points

4. ⏱️ CRITICAL TIMELINE
   - Key timestamps in chronological order
   - Calculate time deltas between critical events
   - Highlight the metric-relevant time period
   - Keep to 5-7 bullet points

5. 🚩 KEY CLINICAL CONSIDERATIONS
   - Delays and their justifications
   - Contraindications or special factors
   - Quality metric result (meets/fails threshold)
   - Keep to 3-5 bullet points

FORMAT:
- Use bullet points (•) for each item
- Be concise but complete
- Include specific times, numbers, classifications
- After each section, list JSON paths where information was found
- Highlight the final metric result in bold

EXAMPLE OUTPUT FORMAT:

🧒 PATIENT
• Age: 6 years old
• Weight: 20.5 kg
• Gender: Male

📋 PRESENTATION
• Mechanism: Fall from monkey bars
• Time of injury: Jan 15, 2024 06:00
• ED arrival: Jan 15, 2024 07:00 (1 hour post-injury)

[continue with other sections...]

Do NOT include field names or technical jargon. Write in natural clinical language as you would present the case.
`.trim();
  }

  /**
   * Parse the AI response into structured sections
   */
  private parseSummary(rawText: string, encounterPayload: any): ClinicalSummary {
    const sections = {
      patient: this.extractSection(rawText, '🧒', ['age', 'weight', 'gender']),
      presentation: this.extractSection(rawText, '📋', ['chief_complaint', 'mechanism', 'ed']),
      assessment: this.extractSection(rawText, /🦴|🫀|🧠|💊/, ['diagnosis', 'injury', 'condition']),
      timeline: this.extractSection(rawText, '⏱️', ['timeline', 'time']),
      keyConsiderations: this.extractSection(rawText, '🚩', ['delay', 'consideration', 'threshold']),
    };

    return {
      ...sections,
      rawText
    };
  }

  /**
   * Extract a specific section from the summary text
   */
  private extractSection(
    text: string,
    sectionMarker: string | RegExp,
    keywords: string[]
  ): ClinicalSummarySection {
    const markerRegex = typeof sectionMarker === 'string'
      ? new RegExp(`${sectionMarker}\\s*([A-Z\\s]+)`, 'i')
      : sectionMarker;

    const match = text.match(markerRegex);
    if (!match) {
      return {
        title: '',
        emoji: '',
        content: [],
        citations: []
      };
    }

    const emoji = typeof sectionMarker === 'string' ? sectionMarker : match[0][0];
    const title = match[1] ? match[1].trim() : '';

    // Find content between this section and the next emoji section
    const sectionStart = text.indexOf(match[0]);
    const nextSectionMatch = text.slice(sectionStart + 1).match(/[🧒📋🦴🫀🧠💊⏱️🚩]/);
    const sectionEnd = nextSectionMatch
      ? sectionStart + 1 + text.slice(sectionStart + 1).indexOf(nextSectionMatch[0])
      : text.length;

    const sectionText = text.slice(sectionStart, sectionEnd);

    // Extract bullet points
    const bullets = sectionText
      .split('\n')
      .filter(line => line.trim().startsWith('•'))
      .map(line => line.trim().replace(/^•\s*/, ''));

    // Extract citations (JSON paths)
    const citations = this.extractCitations(sectionText);

    return {
      title,
      emoji,
      content: bullets,
      citations
    };
  }

  /**
   * Extract JSON path citations from text
   */
  private extractCitations(text: string): string[] {
    const citationPattern = /encounter\.[a-zA-Z0-9_.*[\]]+/g;
    const matches = text.match(citationPattern) || [];
    return [...new Set(matches)]; // Deduplicate
  }

  /**
   * Generate a simplified summary for display
   */
  async generateQuickSummary(encounterPayload: any, metricContext: MetricContext): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a medical chart abstraction assistant. Provide ultra-concise one-line summaries.'
          },
          {
            role: 'user',
            content: `Summarize this case in one sentence for ${metricContext.metric_name}:\n\n${JSON.stringify(encounterPayload, null, 2)}`
          }
        ],
        temperature: 0.2,
        max_tokens: 100,
      });

      return response.choices[0].message.content || 'Case summary unavailable';
    } catch (error) {
      console.error('Error generating quick summary:', error);
      return 'Unable to generate summary';
    }
  }
}

// Export singleton instance
export const clinicalSummaryGenerator = new ClinicalSummaryGenerator();
