import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Play } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getModulesForSpecialty } from "@/data/specialtyMetadata";
import { useSpecialties } from "@/hooks/useSpecialties";
import ChipButton from "@/components/ui/ChipButton";
import Navbar from "@/components/Navbar";
import EvidenceAssist from "@/components/EvidenceAssist";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import { mapIntakeToAbstractionModuleId } from "@/data/moduleIdMapping";
import { USNWR_MATRIX, listGroups } from "@/types/usnwrMatrix";
import { usePromptStore } from "@/lib/promptStore";
import { PromptPlayProvider, PromptPlayDrawer, PromptPlayTrigger, usePromptPlay, PromptPlayBadge } from "@/components/PromptPlay";
import { apiRequest } from "@/lib/queryClient";
import { withLocalStore, withApiClient, withStaticConfig, recordOnce } from "@/lib/provenance";
import { canonicalizeMergedSignals } from "@/lib/signalCanonicalizer";
import { record } from "@/lib/provenance";

// Import demo cases from JSON configuration  
import DEMO_CASES from "@/data/demoCases.json";

// Signal follow-up mapping for chip interactions
const SIGNAL_FOLLOWUPS: Record<string, string> = {
  "dx_confirmed": "Does the operative report confirm diagnosis?",
  "possible_miscoding": "Any miscoding of diagnosis/procedure?",
  "borderline_threshold": "Was incision within ≤19h cutoff?",
  "conflicting_timestamps": "Were ED vs OR times conflicting?",
  "comorbidity_delaying_surgery": "Did underlying conditions delay surgery?",
  "higher_priority_injury": "Did another injury take precedence?",
  "non_ortho_admit": "Was admission service non-ortho?",
  "pre_op_npo_violation": "Was there an NPO violation delaying case?",
  "extra_testing_needed_ct": "Did CT/imaging cause delay?",
  "non_ortho_consult_delay": "Did a consult outside ortho cause delay?",
  "multi_procedure_session": "Was this a multi-procedure session?",
  "non_operative_elective_plan": "Was case managed non-op or elective?",
  "or_specialist_unavailable": "Was OR/specialist availability a factor?",
  "open_contaminated_injury": "Was injury open/contaminated?",
  "antibiotics_started_timely": "Were antibiotics started urgently?",
  "stabilization_for_other_injuries": "Did other injuries require stabilization first?",
  "imaging_lab_delay": "Did imaging/labs delay care?",
  "cdc_nhsn_criteria_met": "Did SSI meet CDC/NHSN criteria?",
  "superficial_vs_deep_organ": "Was SSI superficial vs deep/organ?",
  "operative_debridement_done": "Was debridement performed?",
  "planned_staged_return": "Was return a planned staged procedure?",
  "unplanned_return": "Was return unplanned?",
  "fixation_loss": "Was fixation loss documented?",
  "hardware_revised_removed": "Was hardware revised or removed?",
  "pain_wound_cast_problem": "Was revisit for pain/wound/cast issue?",
  "imaging_of_index_site": "Was imaging for index site done?",
  "unrelated_illness": "Was revisit unrelated illness?",
  "scheduled_follow_up_mis_coded": "Was revisit mis-coded scheduled follow-up?",
  "normal_pre_op_exam": "Was pre-op NV exam normal?",
  "new_persistent_deficit": "Was NV deficit persistent?",
  "transient_deficit": "Was NV deficit transient?",
  "vascular_consult_done": "Was vascular consult performed?",
  "rom_loss": "Was there ROM loss?",
  "gait_change": "Was gait change documented?",
  "functional_limitation": "Was functional limitation noted?",
  "assistive_device_still_needed": "Was assistive device still required?",
  "failure_mode_breakage_migration_loosening": "What was implant failure mode?",
  "trauma_vs_gradual": "Was implant failure due to trauma vs gradual?",
  "revision_removal_done": "Was revision/removal performed?",
  "dvt_pe_confirmed": "Was VTE confirmed by imaging?",
  "prophylaxis_ordered": "Was prophylaxis ordered?",
  "prophylaxis_timing_appropriate": "Was prophylaxis timing appropriate?",
  "high_risk_patient_flag": "Was patient high-risk?",
  "clinical_signs_present": "What clinical signs prompted dx?",
  "fasciotomy_performed": "Was fasciotomy performed?",
  "linked_to_index_injury_surgery": "Was compartment syndrome linked to index case?",
  "death_peri_op": "Was death peri-op?",
  "later_death": "Was death later (post-discharge)?",
  "ortho_complication_cause": "Was death due to ortho complication?",
  "palliative_intent_documented": "Was palliative intent documented?"
};

type SignalResult = {
  check: string;
  status: "pass" | "fail" | "caution" | "inactive";
  evidence: string;
};

type ProcessedCase = {
  patient_payload: any;
  signals: SignalResult[];
  mergedSignals: Array<{
    id: string;
    label: string;
    status: string;
    evidence: string;
    group?: string;
    enriched?: boolean;
  }>;
  category_counts: Record<string, number>;
  selectedSpecialty: string;
  selectedModule: string;
  selectedModuleId: string; // Add the module ID for proper handoff
  selectedCaseId: string;
  loadedAt: string;
  loadedBy: string;
  readyForReview?: boolean;
  reviewTimestamp?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  promptVersionUsed?: {
    promptId: string;
    versionId: string;
    timestamp: string;
  };
  fromCache?: boolean;
  cacheTimestamp?: string;
};

// Utility to strip existing signal data from JSON
function stripSignals(json: any) {
  const copy = JSON.parse(JSON.stringify(json));
  delete copy.signals;
  delete copy.aisignals;
  delete copy.category_counts;
  delete copy.mergedSignals;
  return copy;
}

interface IntakePageProps {
  selectedSpecialty: string;
  onSpecialtyChange: (specialty: string) => void;
  availableSpecialties?: string[];
}

export default function IntakePage({ 
  selectedSpecialty: propSelectedSpecialty, 
  onSpecialtyChange: propOnSpecialtyChange,
  availableSpecialties = []
}: IntakePageProps) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { getPrompt } = usePromptStore();
  
  const pp = usePromptPlay();
  
  const [jsonInput, setJsonInput] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState(propSelectedSpecialty);
  
  // Force refresh mechanism to clear all caches
  const forceRefresh = () => {
    console.log('🔄 FORCE REFRESH: Clearing all caches and resetting state');
    
    // Clear localStorage caches
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.startsWith('processed_') || 
      key === 'abstraction.cases' || 
      key === 'currentCase'
    );
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🗑️ Cleared cache: ${key}`);
    });
    
    // Reset form input
    setJsonInput("");
    
    console.log('✅ Force refresh complete - ready for fresh processing');
  };
  
  // Auto force refresh on page load to ensure fresh state
  useEffect(() => {
    console.log('🔄 Auto-refreshing intake page for fresh state');
    forceRefresh();
  }, []); // Run once on mount
  
  // Sync with parent component
  useEffect(() => {
    setSelectedSpecialty(propSelectedSpecialty);
  }, [propSelectedSpecialty]);
  const [selectedModuleId, setSelectedModuleId] = useState("timeliness_sch");
  const [processedCase, setProcessedCase] = useState<ProcessedCase | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFollowup, setSelectedFollowup] = useState<string | null>(null);
  const [showPromptUsed, setShowPromptUsed] = useState(false);
  const [assertions, setAssertions] = useState<any[]>([]);
  const [assertionsValidated, setAssertionsValidated] = useState(false);
  const [selectedSignalForEvidence, setSelectedSignalForEvidence] = useState<any>(null);

  // Function to get demo cases for current selections
  const getDemoCasesForModule = () => {
    if (!selectedSpecialty || !selectedModuleId) return [];
    
    const specialtyCases = DEMO_CASES[selectedSpecialty as keyof typeof DEMO_CASES];
    if (!specialtyCases) return [];
    
    const moduleCases = specialtyCases[selectedModuleId as keyof typeof specialtyCases];
    return moduleCases || [];
  };

  // Chip click handler to set follow-up question
  const handleChipClick = (signalId: string) => {
    const followupQuestion = SIGNAL_FOLLOWUPS[signalId];
    setSelectedFollowup(followupQuestion || null);
  };

  // Helper function to resolve cite paths into payload data (reused from Home)
  function getByPath(payload: any, path: string): any {
    try {
      return path
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .filter(Boolean)
        .reduce((acc, key) => (acc == null ? acc : acc[key]), payload);
    } catch { 
      return undefined; 
    }
  }

  // Resolve cites to items for Evidence Drawer
  function resolveCitesToItems(payload: any, cites: string[]) {
    return (cites ?? [])
      .map((p) => ({ path: p, item: getByPath(payload, p) }))
      .filter((x) => x.item != null);
  }

  // Persist last selection to localStorage
  useEffect(() => {
    const key = "intake.scope";
    const saved = JSON.parse(withLocalStore.get(key) || "null");
    if (saved && saved.specialty && saved.moduleId) {
      setSelectedSpecialty(saved.specialty);
      setSelectedModuleId(saved.moduleId);
    }
  }, []);

  useEffect(() => {
    const key = "intake.scope";
    withLocalStore.set(key, JSON.stringify({ 
      specialty: selectedSpecialty, 
      moduleId: selectedModuleId 
    }));
  }, [selectedSpecialty, selectedModuleId]);

  const { specialties } = useSpecialties();
  const modules = getModulesForSpecialty(selectedSpecialty);
  const selectedModule = USNWR_MATRIX.find(m => m.id === selectedModuleId);
  console.log('🔍 Looking for module:', selectedModuleId, 'Found:', selectedModule ? `${selectedModule.id} (${selectedModule.title})` : 'NOT FOUND');

  // File upload handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const json = JSON.parse(content);
          setJsonInput(JSON.stringify(json, null, 2));
          setError(null);
        } catch (error) {
          setError("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    } else {
      setError("Please select a valid JSON file");
    }
  };

  // Process patient data function
  const processPatientData = async (forceReprocess = false) => {
    if (!jsonInput.trim() || !selectedModule) return;
    
    setIsProcessing(true);
    setError(null);
    
    // Register prompt execution with prompt@play
    const t0 = performance.now();
    const promptId = `${selectedSpecialty.toLowerCase()}-${selectedModule.id}`;
    const variables = {
      specialty: selectedSpecialty,
      moduleId: selectedModuleId,
      caseId: "intake-generated",
      counts: { notes: (JSON.parse(jsonInput)?.notes ?? []).length }
    };

    const runId = pp.register({
      promptId,
      type: "signal_processing",
      version: "v1",
      variables,
      model: "gpt-4o-mini",
      params: { temperature: 0.2 },
      contextRef: "#intake-generate"
    });
    
    
    try {
      const rawJson = JSON.parse(jsonInput);
      const cleanedJson = stripSignals(rawJson);
      
      // Cache check
      const caseId = rawJson.id || `INTAKE_${Date.now()}`;
      const cacheKey = `processed_${caseId}_${selectedModule.id}_${selectedSpecialty}`;
      
      if (!forceReprocess) {
        const cached = withLocalStore.get(cacheKey);
        if (cached) {
          console.log('📋 Using cached processing results');
          const cachedCase = JSON.parse(cached);
          
          // Complete prompt@play for cached results
          pp.complete(runId, {
            output: { ...cachedCase, fromCache: true },
            metrics: { totalMs: Math.round(performance.now() - t0), cached: true },
            resolvedPrompt: "Using cached results - no AI call made"
          });
          
          setProcessedCase({
            ...cachedCase,
            fromCache: true,
            cacheTimestamp: new Date().toISOString()
          });
          setIsProcessing(false);
          return;
        }
      }
      
      // Get prompt for signal processing
      const prompt = getPrompt({ 
        specialty: selectedSpecialty, 
        moduleId: selectedModule.id, 
        type: "signal_processing" as const
      });
      
      if (!prompt) {
        const errorMsg = `No signal processing prompt found for ${selectedSpecialty}:${selectedModule.id}:signal_processing`;
        setError(errorMsg);
        
        // Complete prompt@play with error
        pp.complete(runId, {
          output: { error: errorMsg },
          metrics: { totalMs: Math.round(performance.now() - t0) }
        });
        
        setIsProcessing(false);
        return;
      }
      
      const response = await withApiClient('/api/ai_signals', {
        specialty: selectedSpecialty,
        moduleId: selectedModuleId,
        moduleSignals: selectedModule.signals,
        patient: cleanedJson,
        promptText: prompt.versions?.[0]?.content || (prompt.versions as any)?.[prompt.currentVersionId || 'v1']?.content || 'Analyze the patient data for quality signals.'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Signal processing failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      const mergedSignals = result.signals?.map((signal: any) => {
        const moduleSignal = selectedModule.signals.find((s: any) => s.id === signal.id);
        const mappedSignal = {
          id: signal.id,
          label: moduleSignal?.label || signal.id,
          status: signal.status,
          evidence: signal.evidence,
          cites: signal.cites || [],
          group: moduleSignal?.group || "Core"
        };
        
        console.log(`📊 Signal Mapping: ${signal.id} → group: ${mappedSignal.group}, status: ${mappedSignal.status}`);
        
        // Record signal cites for provenance
        if (mappedSignal.cites?.length > 0 && typeof recordOnce === 'function') {
          recordOnce({
            source: 'computed',
            key: 'intake.signal.cites',
            detail: { id: mappedSignal.id, citesCount: mappedSignal.cites.length },
            ts: Date.now(),
            page: location
          });
        }
        
        return mappedSignal;
      }) || [];

      // Canonicalize signal IDs for consistent Home page mapping
      const canonicalizedSignals = canonicalizeMergedSignals(selectedModuleId, mergedSignals);
      
      console.log('🔧 ID Canonicalization:', {
        before: mergedSignals.map((s: any) => s.id),
        after: canonicalizedSignals.map((s: any) => s.id),
        differences: mergedSignals.filter((s: any, i: number) => s.id !== canonicalizedSignals[i].id).map((s: any) => s.id)
      });
      
      console.log('📈 Final mergedSignals:', canonicalizedSignals.map((s: any) => `${s.id}:${s.group}:${s.status}`));
      
      const processedCase: ProcessedCase = {
        patient_payload: cleanedJson,
        signals: result.signals || [],
        mergedSignals: canonicalizedSignals,
        category_counts: result.category_counts || { pass: 0, fail: 0, caution: 0, inactive: 0 },
        selectedSpecialty,
        selectedModule: selectedModule.title,
        selectedModuleId,
        selectedCaseId: caseId,
        loadedAt: new Date().toISOString(),
        loadedBy: (user as any)?.email || "unknown",
        promptVersionUsed: {
          promptId: `${selectedSpecialty}:${selectedModule.id}:signal_processing`,
          versionId: prompt.currentVersionId || 'v1',
          timestamp: new Date().toISOString()
        }
      };
      
      // Complete prompt execution tracking
      const completionData = {
        output: processedCase,
        metrics: { totalMs: Math.round(performance.now() - t0) },
        resolvedPrompt: prompt?.versions?.[0]?.content || "No template available",
        meta: { 
          promptId,
          type: "signal_processing",
          version: "v1"
        }
      };
      
      pp.complete(runId, completionData);
      
      // Cache the result
      withLocalStore.set(cacheKey, JSON.stringify(processedCase));
      setProcessedCase(processedCase);
      
    } catch (error) {
      console.error('Processing error:', error);
      
      // Complete prompt execution with error
      pp.complete(runId, {
        output: { error: String(error) },
        metrics: { totalMs: Math.round(performance.now() - t0) },
        resolvedPrompt: "Error occurred before AI call"
      });
      
      setError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Signal organization helper with enhanced debugging
  const organizedSignals = useMemo(() => {
    if (!processedCase?.mergedSignals) {
      console.log('❌ No mergedSignals in processedCase');
      return null;
    }
    
    const signalGroups = selectedModule?.groups || ["Core", "Delay Drivers", "Documentation", "Ruleouts"];
    const byGroup: Record<string, any[]> = {};
    const groupCounts: Record<string, Record<string, number>> = {};
    
    signalGroups.forEach(group => {
      byGroup[group] = [];
      groupCounts[group] = { pass: 0, fail: 0, caution: 0, inactive: 0 };
    });
    
    console.log('🏗️ Signal Organization:', {
      totalSignals: processedCase.mergedSignals.length,
      availableGroups: signalGroups,
      signalsByGroup: processedCase.mergedSignals.map(s => `${s.id}:${s.group}:${s.status}`)
    });
    
    processedCase.mergedSignals.forEach(signal => {
      const group = signal.group || "Core";
      if (byGroup[group]) {
        byGroup[group].push(signal);
        if (groupCounts[group] && groupCounts[group][signal.status] !== undefined) {
          groupCounts[group][signal.status]++;
          console.log(`📊 Count Update: ${group}.${signal.status} = ${groupCounts[group][signal.status]}`);
        }
      } else {
        console.warn(`⚠️ Unknown group "${group}" for signal ${signal.id}`);
      }
    });
    
    console.log('📋 Final Group Counts:', groupCounts);
    return { byGroup, groupCounts };
  }, [processedCase?.mergedSignals, selectedModule?.groups]);

  const signalGroups = selectedModule?.groups || ["Core", "Delay Drivers", "Documentation", "Ruleouts"];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass": return "bg-green-100 text-green-800 border-green-200";
      case "fail": return "bg-red-100 text-red-800 border-red-200";
      case "caution": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "inactive": return "bg-gray-100 text-gray-600 border-gray-200";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const saveAndContinue = async () => {
    if (!processedCase) {
      console.error('❌ No processedCase to save!');
      return;
    }
    
    setIsSaving(true);
    console.log('💾 Saving case for handoff to Screen 2:', processedCase);
    
    // Create reviewed case with ready for review flag
    const reviewedCase: ProcessedCase = {
      ...processedCase,
      readyForReview: true,
      reviewTimestamp: new Date().toISOString(),
      reviewedBy: (user as any)?.email || "unknown",
      reviewNotes: ""
    };
    
    // Store in localStorage for now (could be API call)
    withLocalStore.set('currentCase', JSON.stringify(reviewedCase));
    
    // Also store the scope for easier auto-selection
    withLocalStore.set('intake.handoff', JSON.stringify({
      specialty: selectedSpecialty,
      moduleId: selectedModuleId,
      caseId: reviewedCase.selectedCaseId,
      timestamp: new Date().toISOString()
    }));

    // Save canonicalized signals to the key Home expects (single case, not array)
    console.log('💾 Saving reviewed case with canonicalized signals:', {
      caseId: reviewedCase.selectedCaseId,
      mergedSignalsCount: reviewedCase.mergedSignals?.length || 0,
      signalIds: reviewedCase.mergedSignals?.map(s => s.id) || [],
      readyForReview: reviewedCase.readyForReview,
      hasPatientData: !!reviewedCase.patient_payload,
      patientDataKeys: reviewedCase.patient_payload ? Object.keys(reviewedCase.patient_payload) : []
    });
    
    // CRITICAL: Log AI-enriched status values to confirm they're not just 'inactive'
    console.log('🔍 SAVE VERIFICATION - AI-enriched statuses:', {
      statusBreakdown: reviewedCase.mergedSignals?.reduce((acc, sig) => {
        acc[sig.status] = (acc[sig.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
      detailedStatuses: reviewedCase.mergedSignals?.map(s => `${s.id}:${s.status}`) || [],
      hasNonInactiveStatuses: reviewedCase.mergedSignals?.some(s => s.status !== 'inactive') || false
    });
    
    withLocalStore.set('abstraction.cases', JSON.stringify(reviewedCase));
    console.log('✅ SAVE COMPLETE - Keys saved:', ['currentCase', 'intake.handoff', 'abstraction.cases']);
    
    // Verify the save worked
    const verification = withLocalStore.get('abstraction.cases');
    console.log('🔍 SAVE VERIFICATION - Can read back?', !!verification, verification ? 'YES' : 'NO');
    
    // Update current case pointer
    withLocalStore.set('abstraction.currentCaseId', reviewedCase.selectedCaseId);

    // Update local state
    setProcessedCase(reviewedCase);
    
    console.log('✅ Case saved, marked ready for review, and added to review queue');
    
    // Brief delay to show saving state, then navigate with parameters
    setTimeout(() => {
      setIsSaving(false);
      const abstracted = mapIntakeToAbstractionModuleId(selectedModuleId);
      setLocation(`/?specialty=${encodeURIComponent(selectedSpecialty)}&moduleId=${encodeURIComponent(abstracted)}&expanded=true`);
    }, 500);
  };

  // Removed markReadyForReview function - now handled by saveAndContinue
  
  return (
    <>
      <PromptPlayBadge hotkey="P" />
      <div className="min-h-screen bg-gradient-to-b from-[#F7FBFE] to-[#FFFFFF]">      
        <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-lurie-blue mb-2">AI Signal Intake</h2>
              <p className="text-slate-600">Upload or paste raw patient JSON data to generate quality signals</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: JSON Input */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Patient Data Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Specialty & Module Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Specialty</label>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  {specialties.map((s, index) => (
                    <option key={index} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Module</label>
                <select
                  value={selectedModuleId}
                  onChange={(e) => setSelectedModuleId(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  {modules.map((m, index) => (
                    <option key={index} value={m.value}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Upload JSON File</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              {/* Demo Data Buttons */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Demo Data</label>
                {getDemoCasesForModule().length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {getDemoCasesForModule().map((demoCase, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setJsonInput(JSON.stringify(demoCase.data, null, 2))}
                        className="text-xs"
                      >
                        {demoCase.icon} {demoCase.label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 p-2 border border-dashed rounded">
                    No demo cases available for {selectedModuleId ? modules.find(m => m.value === selectedModuleId)?.name : 'this module'}
                  </div>
                )}
              </div>

              {/* JSON Input Textarea */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Raw Patient JSON</label>
                <Textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Paste patient JSON data here..."
                  className="min-h-[200px] font-mono text-xs"
                />
              </div>

              {/* Process Button */}
              <div className="flex gap-2 items-center w-full">
                <Button 
                  id="intake-generate"
                  onClick={() => processPatientData(false)} 
                  className="flex-1" 
                  disabled={isProcessing || !jsonInput.trim()}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isProcessing ? "Processing..." : "Generate Signals"}
                </Button>
                <PromptPlayTrigger 
                  contextRef="#intake-generate" 
                  size="sm"
                />
              </div>
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Center: Signal Preview */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Signal Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {processedCase && organizedSignals ? (
                <div className="space-y-4">
                  {signalGroups.map(groupName => {
                    const groupSignals = organizedSignals.byGroup[groupName] || [];
                    const counts = organizedSignals.groupCounts[groupName] || {};
                    const hasSignals = groupSignals.length > 0;
                    
                    if (!hasSignals) return null;
                    
                    return (
                      <div key={groupName} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <span>{groupName}</span>
                          <span className="text-xs text-gray-500">
                            · {counts.fail || 0} fail, {counts.caution || 0} caution, {counts.pass || 0} pass
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {groupSignals.map(signal => (
                            <div key={signal.id} className="flex gap-1">
                              <Badge
                                variant="outline"
                                className={`${getStatusColor(signal.status)} cursor-pointer hover:opacity-80 transition-opacity`}
                                title={[signal.evidence, signal.cites?.[0] ?? ""].filter(Boolean).join(" • ")}
                                onClick={() => handleChipClick(signal.id)}
                              >
                                {signal.label}{signal.cites?.length ? `  📎${signal.cites.length}` : ""}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-xs"
                                title="View signal-specific evidence"
                                onClick={() => {
                                  console.log('📋 Opening evidence for signal:', signal.id, 'Evidence:', signal.evidence, 'Cites:', signal.cites?.length || 0);
                                  if (typeof recordOnce === 'function') {
                                    recordOnce({
                                      source: 'computed',
                                      key: 'intake.evidence.open',
                                      detail: { id: signal.id, citesCount: signal.cites?.length || 0 },
                                      ts: Date.now(),
                                      page: location
                                    });
                                  }
                                  setSelectedSignalForEvidence(signal);
                                }}
                              >
                                📋
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Process patient data to see signal preview
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Risk Assessment */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Risk Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              {processedCase ? (
                <div className="space-y-4">
                  {processedCase.fromCache && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                      📋 Using cached results from previous processing
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-center">
                      <div className="text-2xl font-bold text-red-700">
                        {processedCase.category_counts.fail}
                      </div>
                      <div className="text-xs text-red-600">FAIL</div>
                    </div>
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-center">
                      <div className="text-2xl font-bold text-yellow-700">
                        {processedCase.category_counts.caution}
                      </div>
                      <div className="text-xs text-yellow-600">CAUTION</div>
                    </div>
                    <div className="p-3 bg-green-50 border border-green-200 rounded text-center">
                      <div className="text-2xl font-bold text-green-700">
                        {processedCase.category_counts.pass}
                      </div>
                      <div className="text-xs text-green-600">PASS</div>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded text-center">
                      <div className="text-2xl font-bold text-gray-700">
                        {processedCase.category_counts.inactive}
                      </div>
                      <div className="text-xs text-gray-600">INACTIVE</div>
                    </div>
                  </div>
                  
                  {/* Action buttons when processing is complete */}
                  <div className="pt-4 border-t space-y-2">
                    <Button
                      onClick={saveAndContinue}
                      disabled={isSaving}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {isSaving ? "Saving..." : "Save & Continue to Review →"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Process patient data to see risk assessment
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Evidence Drawer */}
        {selectedSignalForEvidence && (
          (() => {
            const items = resolveCitesToItems(processedCase?.patient_payload, selectedSignalForEvidence?.cites ?? []);
            const fallbackNotes = (processedCase?.patient_payload?.notes ?? []).map((n: any, i: number) => ({ path: `notes[${i}]`, item: n }));
            
            return (
              <EvidenceDrawer
                title={`${selectedSignalForEvidence?.label} — Evidence`}
                items={items.length ? items : fallbackNotes}
                onClose={() => setSelectedSignalForEvidence(null)}
              />
            );
          })()
        )}
        </div>
      </div>
    </>
  );
}