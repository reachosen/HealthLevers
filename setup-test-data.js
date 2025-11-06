// Run this in browser console to initialize test data for Abstraction Helper

const testCaseData = {
  selectedSpecialty: "Orthopedics",
  selectedModuleId: "timeliness_sch", 
  selectedModule: "SCH Timeliness",
  selectedCaseId: "E12345",
  
  // Patient payload - this is the key data needed for display
  patient_payload: {
    "id": "E12345",
    "patient": { "mrn": "00112233", "name": "J. Doe", "age": 7 },
    "encounter": { "id": "E12345", "location": "ED", "disposition": "Admit" },
    "events": {
      "arrival": "2025-08-15T10:40:00Z",
      "consult": { "ortho": "2025-08-15T12:10:00Z" },
      "imaging": { "first": "2025-08-15T11:05:00Z" },
      "surgery": { "start": "2025-08-16T02:05:00Z", "end": "2025-08-16T03:05:00Z" }
    },
    "times": {
      "ArrivalInstant": "2025-08-15T10:40:00Z",
      "IncisionStartInstant": "2025-08-16T02:05:00Z"
    },
    "consults": { "ortho": { "provider": "Smith, MD" } },
    "imaging": {
      "ct": { "performed": true, "time": "2025-08-15T11:12:00Z" },
      "xray": { "time": "2025-08-15T11:05:00Z" }
    },
    "surgery": { "procedure": "CRPP SCH", "room": "OR-4", "priority": "Urgent" },
    "clinical": { "neurovascular_compromise": false, "open_fracture": false },
    "derived": {
      "arrival_to_surgery_min": 920,
      "target_19h_met": false,
      "target_hours": 19,
      "hours_to_surgery": 15.3
    }
  },
  
  // Optional: Pre-processed signals
  mergedSignals: [
    {
      "id": "on_time_19h",
      "label": "19-Hour Timeliness",
      "status": "fail", 
      "group": "Timeliness",
      "evidence": ["Surgery occurred 15.3 hours after arrival"],
      "cites": ["events.arrival", "events.surgery.start", "derived.hours_to_surgery"]
    }
  ],
  
  readyForReview: true,
  loadedAt: new Date().toISOString(),
  loadedBy: "manual_setup"
};

// Store in localStorage
localStorage.setItem('abstraction.cases', JSON.stringify(testCaseData));

console.log('✅ Test data initialized in abstraction.cases');
console.log('🔄 Refresh the page to see patient data display');