import { createContext, useContext, useState, useEffect } from "react";
import { SPECIALTY_METADATA, getSpecialties, getModulesForSpecialty } from "@/data/specialtyMetadata";

export type PromptVersion = {
  id: string;
  createdAt: string;
  content: string;
};

export type Prompt = {
  id: string;
  specialty: string;
  question: string;
  currentVersionId: string;
  versions: PromptVersion[];
  description?: string;
  order?: number;
};

type Store = {
  prompts: Prompt[];
  savePrompt: (p: Prompt) => void;
  deletePrompt: (id: string) => void;
  setDefaultVersion: (promptId: string, versionId: string) => void;
  getPromptForQuestion: (specialty: string, question: string) => Prompt | null;
  updatePrompt: (id: string, updates: Partial<Pick<Prompt, 'description' | 'order'>>) => void;
  bulkUpdateVersions: (updates: Array<{id: string; content: string}>) => void;
  reorderPrompts: (specialty: string, question: string, idsInOrder: string[]) => void;
};

const PromptContext = createContext<Store | null>(null);

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Generate seed prompts from specialty metadata
function generateSeedPrompts(): Prompt[] {
  const prompts: Prompt[] = [];
  
  for (const specialty of SPECIALTY_METADATA) {
    for (const module of specialty.modules) {
      const promptId = `${specialty.specialty.toLowerCase().replace(/\s+/g, '-')}-${module.name.toLowerCase().replace(/\s+/g, '-')}-prompt`;
      const versionId = `v1`;
      
      prompts.push({
        id: promptId,
        specialty: specialty.specialty,
        question: module.name,
        currentVersionId: versionId,
        description: module.description,
        order: module.displayOrder,
        versions: [{
          id: versionId,
          createdAt: "2025-08-17T10:00:00Z",
          content: module.defaultPrompt
        }]
      });
    }
  }
  
  return prompts;
}

const SEED_PROMPTS = generateSeedPrompts();

export function PromptProvider({ children }: { children: React.ReactNode }) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("promptstore");
    if (saved) {
      setPrompts(JSON.parse(saved));
    } else {
      // Initialize with seed data if no saved prompts
      setPrompts(SEED_PROMPTS);
      localStorage.setItem("promptstore", JSON.stringify(SEED_PROMPTS));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("promptstore", JSON.stringify(prompts));
  }, [prompts]);

  const savePrompt = (p: Prompt) => {
    setPrompts(prev => {
      const existing = prev.find(x => x.id === p.id);
      if (existing) {
        return prev.map(x => (x.id === p.id ? p : x));
      }
      return [...prev, p];
    });
  };

  const deletePrompt = (id: string) => {
    setPrompts(prev => prev.filter(x => x.id !== id));
  };

  const setDefaultVersion = (promptId: string, versionId: string) => {
    setPrompts(prev =>
      prev.map(p =>
        p.id === promptId ? { ...p, currentVersionId: versionId } : p
      )
    );
  };

  const getPromptForQuestion = (specialty: string, question: string) => {
    return prompts.find(p => 
      p.specialty.toLowerCase() === specialty.toLowerCase() && 
      p.question.toLowerCase().includes(question.toLowerCase())
    ) || null;
  };

  const updatePrompt = (id: string, updates: Partial<Pick<Prompt, 'description' | 'order'>>) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const bulkUpdateVersions = (updates: Array<{id: string; content: string}>) => {
    setPrompts(prev => prev.map(p => {
      const update = updates.find(u => u.id === p.id);
      if (!update) return p;
      
      const newVersionId = generateId();
      const newVersion: PromptVersion = {
        id: newVersionId,
        createdAt: new Date().toISOString(),
        content: update.content
      };
      
      return {
        ...p,
        versions: [...p.versions, newVersion],
        currentVersionId: newVersionId
      };
    }));
  };

  const reorderPrompts = (specialty: string, question: string, idsInOrder: string[]) => {
    setPrompts(prev => prev.map(p => {
      if (p.specialty === specialty && p.question === question) {
        const index = idsInOrder.indexOf(p.id);
        return index >= 0 ? { ...p, order: index + 1 } : p;
      }
      return p;
    }));
  };

  return (
    <PromptContext.Provider value={{ 
      prompts, 
      savePrompt, 
      deletePrompt, 
      setDefaultVersion, 
      getPromptForQuestion,
      updatePrompt,
      bulkUpdateVersions,
      reorderPrompts
    }}>
      {children}
    </PromptContext.Provider>
  );
}

export function usePromptStore() {
  const ctx = useContext(PromptContext);
  if (!ctx) throw new Error("usePromptStore must be used within PromptProvider");
  return ctx;
}