import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Filter, Play, Edit } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PatientData } from "@shared/schema";
import { RiskAssessmentSection } from "@/components/risk-assessment-section";
import { PromptEditor } from "@/components/prompt-editor";


interface PatientDataLoaderProps {
  selectedPatient: string;
  onPatientChange: (patient: string) => void;
  editableNotes: string;
  onNotesChange: (notes: string) => void;
  onRunTest: () => void;
  isRunning: boolean;
  selectedQuestion?: string;
  selectedSpecialty?: string;
  showPrompt?: boolean;
}

export function PatientDataLoader({ 
  selectedPatient, 
  onPatientChange, 
  editableNotes, 
  onNotesChange,
  onRunTest,
  isRunning,
  selectedQuestion,
  selectedSpecialty,
  showPrompt = false
}: PatientDataLoaderProps) {
  const { data: patients, isLoading } = useQuery<PatientData[]>({
    queryKey: ['/api/patients']
  });

  const { data: currentPatientData } = useQuery<PatientData>({
    queryKey: ['/api/patients', selectedPatient],
    enabled: !!selectedPatient
  });

  if (!patients || isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse">Loading patient data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Patient Selection - Dropdown with Categories */}
        <div className="mb-6">
          <Select value={selectedPatient} onValueChange={onPatientChange}>
            <SelectTrigger className="w-full" data-testid="select-patient">
              <SelectValue placeholder="Choose a test patient..." />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase tracking-wide">Recently Added to Review</div>
              <SelectItem value="TC_SCH_PASS">TC_SCH_PASS - SCH - On-time case</SelectItem>
              <SelectItem value="TC_SCH_DELAY_CT_NONORTHO_NPO">TC_SCH_DELAY_CT_NONORTHO_NPO - SCH - Delayed case</SelectItem>
              
              <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase tracking-wide mt-2">Recently Added and Reviewed</div>
              <SelectItem value="TC_SCH_MULTIPROC_PLANNED">TC_SCH_MULTIPROC_PLANNED - SCH - Multi-procedure</SelectItem>
              <SelectItem value="TC_OPENFX_LATE_BOTH">TC_OPENFX_LATE_BOTH - Open FX - Late case</SelectItem>
              
              <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase tracking-wide mt-2">Populate Records</div>
              <SelectItem value="TC_SSI_POSITIVE_DEEP">TC_SSI_POSITIVE_DEEP - SSI - Deep infection</SelectItem>
              <SelectItem value="TC_RTO_UNPLANNED">TC_RTO_UNPLANNED - Return to OR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Risk Assessment Signals - Show above the data */}
        {currentPatientData && selectedQuestion && selectedSpecialty && (
          <RiskAssessmentSection 
            selectedQuestion={selectedQuestion}
            selectedPatient={selectedPatient}
            selectedSpecialty={selectedSpecialty}
          />
        )}

        {/* Data Table and Prompt side by side */}
        {currentPatientData && showPrompt && selectedQuestion ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Data Table */}
            <div className="space-y-4">

              
              <div className="overflow-x-auto">
                <Table data-testid="table-patient-data">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(currentPatientData.data).map(([field, value]) => (
                      <TableRow key={field} data-testid={`row-field-${field}`}>
                        <TableCell className="font-medium">{field}</TableCell>
                        <TableCell className="max-w-md truncate" title={String(value)}>
                          {String(value)}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {getFieldSource(field)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Compact Editable Notes Section */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes (Editable)
                </label>
                <Textarea
                  rows={3}
                  placeholder="Add any additional context or notes that should be considered during abstraction..."
                  value={editableNotes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  data-testid="textarea-editable-notes"
                />
                <p className="mt-1 text-xs text-slate-500">
                  These notes will be included in the LLM prompt for more accurate abstraction.
                </p>
              </div>

              {/* Run Test Button */}
              <div className="mt-4 flex justify-end">
                <Button 
                  onClick={onRunTest} 
                  disabled={!selectedPatient || isRunning}
                  data-testid="button-run-test"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isRunning ? "Running..." : "Run LLM Inference"}
                </Button>
              </div>
            </div>

            {/* Right: Prompt Display */}
            <div className="space-y-4">
              <PromptEditor selectedQuestion={selectedQuestion} />
            </div>
          </div>
        ) : currentPatientData ? (
          /* Fallback: Just data table without prompt */
          <div className="space-y-4">

            
            <div className="overflow-x-auto">
              <Table data-testid="table-patient-data">
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(currentPatientData.data).map(([field, value]) => (
                    <TableRow key={field} data-testid={`row-field-${field}`}>
                      <TableCell className="font-medium">{field}</TableCell>
                      <TableCell className="max-w-md truncate" title={String(value)}>
                        {String(value)}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {getFieldSource(field)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Compact Editable Notes Section */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Edit className="h-4 w-4 inline mr-1" />
                Additional Test Case Notes (Editable)
              </label>
              <Textarea
                rows={3}
                placeholder="Add any additional context or notes that should be considered during abstraction..."
                value={editableNotes}
                onChange={(e) => onNotesChange(e.target.value)}
                data-testid="textarea-editable-notes"
              />
              <p className="mt-1 text-xs text-slate-500">
                These notes will be included in the LLM prompt for more accurate abstraction.
              </p>
            </div>

            {/* Run Test Button */}
            <div className="mt-4 flex justify-end">
              <Button 
                onClick={onRunTest} 
                disabled={!selectedPatient || isRunning}
                data-testid="button-run-test"
              >
                <Play className="h-4 w-4 mr-2" />
                {isRunning ? "Running..." : "Run LLM Inference"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function getFieldSource(field: string): string {
  const sourceMap: Record<string, string> = {
    'ArrivalInstant': 'ADT System',
    'IncisionStartInstant': 'OR System',
    'DiagnosisCode': 'EMR',
    'ServiceAtAdmit': 'Provider Data',
    'OperativeNote': 'Clinical Notes',
    'FirstIVAbxInstant': 'Pharmacy',
    'DebridementStart': 'OR System',
    'GustiloClass': 'EMR',
    'DelayReason': 'Clinical Notes',
    'SourceControlStart': 'OR System',
    'LabsImagingText': 'Lab/Imaging',
    'FixationStart': 'OR System',
    'StabilityType': 'Radiology',
    'CultureResult': 'Lab System',
    'NewPostopAntibiotics': 'Pharmacy',
    'WoundSignsText': 'Nursing Notes',
    'ProcedureCategory': 'OR System',
    'ReturnToOR': 'Surgical Records',
    'Evidence': 'Compiled'
  };
  
  return sourceMap[field] || 'EMR';
}
