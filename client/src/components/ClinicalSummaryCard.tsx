/**
 * Clinical Summary Card
 *
 * Displays AI-generated clinical summary with narrative sections
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import type { ClinicalSummary } from '@/hooks/useCaseReview';

interface ClinicalSummaryCardProps {
  summary: ClinicalSummary;
  onViewRawJSON?: () => void;
}

export function ClinicalSummaryCard({ summary, onViewRawJSON }: ClinicalSummaryCardProps) {
  const [showCitations, setShowCitations] = useState(false);

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-2xl">📊</div>
            <CardTitle className="text-xl">Clinical Summary</CardTitle>
            <Badge variant="secondary" className="ml-2">
              AI-Generated
            </Badge>
          </div>
          {onViewRawJSON && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewRawJSON}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              View Raw JSON
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          This summary was generated from the encounter payload, highlighting the most important clinical information for this metric.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Patient Section */}
        {summary.patient.content.length > 0 && (
          <SummarySection
            emoji={summary.patient.emoji}
            title={summary.patient.title}
            content={summary.patient.content}
            citations={summary.patient.citations}
            showCitations={showCitations}
          />
        )}

        {/* Presentation Section */}
        {summary.presentation.content.length > 0 && (
          <SummarySection
            emoji={summary.presentation.emoji}
            title={summary.presentation.title}
            content={summary.presentation.content}
            citations={summary.presentation.citations}
            showCitations={showCitations}
          />
        )}

        {/* Assessment Section */}
        {summary.assessment.content.length > 0 && (
          <SummarySection
            emoji={summary.assessment.emoji}
            title={summary.assessment.title}
            content={summary.assessment.content}
            citations={summary.assessment.citations}
            showCitations={showCitations}
          />
        )}

        {/* Timeline Section */}
        {summary.timeline.content.length > 0 && (
          <SummarySection
            emoji={summary.timeline.emoji}
            title={summary.timeline.title}
            content={summary.timeline.content}
            citations={summary.timeline.citations}
            showCitations={showCitations}
            highlight={true}
          />
        )}

        {/* Key Considerations Section */}
        {summary.keyConsiderations.content.length > 0 && (
          <SummarySection
            emoji={summary.keyConsiderations.emoji}
            title={summary.keyConsiderations.title}
            content={summary.keyConsiderations.content}
            citations={summary.keyConsiderations.citations}
            showCitations={showCitations}
            variant="warning"
          />
        )}

        {/* Citations Toggle */}
        <div className="pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCitations(!showCitations)}
            className="gap-2"
          >
            {showCitations ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide Citations
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show Citations
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface SummarySectionProps {
  emoji: string;
  title: string;
  content: string[];
  citations: string[];
  showCitations: boolean;
  highlight?: boolean;
  variant?: 'default' | 'warning';
}

function SummarySection({
  emoji,
  title,
  content,
  citations,
  showCitations,
  highlight = false,
  variant = 'default'
}: SummarySectionProps) {
  const bgColor = variant === 'warning' ? 'bg-amber-50' : highlight ? 'bg-blue-100' : 'bg-gray-50';
  const borderColor = variant === 'warning' ? 'border-amber-200' : highlight ? 'border-blue-300' : 'border-gray-200';

  return (
    <div className={`p-4 rounded-lg border ${bgColor} ${borderColor}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{emoji}</span>
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>

      <ul className="space-y-2">
        {content.map((item, index) => {
          // Check if item contains bold text (indicated by ** in markdown)
          const hasBold = item.includes('**');

          return (
            <li key={index} className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              {hasBold ? (
                <span
                  className="flex-1"
                  dangerouslySetInnerHTML={{
                    __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  }}
                />
              ) : (
                <span className="flex-1">{item}</span>
              )}
            </li>
          );
        })}
      </ul>

      {showCitations && citations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <p className="text-xs text-gray-600 font-medium mb-1">Data Sources:</p>
          <div className="flex flex-wrap gap-1">
            {citations.map((citation, index) => (
              <code
                key={index}
                className="text-xs bg-white px-2 py-1 rounded border border-gray-300"
              >
                {citation}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ClinicalSummaryCard;
