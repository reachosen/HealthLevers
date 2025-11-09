# HealthLevers: AI-Powered Clinical Abstraction Workbench
## Intelligent Summary + Guided Review + Dynamic Reasoning

---

## The Correct Model

### 1. Critical 20% = AI-Generated Clinical Summary
**NOT**: Top 20% of predefined signals
**YES**: Intelligently extracted narrative from JSON payload

```
Example JSON Payload (500+ lines):
{
  "patient": { "age": 6, "weight": 20.5, ... },
  "chief_complaint": "Left arm pain after fall from playground...",
  "ed_notes": "6yo male fell from monkey bars at approx 0600...",
  "radiology": "Displaced supracondylar fracture, Gartland type III...",
  "nursing_notes": "Last oral intake 0530 breakfast...",
  "or_log": "Surgery start 1430, procedure ORIF...",
  ... [hundreds more lines]
}

↓ AI Extracts Critical 20% ↓

CLINICAL SUMMARY (what matters for ORTHO_I25):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧒 PATIENT: 6yo male, 20kg

📋 PRESENTATION: Fall from monkey bars
   • Time of injury: 06:00
   • ED arrival: 07:00 (1 hour post-injury)

🦴 INJURY: Displaced supracondylar fracture (Gartland III)
   • Location: Left humerus
   • Neurovascular: INTACT (radial pulse 2+, sensation intact)
   • Skin: Closed injury, no compartment syndrome

⏱️ TIMELINE:
   06:00 - Injury occurred
   07:00 - ED arrival
   14:30 - Surgery start
   TIME TO OR: 8.5 hours

🚩 KEY CONSIDERATIONS:
   • NPO violation: Patient ate breakfast at 05:30
   • Delay justification: 6hr NPO protocol + 2hr OR availability
   • Meets threshold: 8.5h < 18h ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2. Grouped Signals (From Excel Metadata)
Show all signals organized by `signal_group` table - expandable sections

### 3. Dynamic Follow-up Questions (AI-Generated)
**NOT**: Static questions from `followup` table
**YES**: Contextual questions generated to help clinician reason about:
- **Rule In**: Does this case truly qualify?
- **Rule Out**: Are there exclusion criteria?
- **Clinical Insight**: What's the clinical context?

---

## Complete UI Design

```
┌──────────────────────────────────────────────────────────┐
│ Case: ENC_12345 | ORTHO_I25 - In OR <18 hrs             │
│ 6yo Male | Supracondylar Fracture                       │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ 📊 CLINICAL SUMMARY (AI-Generated from Payload)          │
├──────────────────────────────────────────────────────────┤
│ 🧒 PATIENT                                               │
│ • Age: 6 years old                                       │
│ • Weight: 20.5 kg                                        │
│ • Gender: Male                                           │
│                                                          │
│ 📋 PRESENTATION                                          │
│ • Mechanism: Fall from monkey bars (playground)         │
│ • Chief complaint: Left arm pain, unable to move        │
│ • Time of injury: Jan 15, 2024 06:00                    │
│ • ED arrival: Jan 15, 2024 07:00 (1 hour post-injury)  │
│                                                          │
│ 🦴 INJURY ASSESSMENT                                     │
│ • Diagnosis: Displaced supracondylar fracture           │
│ • Classification: Gartland Type III                     │
│ • Location: Left distal humerus                         │
│ • Neurovascular status: INTACT                          │
│   - Radial pulse: 2+ bilaterally                       │
│   - Capillary refill: <2 seconds                       │
│   - Sensation: Intact to light touch                   │
│   - Motor: Able to move fingers                        │
│ • Skin integrity: Closed injury (no open wound)        │
│ • Compartment syndrome: No signs                        │
│                                                          │
│ ⏱️ CRITICAL TIMELINE                                     │
│ • 06:00 - Injury occurred                               │
│ • 07:00 - ED arrival (initial assessment)              │
│ • 07:15 - X-ray completed                              │
│ • 07:30 - Ortho consult called                         │
│ • 08:00 - NPO ordered (last PO intake 05:30)           │
│ • 11:30 - Earliest allowable surgery time (6hr NPO)    │
│ • 14:30 - Actual surgery start                         │
│ • TIME TO OR: 8 hours 30 minutes                       │
│                                                          │
│ 🚩 KEY CLINICAL CONSIDERATIONS                          │
│ • NPO Delay: Patient ate breakfast at 05:30           │
│   Protocol required 6-hour wait → 11:30 earliest       │
│ • Additional delay: 3 hours (11:30 → 14:30)           │
│   Reason documented: OR availability                   │
│ • Quality metric: 8.5h < 18h threshold ✓               │
│                                                          │
│ 💡 This summary was generated from encounter payload    │
│    [View Raw JSON]                                      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ 📋 STRUCTURED SIGNALS (From Excel Groups)                │
├──────────────────────────────────────────────────────────┤
│ ▼ Demographics (5 signals)                              │
│   • patient_age: 6 years                                │
│   • patient_weight: 20.5 kg                             │
│   • patient_gender: Male                                │
│   • patient_race: Not documented                        │
│   • patient_ethnicity: Not documented                   │
│                                                          │
│ ▼ Clinical Assessment (8 signals)                       │
│   • fracture_type: Displaced supracondylar              │
│   • fracture_classification: Gartland III               │
│   • neurovascular_status: Intact                        │
│   • skin_integrity: Closed                              │
│   • compartment_syndrome: Absent                        │
│   • side_affected: Left                                 │
│   • mechanism_of_injury: Fall                           │
│   • injury_location: Playground                         │
│                                                          │
│ ▶ Timing Signals (4 signals) [Expand]                  │
│ ▶ Operative Details (6 signals) [Expand]               │
│ ▶ Post-Operative (5 signals) [Expand]                  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ 🤖 DYNAMIC REASONING QUESTIONS (AI-Generated)            │
├──────────────────────────────────────────────────────────┤
│ These questions help you determine if this case should   │
│ be included, excluded, or requires special consideration │
│                                                          │
│ ✅ RULE IN (Inclusion Criteria)                         │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Q1: Is this a true supracondylar fracture requiring│  │
│ │     urgent surgical intervention?                  │  │
│ │                                                    │  │
│ │ 💡 Why asking: Case classification depends on     │  │
│ │    fracture type and surgical urgency             │  │
│ │                                                    │  │
│ │ 🔍 Evidence found:                                │  │
│ │ • Radiology: "Gartland Type III displaced"        │  │
│ │ • Ortho note: "Requires urgent ORIF"              │  │
│ │                                                    │  │
│ │ Your assessment:                                   │  │
│ │ ( ) Yes, clearly requires urgent surgery          │  │
│ │ ( ) No, could have been managed conservatively    │  │
│ │ ( ) Unclear, need more information                │  │
│ │                                                    │  │
│ │ [Ask LLM for clarification]                       │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ❌ RULE OUT (Exclusion Criteria)                        │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Q2: Was this patient transferred from an outside  │  │
│ │     facility after initial treatment?             │  │
│ │                                                    │  │
│ │ 💡 Why asking: Transfers are excluded from metric│  │
│ │    (time clock starts at original facility)       │  │
│ │                                                    │  │
│ │ 🔍 Evidence found:                                │  │
│ │ • ED note: "Brought by parents from home"         │  │
│ │ • Transfer documentation: None found              │  │
│ │                                                    │  │
│ │ Your assessment:                                   │  │
│ │ (•) No transfer - direct from scene               │  │
│ │ ( ) Yes, transferred from outside facility        │  │
│ │ ( ) Unclear from documentation                    │  │
│ │                                                    │  │
│ │ [Ask LLM for clarification]                       │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ 💡 CLINICAL INSIGHT (Contextual Understanding)          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Q3: What was the clinical justification for the   │  │
│ │     8.5-hour delay to surgery?                    │  │
│ │                                                    │  │
│ │ 💡 Why asking: Understanding delay context helps │  │
│ │    determine if this represents a quality gap    │  │
│ │                                                    │  │
│ │ 🔍 Evidence found:                                │  │
│ │ • NPO delay: 6 hours (protocol-driven)            │  │
│ │ • OR availability: 3 hours (staffing)             │  │
│ │ • Clinical deterioration: None documented         │  │
│ │                                                    │  │
│ │ Your interpretation:                               │  │
│ │ ┌──────────────────────────────────────────────┐  │  │
│ │ │ 6hr delay was unavoidable due to NPO         │  │  │
│ │ │ protocol. 3hr additional delay for OR        │  │  │
│ │ │ availability is within acceptable range.     │  │  │
│ │ │ No evidence of adverse outcome from delay.   │  │  │
│ │ └──────────────────────────────────────────────┘  │  │
│ │                                                    │  │
│ │ [Ask LLM for more context]                        │  │
│ └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ 💬 LLM COPILOT (Ask Follow-up Questions)                 │
├──────────────────────────────────────────────────────────┤
│ [Chat interface as before]                               │
│                                                          │
│ You: Were there any contraindications documented?        │
│                                                          │
│ LLM: Found 1 contraindication:                          │
│      • NPO violation - patient ate at 05:30             │
│      • Anesthesia protocol requires 6-hour fast         │
│      • No other contraindications found                 │
│      Source: encounter.nursing_notes.intake             │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ ⚖️ ABSTRACTION DECISION                                  │
├──────────────────────────────────────────────────────────┤
│ Based on your review of the summary, signals, and       │
│ reasoning questions:                                     │
│                                                          │
│ Metric Result:                                           │
│ • Time to OR: 8.5 hours                                 │
│ • Threshold: <18 hours                                  │
│ • Numerical result: PASS ✓                              │
│                                                          │
│ Your Final Classification:                               │
│ ( ) Include - Meets Standard                            │
│ ( ) Include - Fails Standard                            │
│ ( ) Exclude from Analysis                               │
│                                                          │
│ If excluding, reason:                                    │
│ [ ] Transfer from outside facility                      │
│ [ ] Not appropriate for metric                          │
│ [ ] Incomplete documentation                            │
│ [ ] Other: [_________________________________]           │
│                                                          │
│ Notes:                                                   │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 8.5hr delay is within threshold. NPO delay was    │  │
│ │ clinically justified. Case qualifies for metric.  │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ [Save Draft] [Submit Abstraction]                       │
└──────────────────────────────────────────────────────────┘
```

---

## How Dynamic Questions Work

### Step 1: AI Analyzes Case + Metric Context
```typescript
POST /api/cases/:caseId/generate-reasoning-questions

Input:
{
  caseId: "case_123",
  metricId: "ORTHO_I25",
  encounterPayload: { /* full JSON */ },
  signals: { /* extracted signals */ }
}

AI Prompt:
"Given this case and metric ORTHO_I25 (In OR <18 hrs for SCH),
 generate reasoning questions that help the clinician determine:

 1. RULE IN: Does this case qualify for the metric?
    - Is it truly a supracondylar fracture?
    - Was it urgent/emergent?

 2. RULE OUT: Should this case be excluded?
    - Was it a transfer?
    - Was initial treatment elsewhere?
    - Are there special circumstances?

 3. CLINICAL INSIGHT: What context matters?
    - What explains the delay?
    - Were there complications?
    - What was the clinical reasoning?

 For each question:
 - Explain WHY you're asking (context)
 - Search payload for relevant evidence
 - Suggest answer options
 - Cite sources"
```

### Step 2: AI Returns Structured Questions
```json
{
  "ruleInQuestions": [
    {
      "questionId": "q1",
      "category": "inclusion_criteria",
      "questionText": "Is this a true supracondylar fracture requiring urgent surgical intervention?",
      "rationale": "Case classification depends on fracture type and surgical urgency",
      "evidence": [
        {
          "source": "encounter.radiology.findings",
          "text": "Gartland Type III displaced supracondylar fracture",
          "supports": "yes"
        },
        {
          "source": "encounter.ortho_consult.assessment",
          "text": "Requires urgent ORIF within 24 hours",
          "supports": "yes"
        }
      ],
      "answerOptions": [
        "Yes, clearly requires urgent surgery",
        "No, could have been managed conservatively",
        "Unclear, need more information"
      ],
      "suggestedAnswer": "Yes, clearly requires urgent surgery",
      "confidence": 0.95
    }
  ],
  "ruleOutQuestions": [
    {
      "questionId": "q2",
      "category": "exclusion_criteria",
      "questionText": "Was this patient transferred from an outside facility after initial treatment?",
      "rationale": "Transfers are excluded from metric (time clock starts at original facility)",
      "evidence": [
        {
          "source": "encounter.ed_note.arrival",
          "text": "Brought by parents from home, direct from playground",
          "supports": "no_transfer"
        },
        {
          "source": "encounter.transfer_docs",
          "text": null,
          "supports": "no_transfer"
        }
      ],
      "answerOptions": [
        "No transfer - direct from scene",
        "Yes, transferred from outside facility",
        "Unclear from documentation"
      ],
      "suggestedAnswer": "No transfer - direct from scene",
      "confidence": 0.98
    }
  ],
  "clinicalInsightQuestions": [
    {
      "questionId": "q3",
      "category": "context",
      "questionText": "What was the clinical justification for the 8.5-hour delay to surgery?",
      "rationale": "Understanding delay context helps determine if this represents a quality gap",
      "evidence": [
        {
          "source": "encounter.nursing_notes.intake",
          "text": "Last PO intake 05:30 - breakfast. NPO ordered 08:00",
          "context": "6-hour NPO protocol required"
        },
        {
          "source": "encounter.or_log.scheduling",
          "text": "First available OR time 14:30 due to emergency case priority",
          "context": "3-hour additional delay for OR availability"
        }
      ],
      "interpretationGuidance": "Consider whether delays were clinically justified (NPO protocol) vs preventable (OR scheduling)",
      "suggestedInterpretation": "6hr delay unavoidable (NPO protocol). 3hr additional delay for OR availability is within acceptable range. No adverse outcome documented."
    }
  ]
}
```

### Step 3: Display Questions with Evidence
Each question card shows:
- ✅ **Question text** (what clinician needs to decide)
- 💡 **Rationale** (why this matters)
- 🔍 **Evidence** (what AI found in payload)
- **Answer options** (structured choices)
- **Suggested answer** (AI's interpretation, but clinician decides)
- **[Ask LLM]** button (for clarification)

---

## Key Differences from Previous Design

| Aspect | Previous (Wrong) | Current (Correct) |
|--------|------------------|-------------------|
| **Critical 20%** | Top signals by severity | AI-generated clinical summary |
| **Summary Content** | Field: Value list | Narrative clinical summary |
| **Followup Questions** | Static from DB | Dynamic AI-generated |
| **Question Purpose** | Collect missing data | Help clinician reason |
| **Question Types** | Data fields | Rule in / Rule out / Insight |
| **Evidence** | Not shown | Cited from payload |
| **Clinician Role** | Fill in blanks | Make judgment calls |

---

## Implementation Architecture

### Backend Services

#### 1. Clinical Summary Generator
```typescript
// server/services/clinicalSummaryGenerator.ts

class ClinicalSummaryGenerator {
  async generateSummary(
    encounterPayload: any,
    metricId: string
  ): Promise<ClinicalSummary> {

    const prompt = `
    You are extracting a clinical summary from an encounter record.

    METRIC CONTEXT: ${metricId} - ${getMetricDescription(metricId)}

    ENCOUNTER DATA:
    ${JSON.stringify(encounterPayload, null, 2)}

    Extract the most important clinical information relevant to this metric.
    Create a narrative summary with these sections:

    1. PATIENT: Age, weight, gender, relevant demographics
    2. PRESENTATION: Chief complaint, mechanism, timeline to ED
    3. INJURY/CONDITION ASSESSMENT: Diagnosis, severity, key findings
    4. CRITICAL TIMELINE: Key timestamps (injury → ED → consult → procedure)
    5. KEY CLINICAL CONSIDERATIONS: Delays, contraindications, special factors

    Be concise but complete. This is the "20% that explains 80% of the case."
    Cite sources as JSON paths.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    return this.parseSummary(response.choices[0].message.content);
  }
}
```

#### 2. Dynamic Question Generator
```typescript
// server/services/reasoningQuestionGenerator.ts

class ReasoningQuestionGenerator {
  async generateQuestions(
    encounterPayload: any,
    signals: Signal[],
    metricId: string
  ): Promise<ReasoningQuestions> {

    // Get metric-specific reasoning templates
    const templates = await this.getQuestionTemplates(metricId);

    const prompt = `
    You are helping a clinician review a case for quality metric ${metricId}.

    ENCOUNTER DATA:
    ${JSON.stringify(encounterPayload, null, 2)}

    EXTRACTED SIGNALS:
    ${JSON.stringify(signals, null, 2)}

    Generate reasoning questions to help the clinician determine:

    1. RULE IN (Inclusion): Does this case qualify?
       ${templates.ruleIn.map(t => `- ${t}`).join('\n')}

    2. RULE OUT (Exclusion): Should this be excluded?
       ${templates.ruleOut.map(t => `- ${t}`).join('\n')}

    3. CLINICAL INSIGHT: What context matters?
       ${templates.insight.map(t => `- ${t}`).join('\n')}

    For EACH question:
    - Write clear question text
    - Explain WHY you're asking (rationale)
    - Search encounter data for evidence
    - Cite sources (JSON paths)
    - Suggest answer based on evidence
    - Provide answer options

    Return as JSON matching this schema:
    {
      "ruleInQuestions": [...],
      "ruleOutQuestions": [...],
      "clinicalInsightQuestions": [...]
    }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content);
  }

  private async getQuestionTemplates(metricId: string) {
    // For ORTHO_I25, return templates like:
    return {
      ruleIn: [
        "Is this a true supracondylar fracture requiring urgent surgery?",
        "Is the fracture classification documented (Gartland type)?",
        "Was neurovascular status assessed?"
      ],
      ruleOut: [
        "Was patient transferred from outside facility?",
        "Was initial treatment provided elsewhere?",
        "Is this a re-operation for same injury?"
      ],
      insight: [
        "What was the clinical justification for any delays?",
        "Were there documented contraindications to immediate surgery?",
        "What was the clinical outcome?"
      ]
    };
  }
}
```

#### 3. Question Template Storage
```sql
-- New table for metric-specific question templates
CREATE TABLE reasoning_question_template (
  metric_id TEXT NOT NULL,
  category TEXT NOT NULL, -- 'rule_in', 'rule_out', 'insight'
  question_template TEXT NOT NULL,
  rationale TEXT,
  priority INTEGER,
  PRIMARY KEY (metric_id, category, question_template)
);

-- Example data for ORTHO_I25
INSERT INTO reasoning_question_template VALUES
('ORTHO_I25', 'rule_in', 'Is this a true supracondylar fracture requiring urgent surgical intervention?', 'Case classification depends on fracture type and surgical urgency', 1),
('ORTHO_I25', 'rule_out', 'Was this patient transferred from an outside facility after initial treatment?', 'Transfers are excluded (time clock starts at original facility)', 1),
('ORTHO_I25', 'insight', 'What was the clinical justification for any delay to surgery?', 'Understanding delay context helps determine if this represents a quality gap', 1);
```

---

## API Endpoints

### POST /api/cases/:caseId/prepare-review
Returns everything needed for clinician review:
```typescript
{
  case: { /* case metadata */ },
  clinicalSummary: {
    patient: "6yo male, 20kg",
    presentation: "Fall from monkey bars at 06:00...",
    assessment: "Displaced supracondylar fracture (Gartland III)...",
    timeline: [
      { time: "06:00", event: "Injury occurred" },
      { time: "07:00", event: "ED arrival" },
      { time: "14:30", event: "Surgery start" }
    ],
    keyConsiderations: [
      "NPO violation: ate at 05:30",
      "8.5hr delay: 6hr NPO + 2hr OR availability"
    ],
    citations: [/* JSON paths */]
  },
  groupedSignals: {
    demographics: [/* signals */],
    clinical: [/* signals */],
    timing: [/* signals */]
  },
  reasoningQuestions: {
    ruleIn: [/* questions with evidence */],
    ruleOut: [/* questions with evidence */],
    insight: [/* questions with evidence */]
  }
}
```

---

## Component Structure

```typescript
CaseReviewWorkbench.tsx
├─ CaseHeader
├─ ClinicalSummaryCard (AI-generated narrative)
│  ├─ PatientSection
│  ├─ PresentationSection
│  ├─ AssessmentSection
│  ├─ TimelineSection
│  └─ KeyConsiderationsSection
├─ GroupedSignalsAccordion (from Excel metadata)
│  ├─ SignalGroup (Demographics)
│  ├─ SignalGroup (Clinical)
│  └─ SignalGroup (Timing)
├─ ReasoningQuestionsPanel (AI-generated)
│  ├─ QuestionCategory (Rule In)
│  │  └─ ReasoningQuestionCard[]
│  ├─ QuestionCategory (Rule Out)
│  │  └─ ReasoningQuestionCard[]
│  └─ QuestionCategory (Clinical Insight)
│     └─ ReasoningQuestionCard[]
├─ LLMCopilotChat (interactive Q&A)
└─ AbstractionDecisionForm (final classification)
```

---

## User Workflow

1. **Clinician opens case**
   - Sees AI-generated clinical summary (20% narrative)
   - Gets immediate understanding: "6yo SCH, 8.5hr to OR, NPO delay"

2. **Reviews reasoning questions**
   - Rule In: "Yes, true SCH requiring surgery" (sees evidence)
   - Rule Out: "No transfer" (sees ED note citation)
   - Insight: "8.5hr delay justified by NPO protocol" (sees nursing note)

3. **Asks LLM for clarification** (if needed)
   - "Were there any complications during surgery?"
   - LLM searches OR notes and responds

4. **Reviews grouped signals** (if needs detail)
   - Expands "Operative Details" group
   - Sees all 12 operative signals

5. **Makes final decision**
   - Include - Meets Standard (8.5h < 18h)
   - Adds note about NPO justification
   - Submits

**Time**: 5-7 minutes (vs 30-60 min manual)
**Quality**: High (AI helps reason, clinician decides)

---

This design matches the spirit of **intelligent extraction** (critical 20% from JSON) + **guided reasoning** (dynamic questions for rule in/out) + **clinician control** (final decision).

Should I start implementing this?
