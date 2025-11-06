import React, { useEffect, useMemo, useState } from "react";
import { usePlanningConfig, upsertDomain, upsertQuestion, moveArrayItem } from "../lib/planningConfig";
import { USNWR_MATRIX, listModules, listGroups, signalsByGroup, type Module } from "@/types/usnwrMatrix";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Link } from "wouter";

export default function PlanningPage() {
  const { cfg, setCfg } = usePlanningConfig();
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

  useEffect(() => {
    const base: Record<string, boolean> = {};
    for (const g of moduleGroups) base[g] = existingQuestion?.visibleGroups?.[g] ?? true;
    setVisible(base);
    setGroupOrder(existingQuestion?.groupOrder ?? moduleGroups);
    setFieldOrders(existingQuestion?.fieldOrder ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  function save() {
    const d = existingDomain ?? { domainId, domainLabel: domains.find(x=>x.id===domainId)?.name ?? domainId, questions: [] };
    const q = { 
      questionId: moduleId, 
      questionLabel: selectedModule?.title ?? moduleId, 
      visibleGroups: visible,
      groupOrder: groupOrder,
      fieldOrder: fieldOrders
    };
    const d2 = upsertQuestion(d, q);
    setCfg(upsertDomain(cfg, d2));
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-primary">Planning Config</h1>
            <p className="text-xs text-slate-600">Domain & question visibility for inline review</p>
          </div>
          <a href="/" className="text-sm underline hover:text-primary">Back to app</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <section className="rounded-xl border bg-white p-4">
          <div className="text-sm font-medium mb-2">1) Pick Domain</div>
          <select className="h-9 px-3 py-1 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
            {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <div className="text-sm font-medium mb-2">2) Pick Question (Module)</div>
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

        <section className="rounded-xl border bg-white p-6">
          <div className="text-lg font-medium text-slate-800 mb-4">
            Group Configuration for {selectedModule?.title}
          </div>
          
          <div className="space-y-4">
            <div className="text-sm font-medium text-slate-600 mb-2">Groups (drag to reorder)</div>
            {groupOrder.map((groupName, index) => (
              <div key={groupName} className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-slate-50">
                <button 
                  onClick={() => moveGroup(index, -1)}
                  disabled={index === 0}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => moveGroup(index, 1)}
                  disabled={index === groupOrder.length - 1}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <input 
                  type="checkbox" 
                  checked={!!visible[groupName]} 
                  onChange={e => setVisible(v => ({ ...v, [groupName]: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 ml-2"
                />
                <span className="flex-1 text-slate-700 font-medium">{groupName}</span>
                <span className="text-xs text-slate-500">
                  {getFieldsForGroup(groupName).length} fields
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6">
          <div className="text-lg font-medium text-slate-800 mb-4">
            Field Ordering within Groups
          </div>
          
          <div className="space-y-6">
            {groupOrder.filter(g => visible[g]).map(groupName => {
              const fields = getFieldsForGroup(groupName);
              return (
                <div key={groupName} className="border rounded-lg p-4 bg-slate-50">
                  <div className="text-sm font-medium text-slate-700 mb-3">{groupName}</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {fields.map((fieldId, index) => (
                      <div key={fieldId} className="flex items-center gap-2 text-sm bg-white rounded px-3 py-2">
                        <button 
                          onClick={() => moveField(groupName, index, -1)}
                          disabled={index === 0}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => moveField(groupName, index, 1)}
                          disabled={index === fields.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <span className="flex-1 text-slate-600">{fieldId}</span>
                        <span className="text-xs text-slate-400">#{index + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex gap-2">
          <button 
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition" 
            onClick={save}
          >
            Save Config
          </button>
          <button 
            className="px-4 py-2 rounded-md border text-sm hover:bg-slate-50 transition" 
            onClick={()=>{ localStorage.removeItem("planning_config_v1"); location.reload(); }}
          >
            Reset All
          </button>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <div className="text-xs text-slate-500 mb-2">Current config JSON</div>
          <pre className="text-xs overflow-auto max-h-64 bg-slate-50 p-2 rounded border">{JSON.stringify(cfg, null, 2)}</pre>
          
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="text-xs font-medium text-slate-600 mb-2">Planning Config Features:</div>
            <div className="text-xs text-slate-500 space-y-1">
              <div>• <span className="font-medium">Group Visibility:</span> Control which signal groups appear by default</div>
              <div>• <span className="font-medium">Group Ordering:</span> Predefined sequence (Core → Delay Drivers → Documentation → Ruleouts)</div>
              <div>• <span className="font-medium">Field Ordering:</span> Structured display of the top 20% most critical fields within each group</div>
              <div>• <span className="font-medium">Local Storage:</span> Settings persist across sessions in your browser</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}