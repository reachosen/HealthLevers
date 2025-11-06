import { useState, useEffect, useMemo } from "react";
import { usePromptStore, type Prompt } from "@/lib/promptStore";
import { getModulesForSpecialty } from "@/data/specialtyMetadata";
import { useSpecialties } from "@/hooks/useSpecialties";
import { Plus, Edit, Trash2, Check, X, ChevronUp, ChevronDown } from "lucide-react";

// Helper function to get default prompt for scope
function getDefaultForScope(prompts: Prompt[], specialty: string, moduleId: string, type?: PromptType) {
  // If "all" is selected, try to find a specific match first, then fallback to any match
  if (moduleId === "all") {
    const withType = prompts.filter(p => p.specialty === specialty && (!type || p.type === type));
    return withType[0];
  }
  
  // Find prompts matching the new scoping system
  const scoped = prompts.filter(p => 
    p.specialty === specialty && 
    (p.moduleId === moduleId || p.question === moduleId || p.question?.toLowerCase().replace(/\s+/g, '_') === moduleId) &&
    (!type || p.type === type)
  );
  return scoped[0];
}

interface PromptStorePanelProps {
  onClose: () => void;
}

type PromptType = "abstraction_help" | "signal_processing";

export default function PromptStorePanel({ onClose }: PromptStorePanelProps) {
  const { prompts, createPrompt, updatePrompt, deletePrompt, bulkUpdateVersions, reorderPrompts } = usePromptStore();
  
  // Scope filtering - start with broader scope to show all prompts
  const [selectedScope, setSelectedScope] = useState({
    specialty: "Orthopedics",
    question: "SCH Timeliness",
    moduleId: "timeliness_sch", // Start with specific module
    type: "abstraction_help" as PromptType // Start with abstraction help to see SCH prompts
  });

  // Header editing for default prompt
  const [headerDesc, setHeaderDesc] = useState("");
  const [headerBody, setHeaderBody] = useState("");

  // Update header when scope changes - optimized with early return
  useEffect(() => {
    if (prompts.length === 0) return; // Don't process until prompts are loaded
    
    console.log("Scope changed, updating header. Current scope:", selectedScope);
    const defaultPrompt = getDefaultForScope(prompts, selectedScope.specialty, selectedScope.moduleId, selectedScope.type);
    console.log("Default prompt for scope:", defaultPrompt ? `${defaultPrompt.specialty}-${defaultPrompt.question} (${defaultPrompt.type})` : "none");
    
    if (defaultPrompt) {
      setHeaderDesc(defaultPrompt.description || "");
      const currentVersion = defaultPrompt.versions.find(v => v.id === defaultPrompt.currentVersionId);
      setHeaderBody(currentVersion?.content || "");
    } else {
      setHeaderDesc("");
      setHeaderBody("");
    }
  }, [selectedScope, prompts]);

  // Scoped prompts - memoized for performance, updated for new scoping
  const scopedPrompts = useMemo(() => {
    if (prompts.length === 0) return [];
    
    console.log("Filtering prompts. Selected scope:", selectedScope);
    console.log("Available prompts:", prompts.map(p => `${p.specialty}-${p.question} (moduleId: ${p.moduleId}, type: ${p.type})`));
    
    const filtered = prompts.filter(p => {
      const specialtyMatch = p.specialty === selectedScope.specialty;
      // More flexible module matching
      const moduleMatch = 
        p.moduleId === selectedScope.moduleId || 
        p.question === selectedScope.moduleId ||
        p.question.toLowerCase().replace(/\s+/g, '_') === selectedScope.moduleId ||
        selectedScope.moduleId === "all"; // Show all if "all" is selected
      const typeMatch = !selectedScope.type || p.type === selectedScope.type;
      
      console.log(`Prompt ${p.question}: specialty=${specialtyMatch}, module=${moduleMatch} (${p.moduleId} vs ${selectedScope.moduleId}), type=${typeMatch}`);
      
      return specialtyMatch && moduleMatch && typeMatch;
    });
    
    console.log("Filtered prompts:", filtered.length);
    return filtered;
  }, [prompts, selectedScope]);

  // Inline editing state
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, { description: string; content: string }>>({});

  // Modal editing for full content
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [newContent, setNewContent] = useState("");

  // Creation state
  const [creating, setCreating] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ 
    specialty: selectedScope.specialty, 
    question: "",
    description: "",
    content: "",
    type: "abstraction_help" as PromptType,
    moduleId: selectedScope.moduleId
  });

  // Handlers
  const startEdit = (prompt: Prompt) => {
    const currentVersion = prompt.versions.find(v => v.id === prompt.currentVersionId);
    setDrafts(prev => ({
      ...prev,
      [prompt.id]: {
        description: prompt.description || "",
        content: currentVersion?.content || ""
      }
    }));
    setEditingIds(prev => {
      const newSet = new Set(prev);
      newSet.add(prompt.id);
      return newSet;
    });
  };

  const cancelEdit = (id: string) => {
    setEditingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setDrafts(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const updateDraft = (id: string, field: 'description' | 'content', value: string) => {
    setDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const saveRow = (id: string) => {
    const draft = drafts[id];
    if (!draft) return;
    
    // Update description
    updatePrompt(id, { description: draft.description });
    
    // Update content by creating new version if changed
    const prompt = scopedPrompts.find(p => p.id === id);
    if (prompt) {
      const currentVersion = prompt.versions.find(v => v.id === prompt.currentVersionId);
      if (currentVersion && currentVersion.content !== draft.content) {
        bulkUpdateVersions([{ promptId: id, versionId: prompt.currentVersionId, content: draft.content }]);
      }
    }

    // Update header when default row saved (if this is the first/default prompt for the scope)
    const isDefaultPrompt = getDefaultForScope(prompts, selectedScope.specialty, selectedScope.moduleId, selectedScope.type)?.id === id;
    if (isDefaultPrompt) {
      setHeaderDesc(draft.description);
      setHeaderBody(draft.content);
    }
  };

  const movePrompt = (id: string, delta: number) => {
    const ids = scopedPrompts.map(p => p.id);
    const currentIndex = ids.indexOf(id);
    const newIndex = currentIndex + delta;
    
    if (newIndex < 0 || newIndex >= ids.length) return;
    
    // Swap positions
    [ids[currentIndex], ids[newIndex]] = [ids[newIndex], ids[currentIndex]];
    reorderPrompts(scopedPrompts.map((p, i) => ({ ...p, order: ids.indexOf(p.id) })));
  };

  const handleCreate = () => {
    if (!newPrompt.question || !newPrompt.content) return;
    
    createPrompt(
      newPrompt.specialty,
      newPrompt.question,
      newPrompt.description,
      newPrompt.content,
      newPrompt.type,
      newPrompt.moduleId
    );
    setCreating(false);
    setNewPrompt({ 
      specialty: selectedScope.specialty, 
      question: "",
      description: "",
      content: "",
      type: "abstraction_help" as PromptType,
      moduleId: selectedScope.moduleId
    });
  };

  const handleSave = () => {
    if (!editing) return;
    bulkUpdateVersions([{ promptId: editing.id, versionId: editing.currentVersionId, content: newContent }]);
    setEditing(null);
    setNewContent("");
  };

  // Get specialties and modules from metadata
  const { specialties } = useSpecialties();
  const modulesForSpecialty = getModulesForSpecialty(selectedScope.specialty);
  
  // Convert modules to moduleId -> name mapping for the UI
  const moduleOptions = [
    { id: "all", name: "All Modules" }, // Add option to show all
    { id: "timeliness_sch", name: "Timeliness - SCH" }, // Specific mapping for SCH module
    ...modulesForSpecialty.filter(m => !m.name.includes("SCH")).map(m => ({
      id: m.name.toLowerCase().replace(/\s+/g, '_'),
      name: m.name
    }))
  ];

  const typeOptions: { value: PromptType; label: string; badge: string }[] = [
    { value: "abstraction_help", label: "Abstraction Help", badge: "Abstraction" },
    { value: "signal_processing", label: "Signal Processing", badge: "Signals" }
  ];

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 overflow-auto">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 pb-2 border-b">
          <div>
            <h2 className="text-lg font-bold text-lurie-blue">PromptStore</h2>
            <p className="text-sm text-slate-600">Manage LLM prompts for medical abstraction</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recovery Button */}
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-yellow-800">Prompt Recovery</h3>
              <p className="text-sm text-yellow-700">If your prompts were wiped out, click here to restore defaults</p>
            </div>
            <button
              onClick={() => {
                if (confirm("This will restore default prompts and clear any custom changes. Continue?")) {
                  localStorage.removeItem("usnwr-prompt-store");
                  window.location.reload();
                }
              }}
              className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
            >
              Restore Defaults
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-white border rounded-lg">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Specialty</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={selectedScope.specialty}
              onChange={e => setSelectedScope(prev => ({ ...prev, specialty: e.target.value }))}
            >
              {specialties.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Module</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={selectedScope.moduleId}
              onChange={e => setSelectedScope(prev => ({ ...prev, moduleId: e.target.value }))}
            >
              {moduleOptions.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Type</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={selectedScope.type}
              onChange={e => setSelectedScope(prev => ({ ...prev, type: e.target.value as PromptType }))}
            >
              {typeOptions.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">

          {/* Prompt Header - Default Prompt Management */}
          <section className="border rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                Default Prompt · <span className="font-semibold">{selectedScope.specialty}</span> · <span className="font-semibold">{moduleOptions.find(m => m.id === selectedScope.moduleId)?.name || selectedScope.moduleId}</span> · <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">{typeOptions.find(t => t.value === selectedScope.type)?.badge}</span>
              </div>
              <div className="text-xs text-slate-500">Shown on Home (LLM) for this scope</div>
            </div>

            <div className="mt-2 grid gap-2">
              <label className="text-xs font-medium text-slate-600">Description</label>
              <input
                className="border rounded px-2 py-1 text-xs"
                value={headerDesc}
                onChange={e => setHeaderDesc(e.target.value)}
                placeholder="Short description of this prompt"
              />
              <label className="text-xs font-medium text-slate-600 mt-2">Prompt Text</label>
              <textarea
                className="w-full min-h-[140px] border rounded p-2 text-xs font-mono"
                value={headerBody}
                onChange={e => setHeaderBody(e.target.value)}
                placeholder="Prompt content..."
              />
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 bg-black text-white rounded text-xs hover:bg-gray-800"
                  onClick={() => {
                    console.log("Save Default clicked. Current scope:", selectedScope);
                    console.log("Available prompts:", prompts.map(p => `${p.specialty}-${p.question} (${p.type}, moduleId: ${p.moduleId})`));
                    
                    const def = getDefaultForScope(prompts, selectedScope.specialty, selectedScope.moduleId, selectedScope.type);
                    console.log("Found default prompt:", def ? `${def.specialty}-${def.question} (${def.type})` : "none");
                    
                    if (!def) {
                      alert("No default prompt found for this scope. Please create one first.");
                      return;
                    }
                    
                    console.log("Updating prompt description to:", headerDesc);
                    updatePrompt(def.id, { description: headerDesc });
                    
                    const cur = def.versions.find(v => v.id === def.currentVersionId);
                    const currentContent = cur?.content ?? "";
                    console.log("Current content length:", currentContent.length, "New content length:", headerBody.length);
                    
                    if (currentContent !== headerBody) {
                      console.log("Content changed, updating version");
                      bulkUpdateVersions([{ promptId: def.id, versionId: def.currentVersionId, content: headerBody }]);
                    } else {
                      console.log("Content unchanged, no version update needed");
                    }
                    
                    alert("Prompt saved successfully!");
                  }}
                >
                  Save Default
                </button>
              </div>
            </div>
          </section>

          {/* Inline Editable Table */}
          <section className="border rounded-lg">
            <div className="p-3 border-b bg-slate-50">
              <div className="text-sm font-medium text-slate-800">
                Prompts for {selectedScope.specialty} · {moduleOptions.find(m => m.id === selectedScope.moduleId)?.name || selectedScope.moduleId} · {typeOptions.find(t => t.value === selectedScope.type)?.label}
              </div>
              <div className="text-xs text-slate-600">
                {scopedPrompts.length} prompt{scopedPrompts.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 w-16">Order</th>
                    <th className="text-left p-3 w-40">Type</th>
                    <th className="text-left p-3 w-48">Description</th>
                    <th className="text-left p-3">Prompt Content</th>
                    <th className="text-left p-3 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedPrompts.map((prompt, index) => {
                    const isEditing = editingIds.has(prompt.id);
                    const draft = drafts[prompt.id];
                    const currentVersion = prompt.versions.find(v => v.id === prompt.currentVersionId);
                    const displayDesc = isEditing ? draft?.description : prompt.description;
                    const displayContent = isEditing ? draft?.content : currentVersion?.content;

                    return (
                      <tr key={prompt.id} className="border-b hover:bg-slate-50">
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => movePrompt(prompt.id, -1)}
                              disabled={index === 0}
                              className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => movePrompt(prompt.id, 1)}
                              disabled={index === scopedPrompts.length - 1}
                              className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-sm font-medium ${
                            prompt.type === "signal_processing" 
                              ? "bg-blue-100 text-blue-700" 
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {prompt.type === "signal_processing" ? "Signal Processing" : "Abstraction Help"}
                          </span>
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <input
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={displayDesc || ""}
                              onChange={e => updateDraft(prompt.id, 'description', e.target.value)}
                            />
                          ) : (
                            <span className="text-sm">{displayDesc || "—"}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <textarea
                              className="w-full border rounded px-2 py-1 text-sm font-mono min-h-[120px] resize-y"
                              value={displayContent || ""}
                              onChange={e => updateDraft(prompt.id, 'content', e.target.value)}
                            />
                          ) : (
                            <div className="text-sm font-mono whitespace-pre-wrap break-words max-w-2xl">
                              {displayContent || "—"}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => {
                                    saveRow(prompt.id);
                                    cancelEdit(prompt.id);
                                  }}
                                  className="p-1 rounded hover:bg-emerald-100 text-emerald-600"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => cancelEdit(prompt.id)}
                                  className="p-1 rounded hover:bg-rose-100 text-rose-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(prompt)}
                                  className="p-1 rounded hover:bg-slate-200"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditing(prompt);
                                    setNewContent(currentVersion?.content || "");
                                  }}
                                  className="p-1 rounded hover:bg-slate-200"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => deletePrompt(prompt.id)}
                                  className="p-1 rounded hover:bg-rose-100 text-rose-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {scopedPrompts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">
                        No prompts for this scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Create New Prompt */}
          <section className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-800">Create New Prompt</h3>
              <button
                onClick={() => setCreating(!creating)}
                className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-slate-50 transition"
              >
                <Plus className="w-3 h-3" />
                New
              </button>
            </div>

            {creating && (
              <div className="border rounded p-4 bg-white space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Specialty</label>
                    <select
                      value={newPrompt.specialty}
                      onChange={e => setNewPrompt({ ...newPrompt, specialty: e.target.value })}
                      className="w-full border rounded px-2 py-1 text-xs"
                    >
                      {specialties.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Module</label>
                    <select
                      value={newPrompt.moduleId || ""}
                      onChange={e => setNewPrompt({ ...newPrompt, moduleId: e.target.value })}
                      className="w-full border rounded px-2 py-1 text-xs"
                    >
                      {moduleOptions.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                    <select
                      value={newPrompt.type || "abstraction_help"}
                      onChange={e => setNewPrompt({ ...newPrompt, type: e.target.value as PromptType })}
                      className="w-full border rounded px-2 py-1 text-xs"
                    >
                      <option value="abstraction_help">Abstraction Help</option>
                      <option value="signal_processing">Signal Processing</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Question/Title</label>
                    <input
                      type="text"
                      value={newPrompt.question}
                      onChange={e => setNewPrompt({ ...newPrompt, question: e.target.value })}
                      placeholder="e.g., SCH Timeliness"
                      className="w-full border rounded px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                  <input
                    type="text"
                    value={newPrompt.description || ""}
                    onChange={e => setNewPrompt({ ...newPrompt, description: e.target.value })}
                    placeholder="Brief description of this prompt's purpose"
                    className="w-full border rounded px-2 py-1 text-xs"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Prompt Content</label>
                  <textarea
                    value={newPrompt.content || ""}
                    onChange={e => setNewPrompt({ ...newPrompt, content: e.target.value })}
                    placeholder="Enter the full prompt text here..."
                    className="w-full min-h-[140px] p-2 border rounded resize-y text-xs font-mono"
                  />
                </div>
                
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setCreating(false)}
                    className="px-3 py-2 border rounded text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!newPrompt.question || !newPrompt.content}
                    className="px-3 py-2 bg-lurie-blue text-white rounded text-xs hover:bg-lurie-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Prompt
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Edit Modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-auto">
              <div className="p-4 border-b">
                <h2 className="font-semibold">
                  Edit: {editing.specialty} – {editing.question}
                </h2>
                <p className="text-sm text-slate-600">
                  Creates a new version while preserving previous versions
                </p>
              </div>
              <div className="p-4">
                <textarea
                  className="w-full border rounded p-3 font-mono text-sm"
                  rows={12}
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="Enter your prompt content..."
                />
              </div>
              <div className="p-4 border-t flex gap-2">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
                >
                  Save New Version
                </button>
                <button
                  onClick={() => {
                    setEditing(null);
                    setNewContent("");
                  }}
                  className="px-4 py-2 border rounded text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}