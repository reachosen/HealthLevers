import React from 'react';

export function DemoResetButton() {
  const KEYS = [
    "planning_config_v1",
    "intake.handoff", 
    "abstraction.cases",
    "currentCase",
    "abstraction.currentCaseId"
  ];
  
  const nuke = () => {
    // Clear specific demo keys
    KEYS.forEach(k => localStorage.removeItem(k));
    
    // Clear prompt store keys
    Object.keys(localStorage)
      .filter(k => k.startsWith("promptStore"))
      .forEach(k => localStorage.removeItem(k));
    
    // Clear specialty memory keys
    Object.keys(localStorage)
      .filter(k => k.startsWith("SpecialtyMemory"))
      .forEach(k => localStorage.removeItem(k));
    
    // Clear intake scope
    localStorage.removeItem("intake.scope");
    
    // Reload page to reset state
    location.reload();
  };
  
  return (
    <button 
      onClick={nuke} 
      className="px-3 py-1 border border-red-300 rounded text-xs text-red-600 hover:bg-red-50 transition"
      title="Reset all demo data and reload"
    >
      Reset Demo
    </button>
  );
}