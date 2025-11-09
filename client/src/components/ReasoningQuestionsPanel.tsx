/**
 * Reasoning Questions Panel
 *
 * Displays dynamic AI-generated reasoning questions to help clinicians
 * make informed decisions about case classification
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { CheckCircle2, XCircle, Lightbulb, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import type { ReasoningQuestion, ReasoningQuestions } from '@/hooks/useCaseReview';

interface ReasoningQuestionsPanelProps {
  questions: ReasoningQuestions;
  onAnswerQuestion?: (questionId: string, answer: string) => void;
  onAskAI?: (question: ReasoningQuestion) => void;
}

export function ReasoningQuestionsPanel({
  questions,
  onAnswerQuestion,
  onAskAI
}: ReasoningQuestionsPanelProps) {
  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="text-2xl">🤖</div>
          <CardTitle className="text-xl">Dynamic Reasoning Questions</CardTitle>
          <Badge variant="secondary" className="ml-2">
            AI-Generated
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          These questions help you determine if this case should be included, excluded,
          or requires special consideration
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Rule In Questions */}
        {questions.ruleInQuestions.length > 0 && (
          <QuestionCategory
            icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
            title="Rule In (Inclusion Criteria)"
            description="Does this case qualify for the metric?"
            questions={questions.ruleInQuestions}
            variant="success"
            onAnswerQuestion={onAnswerQuestion}
            onAskAI={onAskAI}
          />
        )}

        {/* Rule Out Questions */}
        {questions.ruleOutQuestions.length > 0 && (
          <QuestionCategory
            icon={<XCircle className="h-5 w-5 text-red-600" />}
            title="Rule Out (Exclusion Criteria)"
            description="Should this case be excluded?"
            questions={questions.ruleOutQuestions}
            variant="danger"
            onAnswerQuestion={onAnswerQuestion}
            onAskAI={onAskAI}
          />
        )}

        {/* Clinical Insight Questions */}
        {questions.clinicalInsightQuestions.length > 0 && (
          <QuestionCategory
            icon={<Lightbulb className="h-5 w-5 text-blue-600" />}
            title="Clinical Insight (Contextual Understanding)"
            description="What context matters for this case?"
            questions={questions.clinicalInsightQuestions}
            variant="info"
            onAnswerQuestion={onAnswerQuestion}
            onAskAI={onAskAI}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface QuestionCategoryProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  questions: ReasoningQuestion[];
  variant: 'success' | 'danger' | 'info';
  onAnswerQuestion?: (questionId: string, answer: string) => void;
  onAskAI?: (question: ReasoningQuestion) => void;
}

function QuestionCategory({
  icon,
  title,
  description,
  questions,
  variant,
  onAnswerQuestion,
  onAskAI
}: QuestionCategoryProps) {
  const bgColor = {
    success: 'bg-green-50',
    danger: 'bg-red-50',
    info: 'bg-blue-50'
  }[variant];

  const borderColor = {
    success: 'border-green-200',
    danger: 'border-red-200',
    info: 'border-blue-200'
  }[variant];

  return (
    <div className={`p-4 rounded-lg border-2 ${bgColor} ${borderColor}`}>
      <div className="flex items-start gap-3 mb-4">
        {icon}
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.questionId || index}
            question={question}
            variant={variant}
            onAnswerQuestion={onAnswerQuestion}
            onAskAI={onAskAI}
          />
        ))}
      </div>
    </div>
  );
}

interface QuestionCardProps {
  question: ReasoningQuestion;
  variant: 'success' | 'danger' | 'info';
  onAnswerQuestion?: (questionId: string, answer: string) => void;
  onAskAI?: (question: ReasoningQuestion) => void;
}

function QuestionCard({ question, variant, onAnswerQuestion, onAskAI }: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState('');
  const [showEvidence, setShowEvidence] = useState(true);

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
    if (onAnswerQuestion) {
      onAnswerQuestion(question.questionId, answer);
    }
  };

  const handleCustomAnswerSubmit = () => {
    if (customAnswer.trim() && onAnswerQuestion) {
      onAnswerQuestion(question.questionId, customAnswer);
    }
  };

  const isInsightQuestion = question.category === 'context';

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      {/* Question Text */}
      <div className="mb-3">
        <p className="font-medium text-base">{question.questionText}</p>
      </div>

      {/* Rationale */}
      <div className="mb-3 flex items-start gap-2">
        <span className="text-xs text-muted-foreground mt-0.5">💡</span>
        <p className="text-sm text-gray-600">
          <strong>Why asking:</strong> {question.rationale}
        </p>
      </div>

      {/* Evidence Section */}
      {question.evidence.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowEvidence(!showEvidence)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 mb-2"
          >
            {showEvidence ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            🔍 Evidence Found ({question.evidence.length})
          </button>

          {showEvidence && (
            <div className="space-y-2 pl-6">
              {question.evidence.map((evidence, index) => (
                <div key={index} className="text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <div className="flex-1">
                      {evidence.text ? (
                        <p className="text-gray-700">{evidence.text}</p>
                      ) : (
                        <p className="text-gray-500 italic">None found</p>
                      )}
                      <code className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">
                        {evidence.source}
                      </code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Answer Options (for Rule In/Out questions) */}
      {!isInsightQuestion && question.answerOptions && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Your assessment:</p>
          <div className="space-y-2">
            {question.answerOptions.map((option) => (
              <label
                key={option}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name={`question-${question.questionId}`}
                  value={option}
                  checked={selectedAnswer === option}
                  onChange={(e) => handleAnswerSelect(e.target.value)}
                  className="h-4 w-4"
                />
                <span className="text-sm flex-1">{option}</span>
                {option === question.suggestedAnswer && (
                  <Badge variant="secondary" className="text-xs">
                    AI suggests ({Math.round((question.confidence || 0) * 100)}%)
                  </Badge>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Interpretation Field (for Clinical Insight questions) */}
      {isInsightQuestion && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Your interpretation:</p>
          {question.suggestedInterpretation && (
            <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong className="text-blue-700">AI Suggestion:</strong>{' '}
                {question.suggestedInterpretation}
              </p>
            </div>
          )}
          <Textarea
            placeholder="Enter your clinical interpretation..."
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <Button
            size="sm"
            onClick={handleCustomAnswerSubmit}
            className="mt-2"
            disabled={!customAnswer.trim()}
          >
            Save Interpretation
          </Button>
        </div>
      )}

      {/* Ask LLM Button */}
      {onAskAI && (
        <div className="pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAskAI(question)}
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Ask LLM for Clarification
          </Button>
        </div>
      )}
    </div>
  );
}

export default ReasoningQuestionsPanel;
