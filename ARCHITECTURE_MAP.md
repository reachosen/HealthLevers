# HealthLevers v9.2 - Complete Architecture Map

## Overview
This document maps the complete data flow from case selection through enrichment, storage, display, and user feedback in the HealthLevers quality metrics application.

---

## 1. Environment Detection & Data Selection

### How Prod vs Dev is Determined

**File**: `server/db.ts`

```typescript
// Auto-detects environment based on DATABASE_URL
const isNeon = process.env.DATABASE_URL.includes('neon.tech')

if (isNeon) {
  // PRODUCTION: Use Neon serverless driver
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNeon({ client: pool, schema });
} else {
  // DEVELOPMENT: Use local PostgreSQL
  pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNode({ client: pool, schema });
}
```

**Selection Logic**:
- **Dev**: `DATABASE_URL=postgresql://localhost:5432/healthlevers` → Uses test cases
- **Prod**: `DATABASE_URL=postgresql://...neon.tech/...` → Uses real patient data

---

## 2. Complete Data Flow - Step by Step

### STEP 1: User Selects Specialty & Module

**Screen**: Home Page (`client/src/pages/home.tsx`)

```
User Actions:
1. Selects Specialty (e.g., "Orthopedics") from dropdown
2. Selects Module (e.g., "Timeliness – SCH") from module list
3. Sees list of available cases for that module

Data Flow:
→ GET /api/specialties (returns all specialties from metadata)
→ GET /api/modules?specialty=Orthopedics (returns modules for specialty)
→ GET /api/cases?specialty=Orthopedics&moduleId=timeliness_sch
```

**Data Source**:
- **Dev**: Loads from `client/src/data/testCases.json` (50+ predefined cases)
- **Prod**: Queries `case` table in PostgreSQL

---

### STEP 2: User Uploads/Selects Case for Enrichment

**Screen**: Intake Page (`client/src/pages/intake.tsx`)

**Two Input Methods**:

**Method A: Upload JSON**
```typescript
// User uploads patient_payload.json
const handleUpload = (file) => {
  const patientData = JSON.parse(file);
  setPatientPayload(patientData);
}
```

**Method B: Select Existing Case**
```typescript
// User selects from dropdown
const handleSelectCase = async (caseId) => {
  const response = await fetch(`/api/cases/${caseId}`);
  const caseData = await response.json();
  setPatientPayload(caseData.patient_payload);
}
```

**What Gets Loaded**:
```json
{
  "patient": {
    "mrn": "12345",
    "name": "John Doe",
    "age": 8
  },
  "encounter": {
    "encounterId": "E001",
    "admitService": "Orthopedics"
  },
  "times": {
    "ArrivalInstant": "2024-01-15T14:30:00Z",
    "IncisionStartInstant": "2024-01-16T08:15:00Z"
  },
  "notes": [
    {
      "timestamp": "2024-01-15T14:35:00Z",
      "type": "ED Note",
      "text": "8yo with supracondylar humerus fracture..."
    }
  ]
}
```

---

### STEP 3: AI Enrichment Process

**Trigger**: User clicks "Analyze" button on Intake page

**Client-Side Code** (`client/src/pages/intake.tsx`):
```typescript
const handleEnrich = async () => {
  // 1. Get signal definitions for the selected module
  const moduleSignals = getSignalsForModule(selectedModule);

  // 2. Get prompt template from metadata
  const promptConfig = await fetch(
    `/api/metadata/metrics/${metricId}/prompts/abstraction_help`
  );

  // 3. Call enrichment API
  const response = await fetch('/api/ai_signals', {
    method: 'POST',
    body: JSON.stringify({
      specialty: selectedSpecialty,
      moduleId: selectedModule,
      moduleSignals: moduleSignals,
      patient: patientPayload,
      promptText: promptConfig.prompt_text
    })
  });

  const enrichedData = await response.json();
  // enrichedData = { signals: [...], category_counts: {...} }
}
```

**Server-Side Processing** (`server/routes.ts:220-326`):

```typescript
app.post("/api/ai_signals", isAuthenticated, async (req, res) => {
  const { specialty, moduleId, moduleSignals, patient, promptText } = req.body;

  // 1. Build system prompt
  const systemPrompt = promptText || `You are a medical quality reviewer...`;

  // 2. Build user prompt with patient data
  const userPrompt = `
    Patient Data: ${JSON.stringify(patient, null, 2)}

    Signals to evaluate:
    ${moduleSignals.map(s => `- ${s.id}: ${s.label}`).join('\n')}
  `;

  // 3. Call OpenAI GPT-4o
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.1
  });

  // 4. Parse AI response
  const aiResult = JSON.parse(completion.choices[0].message.content);

  // 5. Process and validate signals
  const processedSignals = moduleSignals.map(sig => {
    const aiSignal = aiResult.signals.find(s => s.id === sig.id);
    return {
      id: sig.id,
      status: aiSignal?.status || "inactive",
      evidence: aiSignal?.evidence || "No evidence found",
      cites: aiSignal?.cites || [] // Patient data paths referenced
    };
  });

  // 6. Calculate category counts
  const category_counts = {
    pass: processedSignals.filter(s => s.status === "pass").length,
    fail: processedSignals.filter(s => s.status === "fail").length,
    caution: processedSignals.filter(s => s.status === "caution").length,
    inactive: processedSignals.filter(s => s.status === "inactive").length
  };

  return res.json({ signals: processedSignals, category_counts });
});
```

**AI Response Format**:
```json
{
  "signals": [
    {
      "id": "on_time_19h",
      "status": "pass",
      "evidence": "Surgery completed at 18:30 - within 19h window",
      "cites": [
        "patient_payload.times.ArrivalInstant",
        "patient_payload.times.IncisionStartInstant"
      ]
    },
    {
      "id": "npo_violation",
      "status": "fail",
      "evidence": "NPO violated at 20:00 (juice given)",
      "cites": ["patient_payload.notes[3].text"]
    }
  ],
  "category_counts": {
    "pass": 15,
    "fail": 2,
    "caution": 1,
    "inactive": 0
  }
}
```

---

### STEP 4: Data Storage After Enrichment

**Storage Mechanism**: localStorage (client-side)

**Client Code** (`client/src/pages/intake.tsx`):
```typescript
const storageKey = `processed_${caseId}_${moduleId}_${specialty}`;

const enrichedCase = {
  selectedCaseId: caseId,
  selectedSpecialty: specialty,
  selectedModule: moduleName,
  selectedModuleId: moduleId,
  patient_payload: patientPayload,
  mergedSignals: enrichedData.signals, // AI-enriched signals
  category_counts: enrichedData.category_counts,
  timestamp: new Date().toISOString()
};

// Store in localStorage
localStorage.setItem(storageKey, JSON.stringify(enrichedCase));

// Also store in "available cases" list
const existingCases = JSON.parse(localStorage.getItem('stored_cases') || '[]');
existingCases.push(enrichedCase);
localStorage.setItem('stored_cases', JSON.stringify(existingCases));
```

**What Gets Stored**:
```json
{
  "selectedCaseId": "TC_SCH_PASS",
  "selectedSpecialty": "Orthopedics",
  "selectedModule": "Timeliness – SCH",
  "selectedModuleId": "timeliness_sch",
  "patient_payload": { /* original patient data */ },
  "mergedSignals": [
    {
      "id": "on_time_19h",
      "label": "Incision ≤19h of ED arrival",
      "group": "Core",
      "status": "pass",
      "evidence": "Surgery at 18:30 - within 19h",
      "cites": ["patient_payload.times.ArrivalInstant", "..."]
    }
  ],
  "category_counts": { "pass": 15, "fail": 2, "caution": 1, "inactive": 0 },
  "timestamp": "2024-11-08T11:45:00Z"
}
```

---

### STEP 5: Navigation to Review Screen (Screen 2)

**From**: Intake Page → **To**: Home Page

**Trigger**: User clicks "Review Case" or navigates to Home

**Data Retrieval** (`client/src/pages/home.tsx`):

```typescript
// On Home page mount
useEffect(() => {
  // Load all stored cases from localStorage
  const storedCases = JSON.parse(localStorage.getItem('stored_cases') || '[]');
  setAvailableCases(storedCases);

  // If a specific case is selected, load it
  if (selectedCaseId) {
    const caseKey = `processed_${selectedCaseId}_${moduleId}_${specialty}`;
    const caseData = JSON.parse(localStorage.getItem(caseKey));
    setCurrentCase(caseData);
  }
}, [selectedCaseId]);
```

**What Displays**:
1. **Case list** (left sidebar) - All enriched cases from localStorage
2. **Selected case details** (main area) - Patient info + signals
3. **Signal groups** (collapsible sections) - Organized by group_id
4. **Category counts** (summary cards) - Pass/Fail/Caution/Inactive totals

---

## 3. Display Plan & Metadata Integration

### How Display Plan Controls UI

**Database Table**: `display_plan`

```sql
SELECT * FROM display_plan WHERE metric_id = 'ORTHO_I32A_RETURNOR';
```

**Result**:
```
metric_id              | field_name           | label                    | tier | order_nbr | visibility_cond
-----------------------|----------------------|--------------------------|------|-----------|------------------
ORTHO_I32A_RETURNOR    | patient_name         | Patient Name             | 1    | 10        | NULL
ORTHO_I32A_RETURNOR    | mrn                  | Medical Record Number    | 1    | 20        | NULL
ORTHO_I32A_RETURNOR    | return_date          | Return to OR Date        | 2    | 30        | status=='fail'
ORTHO_I32A_RETURNOR    | complication_details | Complication Details     | 3    | 40        | tier>=3
```

**How UI Uses This**:

**Client Component** (`client/src/components/DynamicSignalDisplay.tsx`):

```typescript
const DynamicSignalDisplay = ({ metricId, patientData, signals }) => {
  // 1. Fetch display plan from metadata API
  const { data: displayPlan } = useQuery({
    queryKey: [`/api/metadata/metrics/${metricId}/display-plan`]
  });

  // 2. Sort fields by order_nbr
  const sortedFields = displayPlan.sort((a, b) => a.order_nbr - b.order_nbr);

  // 3. Filter by visibility conditions
  const visibleFields = sortedFields.filter(field => {
    if (!field.visibility_cond) return true;

    // Evaluate condition (e.g., "status=='fail'")
    return evaluateCondition(field.visibility_cond, signals);
  });

  // 4. Group by tier
  const tier1Fields = visibleFields.filter(f => f.tier === '1');
  const tier2Fields = visibleFields.filter(f => f.tier === '2');

  // 5. Render dynamically
  return (
    <div>
      <Section title="Primary Details">
        {tier1Fields.map(field => (
          <Field
            key={field.field_name}
            label={field.label}
            value={patientData[field.field_name]}
          />
        ))}
      </Section>

      <Section title="Additional Details" collapsible>
        {tier2Fields.map(field => (
          <Field
            key={field.field_name}
            label={field.label}
            value={patientData[field.field_name]}
          />
        ))}
      </Section>
    </div>
  );
};
```

**Visual Result**:
```
┌─────────────────────────────────────┐
│ Primary Details (Tier 1)            │
├─────────────────────────────────────┤
│ Patient Name: John Doe              │
│ Medical Record Number: 12345        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ▼ Additional Details (Tier 2)       │
├─────────────────────────────────────┤
│ Return to OR Date: 2024-01-20       │ ← Only shows if status=='fail'
└─────────────────────────────────────┘
```

---

### Signal Grouping with Metadata

**Database Tables**: `signal_group` + `signal_def`

```sql
-- Get groups for metric
SELECT * FROM signal_group WHERE metric_id = 'ORTHO_I32A_TIMELINESS';

-- Result:
metric_id              | group_id    | group_code
-----------------------|-------------|------------
ORTHO_I32A_TIMELINESS  | core        | Core
ORTHO_I32A_TIMELINESS  | delay       | Delay Drivers

-- Get signals for each group
SELECT * FROM signal_def
WHERE metric_id = 'ORTHO_I32A_TIMELINESS'
  AND group_id = 'core';

-- Result:
metric_id              | signal_code      | group_id | severity | status
-----------------------|------------------|----------|----------|--------
ORTHO_I32A_TIMELINESS  | on_time_19h      | core     | critical | active
ORTHO_I32A_TIMELINESS  | dx_confirmed_sch | core     | high     | active
```

**UI Rendering** (`client/src/components/SignalGroupDisplay.tsx`):

```typescript
const SignalGroupDisplay = ({ metricId, enrichedSignals }) => {
  // 1. Fetch signal groups
  const { data: groups } = useQuery({
    queryKey: [`/api/metadata/metrics/${metricId}/signal-groups`]
  });

  // 2. Fetch signal definitions
  const { data: signalDefs } = useQuery({
    queryKey: [`/api/metadata/metrics/${metricId}/signals`]
  });

  // 3. Merge with enriched data
  const groupedSignals = groups.map(group => ({
    ...group,
    signals: signalDefs
      .filter(def => def.group_id === group.group_id)
      .map(def => ({
        ...def,
        // Add enrichment data (status, evidence, cites)
        ...enrichedSignals.find(e => e.id === def.signal_code)
      }))
  }));

  // 4. Render groups
  return (
    <div>
      {groupedSignals.map(group => (
        <CollapsibleSection
          key={group.group_id}
          title={group.group_code}
          defaultOpen={group.group_id === 'core'}
        >
          {group.signals.map(signal => (
            <SignalChip
              key={signal.signal_code}
              label={signal.label}
              status={signal.status} // pass/fail/caution
              evidence={signal.evidence}
              cites={signal.cites}
            />
          ))}
        </CollapsibleSection>
      ))}
    </div>
  );
};
```

**Visual Result**:
```
┌────────────────────────────────────────────┐
│ ▼ Core                                     │
├────────────────────────────────────────────┤
│ ✓ Incision ≤19h of ED arrival   [PASS]    │
│   Evidence: Surgery at 18:30 - within 19h │
│                                            │
│ ✓ Operative note confirms SCH    [PASS]   │
│   Evidence: SCH diagnosis in op note       │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ ▶ Delay Drivers                            │ ← Collapsed by default
└────────────────────────────────────────────┘
```

---

## 4. Dynamic Followup Forms

**Database Table**: `followup`

```sql
SELECT * FROM followup WHERE metric_id = 'ORTHO_I32A_TIMELINESS';
```

**Result**:
```
metric_id              | followup_id       | when_cond           | question_text                | response_type
-----------------------|-------------------|---------------------|------------------------------|---------------
ORTHO_I32A_TIMELINESS  | delay_reason      | status=='fail'      | What caused the delay?       | text
ORTHO_I32A_TIMELINESS  | npo_break_time    | npo_violation=true  | When was NPO broken?         | datetime
```

**Dynamic Form Rendering** (`client/src/components/DynamicFollowupForms.tsx`):

```typescript
const DynamicFollowupForms = ({ metricId, signals }) => {
  // 1. Fetch followup questions
  const { data: followups } = useQuery({
    queryKey: [`/api/metadata/metrics/${metricId}/followups`]
  });

  // 2. Filter by conditions
  const activeFollowups = followups.filter(f => {
    if (!f.when_cond) return true; // Always show if no condition

    // Evaluate condition against current signals
    // Example: "status=='fail'" checks if any signal failed
    return evaluateCondition(f.when_cond, signals);
  });

  // 3. Render conditional forms
  return (
    <form>
      {activeFollowups.map(followup => (
        <FormField
          key={followup.followup_id}
          type={followup.response_type} // text, datetime, select, etc.
          label={followup.question_text}
          name={followup.followup_id}
        />
      ))}
    </form>
  );
};
```

**Visual Result (when signal fails)**:
```
┌─────────────────────────────────────────────┐
│ Follow-up Questions                         │
├─────────────────────────────────────────────┤
│ What caused the delay?                      │
│ [_________________________________]         │
│                                             │
│ When was NPO broken?                        │
│ [__/__/____] [__:__] AM/PM                  │
└─────────────────────────────────────────────┘
```

---

## 5. Chat & LLM Q&A Integration

### User-Initiated Questions

**Trigger**: User clicks "Ask AI" button on any signal

**Frontend Component** (`client/src/components/LLMChat.tsx`):

```typescript
const LLMChat = ({ signal, patientData }) => {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState(null);

  const handleAsk = async () => {
    const result = await fetch('/api/qa', {
      method: 'POST',
      body: JSON.stringify({
        prompt_text: question,
        specialty: 'Orthopedics',
        module_id: 'timeliness_sch',
        patient_payload: patientData,
        signal_ids: [signal.id]
      })
    });

    const data = await result.json();
    setResponse(data.response);
  };

  return (
    <div>
      <textarea
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="Ask a question about this signal..."
      />
      <button onClick={handleAsk}>Ask AI</button>

      {response && (
        <div className="ai-response">
          <h4>AI Analysis:</h4>
          <pre>{response}</pre>
        </div>
      )}
    </div>
  );
};
```

**Backend Q&A Endpoint** (`server/routes.ts:739-860`):

```typescript
app.post("/api/qa", isAuthenticated, async (req, res) => {
  const { prompt_text, specialty, module_id, patient_payload, signal_ids } = req.body;

  // 1. Enforce 3-field response schema
  const SYSTEM_WRAPPER = `You must answer in exactly 3 fields only:
    Result/Finding: <short assessment>
    Reason: <≤10 words>
    Evidence: [list items with timestamps/sources]

    No extra lines or explanations outside these 3 fields.`;

  // 2. Build context
  const context = `
    Specialty: ${specialty}
    Module: ${module_id}
    Focus on signals: ${signal_ids.join(', ')}

    Patient Data:
    ${JSON.stringify(patient_payload, null, 2)}

    ${prompt_text}
  `;

  // 3. Call GPT-4o with structured prompt
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_WRAPPER },
      { role: "user", content: context }
    ],
    temperature: 0.1
  });

  let response = completion.choices[0].message.content;

  // 4. Validate response has all 3 fields
  const hasResultFinding = response.includes('Result') || response.includes('Finding');
  const hasReason = response.includes('Reason');
  const hasEvidence = response.includes('Evidence');

  // 5. Auto-repair if missing fields
  if (!hasResultFinding || !hasReason || !hasEvidence) {
    const repairCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_WRAPPER + "\n\nYou omitted required fields. Provide all 3 fields now." },
        { role: "user", content: `Original context: ${context.substring(0, 500)}...` }
      ]
    });
    response = repairCompletion.choices[0].message.content;
  }

  return res.json({ response });
});
```

**AI Response Format**:
```
Result/Finding: Patient met 19-hour timeliness target

Reason: Surgery started 18.75 hours after ED arrival

Evidence:
- ED arrival: 2024-01-15 14:30:00Z (patient_payload.times.ArrivalInstant)
- Incision start: 2024-01-16 08:15:00Z (patient_payload.times.IncisionStartInstant)
- Time delta: 18h 45min < 19h threshold
```

---

### User Feedback Capture

**Database Table**: `feedback`

```sql
CREATE TABLE feedback (
  feedback_id TEXT PRIMARY KEY,
  run_id TEXT,
  mode TEXT, -- 'abstraction' | 'validation'
  rating NUMERIC, -- 1-5 stars
  label TEXT, -- 'helpful' | 'incorrect' | 'incomplete'
  comment TEXT,
  created_ts TIMESTAMP DEFAULT NOW()
);
```

**Frontend Component** (`client/src/components/FeedbackWidget.tsx`):

```typescript
const FeedbackWidget = ({ runId, signalId }) => {
  const [rating, setRating] = useState(0);
  const [label, setLabel] = useState('');
  const [comment, setComment] = useState('');

  const handleSubmit = async () => {
    await fetch('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        run_id: runId,
        signal_id: signalId,
        rating,
        label,
        comment
      })
    });

    // Show success toast
    toast.success('Feedback submitted');
  };

  return (
    <div>
      <StarRating value={rating} onChange={setRating} />

      <div className="labels">
        <label>
          <input type="radio" value="helpful" checked={label === 'helpful'} onChange={e => setLabel(e.target.value)} />
          Helpful
        </label>
        <label>
          <input type="radio" value="incorrect" checked={label === 'incorrect'} onChange={e => setLabel(e.target.value)} />
          Incorrect
        </label>
        <label>
          <input type="radio" value="incomplete" checked={label === 'incomplete'} onChange={e => setLabel(e.target.value)} />
          Incomplete
        </label>
      </div>

      <textarea
        placeholder="Additional comments..."
        value={comment}
        onChange={e => setComment(e.target.value)}
      />

      <button onClick={handleSubmit}>Submit Feedback</button>
    </div>
  );
};
```

**Backend Storage** (`server/routes.ts` - add this endpoint):

```typescript
app.post("/api/feedback", isAuthenticated, async (req, res) => {
  const { run_id, signal_id, rating, label, comment } = req.body;

  const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await db.insert(feedback).values({
    feedbackId,
    runId: run_id,
    mode: 'abstraction',
    rating: rating.toString(),
    label,
    comment,
    createdTs: new Date()
  });

  res.json({ success: true, feedbackId });
});
```

---

## 6. Complete User Journey Example

### Scenario: Reviewing SCH Timeliness Case

**Timeline**:

1. **00:00 - User arrives at app**
   - URL: `http://localhost:5000/`
   - Auth check: `GET /api/auth/user` → Returns mock dev user
   - Loads Home page with empty case list

2. **00:05 - Navigate to Intake**
   - Clicks "New Case" button
   - URL changes to `/intake`
   - Component mounts: `IntakePage`

3. **00:10 - Select specialty & module**
   - Selects "Orthopedics" from dropdown
   - API call: `GET /api/modules?specialty=Orthopedics`
   - Selects "Timeliness – SCH" from module list
   - Fetches metadata: `GET /api/metadata/metrics/ORTHO_I32A_TIMELINESS`

4. **00:20 - Upload patient JSON**
   - Clicks "Upload File" button
   - Selects `patient_TC_SCH_PASS.json` from computer
   - File contents loaded into `patientPayload` state

5. **00:30 - Trigger enrichment**
   - Clicks "Analyze" button
   - Frontend calls:
     ```
     POST /api/ai_signals
     Body: {
       specialty: "Orthopedics",
       moduleId: "timeliness_sch",
       moduleSignals: [
         { id: "on_time_19h", label: "Incision ≤19h of ED arrival", group: "Core" },
         { id: "dx_confirmed_sch", label: "Operative note confirms SCH", group: "Core" },
         { id: "npo_violation", label: "Pre-op NPO violation", group: "Delay Drivers" }
       ],
       patient: { /* patient_payload */ },
       promptText: "You are a medical quality reviewer..."
     }
     ```

6. **00:35 - AI Processing (server-side)**
   - GPT-4o analyzes patient data
   - Generates response:
     ```json
     {
       "signals": [
         {
           "id": "on_time_19h",
           "status": "pass",
           "evidence": "Surgery at 18:30 - within 19h window",
           "cites": ["patient_payload.times.ArrivalInstant", "patient_payload.times.IncisionStartInstant"]
         },
         {
           "id": "dx_confirmed_sch",
           "status": "pass",
           "evidence": "SCH diagnosis confirmed in operative note",
           "cites": ["patient_payload.notes[2].text"]
         },
         {
           "id": "npo_violation",
           "status": "pass",
           "evidence": "No NPO violations documented",
           "cites": []
         }
       ],
       "category_counts": { "pass": 3, "fail": 0, "caution": 0, "inactive": 0 }
     }
     ```

7. **00:40 - Store enriched data**
   - Frontend receives response
   - Stores in localStorage:
     ```javascript
     localStorage.setItem('processed_TC_SCH_PASS_timeliness_sch_Orthopedics', JSON.stringify({
       selectedCaseId: 'TC_SCH_PASS',
       selectedSpecialty: 'Orthopedics',
       selectedModule: 'Timeliness – SCH',
       selectedModuleId: 'timeliness_sch',
       patient_payload: { /* original data */ },
       mergedSignals: [ /* enriched signals */ ],
       category_counts: { pass: 3, fail: 0, caution: 0, inactive: 0 },
       timestamp: '2024-11-08T12:00:40Z'
     }));
     ```

8. **00:45 - Navigate to review screen**
   - User clicks "Review Case" button
   - URL changes to `/` (Home)
   - Home component loads enriched case from localStorage

9. **00:50 - Display with metadata**
   - Fetches display plan: `GET /api/metadata/metrics/ORTHO_I32A_TIMELINESS/display-plan`
   - Fetches signal groups: `GET /api/metadata/metrics/ORTHO_I32A_TIMELINESS/signal-groups`
   - Fetches followup questions: `GET /api/metadata/metrics/ORTHO_I32A_TIMELINESS/followups`

   - Renders UI:
     ```
     ┌──────────────────────────────────────┐
     │ Case: TC_SCH_PASS                    │
     │ Patient: John Doe (MRN: 12345)       │ ← From display_plan (tier 1)
     ├──────────────────────────────────────┤
     │ Status Summary:                      │
     │   ✓ Pass: 3   ✗ Fail: 0              │
     │   ⚠ Caution: 0   ○ Inactive: 0       │
     ├──────────────────────────────────────┤
     │ ▼ Core                               │ ← From signal_group
     │   ✓ Incision ≤19h of ED arrival      │ ← From signal_def
     │     Evidence: Surgery at 18:30...    │ ← From AI enrichment
     │                                      │
     │   ✓ Operative note confirms SCH      │
     │     Evidence: SCH diagnosis...       │
     ├──────────────────────────────────────┤
     │ ▶ Delay Drivers                      │
     └──────────────────────────────────────┘
     ```

10. **01:00 - User asks follow-up question**
    - Clicks "Ask AI" on "on_time_19h" signal
    - Types: "What was the exact time from arrival to incision?"
    - Clicks "Send"

    - Frontend calls:
      ```
      POST /api/qa
      Body: {
        prompt_text: "What was the exact time from arrival to incision?",
        specialty: "Orthopedics",
        module_id: "timeliness_sch",
        patient_payload: { /* patient data */ },
        signal_ids: ["on_time_19h"]
      }
      ```

    - AI responds:
      ```
      Result/Finding: Arrival to incision was 18 hours and 45 minutes

      Reason: Below 19-hour target by 15 minutes

      Evidence:
      - ED arrival: 2024-01-15 14:30:00Z (patient_payload.times.ArrivalInstant)
      - Incision start: 2024-01-16 08:15:00Z (patient_payload.times.IncisionStartInstant)
      - Calculated delta: 18h 45min
      ```

11. **01:10 - User provides feedback**
    - Clicks 5-star rating
    - Selects "Helpful" label
    - Types comment: "Very accurate analysis"
    - Clicks "Submit Feedback"

    - Frontend calls:
      ```
      POST /api/feedback
      Body: {
        run_id: "run_20241108_120040",
        signal_id: "on_time_19h",
        rating: 5,
        label: "helpful",
        comment: "Very accurate analysis"
      }
      ```

    - Stored in `feedback` table for future model training

---

## 7. Caching Strategy

### Client-Side Caching (React Query)

**Configuration** (`client/src/lib/queryClient.ts`):

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh
      cacheTime: 10 * 60 * 1000, // 10 minutes - keep in cache
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});
```

**What Gets Cached**:
- `/api/auth/user` - 5 min
- `/api/specialties` - 5 min
- `/api/modules?specialty=X` - 5 min
- `/api/metadata/metrics/X` - 5 min (metadata rarely changes)
- `/api/metadata/metrics/X/signals` - 5 min
- `/api/metadata/metrics/X/display-plan` - 5 min

### Server-Side Caching (In-Memory)

**Metadata API** (`server/routes/metadata.ts`):

```typescript
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, { data: any; timestamp: number }>();

function getCached(key: string) {
  const cached = cache.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  console.log(`[CACHE HIT] ${key}`);
  return cached.data;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
  console.log(`[CACHE SET] ${key}`);
}

// Example usage
router.get('/metrics/:metricId', async (req, res) => {
  const cacheKey = `metric_${req.params.metricId}`;

  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const data = await db.query.metric.findFirst({
    where: eq(metric.metricId, req.params.metricId)
  });

  setCache(cacheKey, data);
  res.json(data);
});
```

**Cache Clear Endpoint**:
```typescript
router.post('/cache/clear', isAuthenticated, (req, res) => {
  cache.clear();
  res.json({ message: 'Cache cleared', count: cache.size });
});
```

---

## 8. Technology Stack Summary

### Frontend
- **Framework**: React 18 + TypeScript
- **Routing**: Wouter (lightweight React Router alternative)
- **State Management**: React Query (server state) + React Context (UI state)
- **UI Components**: Radix UI + Tailwind CSS
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Fetch API (wrapped by React Query)
- **Storage**: localStorage (enriched cases, planning config)

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database ORM**: Drizzle ORM
- **Database**: PostgreSQL (local) or Neon (cloud)
- **Authentication**: Placeholder (SSO planned)
- **AI/LLM**: OpenAI GPT-4o
- **Session Storage**: PostgreSQL (sessions table)

### Database
- **Dev**: PostgreSQL 17 (localhost:5432)
- **Prod**: Neon Serverless PostgreSQL
- **Schema**: 21 tables (8 metadata + 13 runtime)
- **Migrations**: Drizzle Kit

### Development Tools
- **Dev Server**: Vite 5 (frontend) + TSX (backend)
- **Build**: Vite (frontend) + esbuild (backend)
- **Type Checking**: TypeScript 5.6
- **Linting**: (not configured yet)
- **Testing**: Vitest

---

## 9. Key Files Reference

| Category | File | Purpose |
|----------|------|---------|
| **Entry Points** | `server/index.ts` | Express app setup, Vite integration |
| | `client/src/main.tsx` | React app mount point |
| | `client/src/App.tsx` | Route configuration, providers |
| **Pages** | `client/src/pages/home.tsx` | Case review screen (Screen 2) |
| | `client/src/pages/intake.tsx` | Case upload & enrichment (Screen 1) |
| | `client/src/pages/Landing.tsx` | Unauthenticated landing page |
| | `client/src/pages/metrics.tsx` | Metadata browsing |
| **API Routes** | `server/routes.ts` | Core API endpoints (1129 lines) |
| | `server/routes/metadata.ts` | v9.2 Metadata API (cached) |
| **Components** | `client/src/components/DynamicSignalDisplay.tsx` | Metadata-driven signal rendering |
| | `client/src/components/DynamicFollowupForms.tsx` | Conditional followup questions |
| | `client/src/components/LLMChat.tsx` | AI Q&A interface |
| | `client/src/components/FeedbackWidget.tsx` | User feedback capture |
| **Hooks** | `client/src/hooks/useAuth.ts` | Authentication state |
| | `client/src/hooks/useMetadataApi.ts` | Metadata fetching hooks |
| | `client/src/hooks/useSpecialties.ts` | Specialty data |
| **Database** | `server/db.ts` | Database connection (auto-detect Neon/local) |
| | `shared/schema.ts` | Drizzle ORM table definitions |
| **Auth** | `server/placeholderAuth.ts` | No-op auth (SSO placeholder) |
| **Prompts** | `server/promptStore.ts` | Prompt templates & routing |
| **Data** | `client/src/data/testCases.json` | 50+ test cases (dev mode) |
| | `USNWR_Master_AllMetrics_v4.xlsx` | Metadata source (seeding) |
| **Scripts** | `scripts/seed-metadata.ts` | Database seeding from Excel |
| | `scripts/validate-database.ts` | Schema validation |

---

## 10. Next Steps & Recommendations

### Immediate Improvements

1. **Add Feedback API Endpoint**
   - Create `POST /api/feedback` to store user ratings
   - Track which signals get negative feedback for model improvement

2. **Implement SSO Authentication**
   - Replace `placeholderAuth.ts` with real SSO provider
   - Options: Azure AD, Okta, Auth0

3. **Add Audit Logging**
   - Log all AI enrichment runs to `ai_run` table
   - Track user actions to `audit_log` table

4. **Cache Optimization**
   - Add Redis for distributed caching (when scaling)
   - Implement cache warming on startup

5. **Error Handling**
   - Add global error boundary in React
   - Implement retry logic for AI calls
   - Add circuit breaker for OpenAI API

### Future Enhancements

1. **Real-time Collaboration**
   - WebSocket support for multi-user case review
   - Live updates when another abstractor modifies a case

2. **Batch Processing**
   - Process multiple cases simultaneously
   - Background job queue for large batches

3. **Advanced Analytics**
   - Dashboard showing enrichment accuracy over time
   - Signal-level accuracy metrics
   - User feedback trends

4. **Export & Reporting**
   - Export enriched cases to CSV/Excel
   - Generate quality reports
   - Integration with reporting tools

---

## Conclusion

This architecture provides:

✅ **Separation of Concerns**: Metadata in PostgreSQL, enriched cases in localStorage, AI processing via API
✅ **Dynamic UI**: All display driven by database metadata (display_plan, signal_def, followup)
✅ **Scalability**: Metadata cached (1hr server, 5min client), stateless API design
✅ **Flexibility**: Easy to add new metrics, signals, or specialties via database
✅ **User Feedback Loop**: Capture ratings/comments for continuous improvement
✅ **Dev/Prod Parity**: Same code, different data sources (testCases.json vs PostgreSQL)

**Total Lines of Code**:
- Frontend: ~8,000 lines
- Backend: ~2,500 lines
- Shared: ~1,000 lines
- **Total: ~11,500 lines** of production TypeScript code

---

**Document Version**: 1.0
**Last Updated**: 2024-11-08
**Author**: Architecture Team
**Status**: Complete & Ready for Onboarding
