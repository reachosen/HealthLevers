# Clinician-Driven Design: HealthLevers Abstraction System

**Document Version:** 1.0
**Date:** 2025-11-09
**Purpose:** Define clinician-centric user experience and implementation roadmap

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [User Stories](#user-stories)
3. [Clinician Workflow Design](#clinician-workflow-design)
4. [UI/UX Principles](#uiux-principles)
5. [Implementation Architecture](#implementation-architecture)
6. [Feature Specifications](#feature-specifications)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Success Metrics](#success-metrics)

---

## Executive Summary

The HealthLevers Abstraction System transitions from a hardcoded, developer-centric system to a **dynamic, clinician-driven platform** powered by AI-generated clinical intelligence and comprehensive Excel metadata. This design centers the clinical abstractor's workflow, cognitive load, and decision-making process.

### The Correct Model: AI-Powered Clinical Reasoning

**Critical 20% = AI-Generated Clinical Summary**
- NOT: Top 20% of predefined signals
- YES: Intelligently extracted narrative from 500+ line JSON payloads
- Presents what matters for the specific metric in readable, clinical language

**Dynamic Reasoning Questions**
- NOT: Static data collection forms
- YES: AI-generated contextual questions that help clinicians:
  - **Rule In**: Does this case qualify for the metric?
  - **Rule Out**: Should this case be excluded?
  - **Clinical Insight**: What's the clinical context and justification?

**Evidence-Based Decision Support**
- Every summary point cited with JSON path
- Every question backed by evidence found in payload
- Clinician makes final judgment with AI guidance

### Core Design Principles

1. **Clinician Agency**: Abstractors drive the workflow, not the system
2. **AI-Assisted Reasoning**: AI extracts and presents, clinician decides
3. **Progressive Disclosure**: Information revealed as needed, reducing cognitive load
4. **Evidence-Based**: All summaries and questions cite sources from payload
5. **Metadata-Driven**: Fully dynamic configuration from Excel source
6. **Contextual Guidance**: AI assistance integrated into workflow, not bolted on
7. **Specialty-Aware**: Adapts to orthopedics, cardiology, behavioral health, etc.

### Key Outcomes

- **Reduce abstraction time** from 15 minutes to 8 minutes per case
- **Increase accuracy** from 85% to 95%+ through structured validation
- **Enable scalability** to 100+ quality metrics without code changes
- **Improve abstractor satisfaction** through intuitive, guided workflows

---

## AI-Powered Clinical Reasoning Architecture

### The Three-Layer Model

```
┌──────────────────────────────────────────────────────────────────┐
│ Layer 1: AI-Generated Clinical Summary (Critical 20%)           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Narrative extraction from 500+ line JSON payload                │
│ Sections: Patient • Presentation • Assessment • Timeline        │
│ All points cited with JSON paths for verification               │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Layer 2: Dynamic Reasoning Questions                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ✅ Rule In: Does case qualify? (inclusion criteria)             │
│ ❌ Rule Out: Should case be excluded? (exclusion criteria)      │
│ 💡 Clinical Insight: What context matters? (justification)      │
│                                                                  │
│ Each question includes:                                          │
│ • Rationale (why asking)                                         │
│ • Evidence (what found in payload)                               │
│ • Suggested answer (AI interpretation)                           │
│ • Citations (JSON paths)                                         │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Layer 3: Grouped Signals (From Excel Metadata)                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Expandable groups: Demographics • Clinical • Timing • Operative │
│ For detailed field-level review when needed                     │
└──────────────────────────────────────────────────────────────────┘
```

### Example: ORTHO_I25 (Supracondylar Fracture <18 hrs)

#### Input: 500+ Line JSON
```json
{
  "patient": { "age": 6, "weight": 20.5, "gender": "M" },
  "chief_complaint": "Left arm pain after fall from playground...",
  "ed_notes": "6yo male fell from monkey bars at approx 0600. Parent reports...",
  "radiology": {
    "xray_findings": "Displaced supracondylar fracture, Gartland type III...",
    "ordered_at": "2024-01-15T07:15:00Z"
  },
  "nursing_notes": {
    "intake": "Last oral intake 0530 breakfast (cereal, milk)...",
    "npo_ordered": "2024-01-15T08:00:00Z"
  },
  "or_log": {
    "surgery_start": "2024-01-15T14:30:00Z",
    "procedure": "ORIF left supracondylar fracture",
    "delay_reason": "NPO protocol + OR availability"
  }
  // ... 400+ more lines
}
```

#### Output: AI-Generated Clinical Summary

```markdown
📊 CLINICAL SUMMARY

🧒 PATIENT
• Age: 6 years old
• Weight: 20.5 kg
• Gender: Male

📋 PRESENTATION
• Mechanism: Fall from monkey bars (playground)
• Chief complaint: Left arm pain, unable to move
• Time of injury: Jan 15, 2024 06:00
• ED arrival: Jan 15, 2024 07:00 (1 hour post-injury)

🦴 INJURY ASSESSMENT
• Diagnosis: Displaced supracondylar fracture
• Classification: Gartland Type III
• Location: Left distal humerus
• Neurovascular status: INTACT (radial pulse 2+, sensation intact)
• Skin integrity: Closed injury
• Compartment syndrome: No signs

⏱️ CRITICAL TIMELINE
• 06:00 - Injury occurred
• 07:00 - ED arrival
• 07:15 - X-ray completed
• 08:00 - NPO ordered (last PO intake 05:30)
• 14:30 - Surgery start
• **TIME TO OR: 8.5 hours**

🚩 KEY CLINICAL CONSIDERATIONS
• NPO Delay: Patient ate breakfast at 05:30
  Protocol required 6-hour wait → 11:30 earliest
• Additional delay: 3 hours (11:30 → 14:30)
  Reason: OR availability
• **Quality metric: 8.5h < 18h threshold ✓**

Citations:
- patient: encounter.patient.*
- presentation: encounter.chief_complaint, encounter.ed_notes
- timeline: encounter.*.timestamp fields
- NPO: encounter.nursing_notes.intake
```

#### Output: Dynamic Reasoning Questions

**✅ RULE IN (Inclusion Criteria)**

**Q1: Is this a true supracondylar fracture requiring urgent surgical intervention?**

💡 **Why asking:** Case classification depends on fracture type and surgical urgency

🔍 **Evidence found:**
- Radiology: "Gartland Type III displaced" [encounter.radiology.xray_findings]
- Ortho note: "Requires urgent ORIF within 24 hours" [encounter.ortho_consult.assessment]

**Your assessment:**
- ⚪ Yes, clearly requires urgent surgery
- ⚪ No, could have been managed conservatively
- ⚪ Unclear, need more information

**Suggested answer:** Yes (confidence: 95%)

---

**❌ RULE OUT (Exclusion Criteria)**

**Q2: Was this patient transferred from an outside facility after initial treatment?**

💡 **Why asking:** Transfers are excluded (time clock starts at original facility)

🔍 **Evidence found:**
- ED note: "Brought by parents from home" [encounter.ed_notes.arrival]
- Transfer documentation: None found [encounter.transfer_docs]

**Your assessment:**
- ⚪ No transfer - direct from scene
- ⚪ Yes, transferred from outside facility
- ⚪ Unclear from documentation

**Suggested answer:** No transfer (confidence: 98%)

---

**💡 CLINICAL INSIGHT (Contextual Understanding)**

**Q3: What was the clinical justification for the 8.5-hour delay to surgery?**

💡 **Why asking:** Understanding delay context helps determine if this represents a quality gap

🔍 **Evidence found:**
- NPO delay: 6 hours (protocol-driven) [encounter.nursing_notes.intake]
- OR availability: 3 hours (staffing) [encounter.or_log.delay_reason]
- Clinical deterioration: None documented [encounter.progress_notes.*]

**Your interpretation:**
```
6hr delay was unavoidable due to NPO protocol.
3hr additional delay for OR availability is within acceptable range.
No evidence of adverse outcome from delay.
```

---

### Workflow: 5-7 Minutes (vs 30+ Minutes Manual)

1. **Clinician opens case** (10 seconds)
   - Sees AI summary: "6yo SCH, 8.5hr to OR, NPO delay"
   - Immediate clinical understanding

2. **Reviews Rule In questions** (60 seconds)
   - Q1: "Yes, true SCH requiring surgery" ✓ (sees radiology evidence)
   - Confidence: High

3. **Reviews Rule Out questions** (30 seconds)
   - Q2: "No transfer" ✓ (sees ED note)
   - Confidence: High

4. **Reviews Clinical Insight** (90 seconds)
   - Q3: Delay justified by NPO protocol + OR scheduling ✓
   - Agrees with AI interpretation

5. **Asks LLM for clarification** (60 seconds, if needed)
   - "Were there complications?" → LLM: "No complications documented"

6. **Makes final decision** (60 seconds)
   - Include - Meets Standard (8.5h < 18h) ✓
   - Adds brief note
   - Submits

**Total: 5-7 minutes of high-quality review**
**Quality: High (AI finds evidence, clinician validates)**

---

## User Stories

### Epic 1: Case Selection & Context

#### Story 1.1: Select My Specialty
**As a** medical abstractor
**I want to** select my clinical specialty when I start a session
**So that** I only see relevant quality metrics and workflows

**Acceptance Criteria:**
- Specialty selector appears in the navigation header
- Specialties are dynamically loaded from metadata (Orthopedics, Cardiology, Behavioral Health, etc.)
- Selection persists across page navigation
- Visual indication of currently selected specialty
- Specialty-specific color theming applied

**Implementation Notes:**
- Load specialties from `metrics` sheet, column: `specialty`
- Store selection in React Context + localStorage
- Apply specialty-specific CSS variables for theming

---

#### Story 1.2: View Available Quality Metrics
**As a** clinician abstractor
**I want to** see all quality metrics for my specialty organized by domain
**So that** I can quickly find the metric I need to review

**Acceptance Criteria:**
- Metrics grouped by domain (Timeliness, Safety, Outcomes, etc.)
- Each metric shows: name, code (e.g., I25), threshold, active status
- Inactive metrics visually distinguished (grayed out)
- Searchable/filterable by metric name or code
- Priority metrics highlighted

**Implementation Notes:**
- Source: `metrics` sheet
- Group by `domain` column
- Display `metric_name`, `question_code`, `threshold_hours`, `active`
- Sort by `priority` column

---

#### Story 1.3: Load Patient Case Data
**As a** clinician abstractor
**I want to** load patient data from JSON, API, or demo cases
**So that** I can begin reviewing the case against quality metrics

**Acceptance Criteria:**
- Support three input methods:
  1. Paste JSON directly (textarea)
  2. Upload JSON file (file picker)
  3. Select from demo cases (dropdown)
- Validate JSON structure before loading
- Show patient identifier (MRN, encounter ID) after loading
- Display data source indicator (Demo, Manual, API)
- Clear error messages for invalid data

**Implementation Notes:**
- Use Zod schema validation for patient data
- Store in React state + localStorage for persistence
- Show loading indicator for API fetches
- Provenance tracking: record data source, timestamp, user

---

### Epic 2: Signal Assessment

#### Story 2.1: See Core Signals Automatically
**As a** clinician abstractor
**I want to** see core signals evaluated automatically when I load a case
**So that** I can quickly identify pass/fail status

**Acceptance Criteria:**
- Core signals appear in primary visibility tier
- Signal chips color-coded:
  - Green (pass): Meets threshold
  - Red (fail): Does not meet threshold
  - Yellow (caution): Borderline or needs review
  - Gray (inactive): Not applicable
- Signal label clearly shows what was checked
- Evidence excerpt shown below each signal
- Signals grouped by category (Core, Delay Drivers, Documentation, etc.)

**Implementation Notes:**
- Load signals from `signals` sheet filtered by `group_id = 'core'`
- Evaluate `trigger_expr` using expression engine
- Map `severity` to color: info→green, warn→yellow, error→red
- Fetch evidence from `signal.cites[]` paths in patient data

---

#### Story 2.2: Expand Signal Groups On-Demand
**As a** clinician abstractor
**I want to** expand/collapse signal groups
**So that** I can focus on relevant signals without clutter

**Acceptance Criteria:**
- Signal groups collapsible with expand/collapse icon
- Core group expanded by default
- Other groups (Delay Drivers, Documentation, Ruleouts, Overrides) collapsed by default
- Group headers show signal count and overall status
- Keyboard accessible (Enter/Space to toggle)
- Animation for smooth expand/collapse

**Implementation Notes:**
- Use Radix UI Collapsible component
- Default open state based on `display_order` (1-2 open, 3+ closed)
- Store user preferences in localStorage

---

#### Story 2.3: View Signal Evidence
**As a** clinician abstractor
**I want to** click a signal chip to see detailed evidence
**So that** I can verify the signal's assessment

**Acceptance Criteria:**
- Click signal chip opens Evidence Drawer (side panel)
- Drawer shows:
  - Signal name and status
  - Evidence excerpt with highlighted relevant data
  - Data source (EHR table, field name)
  - Timestamp and author (if available)
  - Full context toggle ("Show all case context")
- Drawer remains open while reviewing multiple signals
- Close button and ESC key dismiss drawer

**Implementation Notes:**
- Evidence scoped to `signal.cites[]` paths
- Use `provenance_rules` sheet to show source_table, key_field
- Highlight evidence text that triggered the signal
- Full context shows entire patient JSON (prettified)

---

#### Story 2.4: Answer Conditional Followup Questions
**As a** clinician abstractor
**I want to** see followup questions only when relevant to the current case
**So that** I don't waste time on irrelevant questions

**Acceptance Criteria:**
- Followup questions appear conditionally based on signal state
- Question appears inline below signal chip when triggered
- Response types supported:
  - Single-select (radio buttons)
  - Text (textarea)
  - Timestamp + text (datetime picker + notes)
- Responses saved to case record
- Visual indicator shows unanswered questions (orange dot)

**Implementation Notes:**
- Load followups from `followups` sheet
- Evaluate `when_cond` expression (e.g., "imaging_delay OR extra_imaging")
- Render input based on `response_type` column
- Store responses in case data under `followup_responses` key

---

### Epic 3: AI Assistance

#### Story 3.1: Get AI Suggestions for Ambiguous Signals
**As a** clinician abstractor
**I want to** request AI analysis for signals I'm uncertain about
**So that** I can make informed decisions

**Acceptance Criteria:**
- "Ask AI" button appears on each signal chip
- Opens AI chat panel with context pre-loaded
- AI receives:
  - Patient data (scoped to signal's evidence)
  - Signal definition and validation rule
  - Prompt template from metadata
- AI response shows reasoning and recommendation
- Abstractor can accept, reject, or modify AI suggestion
- All AI interactions logged for audit

**Implementation Notes:**
- Load prompt from `prompts` sheet filtered by `metric_id` and `prompt_type = 'abstractor'`
- Use OpenAI GPT-4o with streaming
- Include `trigger_expr` and signal definition in context
- Track AI usage: metric_id, prompt_version, timestamp

---

#### Story 3.2: Use AI for Initial Case Triage
**As a** clinician abstractor
**I want to** run AI-powered intake processing on raw case data
**So that** I get a head start on signal assessment

**Acceptance Criteria:**
- "Process with AI" button available on intake page
- AI processes case and suggests signal values
- Results appear as draft signals (visually distinct from manual)
- Abstractor reviews and confirms/overrides each signal
- AI confidence score shown per signal
- Processing status indicator (loading, complete, error)

**Implementation Notes:**
- Load prompt from `prompts` sheet filtered by `prompt_type = 'intake'`
- Use structured output mode to get signal results
- Store AI suggestions separately from confirmed signals
- Track processing time, model version, prompt version

---

### Epic 4: Configuration & Planning

#### Story 4.1: Customize Field Display Order
**As a** clinician abstractor
**I want to** reorder which fields appear first in the case view
**So that** I can optimize my review workflow

**Acceptance Criteria:**
- Planning configuration page accessible from navbar
- Drag-and-drop interface for field ordering
- Fields organized by tier (Primary, Secondary)
- "Reset to default" button restores metadata defaults
- Configuration saves per specialty per user
- Preview pane shows how layout will appear

**Implementation Notes:**
- Load default order from `display_plan` sheet (`order_in_tier`, `display_tier`)
- Store user overrides in localStorage with key: `planning.${specialty}.${metricId}`
- Merge default + user config at render time

---

#### Story 4.2: Toggle Signal Group Visibility
**As a** clinician abstractor
**I want to** hide signal groups I don't typically use
**So that** I reduce visual clutter

**Acceptance Criteria:**
- Planning page shows list of signal groups with visibility toggles
- Hidden groups don't appear in intake/review pages
- "Show All" button temporarily reveals hidden groups
- Configuration saves per specialty
- Visual indicator on navbar if custom config active

**Implementation Notes:**
- Store visibility config in localStorage: `planning.${specialty}.visibleGroups[]`
- Filter signals at render time based on config
- Show badge on planning icon if custom config active

---

### Epic 5: Data Management

#### Story 5.1: Save Case with Review Status
**As a** clinician abstractor
**I want to** mark a case as "Ready for Review" when I'm done
**So that** I can track my progress and return later

**Acceptance Criteria:**
- "Mark Ready for Review" button appears when all required signals assessed
- Case saved with status: draft, ready, submitted, flagged
- Timestamp and abstractor username recorded
- Case appears in "My Cases" list with status indicator
- Can reopen case to make changes (status reverts to draft)

**Implementation Notes:**
- Store in localStorage: `abstraction.cases[]`
- Case schema includes: status, reviewed_by, reviewed_at, signals[], followup_responses[]
- Color-code status: draft (gray), ready (blue), submitted (green), flagged (orange)

---

#### Story 5.2: Export Case Data for Reporting
**As a** clinician abstractor
**I want to** export completed cases to CSV/JSON
**So that** I can submit to USNWR or analyze in Excel

**Acceptance Criteria:**
- Export button on case list page
- Export formats: CSV, JSON, Excel
- CSV includes: patient_id, metric_id, signal results, followup responses, timestamps
- JSON includes full case structure with provenance data
- Batch export: select multiple cases or export all
- File downloaded with timestamp in filename

**Implementation Notes:**
- Use papaparse library for CSV generation
- Include version info: content_version, prompts_version from `versions` sheet
- CSV columns match USNWR submission requirements

---

### Epic 6: Metadata Management (Admin)

#### Story 6.1: View Current Metadata Version
**As a** system administrator
**I want to** see which metadata version is currently active
**So that** I can track configuration changes

**Acceptance Criteria:**
- Admin page shows current versions:
  - Bundle version
  - Schema version
  - Prompts version
  - Content version
- Last updated timestamp shown
- Change notes displayed
- Version history viewable (last 10 versions)

**Implementation Notes:**
- Source: `versions` sheet
- Display `bundle_version`, `schema_version`, `prompts_version`, `content_version`
- Track upload history in database or filesystem

---

#### Story 6.2: Upload New Metadata Excel File
**As a** system administrator
**I want to** upload a new Excel metadata file
**So that** I can update metrics without code deployment

**Acceptance Criteria:**
- Admin page has "Upload New Metadata" button
- File upload with validation:
  - Must be .xlsx format
  - Must contain all 8 required sheets
  - Sheet structure validated before activation
- Preview changes before activation (diff view)
- "Activate" button replaces current metadata
- "Rollback" button reverts to previous version
- All users notified of metadata update

**Implementation Notes:**
- Parse Excel server-side with `xlsx` library
- Validate sheet structure: column names, data types, foreign keys
- Store uploaded file in `/data/metadata/` directory
- Clear metadata cache on activation
- Broadcast update via WebSocket or refresh prompt

---

## Clinician Workflow Design

### Primary Workflow: Case Abstraction

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SELECT SPECIALTY                                              │
│    └─ Orthopedics, Cardiology, Behavioral Health                │
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. SELECT QUALITY METRIC                                         │
│    └─ Browse by domain or search by code (e.g., "I25")          │
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. LOAD PATIENT CASE                                             │
│    ├─ Paste JSON                                                 │
│    ├─ Upload file                                                │
│    └─ Select demo case                                           │
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. REVIEW CORE SIGNALS (Auto-evaluated)                          │
│    ├─ Green chips: Pass                                          │
│    ├─ Red chips: Fail                                            │
│    ├─ Yellow chips: Needs review                                 │
│    └─ Click chip → View evidence                                 │
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. ANSWER CONDITIONAL FOLLOWUP QUESTIONS                         │
│    └─ Questions appear only when triggered by signal state       │
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. REQUEST AI ASSISTANCE (Optional)                              │
│    └─ "Ask AI" on ambiguous signals                              │
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. MARK READY FOR REVIEW                                         │
│    └─ Save case with status, timestamp, abstractor ID            │
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. EXPORT FOR SUBMISSION                                         │
│    └─ CSV/JSON export for USNWR reporting                        │
└─────────────────────────────────────────────────────────────────┘
```

### Decision Points

#### When to Use AI Assistance

- **Use AI for**: Ambiguous timestamps, conflicting data, complex clinical scenarios
- **Don't use AI for**: Clear pass/fail signals, data entry, simple validation

#### Progressive Disclosure Strategy

| Stage | What's Visible | What's Hidden |
|-------|----------------|---------------|
| **Initial Load** | Specialty selector, metric list | Patient data, signals |
| **Metric Selected** | Metric details, patient data input | Signal results |
| **Data Loaded** | Core signals, primary fields | Secondary fields, followups |
| **Signal Clicked** | Evidence drawer, signal details | Other signals (dimmed) |
| **All Reviewed** | Export button, summary stats | Individual signals (collapsible) |

---

## UI/UX Principles

### 1. Cognitive Load Reduction

**Problem:** Abstractors face information overload with 50+ signals per case.

**Solution:**
- Show only Core signals by default (4-6 signals)
- Group secondary signals under collapsible headers
- Use visual hierarchy: color, size, position
- Progressive disclosure: reveal complexity only when needed

### 2. Evidence-Based Confidence

**Problem:** Abstractors question AI suggestions without seeing underlying data.

**Solution:**
- Every signal links to evidence excerpt
- Source table and field name displayed
- Highlight specific data that triggered signal
- "Show full context" option for complete picture

### 3. Contextual Guidance

**Problem:** Abstractors need help but don't want AI overreach.

**Solution:**
- AI opt-in, not automatic
- "Ask AI" button on each signal (user chooses when)
- AI responses show reasoning, not just answers
- Abstractor always has final say (accept/reject/modify)

### 4. Specialty-Aware Design

**Problem:** Different specialties have different workflows and priorities.

**Solution:**
- Specialty-specific color theming
- Configurable field order per specialty
- Domain grouping (Timeliness for Ortho, Outcomes for Cardiology)
- Specialty-specific demo cases and templates

### 5. Efficient Data Entry

**Problem:** Manual data entry is error-prone and slow.

**Solution:**
- Smart defaults (autofill from previous cases)
- Keyboard shortcuts (Tab through fields, Enter to submit)
- Validation in real-time (red border on invalid fields)
- Autocomplete for common values

### 6. Transparent Provenance

**Problem:** Abstractors need to trust the system and audit decisions.

**Solution:**
- Every data point shows source (EHR table, timestamp, author)
- AI interactions logged with prompt version, model, timestamp
- User actions tracked (signal overrides, followup responses)
- Export includes full provenance trail

---

## Implementation Architecture

### Metadata Backend Service

```typescript
// server/metadata.ts
import xlsx from 'xlsx';
import NodeCache from 'node-cache';

const metadataCache = new NodeCache({ stdTTL: 86400 }); // 24h cache

export class MetadataService {
  private excelPath = './USNWR_Master_AllMetrics_v4.xlsx';

  async getMetrics(): Promise<Metric[]> {
    const cached = metadataCache.get('metrics');
    if (cached) return cached as Metric[];

    const workbook = xlsx.readFile(this.excelPath);
    const metricsSheet = workbook.Sheets['metrics'];
    const data = xlsx.utils.sheet_to_json(metricsSheet);

    const metrics = data.map(row => ({
      metric_id: row.metric_id,
      specialty: row.specialty,
      question_code: row.question_code,
      metric_name: row.metric_name,
      priority: row.priority,
      threshold_hours: row.threshold_hours,
      active: row.active,
      domain: row.domain
    }));

    metadataCache.set('metrics', metrics);
    return metrics;
  }

  async getSignalsForMetric(metricId: string): Promise<Signal[]> {
    const cacheKey = `signals:${metricId}`;
    const cached = metadataCache.get(cacheKey);
    if (cached) return cached as Signal[];

    const workbook = xlsx.readFile(this.excelPath);
    const signalsSheet = workbook.Sheets['signals'];
    const groupsSheet = workbook.Sheets['groups'];

    const signals = xlsx.utils.sheet_to_json(signalsSheet)
      .filter(row => row.metric_id === metricId)
      .map(row => ({
        signal_code: row.signal_code,
        group_id: row.group_id,
        trigger_expr: row.trigger_expr,
        severity: row.severity
      }));

    const groups = xlsx.utils.sheet_to_json(groupsSheet)
      .filter(row => row.metric_id === metricId);

    const result = signals.map(signal => ({
      ...signal,
      group_name: groups.find(g => g.group_id === signal.group_id)?.group_name,
      display_order: groups.find(g => g.group_id === signal.group_id)?.display_order
    }));

    metadataCache.set(cacheKey, result);
    return result;
  }

  async getFollowupsForMetric(metricId: string): Promise<Followup[]> {
    const cacheKey = `followups:${metricId}`;
    const cached = metadataCache.get(cacheKey);
    if (cached) return cached as Followup[];

    const workbook = xlsx.readFile(this.excelPath);
    const followupsSheet = workbook.Sheets['followups'];

    const followups = xlsx.utils.sheet_to_json(followupsSheet)
      .filter(row => row.metric_id === metricId)
      .map(row => ({
        followup_id: row.followup_id,
        when_cond: row.when_cond,
        question_text: row.question_text,
        response_type: row.response_type
      }));

    metadataCache.set(cacheKey, followups);
    return followups;
  }

  async getPromptsForMetric(metricId: string, promptType: string): Promise<Prompt[]> {
    const workbook = xlsx.readFile(this.excelPath);
    const promptsSheet = workbook.Sheets['prompts'];

    return xlsx.utils.sheet_to_json(promptsSheet)
      .filter(row => row.metric_id === metricId && row.prompt_type === promptType)
      .map(row => ({
        prompt_text: row.prompt_text,
        prompt_version: row.prompt_version,
        prompt_role: row.prompt_role
      }));
  }

  clearCache() {
    metadataCache.flushAll();
  }
}
```

### Expression Evaluation Engine

```typescript
// client/src/lib/expressionEvaluator.ts
import { parse } from 'expr-eval';

export class ExpressionEvaluator {
  /**
   * Evaluate a trigger expression like "end_time - start_time < threshold"
   */
  evaluateTrigger(expr: string, context: Record<string, any>): boolean {
    try {
      // Preprocess expression to handle "is null" syntax
      const normalized = expr
        .replace(/(\w+)\s+is\s+null/gi, '($1 === null)')
        .replace(/(\w+)\s+is\s+not\s+null/gi, '($1 !== null)');

      const parser = parse(normalized);
      const result = parser.evaluate(context);
      return Boolean(result);
    } catch (error) {
      console.error('Expression evaluation failed:', expr, error);
      return false;
    }
  }

  /**
   * Evaluate a conditional expression like "imaging_delay OR extra_imaging"
   */
  evaluateCondition(expr: string, signalState: Record<string, boolean>): boolean {
    try {
      const normalized = expr
        .replace(/\bAND\b/gi, '&&')
        .replace(/\bOR\b/gi, '||')
        .replace(/\bNOT\b/gi, '!');

      const parser = parse(normalized);
      return Boolean(parser.evaluate(signalState));
    } catch (error) {
      console.error('Condition evaluation failed:', expr, error);
      return false;
    }
  }
}
```

### React Hooks for Metadata

```typescript
// client/src/hooks/useMetadata.ts
import { useQuery } from '@tanstack/react-query';

export function useMetrics() {
  return useQuery({
    queryKey: ['metadata', 'metrics'],
    queryFn: async () => {
      const res = await fetch('/api/metadata/metrics');
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useSignalsForMetric(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'signals', metricId],
    queryFn: async () => {
      if (!metricId) return null;
      const res = await fetch(`/api/metadata/signals/${metricId}`);
      if (!res.ok) throw new Error('Failed to fetch signals');
      return res.json();
    },
    enabled: !!metricId,
    staleTime: 1000 * 60 * 60,
  });
}

export function useFollowupsForMetric(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'followups', metricId],
    queryFn: async () => {
      if (!metricId) return null;
      const res = await fetch(`/api/metadata/followups/${metricId}`);
      if (!res.ok) throw new Error('Failed to fetch followups');
      return res.json();
    },
    enabled: !!metricId,
    staleTime: 1000 * 60 * 60,
  });
}
```

### Dynamic Intake Page

```typescript
// client/src/pages/DynamicIntake.tsx
import { useState, useMemo } from 'react';
import { useMetrics, useSignalsForMetric, useFollowupsForMetric } from '@/hooks/useMetadata';
import { ExpressionEvaluator } from '@/lib/expressionEvaluator';

export function DynamicIntakePage() {
  const { data: metrics, isLoading } = useMetrics();
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [patientData, setPatientData] = useState<any>(null);

  const { data: signals } = useSignalsForMetric(selectedMetric);
  const { data: followups } = useFollowupsForMetric(selectedMetric);

  const specialties = useMemo(() => {
    if (!metrics) return [];
    return [...new Set(metrics.map((m: any) => m.specialty))];
  }, [metrics]);

  const metricsForSpecialty = useMemo(() => {
    if (!metrics || !selectedSpecialty) return [];
    return metrics.filter((m: any) => m.specialty === selectedSpecialty);
  }, [metrics, selectedSpecialty]);

  const evaluateSignals = () => {
    if (!signals || !patientData) return [];

    const evaluator = new ExpressionEvaluator();
    return signals.map((signal: any) => {
      const isTriggered = evaluator.evaluateTrigger(signal.trigger_expr, patientData);
      return {
        ...signal,
        status: isTriggered ? 'pass' : 'fail',
        evaluated: true
      };
    });
  };

  const evaluatedSignals = useMemo(evaluateSignals, [signals, patientData]);

  const relevantFollowups = useMemo(() => {
    if (!followups || !evaluatedSignals.length) return [];

    const evaluator = new ExpressionEvaluator();
    const signalState = evaluatedSignals.reduce((acc, sig) => {
      acc[sig.signal_code] = sig.status === 'pass';
      return acc;
    }, {} as Record<string, boolean>);

    return followups.filter((f: any) =>
      evaluator.evaluateCondition(f.when_cond, signalState)
    );
  }, [followups, evaluatedSignals]);

  return (
    <div className="space-y-6">
      {/* Specialty Selector */}
      <div>
        <label>Select Specialty</label>
        <select onChange={(e) => setSelectedSpecialty(e.target.value)}>
          <option value="">Choose...</option>
          {specialties.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Metrics Grid */}
      {selectedSpecialty && (
        <div className="grid grid-cols-2 gap-4">
          {metricsForSpecialty.map((metric: any) => (
            <MetricCard
              key={metric.metric_id}
              metric={metric}
              selected={selectedMetric === metric.metric_id}
              onClick={() => setSelectedMetric(metric.metric_id)}
            />
          ))}
        </div>
      )}

      {/* Patient Data Input */}
      {selectedMetric && (
        <PatientDataInput onLoad={setPatientData} />
      )}

      {/* Signal Results */}
      {patientData && (
        <SignalResultsPanel signals={evaluatedSignals} />
      )}

      {/* Conditional Followups */}
      {relevantFollowups.length > 0 && (
        <FollowupQuestionsPanel followups={relevantFollowups} />
      )}
    </div>
  );
}
```

---

## Feature Specifications

### 1. Specialty-Aware Theming

**Requirement:** Each specialty has a distinct color palette for visual differentiation.

**Implementation:**
```css
/* Orthopedics */
.specialty-orthopedics {
  --primary: #1e40af; /* blue-800 */
  --secondary: #3b82f6; /* blue-500 */
}

/* Cardiology */
.specialty-cardiology {
  --primary: #dc2626; /* red-600 */
  --secondary: #ef4444; /* red-500 */
}

/* Behavioral Health */
.specialty-behavioral-health {
  --primary: #7c3aed; /* violet-600 */
  --secondary: #8b5cf6; /* violet-500 */
}
```

### 2. Signal Chip States

| State | Color | Border | Icon | Use Case |
|-------|-------|--------|------|----------|
| **pass** | Green bg | Green border | ✓ | Signal condition met |
| **fail** | Red bg | Red border | ✗ | Signal condition not met |
| **caution** | Yellow bg | Yellow border | ⚠ | Borderline or needs review |
| **inactive** | Gray bg | Gray border | - | Signal not applicable |
| **pending** | Blue bg | Blue border | ⏳ | AI processing |

### 3. Evidence Drawer Layout

```
┌─────────────────────────────────────┐
│ Evidence Drawer                  [×]│
├─────────────────────────────────────┤
│ Signal: Within Threshold            │
│ Status: ✓ Pass                      │
├─────────────────────────────────────┤
│ Evidence                            │
│ ┌─────────────────────────────────┐ │
│ │ ED Arrival: 2024-01-15 08:30    │ │
│ │ OR Start:   2024-01-15 14:15    │ │
│ │ Delta:      5.75 hours          │ │
│ │                                 │ │
│ │ Threshold: < 18 hours ✓         │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Data Source                         │
│ Table: ehr_encounters               │
│ Fields: ed_arrival_time, or_start  │
│ Author: Dr. Smith                   │
│ Recorded: 2024-01-15 14:16          │
├─────────────────────────────────────┤
│ [Show all case context]             │
└─────────────────────────────────────┘
```

### 4. Conditional Followup Rendering

**Example:** Show CT imaging question only if imaging delay detected.

**Metadata:**
```
metric_id: ORTHO_I25
followup_id: FU_CT
when_cond: imaging_delay OR extra_imaging
question_text: Was CT clinically required beyond X-ray?
response_type: single-select
```

**Rendered UI:**
```jsx
{followups
  .filter(f => evaluator.evaluateCondition(f.when_cond, signalState))
  .map(f => (
    <div key={f.followup_id} className="followup-question">
      <label>{f.question_text}</label>
      {f.response_type === 'single-select' && (
        <select>
          <option>Yes</option>
          <option>No</option>
          <option>Unknown</option>
        </select>
      )}
    </div>
  ))
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal:** Set up metadata backend and API

**Tasks:**
1. Install dependencies: `xlsx`, `node-cache`, `expr-eval`
2. Create `MetadataService` class
3. Implement API endpoints:
   - `GET /api/metadata/metrics`
   - `GET /api/metadata/signals/:metricId`
   - `GET /api/metadata/followups/:metricId`
   - `GET /api/metadata/prompts/:metricId/:type`
4. Add caching layer with 24h TTL
5. Write unit tests for metadata parsing

**Deliverables:**
- Functional metadata API
- Postman collection for testing
- API documentation

---

### Phase 2: Frontend Hooks & Components (Week 3-4)

**Goal:** Create React infrastructure for dynamic metadata

**Tasks:**
1. Create hooks:
   - `useMetrics()`
   - `useSignalsForMetric(metricId)`
   - `useFollowupsForMetric(metricId)`
2. Create expression evaluator:
   - `ExpressionEvaluator.evaluateTrigger()`
   - `ExpressionEvaluator.evaluateCondition()`
3. Build reusable components:
   - `MetricCard`
   - `SignalChip`
   - `FollowupQuestion`
   - `EvidenceDrawer`
4. Write Storybook stories for components

**Deliverables:**
- Hook library for metadata
- Component library with variants
- Storybook documentation

---

### Phase 3: Dynamic Intake Page (Week 5-6)

**Goal:** Replace hardcoded intake with dynamic metadata-driven page

**Tasks:**
1. Create `DynamicIntakePage.tsx`
2. Implement specialty selector (loads from metadata)
3. Implement metric selector (grouped by domain)
4. Implement patient data input (JSON/file/demo)
5. Implement signal evaluation and rendering
6. Implement conditional followup questions
7. Add evidence drawer integration
8. Migrate localStorage data from old format

**Deliverables:**
- Fully dynamic intake page
- Deprecation notice for old intake page
- Migration guide for users

---

### Phase 4: AI Integration (Week 7-8)

**Goal:** Add AI assistance features

**Tasks:**
1. Load prompts from metadata
2. Create AI chat panel component
3. Implement "Ask AI" button on signal chips
4. Implement AI-powered intake processing
5. Add AI response acceptance/rejection UI
6. Track AI usage in provenance log
7. Add AI confidence scoring

**Deliverables:**
- AI assistance panel
- Prompt management UI
- AI usage analytics

---

### Phase 5: Planning & Configuration (Week 9-10)

**Goal:** Enable abstractor customization

**Tasks:**
1. Create planning configuration page
2. Implement drag-and-drop field ordering
3. Implement signal group visibility toggles
4. Implement "Reset to default" functionality
5. Store config in localStorage per specialty
6. Add preview pane to planning page

**Deliverables:**
- Planning configuration UI
- User preference system
- Configuration import/export

---

### Phase 6: Admin & Metadata Management (Week 11-12)

**Goal:** Enable metadata updates without code deployment

**Tasks:**
1. Create admin page
2. Implement metadata version display
3. Implement Excel file upload
4. Implement validation before activation
5. Implement diff viewer for changes
6. Implement rollback functionality
7. Add metadata update notifications

**Deliverables:**
- Admin panel
- Metadata upload workflow
- Version control system

---

### Phase 7: Testing & Launch (Week 13-14)

**Goal:** Comprehensive testing and production deployment

**Tasks:**
1. Write unit tests (>80% coverage)
2. Write integration tests for API
3. Write E2E tests for user workflows
4. Performance testing (load time, caching)
5. User acceptance testing with 3 abstractors
6. Fix bugs and polish UI
7. Create user training materials
8. Production deployment

**Deliverables:**
- Test suite with >80% coverage
- UAT report
- Training videos and guides
- Production deployment checklist

---

## Success Metrics

### User Experience

- **Task Completion Time**: Reduce from 15min to 8min per case
- **Error Rate**: Reduce from 15% to <5% (signal assessment errors)
- **User Satisfaction**: >4.5/5 rating from abstractors
- **Training Time**: New abstractors productive within 2 hours (down from 8 hours)

### System Performance

- **Page Load Time**: <2 seconds for intake page
- **API Response Time**: <200ms for metadata endpoints
- **Cache Hit Rate**: >90% for metadata requests
- **Uptime**: 99.9% for metadata service

### Adoption Metrics

- **Metadata Coverage**: 100% of new metrics use dynamic metadata
- **AI Assistance Usage**: 40% of cases use "Ask AI" feature
- **Configuration Customization**: 60% of users customize field order
- **Export Volume**: 90% of completed cases exported for submission

### Business Impact

- **Metadata Update Time**: Reduce from 2 hours (code changes) to 15 minutes (Excel upload)
- **Scalability**: Support 100+ metrics without performance degradation
- **Cost Savings**: $50K/year in developer time (no hardcoding needed)
- **Quality Scores**: Improve USNWR submission accuracy from 85% to 95%+

---

## Appendix

### A. User Personas

#### Persona 1: Sarah - Orthopedic Abstractor
- **Role**: Medical chart abstractor
- **Experience**: 5 years in orthopedics
- **Goals**: Complete 15 cases per day accurately
- **Pain Points**: Slow system, unclear AI suggestions, too many fields
- **Preferences**: Keyboard shortcuts, minimal clicks, evidence-based

#### Persona 2: Michael - Admin/Quality Manager
- **Role**: Quality improvement manager
- **Experience**: 10 years in healthcare quality
- **Goals**: Maintain up-to-date metrics, track abstractor performance
- **Pain Points**: Requires developer to update metrics, no version control
- **Preferences**: Self-service uploads, audit trails, reports

#### Persona 3: Lisa - New Abstractor
- **Role**: Recently hired medical coder
- **Experience**: 6 months in medical coding
- **Goals**: Learn system quickly, avoid mistakes
- **Pain Points**: Overwhelming UI, unclear guidance, fear of errors
- **Preferences**: Tooltips, in-app help, clear error messages

### B. Wireframes

See `designs/wireframes/` directory for:
- Specialty selector
- Metric grid layout
- Signal chip states
- Evidence drawer
- Followup questions
- Planning configuration
- Admin panel

### C. API Examples

#### Get Metrics
```http
GET /api/metadata/metrics
Response:
[
  {
    "metric_id": "ORTHO_I25",
    "specialty": "Ortho",
    "question_code": "I25",
    "metric_name": "In OR <18 hrs – Supracondylar fracture",
    "priority": 1,
    "threshold_hours": 18.0,
    "active": true,
    "domain": "timeliness"
  }
]
```

#### Get Signals for Metric
```http
GET /api/metadata/signals/ORTHO_I25
Response:
[
  {
    "signal_code": "within_threshold",
    "group_id": "core",
    "group_name": "Core",
    "trigger_expr": "end_time - start_time < threshold",
    "severity": "info",
    "display_order": 1
  }
]
```

---

**End of Document**

**Next Actions:**
1. Review with stakeholders
2. Prioritize user stories for MVP
3. Begin Phase 1 implementation
4. Schedule weekly sprint reviews
