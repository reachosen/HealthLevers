// API-first loading system for Home page
import { apiRequest } from '@/lib/queryClient';
import { withLocalStore } from '@/lib/withLocalStore';

// Feature flag for server cases
const useServerCases = true;

export interface CaseData {
  patient_payload: any;
  mergedSignals: any[];
  category_counts: { pass: number; fail: number; caution: number; inactive: number };
  selectedSpecialty: string;
  selectedModule: string;
  selectedModuleId: string;
  selectedCaseId: string;
}

export interface ModuleData {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
}

export interface CaseItem {
  id: string;
  specialty: string;
  moduleId: string;
  status: string;
  patient: { name: string; age: number; mrn: string };
  createdAt: string;
  bucket: string;
}

export interface SpecialtyData {
  id: string;
  name: string;
  displayOrder: number;
}

// API loader functions
export class ApiLoader {
  static async getSpecialties(): Promise<SpecialtyData[]> {
    if (!useServerCases) {
      throw new Error('Server cases disabled');
    }

    try {
      const response = await apiRequest('GET', '/api/specialties');
      const data = await response.json();
      return data.specialties || [];
    } catch (error) {
      console.error('Error fetching specialties:', error);
      throw error;
    }
  }
  static async getModules(specialty: string): Promise<ModuleData[]> {
    if (!useServerCases) {
      throw new Error('Server cases disabled');
    }

    try {
      const response = await apiRequest('GET', `/api/modules?specialty=${encodeURIComponent(specialty)}`);
      const data = await response.json();
      return data.modules || [];
    } catch (error) {
      console.error('Error fetching modules:', error);
      throw error;
    }
  }

  static async getCases(specialty: string, moduleId?: string, status?: string, limit = 10): Promise<CaseItem[]> {
    if (!useServerCases) {
      throw new Error('Server cases disabled');
    }

    try {
      const params = new URLSearchParams({
        specialty,
        ...(moduleId && { moduleId }),
        ...(status && { status }),
        limit: limit.toString()
      });

      const response = await apiRequest('GET', `/api/cases?${params}`);
      const data = await response.json();
      return data.cases || [];
    } catch (error) {
      console.error('Error fetching cases:', error);
      throw error;
    }
  }

  static async getCase(caseId: string): Promise<CaseData> {
    if (!useServerCases) {
      throw new Error('Server cases disabled');
    }

    try {
      const response = await apiRequest('GET', `/api/cases/${encodeURIComponent(caseId)}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching case:', error);
      throw error;
    }
  }

  static isServerCasesEnabled(): boolean {
    return useServerCases;
  }
}

// URL parameter utilities
export class UrlParams {
  static getParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      specialty: params.get('specialty'),
      moduleId: params.get('moduleId'),
      caseId: params.get('caseId')
    };
  }

  static updateParams(updates: { specialty?: string; moduleId?: string; caseId?: string }) {
    const params = new URLSearchParams(window.location.search);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }

  static clearParams() {
    window.history.replaceState({}, '', window.location.pathname);
  }
}

// Per-specialty memory for last case selection
export class SpecialtyMemory {
  private static STORAGE_KEY = 'specialty_last_cases';

  static getLastCase(specialty: string): { moduleId?: string; caseId?: string } {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : {};
      return data[specialty] || {};
    } catch {
      return {};
    }
  }

  static setLastCase(specialty: string, moduleId?: string, caseId?: string) {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : {};
      
      data[specialty] = {
        ...(moduleId && { moduleId }),
        ...(caseId && { caseId })
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save specialty memory:', error);
    }
  }

  static clearMemory() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}