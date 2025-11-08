# Metadata Interface Specification
## ORTHO_I25: Supracondylar Fracture Timeliness (<18h)

**Version**: 1.0
**Date**: 2025-11-08
**Example Domain**: Orthopedics
**Example Case**: SCH (Supracondylar Humerus Fracture)

---

## Table of Contents
1. [Overview](#overview)
2. [Complete Schema Reference](#complete-schema-reference)
3. [Database Tables → UI Component Mapping](#database-tables--ui-component-mapping)
4. [Data Flow](#data-flow)
5. [Grouping and Presentation Rules](#grouping-and-presentation-rules)
6. [Concrete Example](#concrete-example)

---

## Overview

This specification defines the **conceptual integrity** between database metadata tables and UI presentation components for the ORTHO_I25 metric (Supracondylar Fracture Timeliness). It demonstrates how metadata-driven design enables standardized presentation while retaining domain-specific grouping and logic.

### Key Principle
**One Source of Truth**: All UI behavior (field ordering, visibility, grouping, prompts) is defined in metadata tables, not hardcoded in components.

---

## Complete Schema Reference

### 1. METRIC Table
**Purpose**: Defines the quality metric and its threshold

```typescript
interface Metric {
  metric_id: string;        // "ORTHO_I25"
  specialty: string;        // "Ortho"
  metric_name: string;      // "In OR <18 hrs – Supracondylar fracture"
  domain: string;           // "timeliness"
  threshold_hours: number;  // 18
  status: string;           // "active"
}
```

**ORTHO_I25 Instance**:
```json
{
  "metric_id": "ORTHO_I25",
  "specialty": "Ortho",
  "metric_name": "In OR <18 hrs – Supracondylar fracture",
  "domain": "timeliness",
  "threshold_hours": 18
}
```

**UI Mapping**:
- Card header title: `{specialty} • {metric_id} — {metric_name}`
- Threshold display: `<{threshold_hours}h`
- Status badge color based on computed result vs threshold

---

### 2. SIGNAL_GROUP Table
**Purpose**: Organizes signals into collapsible groups with semantic colors

```typescript
interface SignalGroup {
  group_id: string;      // "core", "delay_drivers", etc.
  metric_id: string;     // "ORTHO_I25"
  group_code: string;    // "Core", "Delays/Drivers", etc.
  color_code?: string;   // Optional override, defaults to standard palette
  order_nbr?: number;    // Display order of groups
}
```

**ORTHO_I25 Groups** (5 groups):
1. **core** → "Core" → Blue (#007acc)
   - Purpose: Essential pass/fail signals

2. **delay_drivers** → "Delays/Drivers" → Yellow (#e0a800)
   - Purpose: Factors causing delays

3. **documentation** → "Documentation" → Gray (#6c757d)
   - Purpose: Missing or conflicting data

4. **ruleouts** → "Exclusions/Ruleouts" → Green (#28a745)
   - Purpose: Valid exclusion criteria

5. **overrides** → "Overrides/Clinician" → Cyan (#17a2b8)
   - Purpose: Clinician-approved overrides

**UI Mapping**:
- Each group becomes a collapsible chip section
- Group color applied to chip background
- Group code displayed as section label

---

### 3. SIGNAL_DEF Table
**Purpose**: Defines individual signals within groups

```typescript
interface SignalDef {
  signal_code: string;       // "within_threshold", "consult_delay", etc.
  metric_id: string;         // "ORTHO_I25"
  group_id: string;          // "core", "delay_drivers", etc.
  severity: string;          // "info", "warn", "error"
  status: string;            // "active", "deprecated"
  description?: string;      // Human-readable explanation
}
```

**ORTHO_I25 Signals** (21 total):

| Group | Signal Code | Severity | Description |
|-------|------------|----------|-------------|
| core | within_threshold | info | Case met <18h threshold |
| core | borderline_pm30 | warn | Within 30min of threshold |
| delay_drivers | consult_delay | warn | Orthopedic consult delayed |
| delay_drivers | imaging_delay | warn | Imaging completion delayed |
| delay_drivers | extra_imaging | warn | CT/MRI beyond standard X-ray |
| delay_drivers | npo_violation | warn | NPO protocol not followed |
| delay_drivers | consent_delay | warn | Consent process delayed |
| delay_drivers | transfer_delay | warn | External transfer delay |
| delay_drivers | bed_unavailable | warn | OR/bed capacity issue |
| delay_drivers | team_unavailable | warn | Team availability issue |
| delay_drivers | anticoag_reversal_delay | warn | Anticoagulation reversal delayed |
| documentation | missing_start | error | Start time not documented |
| documentation | missing_end | error | End time not documented |
| documentation | conflicting_times | error | Timeline conflicts detected |
| documentation | timezone_mismatch | warn | Timezone inconsistency |
| ruleouts | higher_priority_case | info | Higher priority case took precedence |
| ruleouts | non_operative_plan | info | Non-operative treatment chosen |
| ruleouts | medical_instability | info | Patient medically unstable |
| ruleouts | multi_procedure_session | info | Combined with other procedure |
| ruleouts | family_refusal_delay | info | Family requested delay |
| overrides | clinician_override | info | Clinician override documented |

**UI Mapping**:
- Each active signal becomes a chip within its group section
- Chip border/icon reflects severity (info=normal, warn=caution, error=alert)
- Clicking chip shows description in detail panel

---

### 4. DISPLAY_PLAN Table
**Purpose**: Controls field visibility, ordering, and tier placement

```typescript
interface DisplayPlan {
  metric_id: string;          // "ORTHO_I25"
  field_name: string;         // "index_event_instant", "consult_instant_time", etc.
  label?: string;             // Display label (defaults to field_name)
  tier: string;               // "1" (primary), "2" (secondary), "3" (tertiary)
  order_nbr?: number;         // Sort order within tier (default 9999)
  visibility_cond?: string;   // Conditional expression, null = always show
}
```

**ORTHO_I25 Display Plan** (8 fields):

| Field Name | Label | Tier | Order | Visibility |
|------------|-------|------|-------|------------|
| index_event_instant | ED Arrival | 1 | 10 | always |
| target_event_instant | OR Start | 1 | 20 | always |
| consult_instant_time | Consult Time | 1 | 30 | always |
| imaging_order | Imaging Ordered | 2 | 40 | consult_delay \|\| imaging_delay |
| imaging_complete | Imaging Done | 2 | 50 | consult_delay \|\| imaging_delay |
| bed_request_time | Bed Requested | 2 | 60 | bed_unavailable |
| bed_ready_time | Bed Ready | 2 | 70 | bed_unavailable |
| full_notes | Clinical Notes | 3 | 80 | always |

**Tier Semantics**:
- **Tier 1 (Primary)**: Always visible, core timeline points
- **Tier 2 (Secondary)**: Collapsible, shown when relevant signals active
- **Tier 3 (Tertiary)**: Advanced details, usually in expandable drawer

**UI Mapping**:
- Query display_plan WHERE metric_id = 'ORTHO_I25' ORDER BY tier ASC, order_nbr ASC
- Render fields in order within each tier section
- Evaluate visibility_cond against current active signals
- If field has no value in patient_payload, show "—" placeholder

---

### 5. FOLLOWUP Table
**Purpose**: Defines conditional questions based on active signals

```typescript
interface Followup {
  followup_id: string;      // "FU_CT", "FU_consent", etc.
  metric_id: string;        // "ORTHO_I25"
  question_text: string;    // Human-readable question
  when_cond: string;        // Signal condition expression
  response_type: string;    // "text", "single-select", "timestamp", etc.
  options?: string[];       // For select types
}
```

**ORTHO_I25 Followup Questions** (10 total):

| ID | Question | When Condition | Response Type |
|----|----------|----------------|---------------|
| FU_CT | Was CT clinically required beyond X-ray? | imaging_delay OR extra_imaging | single-select |
| FU_consent | Why was consent obtained late? | consent_delay | text |
| FU_NPO | Confirm NPO start and reason for violation. | npo_violation | timestamp+text |
| FU_transfer | Confirm external transfer logistics. | transfer_delay | single-select |
| FU_bed | Was bed/ICU capacity the cause of delay? | bed_unavailable | single-select |
| FU_anticoag | Enter reversal protocol start/complete times. | anticoag_reversal_delay | timestamps |
| FU_priority | Document the higher-priority case ID. | higher_priority_case | text |
| FU_nonop | Confirm non-operative final plan. | non_operative_plan | single-select |
| FU_instability | When was the patient stabilized? | medical_instability | timestamp |
| FU_override | Enter justification reference. | clinician_override | text |

**UI Mapping**:
- Evaluate `when_cond` against active signals
- If true, show question in followup drawer/modal
- Render appropriate input component based on `response_type`
- Store responses in `followup_response` table linked to case

---

### 6. PROMPT Table
**Purpose**: Stores AI prompts for signal detection and abstraction

```typescript
interface Prompt {
  prompt_id: string;        // Auto-generated
  metric_id: string;        // "ORTHO_I25"
  prompt_type: string;      // "intake", "abstractor", "reviewer"
  persona?: string;         // AI persona/role
  purpose?: string;         // Prompt purpose description
  prompt_text: string;      // Full prompt template
}
```

**ORTHO_I25 Prompts** (2 total):

1. **Intake Prompt** (prompt_type: "intake")
   - Purpose: GPT-4o signal detection from raw patient payload
   - Output: JSON array of active signals
   - Example excerpt:
     ```
     SYSTEM: You compute USNWR Ortho I25 (In OR <18 hrs – Supracondylar fracture)
     signal statuses. Output JSON only.

     CONTRACT:
     - Input: { specialty, mo...
     ```

2. **Abstractor Prompt** (prompt_type: "abstractor")
   - Purpose: Assist human reviewer with contextual guidance
   - Output: Conversational assistance
   - Example excerpt:
     ```
     SYSTEM: You assist a human abstractor reviewing USNWR Ortho I25
     (In OR <18 hrs – Supracondylar fracture).

     CONTEXT:
     - You receive an XML payload co...
     ```

**UI Mapping**:
- Not directly rendered in UI
- Used by backend `/api/enrichment` endpoint
- Abstractor prompt loaded when user clicks "Chat with AI" button

---

### 7. PROVENANCE_RULE Table
**Purpose**: Maps display fields to patient_payload JSON paths

```typescript
interface ProvenanceRule {
  metric_id: string;        // "ORTHO_I25"
  field_name: string;       // "start_time", "end_time", etc.
  table_name?: string;      // Default: "patient_payload"
  field_ref?: string;       // JSON path, defaults to field_name
  key_name?: string;        // Optional lookup key
  fallback_json?: object;   // Default value if missing
}
```

**ORTHO_I25 Provenance Rules** (2 defined, more implicit):

| Field Name | Table | Field Ref | Fallback |
|------------|-------|-----------|----------|
| start_time | patient_payload | start_time | null |
| end_time | patient_payload | end_time | null |

**Implicit Rules** (convention-based):
- `index_event_instant` → `patient_payload.ed_arrival_time`
- `target_event_instant` → `patient_payload.or_start_time`
- `consult_instant_time` → `patient_payload.consult_time`
- `imaging_order` → `patient_payload.imaging_order_time`
- `imaging_complete` → `patient_payload.imaging_complete_time`

**UI Mapping**:
- When rendering display_plan fields, use provenance rules to extract values
- If rule exists, use `table_name.field_ref`
- If no rule, default to `patient_payload.{field_name}`
- Show fallback value if field missing from payload
- Clicking field shows provenance source in ProvenancePanel

---

## Database Tables → UI Component Mapping

### Visual Card Structure (Based on UI Mock v4)

```
┌─────────────────────────────────────────────────────────────────┐
│ [1] CARD HEADER                                                │
│     Source: metric table                                        │
│     ┌───────────────────────────────────────────┬─────────────┐ │
│     │ Ortho • I25 — In OR <18h (Supracondylar) │ [PASS] ✓   │ │
│     └───────────────────────────────────────────┴─────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ [2] PATIENT INFO                                               │
│     Source: patient_payload (implicit fields)                  │
│     ID: TC_SCH_001 • Age: 6 F • Weight: 22.5 kg               │
├─────────────────────────────────────────────────────────────────┤
│ [3] TIMELINE BAR                                               │
│     Source: Computed from metric.threshold_hours + timestamps  │
│     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░ 87% (15.7h / 18h)    │
├─────────────────────────────────────────────────────────────────┤
│ [4] PRIMARY FIELDS (Tier 1)                                    │
│     Source: display_plan WHERE tier = '1' ORDER BY order_nbr   │
│     ED Arrival:     2024-01-15 08:23                          │
│     Consult Time:   2024-01-15 09:45                          │
│     OR Start:       2024-01-16 00:05                          │
├─────────────────────────────────────────────────────────────────┤
│ [5] SIGNAL CHIPS (Grouped)                                     │
│     Source: signal_group + signal_def (active signals only)    │
│                                                                 │
│     ┌─────────────────────────────────────────────────────┐   │
│     │ 🔵 Core                                             │   │
│     │    [within_threshold ✓]                             │   │
│     └─────────────────────────────────────────────────────┘   │
│                                                                 │
│     ┌─────────────────────────────────────────────────────┐   │
│     │ 🟡 Delays/Drivers                                   │   │
│     │    [consult_delay ⚠]  [imaging_delay ⚠]           │   │
│     └─────────────────────────────────────────────────────┘   │
│                                                                 │
│     ┌─────────────────────────────────────────────────────┐   │
│     │ ⚪ Documentation                                     │   │
│     │    [timezone_mismatch ⚠]                            │   │
│     └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ [6] SECONDARY FIELDS (Tier 2, Collapsible)      [▼ Expand]    │
│     Source: display_plan WHERE tier = '2'                      │
│     + visibility_cond evaluated                                │
│     Imaging Ordered: 2024-01-15 09:50                         │
│     Imaging Done:    2024-01-15 11:23                         │
├─────────────────────────────────────────────────────────────────┤
│ [7] ACTIONS                                                    │
│     [View Followup Questions]  [Chat with AI]  [Mark Reviewed] │
└─────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```typescript
<MetricCard metric_id="ORTHO_I25" case_id="TC_SCH_001">

  {/* [1] Header - from metric table */}
  <CardHeader>
    <MetricTitle metric={metric} />
    <StatusBadge status={computedStatus} />
  </CardHeader>

  {/* [2] Patient Info - from patient_payload */}
  <PatientInfo payload={patientPayload} />

  {/* [3] Timeline - computed from metric + timestamps */}
  <TimelineBar
    threshold={metric.threshold_hours}
    startTime={patientPayload.index_event_instant}
    endTime={patientPayload.target_event_instant}
  />

  {/* [4] Primary Fields - from display_plan tier 1 */}
  <PrimaryFields>
    {displayPlan
      .filter(d => d.tier === '1')
      .sort((a, b) => a.order_nbr - b.order_nbr)
      .map(field => (
        <Field
          key={field.field_name}
          label={field.label || field.field_name}
          value={getFieldValue(field, patientPayload, provenanceRules)}
        />
      ))
    }
  </PrimaryFields>

  {/* [5] Signal Chips - from signal_group + signal_def */}
  <SignalGroups>
    {signalGroups.map(group => (
      <SignalGroup
        key={group.group_id}
        group={group}
        signals={getActiveSignals(group, enrichmentResult)}
      />
    ))}
  </SignalGroups>

  {/* [6] Secondary Fields - from display_plan tier 2 */}
  <Collapsible trigger="Secondary Fields">
    {displayPlan
      .filter(d => d.tier === '2')
      .filter(d => evaluateVisibility(d.visibility_cond, activeSignals))
      .map(field => (
        <Field
          key={field.field_name}
          label={field.label}
          value={getFieldValue(field, patientPayload, provenanceRules)}
        />
      ))
    }
  </Collapsible>

  {/* [7] Actions - followup + prompts */}
  <CardActions>
    <FollowupButton
      questions={getActiveFollowups(followups, activeSignals)}
    />
    <ChatButton
      prompt={prompts.find(p => p.prompt_type === 'abstractor')}
    />
  </CardActions>

</MetricCard>
```

---

## Data Flow

### 1. Case Selection → Enrichment → Storage → Display

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Case Selection (Screen 1 - Intake)                     │
├─────────────────────────────────────────────────────────────────┤
│ User Action:                                                    │
│   - Selects specialty: "Orthopedics"                           │
│   - Uploads patient payload (JSON/XML)                         │
│   - OR selects from recent cases                               │
│                                                                 │
│ System Action:                                                  │
│   - Validates payload schema                                   │
│   - Identifies applicable metrics (looks for SCH diagnosis)    │
│   - Suggests metric: ORTHO_I25                                 │
│                                                                 │
│ Data Storage:                                                   │
│   INSERT INTO patient_payload (case_id, specialty, payload_json) │
│   VALUES ('TC_SCH_001', 'Ortho', {...})                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: AI Enrichment (Background Process)                     │
├─────────────────────────────────────────────────────────────────┤
│ API Endpoint: POST /api/enrichment                             │
│   Request: {                                                    │
│     case_id: "TC_SCH_001",                                     │
│     metric_id: "ORTHO_I25",                                    │
│     payload: {...patient data...}                              │
│   }                                                             │
│                                                                 │
│ System Action:                                                  │
│   1. Fetch prompt WHERE prompt_type = 'intake'                 │
│   2. Inject payload into prompt template                       │
│   3. Call OpenAI GPT-4o with prompt                            │
│   4. Parse JSON response: { signals: [...] }                   │
│                                                                 │
│ Data Storage:                                                   │
│   INSERT INTO enrichment_result (case_id, metric_id, signals,  │
│     computed_status, computed_at)                              │
│   VALUES ('TC_SCH_001', 'ORTHO_I25', [...], 'pass', NOW())    │
│                                                                 │
│ Cache:                                                          │
│   SET cache:enrichment:TC_SCH_001:ORTHO_I25 = {...}           │
│   EXPIRE 3600 (1 hour)                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Screen 2 - Metric Card Display                        │
├─────────────────────────────────────────────────────────────────┤
│ API Endpoint: GET /api/cases/:caseId/metrics/:metricId         │
│                                                                 │
│ System Fetches (Single Query):                                 │
│   SELECT                                                        │
│     m.*,                    -- metric definition               │
│     sg.*,                   -- signal groups                   │
│     sd.*,                   -- signal definitions              │
│     dp.*,                   -- display plan                    │
│     fq.*,                   -- followup questions              │
│     pr.*,                   -- prompts                         │
│     prov.*,                 -- provenance rules                │
│     er.signals,             -- active signals from enrichment  │
│     pp.payload_json         -- patient payload                 │
│   FROM metric m                                                 │
│   LEFT JOIN signal_group sg ON sg.metric_id = m.metric_id     │
│   LEFT JOIN signal_def sd ON sd.metric_id = m.metric_id       │
│   LEFT JOIN display_plan dp ON dp.metric_id = m.metric_id     │
│   LEFT JOIN followup fq ON fq.metric_id = m.metric_id         │
│   LEFT JOIN prompt pr ON pr.metric_id = m.metric_id           │
│   LEFT JOIN provenance_rule prov ON prov.metric_id = m.metric_id │
│   LEFT JOIN enrichment_result er ON er.case_id = 'TC_SCH_001' │
│     AND er.metric_id = m.metric_id                             │
│   LEFT JOIN patient_payload pp ON pp.case_id = 'TC_SCH_001'   │
│   WHERE m.metric_id = 'ORTHO_I25'                             │
│                                                                 │
│ Frontend Rendering:                                             │
│   1. Render metric header from m.*                             │
│   2. Render timeline from m.threshold_hours + pp timestamps    │
│   3. Render primary fields from dp WHERE tier = '1'            │
│   4. Render signal chips from sg + sd + er.signals             │
│   5. Render secondary fields from dp WHERE tier = '2'          │
│   6. Prepare followup questions from fq + er.signals           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: User Interaction - Followup Questions                 │
├─────────────────────────────────────────────────────────────────┤
│ User Action: Clicks "View Followup Questions"                  │
│                                                                 │
│ System Action:                                                  │
│   1. Filter fq WHERE evaluateCondition(when_cond, er.signals) │
│   2. Example: when_cond = "imaging_delay OR extra_imaging"    │
│      Active signals: ["imaging_delay"]                         │
│      Result: true → show FU_CT question                        │
│   3. Render questions with appropriate input components        │
│                                                                 │
│ User Response:                                                  │
│   - Answers: "CT required for neurovascular assessment"        │
│                                                                 │
│ Data Storage:                                                   │
│   INSERT INTO followup_response (case_id, followup_id, response) │
│   VALUES ('TC_SCH_001', 'FU_CT', 'CT required for...')        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: User Interaction - Chat with AI                       │
├─────────────────────────────────────────────────────────────────┤
│ User Action: Clicks "Chat with AI"                             │
│                                                                 │
│ System Action:                                                  │
│   1. Fetch prompt WHERE prompt_type = 'abstractor'             │
│   2. Initialize chat with prompt + patient payload + signals   │
│   3. User asks: "Why was imaging delayed?"                     │
│   4. AI responds using context from payload and signals        │
│                                                                 │
│ Data Storage:                                                   │
│   INSERT INTO chat_message (case_id, role, content, created_at) │
│   VALUES ('TC_SCH_001', 'user', 'Why was imaging delayed?', NOW()) │
│                                                                 │
│   INSERT INTO chat_message (case_id, role, content, created_at) │
│   VALUES ('TC_SCH_001', 'assistant', 'Based on the timeline...', NOW()) │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Final Review & Feedback                               │
├─────────────────────────────────────────────────────────────────┤
│ User Action: Clicks "Mark Reviewed"                            │
│                                                                 │
│ System Action:                                                  │
│   UPDATE enrichment_result                                      │
│   SET reviewed = true, reviewed_by = 'user@example.com',      │
│       reviewed_at = NOW()                                       │
│   WHERE case_id = 'TC_SCH_001' AND metric_id = 'ORTHO_I25'    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Grouping and Presentation Rules

### Rule 1: Signal Group Rendering
**Source**: `signal_group` + `signal_def` + `enrichment_result.signals`

**Logic**:
```typescript
function renderSignalGroups(metricId: string, activeSignals: string[]) {
  // 1. Fetch all groups for metric
  const groups = db.query(
    `SELECT * FROM signal_group WHERE metric_id = ? ORDER BY order_nbr ASC`,
    [metricId]
  );

  // 2. For each group, get signals
  groups.forEach(group => {
    const groupSignals = db.query(
      `SELECT * FROM signal_def
       WHERE metric_id = ? AND group_id = ? AND status = 'active'`,
      [metricId, group.group_id]
    );

    // 3. Filter to only active signals from enrichment
    const activeGroupSignals = groupSignals.filter(s =>
      activeSignals.includes(s.signal_code)
    );

    // 4. Only render group if it has active signals
    if (activeGroupSignals.length > 0) {
      renderGroup(group, activeGroupSignals);
    }
  });
}
```

**Color Mapping** (standard palette):
```typescript
const GROUP_COLORS = {
  'core': '#007acc',           // Blue
  'delay_drivers': '#e0a800',  // Yellow
  'delays': '#e0a800',         // Yellow (alias)
  'complications': '#d9534f',  // Red
  'documentation': '#6c757d',  // Gray
  'ruleouts': '#28a745',       // Green
  'exclusions': '#28a745',     // Green (alias)
  'overrides': '#17a2b8',      // Cyan
};
```

**Severity Icons**:
```typescript
const SEVERITY_ICONS = {
  'info': '✓',      // Checkmark
  'warn': '⚠',      // Warning triangle
  'error': '✖',     // X mark
};
```

---

### Rule 2: Display Plan Tiering
**Source**: `display_plan.tier` + `display_plan.order_nbr`

**Tier Definitions**:
- **Tier 1**: Primary/Core fields
  - Always visible on card
  - Essential timeline points
  - No conditional visibility

- **Tier 2**: Secondary fields
  - Collapsible section
  - May have visibility conditions
  - Detail/supporting information

- **Tier 3**: Tertiary fields
  - Hidden by default
  - Shown in "Advanced Details" drawer
  - Often clinical notes or raw data

**Rendering Logic**:
```typescript
function renderDisplayFields(metricId: string, tier: string, activeSignals: string[], payload: any) {
  const fields = db.query(
    `SELECT * FROM display_plan
     WHERE metric_id = ? AND tier = ?
     ORDER BY COALESCE(order_nbr, 9999) ASC`,
    [metricId, tier]
  );

  fields.forEach(field => {
    // Evaluate visibility condition
    if (field.visibility_cond && !evaluateCondition(field.visibility_cond, activeSignals)) {
      return; // Skip this field
    }

    // Get field value from payload using provenance rules
    const value = getFieldValue(field.field_name, payload, metricId);

    // Render field
    renderField({
      label: field.label || field.field_name,
      value: value || '—',
      tier: tier
    });
  });
}
```

---

### Rule 3: Visibility Condition Evaluation
**Source**: `display_plan.visibility_cond` + `followup.when_cond`

**Expression Syntax**:
- Signal references: `signal_code` (e.g., `imaging_delay`)
- Logical operators: `AND`, `OR`, `NOT`
- Grouping: `(...)` parentheses
- Examples:
  - `imaging_delay` → Show if imaging_delay signal is active
  - `imaging_delay OR extra_imaging` → Show if either signal active
  - `consult_delay AND NOT clinician_override` → Show if consult delayed but not overridden

**Evaluation Logic**:
```typescript
function evaluateCondition(condition: string | null, activeSignals: string[]): boolean {
  if (!condition) return true; // Always show if no condition

  // Parse expression (simplified)
  const tokens = condition.split(/\s+(AND|OR|NOT)\s+/);

  // Evaluate each token
  let result = true;
  let operator = 'AND';

  tokens.forEach(token => {
    if (token === 'AND' || token === 'OR' || token === 'NOT') {
      operator = token;
    } else {
      const signalActive = activeSignals.includes(token);

      if (operator === 'AND') {
        result = result && signalActive;
      } else if (operator === 'OR') {
        result = result || signalActive;
      } else if (operator === 'NOT') {
        result = result && !signalActive;
      }
    }
  });

  return result;
}
```

---

### Rule 4: Provenance Mapping
**Source**: `provenance_rule` table

**Extraction Logic**:
```typescript
function getFieldValue(fieldName: string, payload: any, metricId: string): any {
  // 1. Check for explicit provenance rule
  const rule = db.queryOne(
    `SELECT * FROM provenance_rule
     WHERE metric_id = ? AND field_name = ?`,
    [metricId, fieldName]
  );

  if (rule) {
    const tableName = rule.table_name || 'patient_payload';
    const fieldRef = rule.field_ref || fieldName;

    // Extract value from payload using JSON path
    const value = extractJsonPath(payload, fieldRef);

    // Return fallback if missing
    return value ?? rule.fallback_json;
  }

  // 2. Default: use field_name as JSON key
  return payload[fieldName];
}
```

---

## Concrete Example

### Scenario: 6-year-old with Supracondylar Fracture

**Patient Payload**:
```json
{
  "case_id": "TC_SCH_001",
  "patient_id": "P123456",
  "age": 6,
  "sex": "F",
  "weight_kg": 22.5,
  "diagnosis": "Supracondylar humerus fracture (Gartland III)",
  "ed_arrival_time": "2024-01-15T08:23:00-05:00",
  "consult_time": "2024-01-15T09:45:00-05:00",
  "imaging_order_time": "2024-01-15T09:50:00-05:00",
  "imaging_complete_time": "2024-01-15T11:23:00-05:00",
  "or_start_time": "2024-01-16T00:05:00-05:00",
  "consult_notes": "High-energy fall from monkey bars. Neurovascularly intact. Gartland III displaced fracture.",
  "imaging_notes": "Initial X-rays adequate. Delayed to radiology due to department queue."
}
```

**Enrichment Result** (from GPT-4o):
```json
{
  "case_id": "TC_SCH_001",
  "metric_id": "ORTHO_I25",
  "signals": [
    "within_threshold",
    "borderline_pm30",
    "consult_delay",
    "imaging_delay"
  ],
  "computed_status": "pass",
  "time_to_or_hours": 15.7,
  "computed_at": "2024-01-16T00:30:00Z"
}
```

**Rendered Card**:

```
┌─────────────────────────────────────────────────────────────────┐
│ Ortho • I25 — In OR <18h (Supracondylar)         [PASS ✓]     │
├─────────────────────────────────────────────────────────────────┤
│ ID: TC_SCH_001 • Age: 6 F • Weight: 22.5 kg                   │
├─────────────────────────────────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░ 15.7h / 18h (87%)        │
├─────────────────────────────────────────────────────────────────┤
│ ED Arrival:     Mon Jan 15, 2024 at 8:23 AM                   │
│ Consult Time:   Mon Jan 15, 2024 at 9:45 AM                   │
│ OR Start:       Tue Jan 16, 2024 at 12:05 AM                  │
├─────────────────────────────────────────────────────────────────┤
│ 🔵 Core                                                        │
│    [within_threshold ✓]  [borderline_pm30 ⚠]                 │
│                                                                 │
│ 🟡 Delays/Drivers                                              │
│    [consult_delay ⚠]  [imaging_delay ⚠]                      │
├─────────────────────────────────────────────────────────────────┤
│ ▼ Secondary Fields                                             │
│ Imaging Ordered: Mon Jan 15, 2024 at 9:50 AM                  │
│ Imaging Done:    Mon Jan 15, 2024 at 11:23 AM                 │
├─────────────────────────────────────────────────────────────────┤
│ [View Followup Questions (1)]  [Chat with AI]  [Mark Reviewed] │
└─────────────────────────────────────────────────────────────────┘
```

**Active Followup Questions**:
- **FU_CT**: "Was CT clinically required beyond X-ray?"
  - Condition: `imaging_delay OR extra_imaging` → ✓ (imaging_delay active)
  - Type: single-select
  - Options: ["Yes - clinical indication", "No - protocol only", "Uncertain"]

**Chat Context** (abstractor prompt loaded):
```
SYSTEM: You assist a human abstractor reviewing USNWR Ortho I25
(In OR <18 hrs – Supracondylar fracture).

CONTEXT:
- Patient: 6yo F with Gartland III supracondylar fracture
- Timeline: ED arrival to OR = 15.7 hours (within 18h threshold)
- Active signals: within_threshold, borderline_pm30, consult_delay, imaging_delay
- Status: PASS (but borderline, within 30min of threshold)

Your role: Help reviewer understand delays and determine if case truly meets quality standard.
```

---

## Key Takeaways

### 1. **Single Source of Truth**
All UI behavior is driven by database metadata, not hardcoded in React components.

### 2. **Standardized Presentation**
UI Mock v4 defines a consistent card layout used across all metrics. Metadata tables populate the card with metric-specific content.

### 3. **Domain-Specific Grouping**
Signal groups (core, delays, documentation, etc.) provide semantic organization while maintaining visual consistency.

### 4. **Conditional Visibility**
Fields and followup questions appear based on active signals, reducing noise and focusing reviewer attention.

### 5. **Provenance Transparency**
Every displayed value traces back to source data, supporting audit and debugging.

### 6. **AI Integration Points**
- **Intake**: Automated signal detection from raw payload
- **Abstractor**: Conversational assistance during review
- Both use prompt templates stored in database

### 7. **Scalability**
Adding a new metric (e.g., ORTHO_I26) requires only metadata entries, no code changes.

---

## Appendix: Query Examples

### Get Complete Metric Package
```sql
-- Single query to fetch everything needed for UI rendering
SELECT
  m.metric_id,
  m.specialty,
  m.metric_name,
  m.threshold_hours,
  json_agg(DISTINCT sg.*) AS signal_groups,
  json_agg(DISTINCT sd.*) AS signal_defs,
  json_agg(DISTINCT dp.* ORDER BY dp.tier, COALESCE(dp.order_nbr, 9999)) AS display_plan,
  json_agg(DISTINCT fq.*) AS followups,
  json_agg(DISTINCT pr.*) AS prompts,
  json_agg(DISTINCT prov.*) AS provenance_rules
FROM metric m
LEFT JOIN signal_group sg ON sg.metric_id = m.metric_id
LEFT JOIN signal_def sd ON sd.metric_id = m.metric_id AND sd.status = 'active'
LEFT JOIN display_plan dp ON dp.metric_id = m.metric_id
LEFT JOIN followup fq ON fq.metric_id = m.metric_id
LEFT JOIN prompt pr ON pr.metric_id = m.metric_id
LEFT JOIN provenance_rule prov ON prov.metric_id = m.metric_id
WHERE m.metric_id = 'ORTHO_I25'
GROUP BY m.metric_id;
```

### Get Active Followup Questions
```sql
-- Determine which followup questions to show based on active signals
SELECT fq.*
FROM followup fq
WHERE fq.metric_id = 'ORTHO_I25'
  AND (
    fq.when_cond IS NULL
    OR evaluate_condition(fq.when_cond, ARRAY['consult_delay', 'imaging_delay'])
  );
```

### Get Field Display Order
```sql
-- Get fields in display order for a specific tier
SELECT
  field_name,
  label,
  COALESCE(order_nbr, 9999) AS display_order,
  visibility_cond
FROM display_plan
WHERE metric_id = 'ORTHO_I25' AND tier = '1'
ORDER BY display_order ASC;
```

---

**End of Specification**
