# HealthLevers UI Architecture
## Complete Abstraction Workflow Interface

---

## Current Problem
The existing UI has a "MetricSelector" which doesn't match the actual workflow. The real workflow is:
1. Abstractor receives a **case** (not picking a metric)
2. System **auto-classifies** which metrics apply
3. Abstractor **reviews enriched signals**
4. Abstractor **answers followup questions**
5. Abstractor **submits completed case**

---

## UI Workflow (Abstractor's Journey)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CASE QUEUE (Home Screen)                                    │
│    "You have 12 cases to abstract"                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CASE DETAIL (Click a case)                                  │
│    Patient: 6yo, Ortho, Supracondylar fracture                 │
│    Metrics: ORTHO_I25 (auto-detected)                          │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. SIGNAL REVIEW (Tabbed by group)                             │
│    Demographics | Clinical | Timing | Outcomes                 │
│    [Show enriched signals with confidence scores]              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. FOLLOWUP QUESTIONS                                           │
│    "What was the mechanism of injury?"                         │
│    [Answer text/date/dropdown questions]                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. REVIEW & SUBMIT                                              │
│    Summary of all data before final submission                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Screen Designs

### Screen 1: Case Queue (Home)
**Purpose**: Show all cases assigned to abstractor

```
┌────────────────────────────────────────────────────────────────┐
│ HealthLevers - Quality Abstraction                             │
│                                                    [User: JDoe] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  My Case Queue                                [Filter: All ▼]  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ENC_12345 | 6yo Male | Ortho              [NEW]          │ │
│  │ Supracondylar fracture                                   │ │
│  │ Admitted: Jan 15, 2024                                   │ │
│  │ Metrics: ORTHO_I25 (1)                    [Start Review] │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ENC_12346 | 45yo Female | Cardiology  [IN PROGRESS 65%] │ │
│  │ Acute MI                                                 │ │
│  │ Admitted: Jan 14, 2024                                   │ │
│  │ Metrics: CARDIO_E24 (1)                [Continue Review] │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ENC_12347 | 8yo Female | Ortho           [COMPLETED ✓]  │ │
│  │ Femoral shaft fracture                                   │ │
│  │ Admitted: Jan 13, 2024                                   │ │
│  │ Metrics: ORTHO_I26 (1)                       [View Only] │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Showing 3 of 12 cases                          [Load More...] │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Status badges: NEW, IN PROGRESS, COMPLETED
- Progress bar for in-progress cases
- Filter by status, specialty, date range
- Click any case to drill in

---

### Screen 2: Case Header (Top of every screen)
**Purpose**: Context about current case

```
┌────────────────────────────────────────────────────────────────┐
│ ← Back to Queue                                                │
├────────────────────────────────────────────────────────────────┤
│  Patient: 6yo Male                    Encounter: ENC_12345    │
│  Specialty: Ortho                                              │
│  Diagnosis: S42.411A - Supracondylar fracture                 │
│  Admitted: Jan 15, 2024 08:30                                  │
│                                                                 │
│  Metrics Applied:                                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ✓ ORTHO_I25 - I25 - In OR <18 hrs (Supracondylar)      │  │
│  │   Confidence: 98%                                       │  │
│  │   Status: IN PROGRESS (65%)                             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Step Navigation: Signals → Followups → Review & Submit]     │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### Screen 3: Signal Review (Main Abstraction UI)
**Purpose**: Review and correct enriched signals

```
┌────────────────────────────────────────────────────────────────┐
│ [Case Header - see above]                                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ORTHO_I25 - In OR <18 hrs – Supracondylar fracture           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ [Demographics] [Clinical Data] [Timing] [Outcomes]      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Demographics Group                                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Patient Age                              [VERIFIED ✓]   │  │
│  │ 6 years                                                  │  │
│  │ Source: Extracted from EHR                               │  │
│  │ Confidence: 100%                            [Edit]       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Patient Weight                           [AI ENRICHED]  │  │
│  │ 20.5 kg                                                  │  │
│  │ Source: AI inferred from age/gender                      │  │
│  │ Confidence: 75%                  [Accept] [Edit] [Flag]  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Clinical Data Group                                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Fracture Type                            [AI ENRICHED]  │  │
│  │ Displaced                                                │  │
│  │ Source: AI extracted from radiology note                 │  │
│  │ Confidence: 85%                  [Accept] [Edit] [Flag]  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Neurovascular Status                     [MISSING ⚠️]   │  │
│  │ [Please enter value]                                     │  │
│  │ Source: Required signal not found                        │  │
│  │                                             [Add Value]   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Timing Group                                                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Injury Time                              [VERIFIED ✓]   │  │
│  │ Jan 15, 2024 06:00                                       │  │
│  │ Source: Extracted from EHR                               │  │
│  │ Confidence: 100%                            [Edit]       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ OR Start Time                            [VERIFIED ✓]   │  │
│  │ Jan 15, 2024 14:30                                       │  │
│  │ Source: Extracted from OR log                            │  │
│  │ Confidence: 100%                            [Edit]       │  │
│  │                                                          │  │
│  │ ⏱️ Time to OR: 8.5 hours                                │  │
│  │ ✓ Meets threshold: <18 hours                            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Save Progress]                    [Next: Followup Questions] │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Signal Cards** with color-coded badges:
  - 🟢 VERIFIED (100% confidence, extracted)
  - 🟡 AI ENRICHED (needs review)
  - 🔴 MISSING (required but not found)
- **Actions per signal**:
  - Accept: Mark AI enrichment as correct
  - Edit: Modify value
  - Flag: Mark for supervisor review
- **Grouped by signal_group** (tabs at top)
- **Auto-calculated metrics** (e.g., "Time to OR: 8.5 hours")
- **Real-time validation** (meets threshold checkmark)

---

### Screen 4: Followup Questions
**Purpose**: Collect additional context

```
┌────────────────────────────────────────────────────────────────┐
│ [Case Header]                                                  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Follow-up Questions for ORTHO_I25                             │
│                                                                 │
│  The following questions were generated based on the signals   │
│  you reviewed. Please answer all required questions.           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 1. What was the mechanism of injury? *                  │  │
│  │                                                          │  │
│  │ Triggered by: patient_age < 10                          │  │
│  │                                                          │  │
│  │ ┌────────────────────────────────────────────────────┐  │  │
│  │ │ Fall from playground equipment                     │  │  │
│  │ └────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 2. Was there vascular compromise at presentation?       │  │
│  │                                                          │  │
│  │ Triggered by: Missing neurovascular_status              │  │
│  │                                                          │  │
│  │ ( ) Yes    ( ) No    ( ) Unknown                        │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 3. Was surgery delayed due to patient factors?          │  │
│  │                                                          │  │
│  │ Triggered by: time_to_or > 8 hours                      │  │
│  │                                                          │  │
│  │ ( ) Yes → [Explain: ___________________________]        │  │
│  │ ( ) No                                                   │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [← Back to Signals]             [Next: Review & Submit →]     │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Dynamic questions** based on signal values (when_cond)
- **Show trigger reason** (transparency)
- **Multiple response types**: text, boolean, radio, date
- **Conditional followups**: "If yes, explain..."
- **Required vs optional** marked with *

---

### Screen 5: Review & Submit
**Purpose**: Final summary before completion

```
┌────────────────────────────────────────────────────────────────┐
│ [Case Header]                                                  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Review & Submit - ORTHO_I25                                   │
│                                                                 │
│  Please review all abstracted data before submitting.          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Summary                                                  │  │
│  │                                                          │  │
│  │ Metric: ORTHO_I25 - In OR <18 hrs – Supracondylar      │  │
│  │ Patient: 6yo Male                                        │  │
│  │ Encounter: ENC_12345                                     │  │
│  │ Abstracted by: Jane Doe                                  │  │
│  │ Date: Jan 20, 2024                                       │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Key Signals (12 total)                        [View All] │  │
│  │                                                          │  │
│  │ • Patient Age: 6 years ✓                                │  │
│  │ • Injury Time: Jan 15, 2024 06:00 ✓                     │  │
│  │ • OR Start Time: Jan 15, 2024 14:30 ✓                   │  │
│  │ • Time to OR: 8.5 hours ✓                               │  │
│  │ • Fracture Type: Displaced (AI, accepted)               │  │
│  │ • Neurovascular Status: Intact (manual entry)           │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Followup Responses (3 total)                  [View All] │  │
│  │                                                          │  │
│  │ • Mechanism: Fall from playground equipment             │  │
│  │ • Vascular compromise: No                               │  │
│  │ • Surgery delay: No                                      │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Quality Result                                           │  │
│  │                                                          │  │
│  │ ✅ MEETS THRESHOLD                                       │  │
│  │                                                          │  │
│  │ Patient received surgery within 18 hours of injury      │  │
│  │ (8.5 hours actual)                                       │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ⚠️ Warnings:                                                  │
│  • 1 signal was AI-enriched and accepted (Fracture Type)      │
│                                                                 │
│  [← Back to Edit]                         [Submit Abstraction] │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- **Complete summary** of all data
- **Quality result** (meets/fails threshold)
- **Warnings** about AI-enriched data
- **View All** links to expand details
- **Final confirmation** before submission

---

## Navigation Structure

```
App.tsx
├── Layout (Sidebar + Header)
│   ├── Logo
│   ├── Navigation
│   │   ├── My Cases
│   │   ├── Completed Cases
│   │   ├── Reports
│   │   └── Settings
│   └── User Menu
│
└── Routes
    ├── /cases (Case Queue - Screen 1)
    │   └── CaseQueuePage
    │
    ├── /cases/:caseId (Case Detail - redirects to signals)
    │
    ├── /cases/:caseId/signals (Signal Review - Screen 3)
    │   ├── CaseHeader component
    │   └── SignalReviewPage
    │       ├── SignalGroupTabs
    │       └── SignalCard[] (grouped)
    │
    ├── /cases/:caseId/followups (Followup Questions - Screen 4)
    │   ├── CaseHeader component
    │   └── FollowupQuestionsPage
    │       └── FollowupQuestion[]
    │
    └── /cases/:caseId/review (Review & Submit - Screen 5)
        ├── CaseHeader component
        └── ReviewSubmitPage
            ├── SummaryCard
            ├── SignalSummary
            ├── FollowupSummary
            ├── QualityResultCard
            └── SubmitButton
```

---

## Component Hierarchy

### Pages (Routes)
```typescript
client/src/pages/
├── cases/
│   ├── CaseQueuePage.tsx          // Screen 1: List of cases
│   ├── SignalReviewPage.tsx       // Screen 3: Signal abstraction
│   ├── FollowupQuestionsPage.tsx  // Screen 4: Followup questions
│   └── ReviewSubmitPage.tsx       // Screen 5: Final review
```

### Shared Components
```typescript
client/src/components/
├── case/
│   ├── CaseHeader.tsx             // Case context (shown on all screens)
│   ├── CaseCard.tsx               // Case item in queue
│   ├── MetricBadge.tsx            // Metric status badge
│   └── ProgressBar.tsx            // Completion progress
│
├── signals/
│   ├── SignalGroupTabs.tsx        // Tab navigation for groups
│   ├── SignalCard.tsx             // Individual signal display/edit
│   ├── SignalBadge.tsx            // Source/confidence badge
│   └── SignalEditor.tsx           // Edit signal value modal
│
├── followups/
│   ├── FollowupQuestion.tsx       // Single question component
│   ├── TextResponse.tsx           // Text input
│   ├── BooleanResponse.tsx        // Yes/No radio
│   └── DateResponse.tsx           // Date picker
│
└── review/
    ├── SummaryCard.tsx            // Case summary
    ├── SignalSummary.tsx          // Condensed signal list
    ├── FollowupSummary.tsx        // Condensed followup list
    └── QualityResultCard.tsx      // Pass/fail result
```

---

## Data Flow (State Management)

### React Query Keys
```typescript
// Fetch case list
['cases', { status: 'new' | 'in_progress' | 'completed' }]

// Fetch specific case
['case', caseId]

// Fetch enriched signals for case
['case', caseId, 'signals', metricId]

// Fetch followup questions
['case', caseId, 'followups', metricId]

// Fetch case summary
['case', caseId, 'summary']
```

### Mutations
```typescript
// Update signal value
updateSignalValue(caseId, metricId, signalCode, newValue)

// Accept AI enrichment
acceptSignal(caseId, metricId, signalCode)

// Flag signal for review
flagSignal(caseId, metricId, signalCode, reason)

// Save followup response
saveFollowupResponse(caseId, metricId, followupId, response)

// Submit case
submitCase(caseId)
```

---

## API Endpoints Needed

```typescript
// GET /api/cases?status=new
// Returns case queue

// GET /api/cases/:caseId
// Returns case details + assigned metrics

// GET /api/cases/:caseId/signals/:metricId
// Returns enriched signals grouped by signal_group

// PUT /api/cases/:caseId/signals/:metricId/:signalCode
// Update a signal value

// POST /api/cases/:caseId/signals/:metricId/:signalCode/accept
// Accept AI enrichment

// POST /api/cases/:caseId/signals/:metricId/:signalCode/flag
// Flag signal for review

// GET /api/cases/:caseId/followups/:metricId
// Returns generated followup questions

// PUT /api/cases/:caseId/followups/:metricId/:followupId
// Save followup response

// GET /api/cases/:caseId/summary
// Returns complete case summary

// POST /api/cases/:caseId/submit
// Submit completed case
```

---

## Design System

### Colors
```typescript
// Status colors
NEW: blue-500
IN_PROGRESS: yellow-500
COMPLETED: green-500

// Signal source colors
VERIFIED: green-100 (border: green-500)
AI_ENRICHED: yellow-100 (border: yellow-500)
MISSING: red-100 (border: red-500)

// Confidence colors
HIGH (>90%): green
MEDIUM (70-90%): yellow
LOW (<70%): red
```

### Typography
```typescript
Case Title: text-2xl font-semibold
Section Title: text-xl font-medium
Signal Name: text-sm font-medium
Signal Value: text-base
Helper Text: text-xs text-muted-foreground
```

---

## Mobile Considerations

All screens should be **responsive**:
- Desktop: Full layout with tabs
- Tablet: Stacked layout
- Mobile: Single column, expandable sections

Signal cards on mobile:
```
┌──────────────────────────┐
│ Patient Age       [✓]    │
│ 6 years                  │
│ Confidence: 100%         │
│ [Expand for details ▼]   │
└──────────────────────────┘
```

---

## Implementation Priority

### Phase 1: Core Abstraction Flow
1. CaseQueuePage (list of cases)
2. CaseHeader component
3. SignalReviewPage (main abstraction UI)
4. SignalCard component
5. Basic save/submit

### Phase 2: Followups
1. FollowupQuestionsPage
2. Question components (text, boolean, date)
3. Conditional question logic

### Phase 3: Review & Quality
1. ReviewSubmitPage
2. Quality result calculation
3. Submission confirmation

### Phase 4: Polish
1. Mobile responsive
2. Loading states
3. Error handling
4. Accessibility (keyboard nav, ARIA labels)

---

## Summary

The new UI is **case-centric**, not metric-centric:
- ✅ Abstractor works on **cases** (patients)
- ✅ System auto-classifies **metrics**
- ✅ Abstractor reviews **enriched signals**
- ✅ Abstractor answers **followup questions**
- ✅ System calculates **quality results**

This matches the actual clinical abstraction workflow!
