# HealthLevers: Clinical Review Workbench with LLM Copilot
## The Actual Workflow Design

---

## Key Insights from User Clarification

### What We Got Wrong
❌ AI auto-enriches signals → user approves/rejects
❌ AI makes decisions → user verifies
❌ Automation-first approach

### What's Actually Needed
✅ **Enrichment happens separately** (pre-processing step)
✅ **Clinician drives the review** (not AI)
✅ **LLM is a copilot** (answers questions, doesn't decide)
✅ **20/80 presentation** (show critical 20% that solves 80% of case)
✅ **Faithful answers only** (no hallucination, no sycophancy)
✅ **Interactive query** (clinician asks, LLM finds and cites)

---

## The Real Workflow

```
1. Case arrives with JSON payload (pre-loaded)
   ↓
2. System extracts CRITICAL 20% (smart summary)
   ↓
3. Clinician reviews critical info
   ↓
4. Clinician asks LLM questions about the case
   ├─ "What was the neurovascular status?"
   ├─ "When did surgery start?"
   ├─ "Are there any contraindications?"
   └─ LLM searches JSON and answers WITH CITATIONS
   ↓
5. Clinician rules out, classifies, or gains insights
   ↓
6. Clinician makes decision (not AI)
   ↓
7. Clinician submits abstraction
```

---

## Conceptual Model: LLM as Research Assistant

### Not This (AI Agent)
```
AI: "I found the patient had surgery in 8.5 hours. Do you approve?"
Clinician: *clicks approve*
```

### This (LLM Copilot)
```
Clinician: "What was the time from injury to surgery?"
LLM: "According to the OR log (line 45), surgery started at 14:30.
      According to the ED note (line 12), injury occurred at 06:00.
      Calculated time: 8 hours 30 minutes."
Clinician: "Were there any delays documented?"
LLM: "Yes, in the nursing note (line 67): 'Patient NPO status
      required 6 hour wait per protocol.'"
Clinician: *makes judgment based on this context*
```

---

## UI Architecture: Clinical Review Workbench

### Main Screen Layout
```
┌──────────────────────────────────────────────────────────────┐
│ Case: ENC_12345 | 6yo Male | Ortho - Supracondylar Fracture │
│ Metric: ORTHO_I25 - In OR <18 hrs                           │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ CRITICAL SIGNALS (20% that matters)                          │
├──────────────────────────────────────────────────────────────┤
│ ⏱️ TIMING                                                     │
│ • Injury: Jan 15, 06:00                                      │
│ • ED Arrival: Jan 15, 07:00                                  │
│ • OR Start: Jan 15, 14:30                                    │
│ • Time to OR: 8.5 hours ✓ (<18 hr threshold)                │
│                                                               │
│ 🩺 CLINICAL SEVERITY                                         │
│ • Fracture: Displaced supracondylar (Gartland III)          │
│ • Neurovascular: Intact per ED note                          │
│ • Skin: Closed injury                                        │
│                                                               │
│ ⚠️ FLAGS                                                      │
│ • Delay >6 hrs: Yes (NPO protocol)                          │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ GROUPED SIGNALS (Expandable)                                 │
├──────────────────────────────────────────────────────────────┤
│ ▼ Demographics (5 signals)                                   │
│   • Patient Age: 6 years                                     │
│   • Patient Weight: 20.5 kg                                  │
│   • Gender: Male                                             │
│   • ... [2 more]                                             │
│                                                               │
│ ▶ Pre-op Assessment (8 signals) [Expand]                    │
│ ▶ Operative Details (12 signals) [Expand]                   │
│ ▶ Post-op Course (6 signals) [Expand]                       │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ LLM COPILOT (Chat Interface)                                 │
├──────────────────────────────────────────────────────────────┤
│ 💬 Ask questions about this case...                          │
│                                                               │
│ You: What was the neurovascular status at presentation?      │
│                                                               │
│ LLM: According to the ED physician note (timestamp 07:15):   │
│      "Radial pulse 2+, capillary refill <2 sec, sensation    │
│       intact to light touch, able to move fingers."          │
│                                                               │
│      Documented as: INTACT                                   │
│      Source: encounter.clinical_notes.ed_note.neuro_exam     │
│                                                               │
│ You: Were there any contraindications to immediate surgery?  │
│                                                               │
│ LLM: Yes, found 1 contraindication documented:               │
│      1. NPO status - Patient ate breakfast at 05:30          │
│         Source: encounter.nursing_notes.intake               │
│         Protocol requires 6-hour wait → Surgery at 11:30+    │
│                                                               │
│      No other contraindications found in the record.         │
│                                                               │
│ [Type your question...]                                      │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ ABSTRACTION DECISION                                          │
├──────────────────────────────────────────────────────────────┤
│ Based on your review:                                         │
│                                                               │
│ Time to OR: 8.5 hours                                        │
│ Threshold: <18 hours                                         │
│                                                               │
│ Your Classification:                                          │
│ ( ) Meets Standard    ( ) Fails Standard    ( ) Exclude     │
│                                                               │
│ Reason for exclusion (if applicable):                        │
│ [_______________________________________________________]    │
│                                                               │
│ [Save Draft] [Submit Abstraction]                            │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Design Principles

### 1. Critical 20% First
**Goal**: Show the signals that matter most for this metric upfront

For ORTHO_I25 (Time to OR <18 hrs):
- ⏱️ **Timing signals** (injury time, OR start) - MOST CRITICAL
- 🩺 **Clinical severity** (fracture type, neuro status) - HIGH
- 👤 **Demographics** (age, weight) - LOW

**How to determine critical 20%**:
```sql
SELECT signal_code, severity, status
FROM signal_def
WHERE metric_id = 'ORTHO_I25'
  AND (severity = 'critical' OR status = 'required')
ORDER BY severity DESC;
```

From Excel metadata:
```
signal_code    | severity  | status    | Why critical?
---------------|-----------|-----------|------------------
injury_time    | critical  | required  | Calculates metric
or_start_time  | critical  | required  | Calculates metric
fracture_type  | high      | required  | Severity assessment
neuro_status   | high      | required  | Outcome indicator
patient_age    | medium    | required  | Inclusion criteria
patient_weight | low       | optional  | Context only
```

### 2. LLM Copilot Constraints
**Goal**: Helpful but NEVER hallucinates or makes things up

**LLM System Prompt**:
```
You are a clinical data assistant helping a clinician review a patient case.

CONSTRAINTS:
1. ONLY answer from the provided JSON payload
2. ALWAYS cite the exact source path (e.g., encounter.notes.ed_note)
3. If information is NOT in the payload, say "Not found in the record"
4. NEVER speculate, infer, or guess
5. NEVER say what the clinician should do (no sycophancy)
6. If asked for a recommendation, say "I can only provide information, not clinical recommendations"

FORMAT:
- Quote exact text when possible
- Show source path
- If calculating (e.g., time difference), show the math
- Use medical terminology accurately

EXAMPLE GOOD RESPONSE:
"According to the ED note (encounter.clinical_notes.ed_note.exam):
 'Radial pulse 2+, cap refill <2sec, sensation intact'
 Documented as: Neurovascular INTACT"

EXAMPLE BAD RESPONSE:
"The patient probably had good neurovascular status since there's no mention of problems" ❌
```

### 3. Grouped Signals (From Excel Metadata)
**Goal**: Organize signals by clinical context

Use `signal_group` table:
```sql
SELECT sg.group_code, sd.signal_code, sl.value
FROM signal_group sg
JOIN signal_def sd ON sg.group_id = sd.group_id
JOIN signal_ledger sl ON sd.signal_code = sl.signal_code
WHERE sg.metric_id = 'ORTHO_I25'
  AND sl.encounter_id = 'ENC_12345'
ORDER BY sg.group_id, sd.signal_code;
```

Example groups for ORTHO_I25:
```
Demographics
├─ patient_age
├─ patient_weight
└─ patient_gender

Clinical Assessment
├─ fracture_type
├─ fracture_classification
├─ neurovascular_status
├─ skin_integrity
└─ compartment_syndrome

Timing
├─ injury_time
├─ ed_arrival_time
├─ or_start_time
└─ calculated_time_to_or

Operative Details
├─ procedure_type
├─ surgeon
├─ anesthesia_type
└─ complications
```

### 4. Interactive Query (Not Pre-Computed Answers)
**Goal**: Clinician asks, LLM searches and answers in real-time

**NOT this** (pre-computed):
```javascript
// Bad: Pre-generated Q&A
{
  "question": "What was neurovascular status?",
  "answer": "Intact",
  "confidence": 0.85
}
```

**THIS** (interactive):
```javascript
// Good: LLM searches JSON on demand
POST /api/cases/:caseId/query
{
  "question": "What was neurovascular status?",
  "context": "ORTHO_I25 review"
}

→ LLM searches encounter JSON
→ Finds: encounter.clinical_notes.ed_note.neuro_exam
→ Returns: {
    "answer": "According to ED note: 'Radial pulse 2+...'",
    "citations": ["encounter.clinical_notes.ed_note.neuro_exam"],
    "raw_text": "Radial pulse 2+, cap refill <2sec..."
  }
```

### 5. Clinician Makes Decision (Not AI)
**Goal**: LLM informs, clinician decides

UI Flow:
```
1. Clinician reviews critical signals
2. Clinician asks LLM clarifying questions
3. Clinician rules out exclusions
4. Clinician classifies case:
   - Meets Standard (yes/no)
   - Exclude (with reason)
5. Clinician submits (their decision, not AI's)
```

---

## Component Architecture

### Page Structure
```typescript
CaseReviewWorkbench.tsx
├─ CaseHeader (patient/metric context)
├─ CriticalSignalsCard (20% that matters)
│  ├─ Timing signals (for ORTHO_I25)
│  ├─ Clinical severity
│  └─ Flags/warnings
├─ GroupedSignalsAccordion (80% expandable)
│  ├─ Demographics group
│  ├─ Clinical assessment group
│  ├─ Timing group
│  └─ Operative details group
├─ LLMCopilotChat (interactive Q&A)
│  ├─ Message history
│  ├─ Input box
│  └─ Citation display
└─ AbstractionDecisionForm
   ├─ Classification radio buttons
   ├─ Exclusion reason (if needed)
   └─ Submit button
```

### Component Details

#### CriticalSignalsCard.tsx
```typescript
interface CriticalSignalsCardProps {
  metricId: string;
  signals: Signal[];
}

function CriticalSignalsCard({ metricId, signals }: CriticalSignalsCardProps) {
  // Filter signals where severity = 'critical' or 'high'
  const criticalSignals = signals.filter(s =>
    s.severity === 'critical' || s.severity === 'high'
  );

  // Group by category
  const timing = criticalSignals.filter(s => s.groupId === 'timing');
  const clinical = criticalSignals.filter(s => s.groupId === 'clinical');
  const flags = detectFlags(signals); // e.g., delays, contraindications

  return (
    <Card>
      <CardHeader>
        <h3>Critical Signals (20% that matters)</h3>
      </CardHeader>
      <CardContent>
        <Section title="⏱️ Timing">
          {timing.map(s => <SignalDisplay key={s.code} signal={s} />)}
        </Section>
        <Section title="🩺 Clinical Severity">
          {clinical.map(s => <SignalDisplay key={s.code} signal={s} />)}
        </Section>
        {flags.length > 0 && (
          <Section title="⚠️ Flags">
            {flags.map(f => <FlagDisplay key={f.code} flag={f} />)}
          </Section>
        )}
      </CardContent>
    </Card>
  );
}
```

#### GroupedSignalsAccordion.tsx
```typescript
interface GroupedSignalsAccordionProps {
  groups: SignalGroup[];
  signals: Signal[];
}

function GroupedSignalsAccordion({ groups, signals }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  return (
    <Accordion type="multiple">
      {groups.map(group => (
        <AccordionItem key={group.groupId} value={group.groupId}>
          <AccordionTrigger>
            {group.groupCode} ({getSignalCount(group, signals)} signals)
          </AccordionTrigger>
          <AccordionContent>
            {getGroupSignals(group, signals).map(signal => (
              <SignalDisplay key={signal.code} signal={signal} />
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
```

#### LLMCopilotChat.tsx
```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

function LLMCopilotChat({ caseId, encounterId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { mutate: sendQuery, isLoading } = useMutation(
    (question: string) =>
      api.post(`/cases/${caseId}/query`, { question })
  );

  const handleSend = () => {
    // Add user message
    setMessages([...messages, {
      role: 'user',
      content: input,
      timestamp: new Date()
    }]);

    // Send to LLM
    sendQuery(input, {
      onSuccess: (response) => {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.answer,
          citations: response.citations,
          timestamp: new Date()
        }]);
      }
    });

    setInput('');
  };

  return (
    <Card>
      <CardHeader>
        <h3>💬 LLM Copilot</h3>
        <p className="text-sm text-muted-foreground">
          Ask questions about this case. LLM will search the record.
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] mb-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {isLoading && <LoadingIndicator />}
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask a question about this case..."
          />
          <Button onClick={handleSend} disabled={!input.trim()}>
            Send
          </Button>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          <p>💡 Examples:</p>
          <ul className="list-disc list-inside">
            <li>"What was the neurovascular status?"</li>
            <li>"When did surgery start relative to injury?"</li>
            <li>"Were there any documented contraindications?"</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### MessageBubble.tsx
```typescript
function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={`mb-4 ${message.role === 'user' ? 'text-right' : ''}`}>
      <div className={`inline-block p-3 rounded-lg ${
        message.role === 'user'
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted'
      }`}>
        <p className="whitespace-pre-wrap">{message.content}</p>

        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-xs font-medium">Sources:</p>
            {message.citations.map((cite, i) => (
              <div key={i} className="text-xs mt-1">
                <code className="bg-background px-1 rounded">
                  {cite.path}
                </code>
                {cite.excerpt && (
                  <p className="mt-1 italic">"{cite.excerpt}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {format(message.timestamp, 'HH:mm')}
      </p>
    </div>
  );
}
```

#### AbstractionDecisionForm.tsx
```typescript
function AbstractionDecisionForm({ caseId, metricId }: Props) {
  const [classification, setClassification] = useState<
    'meets' | 'fails' | 'exclude' | null
  >(null);
  const [exclusionReason, setExclusionReason] = useState('');

  const { mutate: submit } = useMutation(
    () => api.post(`/cases/${caseId}/submit`, {
      metricId,
      classification,
      exclusionReason: classification === 'exclude' ? exclusionReason : null,
      submittedBy: currentUser.id,
      submittedAt: new Date()
    })
  );

  return (
    <Card>
      <CardHeader>
        <h3>Abstraction Decision</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="font-medium mb-2">Based on your review:</p>
            <p>Time to OR: <strong>8.5 hours</strong></p>
            <p>Threshold: <strong>&lt;18 hours</strong></p>
          </div>

          <div>
            <p className="font-medium mb-2">Your Classification:</p>
            <RadioGroup value={classification} onValueChange={setClassification}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="meets" id="meets" />
                <Label htmlFor="meets">Meets Standard</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fails" id="fails" />
                <Label htmlFor="fails">Fails Standard</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="exclude" id="exclude" />
                <Label htmlFor="exclude">Exclude from Analysis</Label>
              </div>
            </RadioGroup>
          </div>

          {classification === 'exclude' && (
            <div>
              <Label htmlFor="reason">Reason for Exclusion</Label>
              <Textarea
                id="reason"
                value={exclusionReason}
                onChange={(e) => setExclusionReason(e.target.value)}
                placeholder="e.g., Patient transferred from outside facility..."
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline">Save Draft</Button>
            <Button
              onClick={() => submit()}
              disabled={!classification}
            >
              Submit Abstraction
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## API Endpoints

### GET /api/cases/:caseId/review-data
Returns everything needed for review:
```typescript
{
  case: {
    caseId: "case_123",
    encounterId: "ENC_12345",
    patientId: "P_456",
    specialty: "Ortho",
    metrics: ["ORTHO_I25"]
  },
  encounter: {
    // Full JSON payload
    patient: { age: 6, gender: "M", ... },
    clinical_notes: { ... },
    timing: { ... }
  },
  signals: [
    {
      signalCode: "injury_time",
      value: "2024-01-15T06:00:00Z",
      groupId: "timing",
      severity: "critical",
      status: "required"
    },
    // ... all signals
  ],
  groups: [
    {
      groupId: "demographics",
      groupCode: "Demographics",
      order: 1
    },
    // ... all groups
  ]
}
```

### POST /api/cases/:caseId/query
Interactive LLM query:
```typescript
Request:
{
  question: "What was the neurovascular status?",
  context: {
    metricId: "ORTHO_I25",
    encounterId: "ENC_12345"
  }
}

Response:
{
  answer: "According to the ED physician note (timestamp 07:15): 'Radial pulse 2+, capillary refill <2 sec...'",
  citations: [
    {
      path: "encounter.clinical_notes.ed_note.neuro_exam",
      excerpt: "Radial pulse 2+, capillary refill <2 sec, sensation intact...",
      timestamp: "2024-01-15T07:15:00Z"
    }
  ],
  confidence: "high", // LLM found exact match
  notFound: false
}
```

### POST /api/cases/:caseId/submit
Submit abstraction decision:
```typescript
Request:
{
  metricId: "ORTHO_I25",
  classification: "meets" | "fails" | "exclude",
  exclusionReason?: string,
  notes?: string,
  submittedBy: "user_789",
  submittedAt: "2024-01-20T14:30:00Z"
}

Response:
{
  success: true,
  caseId: "case_123",
  status: "completed"
}
```

---

## LLM Integration (Backend)

### LLM Service
```typescript
// server/services/llmCopilot.ts

interface QueryContext {
  encounterPayload: any; // Full JSON
  metricId: string;
  signalMetadata: SignalDef[]; // For context
}

class LLMCopilot {
  async answerQuery(
    question: string,
    context: QueryContext
  ): Promise<QueryResponse> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = `Question: ${question}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for factual answers
      max_tokens: 500
    });

    // Parse response to extract citations
    const answer = response.choices[0].message.content;
    const citations = this.extractCitations(answer, context.encounterPayload);

    return {
      answer,
      citations,
      confidence: this.assessConfidence(answer),
      notFound: answer.includes("Not found in the record")
    };
  }

  private buildSystemPrompt(context: QueryContext): string {
    return `
You are a clinical data assistant helping a clinician review a patient case.

AVAILABLE DATA:
${JSON.stringify(context.encounterPayload, null, 2)}

METRIC BEING REVIEWED: ${context.metricId}

CONSTRAINTS:
1. ONLY answer from the provided JSON data above
2. ALWAYS cite the exact JSON path (e.g., "encounter.clinical_notes.ed_note")
3. If information is NOT in the data, respond exactly: "Not found in the record"
4. NEVER speculate, infer, or make assumptions
5. NEVER provide clinical recommendations or say what should be done
6. Quote exact text from the record when possible
7. If calculating (e.g., time differences), show your work

FORMAT YOUR RESPONSE:
According to [source location]: "[exact quote]"
[Additional context if relevant]
Source: [JSON path]

EXAMPLE:
Question: "What was the neurovascular status?"
Response: "According to the ED physician note (timestamp 07:15): 'Radial pulse 2+, capillary refill <2 sec, sensation intact to light touch.'
Documented as: Neurovascular INTACT
Source: encounter.clinical_notes.ed_note.neuro_exam"
    `.trim();
  }

  private extractCitations(
    answer: string,
    payload: any
  ): Citation[] {
    // Parse answer for "Source: xxx" patterns
    // Look up actual values in payload
    // Return structured citations

    const citations: Citation[] = [];
    const sourceRegex = /Source:\s*([^\n]+)/g;
    let match;

    while ((match = sourceRegex.exec(answer)) !== null) {
      const path = match[1].trim();
      const value = this.getValueAtPath(payload, path);

      citations.push({
        path,
        excerpt: typeof value === 'string' ? value.substring(0, 200) : JSON.stringify(value),
        value
      });
    }

    return citations;
  }

  private assessConfidence(answer: string): 'high' | 'medium' | 'low' {
    // High: Found exact match with source
    if (answer.includes('Source:') && !answer.includes('may') && !answer.includes('possibly')) {
      return 'high';
    }
    // Low: Not found
    if (answer.includes('Not found in the record')) {
      return 'low';
    }
    // Medium: Everything else
    return 'medium';
  }
}
```

---

## Critical 20% Selection Algorithm

```typescript
// server/services/criticalSignalSelector.ts

interface CriticalSignalConfig {
  metricId: string;
  criticalSignals: string[];
  calculatedMetrics: CalculatedMetric[];
}

class CriticalSignalSelector {
  async getCriticalSignals(
    metricId: string,
    signals: Signal[]
  ): Promise<CriticalSignal[]> {
    // 1. Get signal definitions for this metric
    const signalDefs = await db
      .select()
      .from(signalDef)
      .where(eq(signalDef.metricId, metricId));

    // 2. Filter by severity
    const critical = signalDefs.filter(s =>
      s.severity === 'critical' ||
      s.status === 'required'
    );

    // 3. Get actual values
    const criticalWithValues = critical.map(def => {
      const signal = signals.find(s => s.signalCode === def.signalCode);
      return {
        ...def,
        value: signal?.value,
        groupId: def.groupId
      };
    });

    // 4. Group by category
    const grouped = this.groupByCategory(criticalWithValues);

    // 5. Add calculated metrics (e.g., time_to_or)
    const calculated = this.calculateMetrics(metricId, signals);

    return {
      timing: grouped.timing || [],
      clinical: grouped.clinical || [],
      calculated,
      flags: this.detectFlags(signals, metricId)
    };
  }

  private calculateMetrics(
    metricId: string,
    signals: Signal[]
  ): CalculatedMetric[] {
    // For ORTHO_I25: Calculate time from injury to OR
    if (metricId === 'ORTHO_I25') {
      const injuryTime = signals.find(s => s.signalCode === 'injury_time')?.value;
      const orStartTime = signals.find(s => s.signalCode === 'or_start_time')?.value;

      if (injuryTime && orStartTime) {
        const diff = differenceInHours(
          new Date(orStartTime),
          new Date(injuryTime)
        );

        return [{
          name: 'time_to_or',
          value: diff,
          unit: 'hours',
          threshold: 18,
          meets: diff < 18,
          calculation: `${orStartTime} - ${injuryTime} = ${diff}h`
        }];
      }
    }

    return [];
  }

  private detectFlags(
    signals: Signal[],
    metricId: string
  ): Flag[] {
    const flags: Flag[] = [];

    // Flag: Delay documented
    const delayReason = signals.find(s => s.signalCode === 'delay_reason')?.value;
    if (delayReason) {
      flags.push({
        type: 'delay_documented',
        severity: 'warning',
        message: `Delay reason: ${delayReason}`
      });
    }

    // Flag: Missing critical signal
    const requiredSignals = signals.filter(s => s.status === 'required');
    const missingRequired = requiredSignals.filter(s => !s.value);
    if (missingRequired.length > 0) {
      flags.push({
        type: 'missing_required',
        severity: 'error',
        message: `Missing ${missingRequired.length} required signals`
      });
    }

    return flags;
  }
}
```

---

## User Workflow Example

### Case: 6yo Supracondylar Fracture

1. **Clinician opens case**
   - Sees critical 20%:
     - Injury: 06:00
     - OR start: 14:30
     - Time to OR: 8.5h ✓ (<18h)
     - Neurovascular: Intact
     - Flag: Delay >6hrs (NPO protocol)

2. **Clinician reviews and asks LLM**:
   ```
   Q: "Why was there an 8 hour delay?"

   A: "According to the nursing intake note (timestamp 07:00):
       'Patient ate breakfast at 05:30. NPO protocol requires
       6-hour wait before anesthesia.'

       Calculated earliest surgery time: 11:30
       Actual surgery time: 14:30
       Additional delay: 3 hours (no reason documented)

       Source: encounter.nursing_notes.intake"
   ```

3. **Clinician asks followup**:
   ```
   Q: "Is there any documentation about the additional 3 hour delay?"

   A: "Not found in the record. No explanation documented for
       the period between 11:30 (earliest allowable time) and
       14:30 (actual OR start)."
   ```

4. **Clinician expands "Operative Details" group**
   - Sees all signals in that group
   - Notes procedure type, surgeon, etc.

5. **Clinician makes decision**:
   - Classification: Meets Standard (8.5h < 18h threshold)
   - Notes: "Delay justified by NPO protocol. Additional 3h delay undocumented but still within threshold."
   - Submits abstraction

**Time spent**: ~5 minutes (vs 30+ min manual)

---

## Summary: Key Differences from Previous Iterations

| Aspect | Previous Design (Iter 5) | NEW Copilot Design |
|--------|-------------------------|-------------------|
| **AI Role** | Auto-enriches, user approves | Answers questions, user drives |
| **Primary UI** | Signal review with badges | Critical 20% + Chat |
| **Workflow** | Verify AI decisions | Query and classify |
| **Decision Maker** | AI suggests → User accepts | User asks → AI finds → User decides |
| **Trust Model** | Confidence scores | Source citations |
| **Speed** | 3 min (if trust AI) | 5 min (understand case) |
| **Transparency** | Show AI decisions | Show LLM reasoning |

---

## Implementation Priority

### Phase 1 (Week 1-2): Core Review Workbench
1. CaseReviewWorkbench page
2. CriticalSignalsCard (20% display)
3. GroupedSignalsAccordion (80% expandable)
4. Wire to existing `signalLedger` data

### Phase 2 (Week 3-4): LLM Copilot
1. LLMCopilotChat component
2. Backend LLM service (query endpoint)
3. Citation extraction
4. Test with sample questions

### Phase 3 (Week 5): Decision & Submission
1. AbstractionDecisionForm
2. Submission workflow
3. Audit logging

### Phase 4 (Week 6): Polish
1. Mobile responsive
2. Error handling
3. Performance optimization
4. User testing

**Total**: 6 weeks to production

This design puts the **clinician in control** with **LLM as a tool**, not an autonomous agent.
