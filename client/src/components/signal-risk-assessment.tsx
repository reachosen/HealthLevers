import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SpecialtyConfig } from "@shared/schema";
import { SignalChip } from "@/components/signal-chip";

interface SignalRiskAssessmentProps {
  selectedSpecialty: string;
  selectedQuestion: string;
  selectedPatient: string;
  results?: any;
}

export function SignalRiskAssessment({ 
  selectedSpecialty, 
  selectedQuestion, 
  selectedPatient, 
  results 
}: SignalRiskAssessmentProps) {
  const { data: specialty } = useQuery<SpecialtyConfig>({
    queryKey: ['/api/specialties', selectedSpecialty],
    enabled: !!selectedSpecialty
  });

  // Fetch precomputed signals when both question and patient are selected
  const { data: testcaseData } = useQuery<{
    patient_payload: any;
    signals: Array<{check: string; status: string; evidence: string}>;
    category_counts: Record<string, number>;
  }>({
    queryKey: ['/api/testcase', selectedPatient, selectedQuestion],
    enabled: !!selectedPatient && !!selectedQuestion
  });

  const selectedQuestionData = specialty?.questions.find(q => q.id === selectedQuestion);

  if (!selectedQuestionData || !selectedQuestionData.signal_chips) {
    return null;
  }

  // Count risk levels
  const riskCounts = {
    fail: testcaseData?.signals?.filter(s => s.status === "fail").length || 0,
    pass: testcaseData?.signals?.filter(s => s.status === "pass").length || 0,
    caution: testcaseData?.signals?.filter(s => s.status === "caution").length || 0,
    inactive: testcaseData?.signals?.filter(s => s.status === "inactive").length || 0
  };

  const totalActive = riskCounts.fail + riskCounts.pass + riskCounts.caution;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Target className="h-5 w-5 text-primary mr-2" />
          Step 3: Risk Assessment Signals
          {totalActive > 0 && (
            <div className="ml-auto flex items-center space-x-2 text-sm">
              {riskCounts.fail > 0 && (
                <span className="text-red-600 font-medium" data-testid="fail-count">
                  {riskCounts.fail} High Risk
                </span>
              )}
              {riskCounts.caution > 0 && (
                <span className="text-yellow-600 font-medium" data-testid="caution-count">
                  {riskCounts.caution} Medium Risk
                </span>
              )}
              {riskCounts.pass > 0 && (
                <span className="text-green-600 font-medium" data-testid="pass-count">
                  {riskCounts.pass} Low Risk
                </span>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!testcaseData ? (
          <div className="text-center text-slate-500 py-8" data-testid="signals-loading">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-slate-400" />
            Loading risk assessment for test case...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">
                Signal Risk Assessment for {selectedPatient}
              </h4>
              <p className="text-xs text-slate-600 mb-3">
                These signals show real-time risk assessment based on the selected test case data:
              </p>
              
              <div className="flex flex-wrap gap-2" data-testid="risk-signal-chips">
                {selectedQuestionData.signal_chips.map((chip: string) => {
                  // Use precomputed signals from testcase endpoint
                  const signal = testcaseData.signals?.find((s: any) => s.check === chip);
                  const status = signal?.status ?? "inactive";
                  const evidence = signal?.evidence || "No evidence available";
                  const tip = selectedQuestionData.signal_defs?.[chip] 
                    ? `${selectedQuestionData.signal_defs[chip].definition} • Rule: ${selectedQuestionData.signal_defs[chip].rule} • Evidence: ${evidence}`
                    : `${chip} - ${evidence}`;
                    
                  return (
                    <SignalChip 
                      key={chip} 
                      label={chip} 
                      status={status} 
                      tooltip={tip} 
                    />
                  );
                })}
              </div>

              {totalActive > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-300">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Risk Assessment Summary:</span>
                    <span className="font-medium">
                      {totalActive} of {selectedQuestionData.signal_chips.length} signals active
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}