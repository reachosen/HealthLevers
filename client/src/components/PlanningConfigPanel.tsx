import React, { useEffect, useMemo, useState } from "react";
import { usePlanningConfig, upsertDomain, upsertQuestion, moveArrayItem } from "../lib/planningConfig";
import { USNWR_MATRIX, listModules, listGroups, signalsByGroup, type Module } from "@/types/usnwrMatrix";
import { ChevronUp, ChevronDown, X, Plus, Trash2, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { DemoResetButton } from "@/components/DemoResetButton";
import { PromptPlayTrigger, usePromptPlay } from "@/components/PromptPlay";

interface PlanningConfigPanelProps {
  onClose: () => void;
}

export default function PlanningConfigPanel({ onClose }: PlanningConfigPanelProps) {
  const { cfg, setCfg } = usePlanningConfig();
  
  // Optional prompt play integration - only use if provider is available
  let promptPlay: any = null;
  try {
    promptPlay = usePromptPlay();
  } catch (error) {
    // usePromptPlay not available - panel used outside provider context
    console.log('PromptPlay not available in PlanningConfigPanel context');
  }
  const domains = [{ id: "orthopedics", name: "Orthopedics (Pediatric)" }];
  const [domainId, setDomainId] = useState(domains[0].id);

  const modules = useMemo<Module[]>(() => listModules(USNWR_MATRIX), []);
  const [moduleId, setModuleId] = useState<string>(modules[0]?.id ?? "");
  const selectedModule = modules.find(m => m.id === moduleId);
  const moduleGroups = useMemo(() => selectedModule ? listGroups(selectedModule) : [], [selectedModule]);

  const existingDomain = cfg.domains.find(d => d.domainId === domainId);
  const existingQuestion = existingDomain?.questions.find(q => q.questionId === moduleId);
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    for (const g of moduleGroups) base[g] = existingQuestion?.visibleGroups?.[g] ?? true; // default ON
    return base;
  });

  // Group and field ordering states
  const [groupOrder, setGroupOrder] = useState<string[]>(() => 
    existingQuestion?.groupOrder ?? moduleGroups
  );
  const [fieldOrders, setFieldOrders] = useState<Record<string, string[]>>(() => 
    existingQuestion?.fieldOrder ?? {}
  );
  const [fieldPaths, setFieldPaths] = useState<Record<string, string>>(() =>
    existingQuestion?.paths ?? {}
  );
  const [followups, setFollowups] = useState<string[]>(() =>
    existingQuestion?.followups ?? []
  );
  
  // Sample payload ingest state
  const [samplePayload, setSamplePayload] = useState("");
  const [discoveredFields, setDiscoveredFields] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});
  
  // AutoMapper state
  const [autoMapperResults, setAutoMapperResults] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const base: Record<string, boolean> = {};
    for (const g of moduleGroups) base[g] = existingQuestion?.visibleGroups?.[g] ?? true;
    setVisible(base);
    setGroupOrder(existingQuestion?.groupOrder ?? moduleGroups);
    setFieldOrders(existingQuestion?.fieldOrder ?? {});
    setFieldPaths(existingQuestion?.paths ?? {});
    setFollowups(existingQuestion?.followups ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  function save() {
    const d = existingDomain ?? { domainId, domainLabel: domains.find(x=>x.id===domainId)?.name ?? domainId, questions: [] };
    const q = { 
      questionId: moduleId, 
      questionLabel: selectedModule?.title ?? moduleId, 
      visibleGroups: visible,
      groupOrder: groupOrder,
      fieldOrder: fieldOrders,
      paths: fieldPaths,
      followups: followups,
      signals: autoMapperResults?.signals,
      tableLayouts: autoMapperResults?.tableLayouts,
      fieldToSignal: autoMapperResults?.fieldToSignal
    };
    const d2 = upsertQuestion(d, q);
    setCfg(upsertDomain(cfg, d2));
    onClose(); // Close panel after saving
  }

  function moveGroup(index: number, delta: number) {
    setGroupOrder(prev => moveArrayItem(prev, index, delta));
  }

  function moveField(groupName: string, index: number, delta: number) {
    setFieldOrders(prev => ({
      ...prev,
      [groupName]: moveArrayItem(prev[groupName] || [], index, delta)
    }));
  }

  function getFieldsForGroup(groupName: string): string[] {
    if (!selectedModule) return [];
    const signals = signalsByGroup(selectedModule, groupName);
    return fieldOrders[groupName] || signals.map(s => s.id);
  }
  
  // Helper functions for JSON/XML payload processing
  function flattenObject(obj: any, prefix = ''): Record<string, string> {
    const flattened: Record<string, string> = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          Object.assign(flattened, flattenObject(obj[key], newKey));
        } else if (Array.isArray(obj[key])) {
          obj[key].forEach((item: any, index: number) => {
            if (typeof item === 'object') {
              Object.assign(flattened, flattenObject(item, `${newKey}[${index}]`));
            } else {
              flattened[`${newKey}[${index}]`] = String(item);
            }
          });
        } else {
          flattened[newKey] = String(obj[key]);
        }
      }
    }
    
    return flattened;
  }
  
  function discoverFields() {
    try {
      const payload = JSON.parse(samplePayload);
      const flattened = flattenObject(payload);
      const fields = Object.keys(flattened).sort();
      setDiscoveredFields(fields);
      
      // Auto-select fields that have reasonable medical names
      const autoSelect: Record<string, boolean> = {};
      fields.forEach(field => {
        const lower = field.toLowerCase();
        if (lower.includes('patient') || lower.includes('mrn') || lower.includes('name') || 
            lower.includes('age') || lower.includes('time') || lower.includes('date') ||
            lower.includes('arrival') || lower.includes('surgery') || lower.includes('incision')) {
          autoSelect[field] = true;
        }
      });
      setSelectedFields(autoSelect);
    } catch (e) {
      alert('Invalid JSON payload. Please check the format.');
    }
  }
  
  function addFieldToGroup(groupName: string, fieldKey: string) {
    if (!fieldOrders[groupName]) {
      setFieldOrders(prev => ({ ...prev, [groupName]: [fieldKey] }));
    } else if (!fieldOrders[groupName].includes(fieldKey)) {
      setFieldOrders(prev => ({
        ...prev,
        [groupName]: [...prev[groupName], fieldKey]
      }));
    }
  }
  
  function removeFieldFromGroup(groupName: string, fieldKey: string) {
    setFieldOrders(prev => ({
      ...prev,
      [groupName]: prev[groupName]?.filter(f => f !== fieldKey) ?? []
    }));
  }
  
  function updateFieldPath(fieldKey: string, path: string) {
    setFieldPaths(prev => ({ ...prev, [fieldKey]: path }));
  }
  
  function addFollowup() {
    setFollowups(prev => [...prev, ""]);
  }
  
  function updateFollowup(index: number, value: string) {
    setFollowups(prev => prev.map((f, i) => i === index ? value : f));
  }
  
  function removeFollowup(index: number) {
    setFollowups(prev => prev.filter((_, i) => i !== index));
  }
  
  // AutoMapper functions
  async function generateSuggestions() {
    if (!samplePayload.trim()) {
      alert('Please provide a sample payload first.');
      return;
    }
    
    setIsGenerating(true);
    try {
      const payload = JSON.parse(samplePayload);
      const flattened = flattenObject(payload);
      const paths = Object.keys(flattened).sort();
      
      // Prepare the prompt content
      const promptContent = `System:
You output STRICT JSON only. Given module info, registry groups, and a flattened sample payload, propose: paths, fieldOrder.Core, tableLayouts, signals (with group, triggers, citesHint), fieldToSignal, followups, visibleGroups, groupOrder. Be conservative and align to USNWR logic. Prefer high-signal features.

User:
Specialty: Orthopedics
Module: timeliness_sch (Timeliness – SCH ≤19h)
USNWR Question: Was surgery ≤19h from ED arrival? If delayed, justified?
Groups: ["Core","Delay Drivers","Documentation","Ruleouts"]
Flattened paths: ${JSON.stringify(paths)}
Return keys: paths, fieldOrder, tableLayouts, signals, fieldToSignal, followups, visibleGroups, groupOrder`;
      
      // Mock LLM call - in real implementation, this would call OpenAI API
      const suggestions = {
        paths: {
          "PatientMRN": "patient.mrn",
          "PatientName": "patient.name",
          "AgeYears": "patient.age",
          "CSN": "encounter.id",
          "ED_Arrival": "times.ArrivalInstant",
          "SurgStart": "times.IncisionStartInstant",
          "SurgEnd": "times.ProcedureEndInstant",
          "TargetHours": "targets.surgeryHours",
          "HoursToSurgery": "derived.hoursToSurgery",
          "TimelyFlag": "derived.timelyFlag"
        },
        fieldOrder: {
          "Core": ["PatientMRN", "PatientName", "AgeYears", "CSN", "ED_Arrival", "SurgStart", "SurgEnd", "TargetHours", "HoursToSurgery", "TimelyFlag"]
        },
        tableLayouts: [
          {
            id: "core_summary",
            title: "Core Summary",
            fields: ["PatientMRN", "PatientName", "AgeYears", "CSN", "ED_Arrival", "SurgStart", "SurgEnd", "TargetHours", "HoursToSurgery", "TimelyFlag"],
            group: "Core"
          }
        ],
        signals: [
          {
            id: "on_time_19h",
            label: "Incision ≤19h of ED arrival",
            group: "Core",
            triggers: [{
              type: "deltaLTE",
              start: "times.ArrivalInstant",
              end: "times.IncisionStartInstant",
              minutes: 1140
            }],
            citesHint: ["times.ArrivalInstant", "times.IncisionStartInstant"]
          }
        ],
        fieldToSignal: [
          { field: "TimelyFlag", signals: ["on_time_19h"], group: "Core" }
        ],
        followups: [
          "Does the operative report confirm SCH?",
          "Any miscoding or DX/OP mismatch?",
          "Higher-priority injuries that justified delay?"
        ],
        visibleGroups: {
          "Core": true,
          "Delay Drivers": true,
          "Documentation": true,
          "Ruleouts": true
        },
        groupOrder: ["Core", "Delay Drivers", "Documentation", "Ruleouts"]
      };
      
      // Complete prompt execution tracking (if available)
      if (promptPlay && runId) {
        promptPlay.complete(runId, {
          output: suggestions,
          metrics: { totalMs: 1200, tokensIn: 450, tokensOut: 850 },
          resolvedPrompt: `System: You output STRICT JSON only. Given module info, registry groups, and a flattened sample payload, propose: paths, fieldOrder.Core, tableLayouts, signals (with group, triggers, citesHint), fieldToSignal, followups, visibleGroups, groupOrder. Be conservative and align to USNWR logic. Prefer high-signal features.\n\nUser: Specialty: Orthopedics\nModule: timeliness_sch (Timeliness – SCH ≤19h)\nUSNWR Question: Was surgery ≤19h from ED arrival? If delayed, justified?\nGroups: ["Core","Delay Drivers","Documentation","Ruleouts"]\nFlattened paths: ${JSON.stringify(paths)}\nReturn keys: paths, fieldOrder, tableLayouts, signals, fieldToSignal, followups, visibleGroups, groupOrder`
        });
      }
      
      setAutoMapperResults(suggestions);
      console.log('AutoMapper suggestions generated:', suggestions);
      
    } catch (e) {
      console.error('AutoMapper generation failed:', e);
      alert('Failed to generate suggestions. Please check the payload format.');
    } finally {
      setIsGenerating(false);
    }
  }
  
  function applySuggestions() {
    if (!autoMapperResults) return;
    
    // Apply all the suggestions to the current state
    if (autoMapperResults.paths) setFieldPaths(autoMapperResults.paths);
    if (autoMapperResults.fieldOrder) setFieldOrders(autoMapperResults.fieldOrder);
    if (autoMapperResults.followups) setFollowups(autoMapperResults.followups);
    if (autoMapperResults.visibleGroups) setVisible(autoMapperResults.visibleGroups);
    if (autoMapperResults.groupOrder) setGroupOrder(autoMapperResults.groupOrder);
    
    console.log('Applied AutoMapper suggestions');
    alert('Suggestions applied! Review and save when ready.');
  }

  return (
    <div className="bg-white border rounded-lg shadow-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-primary">Case View Setup</h2>
        <div className="flex items-center gap-2">
          <DemoResetButton />
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="payload">Payload Ingest</TabsTrigger>
          <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
        </TabsList>
        
        <TabsContent value="config" className="space-y-4 mt-4">
        {/* Domain Selection */}
        <section className="border rounded-lg p-3">
          <div className="text-sm font-medium mb-2">1) Domain</div>
          <select 
            className="h-9 px-3 py-1 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary" 
            value={domainId} 
            onChange={(e) => setDomainId(e.target.value)}
          >
            {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </section>

        {/* Module Selection */}
        <section className="border rounded-lg p-3">
          <div className="text-sm font-medium mb-2">2) Module</div>
          <div className="flex flex-wrap gap-2">
            {modules.map(m => (
              <button 
                key={m.id} 
                className={[
                  "px-3 py-1 rounded-full text-sm border transition",
                  m.id===moduleId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                ].join(" ")} 
                onClick={()=> setModuleId(m.id)} 
                title={m.usnwrQuestion}
              >
                {m.title}
              </button>
            ))}
          </div>
          {selectedModule && <div className="text-xs text-slate-600 mt-2">{selectedModule.usnwrQuestion}</div>}
        </section>

        {/* Group Configuration */}
        <section className="border rounded-lg p-3">
          <div className="text-sm font-medium text-slate-800 mb-3">
            Group Configuration for {selectedModule?.title}
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {groupOrder.map((groupName, index) => (
              <div key={groupName} className="flex items-center gap-2 border rounded px-3 py-2 bg-slate-50">
                <button 
                  onClick={() => moveGroup(index, -1)}
                  disabled={index === 0}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => moveGroup(index, 1)}
                  disabled={index === groupOrder.length - 1}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <input 
                  type="checkbox" 
                  checked={!!visible[groupName]} 
                  onChange={e => setVisible(v => ({ ...v, [groupName]: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 ml-2"
                />
                <span className="flex-1 text-slate-700 text-sm">{groupName}</span>
                <span className="text-xs text-slate-500">
                  {getFieldsForGroup(groupName).length} fields
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Field Ordering */}
        <section className="border rounded-lg p-3">
          <div className="text-sm font-medium text-slate-800 mb-3">
            Field Ordering (Visible Groups Only)
          </div>
          
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {groupOrder.filter(g => visible[g]).map(groupName => {
              const fields = getFieldsForGroup(groupName);
              return (
                <div key={groupName} className="border rounded p-3 bg-slate-50">
                  <div className="text-xs font-medium text-slate-700 mb-2">{groupName}</div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {fields.slice(0, 5).map((fieldId, index) => (
                      <div key={fieldId} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1">
                        <button 
                          onClick={() => moveField(groupName, index, -1)}
                          disabled={index === 0}
                          className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <ChevronUp className="w-2 h-2" />
                        </button>
                        <button 
                          onClick={() => moveField(groupName, index, 1)}
                          disabled={index === fields.length - 1}
                          className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <ChevronDown className="w-2 h-2" />
                        </button>
                        <span className="flex-1 text-slate-600 truncate">{fieldId}</span>
                        <span className="text-slate-400">#{index + 1}</span>
                      </div>
                    ))}
                    {fields.length > 5 && (
                      <div className="text-xs text-slate-500 text-center py-1">
                        ... and {fields.length - 5} more fields
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t">
          <button 
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition" 
            onClick={save}
          >
            Save & Close
          </button>
          <button 
            className="px-4 py-2 rounded-md border text-sm hover:bg-slate-50 transition" 
            onClick={()=>{ localStorage.removeItem("planning_config_v1"); location.reload(); }}
          >
            Reset All
          </button>
          <button 
            className="px-4 py-2 rounded-md border text-sm hover:bg-slate-50 transition" 
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
        </TabsContent>
        
        <TabsContent value="payload" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sample Payload Ingest</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  JSON/XML Patient Payload
                </label>
                <Textarea
                  placeholder="Paste your JSON or XML patient data here..."
                  value={samplePayload}
                  onChange={(e) => setSamplePayload(e.target.value)}
                  className="min-h-32"
                />
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Button onClick={discoverFields} variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Discover Fields
                </Button>
                
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={generateSuggestions}
                    disabled={isGenerating || !samplePayload.trim()}
                    variant="default" 
                    size="sm"
                  >
                    {isGenerating ? "Generating..." : "Generate Suggestions"}
                  </Button>
                  {promptPlay && (
                    <PromptPlayTrigger 
                      contextRef="#automapper-generate" 
                      size="sm"
                    />
                  )}
                </div>
                
                {autoMapperResults && (
                  <Button onClick={applySuggestions} variant="secondary" size="sm">
                    Apply Suggestions
                  </Button>
                )}
                
                {discoveredFields.length > 0 && (
                  <Badge variant="secondary">
                    {discoveredFields.length} fields found
                  </Badge>
                )}
                
                {autoMapperResults && (
                  <Badge variant="default">
                    AutoMapper ready
                  </Badge>
                )}
              </div>
              
              {discoveredFields.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Discovered Fields</h4>
                  <div className="max-h-48 overflow-y-auto border rounded p-2">
                    {discoveredFields.map(field => (
                      <div key={field} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={selectedFields[field] || false}
                          onChange={(e) => setSelectedFields(prev => ({
                            ...prev,
                            [field]: e.target.checked
                          }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-mono flex-1">{field}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* AutoMapper Results Preview */}
              {autoMapperResults && (
                <div className="mt-6 p-4 border rounded bg-slate-50">
                  <h4 className="text-sm font-medium mb-3">AutoMapper Suggestions</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <strong>Signals:</strong> {autoMapperResults.signals?.length || 0}
                    </div>
                    <div>
                      <strong>Fields:</strong> {Object.keys(autoMapperResults.paths || {}).length}
                    </div>
                    <div>
                      <strong>Follow-ups:</strong> {autoMapperResults.followups?.length || 0}  
                    </div>
                    <div>
                      <strong>Tables:</strong> {autoMapperResults.tableLayouts?.length || 0}
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="text-sm cursor-pointer">View Details</summary>
                    <pre className="text-xs mt-2 p-2 bg-white rounded border overflow-auto max-h-32">
                      {JSON.stringify(autoMapperResults, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="mapping" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Field Mapping & Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Field Path Mappings */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium">Field Path Mappings</h4>
                  {autoMapperResults?.paths && (
                    <Badge variant="outline" className="text-xs">
                      {Object.keys(autoMapperResults.paths).length} suggested
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {Object.entries(fieldPaths).map(([fieldKey, path]) => (
                    <div key={fieldKey} className="flex items-center gap-2">
                      <span className="text-sm w-32 truncate">{fieldKey}:</span>
                      <Input
                        value={path}
                        onChange={(e) => updateFieldPath(fieldKey, e.target.value)}
                        placeholder="e.g., patient.mrn"
                        className="flex-1 text-sm"
                      />
                      {autoMapperResults?.paths?.[fieldKey] && 
                       autoMapperResults.paths[fieldKey] !== path && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs px-2"
                          onClick={() => updateFieldPath(fieldKey, autoMapperResults.paths[fieldKey])}
                        >
                          Use: {autoMapperResults.paths[fieldKey]}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Add new field mapping */}
                <div className="mt-3 pt-3 border-t">
                  <h5 className="text-xs font-medium mb-2">Add Selected Fields to Groups</h5>
                  {Object.entries(selectedFields).filter(([, selected]) => selected).map(([field]) => (
                    <div key={field} className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-mono flex-1">{field}</span>
                      <select 
                        className="text-xs border rounded px-2 py-1"
                        onChange={(e) => {
                          if (e.target.value) {
                            addFieldToGroup(e.target.value, field);
                            updateFieldPath(field, field); // Use field name as default path
                          }
                        }}
                      >
                        <option value="">Add to group...</option>
                        {moduleGroups.map(group => (
                          <option key={group} value={group}>{group}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Follow-up Questions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium">Follow-up Questions</h4>
                  <div className="flex items-center gap-2">
                    {autoMapperResults?.followups && (
                      <Badge variant="outline" className="text-xs">
                        {autoMapperResults.followups.length} suggested
                      </Badge>
                    )}
                    <Button onClick={addFollowup} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {followups.map((followup, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={followup}
                        onChange={(e) => updateFollowup(index, e.target.value)}
                        placeholder="Enter follow-up question..."
                        className="flex-1 text-sm"
                      />
                      <Button
                        onClick={() => removeFollowup(index)}
                        size="sm"
                        variant="ghost"
                        className="p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
            </CardContent>
          </Card>
        </TabsContent>
        
      </Tabs>
    </div>
  );
}