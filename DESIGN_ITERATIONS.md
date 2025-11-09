# HealthLevers Design Iterations
## Finding the Optimal Architecture Through 5 Conceptual Iterations

---

## Iteration 1: Traditional Manual Abstraction (The Old Way)

### Concept
Replicate the paper-based abstraction process digitally. Abstractor manually fills out forms.

### Architecture
```
User selects metric → Empty form loads → User reads chart →
User fills each field → User submits → Done
```

### Data Flow
```
┌─────────────┐
│ Metric List │
└──────┬──────┘
       │ User picks ORTHO_I25
       ▼
┌────────────────────────────┐
│ Empty Form                 │
│ ┌────────────────────────┐ │
│ │ Patient Age: [____]    │ │
│ │ Injury Time: [____]    │ │
│ │ OR Start:    [____]    │ │
│ │ ...                    │ │
│ └────────────────────────┘ │
└────────────────────────────┘
       │ User types everything manually
       ▼
┌──────────────┐
│ Submission   │
└──────────────┘
```

### Pros
- ✅ Simple to understand
- ✅ Full user control
- ✅ Matches current paper workflow

### Cons
- ❌ Extremely slow (30-60 minutes per case)
- ❌ High error rate (typos, transcription errors)
- ❌ Doesn't leverage EHR data
- ❌ No AI assistance
- ❌ Abstractor must know which metric to pick
- ❌ Repetitive data entry

### Key Insight
**This is what we're replacing.** Pure manual work is too slow and error-prone for modern healthcare.

---

## Iteration 2: AI-First Black Box (Opposite Extreme)

### Concept
AI does everything. Human just approves or rejects the final result.

### Architecture
```
Case arrives → AI processes everything → Human sees final answer →
Approve/Reject → Done
```

### Data Flow
```
┌─────────────────┐
│ Case: 6yo SCH   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ AI Processing (Black Box)          │
│ • Classify metrics                 │
│ • Extract all signals              │
│ • Answer all questions             │
│ • Calculate result                 │
└────────┬────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Final Result                       │
│ "ORTHO_I25: PASS (8.5 hrs to OR)" │
│                                    │
│ [✓ Approve]  [✗ Reject]           │
└────────────────────────────────────┘
```

### Pros
- ✅ Very fast
- ✅ Consistent results
- ✅ No manual data entry

### Cons
- ❌ Zero transparency ("Why did AI say this?")
- ❌ No human oversight at signal level
- ❌ Can't correct individual errors
- ❌ Regulatory issues (who is accountable?)
- ❌ AI hallucinations can't be caught
- ❌ Users don't trust it
- ❌ All-or-nothing (can't partially accept)

### Key Insight
**Pure AI is too opaque.** Healthcare requires human accountability and transparency. Need to see HOW the answer was derived.

---

## Iteration 3: Signal-Centric with AI Enrichment (Hybrid)

### Concept
Show every signal individually. AI pre-fills what it can find. Human reviews and corrects each one.

### Architecture
```
Case arrives → AI enriches signals → Human reviews EACH signal →
Manual questions → Submit
```

### Data Flow
```
┌─────────────────┐
│ Case: 6yo SCH   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ AI Enrichment                           │
│ • patient_age: 6 (from EHR) ✓          │
│ • injury_time: 06:00 (from EHR) ✓      │
│ • or_start: 14:30 (from EHR) ✓         │
│ • fracture_type: "displaced" (AI) ⚠️   │
│ • neuro_status: NULL (missing) ❌       │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Signal Review (ONE BY ONE)              │
│ ┌─────────────────────────────────────┐ │
│ │ 1. Patient Age: 6 ✓                 │ │
│ │    [Accept]                         │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 2. Injury Time: 06:00 ✓             │ │
│ │    [Accept]                         │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 3. Fracture Type: "displaced" ⚠️    │ │
│ │    Source: AI (85% confidence)      │ │
│ │    [Accept] [Edit] [Reject]         │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 4. Neuro Status: [ENTER VALUE] ❌   │ │
│ │    Required field                   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Followup Questions                      │
│ "What was mechanism of injury?"         │
│ [User types answer]                     │
└─────────────────────────────────────────┘
         │
         ▼
┌──────────────┐
│ Submit       │
└──────────────┘
```

### Pros
- ✅ Full transparency (see every signal)
- ✅ Human in the loop for every decision
- ✅ AI speeds up extraction
- ✅ Clear confidence scores
- ✅ Can accept/reject individually
- ✅ Regulatory compliant

### Cons
- ⚠️ Still somewhat slow (review 20+ signals per case)
- ⚠️ Cognitive load (which signals need attention?)
- ⚠️ No context about WHY signals matter
- ⚠️ Flat list (all signals equal weight)

### Key Insight
**This is close, but needs better organization.** Reviewing 20+ flat signals is overwhelming. Need grouping and prioritization.

---

## Iteration 4: Grouped Signals with Smart Defaults

### Concept
Group related signals. Show AI-enriched ones first. Let user skip verified ones.

### Architecture
```
Case arrives → AI enriches & groups signals → Show groups with smart defaults →
User focuses on uncertain/missing → Followups → Submit
```

### Data Flow
```
┌─────────────────┐
│ Case: 6yo SCH   │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ AI Enrichment + Grouping                 │
│                                          │
│ Demographics Group (3 signals):          │
│   • patient_age: 6 ✓                    │
│   • patient_weight: 20.5kg ⚠️ (AI 75%)  │
│   • patient_gender: M ✓                 │
│                                          │
│ Clinical Group (4 signals):              │
│   • fracture_type: "displaced" ⚠️       │
│   • neuro_status: NULL ❌                │
│   • vascular_status: "intact" ✓         │
│   • skin_integrity: "closed" ✓          │
│                                          │
│ Timing Group (3 signals):                │
│   • injury_time: 06:00 ✓                │
│   • ed_arrival: 07:00 ✓                 │
│   • or_start: 14:30 ✓                   │
│   → Calculated: time_to_or = 8.5h ✓     │
└──────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ Smart Review UI                          │
│                                          │
│ [Demographics ✓] [Clinical ⚠️] [Timing ✓]│
│                                          │
│ Attention Needed (2):                    │
│ ┌────────────────────────────────────┐   │
│ │ ⚠️ Patient Weight (AI 75%)         │   │
│ │   20.5 kg                          │   │
│ │   [Accept] [Edit]                  │   │
│ └────────────────────────────────────┘   │
│ ┌────────────────────────────────────┐   │
│ │ ❌ Neuro Status (Missing)          │   │
│ │   [Add Value]                      │   │
│ └────────────────────────────────────┘   │
│                                          │
│ Auto-Verified (8):                       │
│ • Patient age: 6 ✓                      │
│ • Injury time: 06:00 ✓                  │
│ • OR start: 14:30 ✓                     │
│ ... [Show All]                          │
│                                          │
│ Quality Check:                           │
│ ✅ Time to OR: 8.5 hrs (threshold <18h) │
└──────────────────────────────────────────┘
```

### Pros
- ✅ Reduces cognitive load (focus on problems)
- ✅ Groups provide context
- ✅ Auto-verified signals can be skipped
- ✅ Shows quality result in real-time
- ✅ Fast for clean cases (just review exceptions)

### Cons
- ⚠️ User might miss auto-verified errors
- ⚠️ Still need to know when to look at "Show All"
- ⚠️ Grouping logic must be good

### Key Insight
**Getting closer! But need progressive disclosure.** Don't hide verified signals, but don't force review. Let user drill down if needed.

---

## Iteration 5: Progressive Disclosure with Context-Aware Workflow ⭐

### Concept
**Start with the outcome, work backwards to details.**

Show the quality result FIRST. Then let user drill into signals ONLY when they need to verify or are uncertain.

### Architecture
```
Case arrives → AI processes → Show RESULT first → User drills into details as needed →
Context-aware followups → One-click submit if all green
```

### Data Flow
```
┌─────────────────────────────────────────┐
│ Case Dashboard (Landing Screen)        │
│                                         │
│ ENC_12345 | 6yo Male | Ortho           │
│ Supracondylar fracture                 │
│                                         │
│ Metric: ORTHO_I25                      │
│ Question: I25 - In OR <18 hrs          │
│                                         │
│ ┌─────────────────────────────────┐    │
│ │ ✅ QUALITY RESULT: PASS         │    │
│ │                                 │    │
│ │ Time to OR: 8.5 hours           │    │
│ │ Threshold: <18 hours            │    │
│ │ Confidence: 95%                 │    │
│ └─────────────────────────────────┘    │
│                                         │
│ Signal Summary:                         │
│ • 8 verified ✓                         │
│ • 1 AI-enriched (needs review) ⚠️      │
│ • 1 missing (action required) ❌        │
│                                         │
│ [Review Signals] [Skip to Submit]      │
└─────────────────────────────────────────┘
         │                        │
         │ User wants details     │ User trusts it
         ▼                        ▼
┌──────────────────┐      ┌──────────────┐
│ Signal Review    │      │ Quick Submit │
│ (Iteration 4 UI) │      └──────────────┘
└──────────────────┘
```

### Detailed Signal Review (When User Clicks)
```
┌─────────────────────────────────────────────┐
│ Signal Review - ORTHO_I25                   │
│                                             │
│ [Demographics ✓] [Clinical ⚠️] [Timing ✓]  │
│                                             │
│ Clinical Signals                            │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Fracture Type                       ⚠️  │ │
│ │ "Displaced"                             │ │
│ │                                         │ │
│ │ 📊 Confidence: 85%                      │ │
│ │ 🔍 Source: AI extracted from:           │ │
│ │    "Radiology report: displaced         │ │
│ │     supracondylar fracture with..."     │ │
│ │    [View Full Evidence]                 │ │
│ │                                         │ │
│ │ ✓ Looks correct                         │ │
│ │ [Accept] [Edit] [Flag for Review]       │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Neurovascular Status                ❌  │ │
│ │ Required - Not Found in Chart           │ │
│ │                                         │ │
│ │ 💡 AI Suggestion:                       │ │
│ │    Found in nursing note:               │ │
│ │    "Neurovascular exam intact"          │ │
│ │                                         │ │
│ │ [Accept "Intact"] [Enter Different]     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Demographics & Timing (8 signals)           │
│ All verified ✓ [Expand to review]           │
│                                             │
│ [Save & Continue]                           │
└─────────────────────────────────────────────┘
```

### Context-Aware Followup Generation
```
┌─────────────────────────────────────────────┐
│ Follow-up Questions (2 generated)           │
│                                             │
│ Based on your signals, we need:             │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 1. Mechanism of Injury?                 │ │
│ │                                         │ │
│ │ 💡 Why asking: Patient age <10          │ │
│ │                                         │ │
│ │ AI found: "fell from monkey bars"       │ │
│ │ [Accept] [Edit]                         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 2. Surgery delayed due to patient       │ │
│ │    factors?                             │ │
│ │                                         │ │
│ │ 💡 Why asking: Time to OR >8 hours      │ │
│ │                                         │ │
│ │ ( ) Yes → [Explain]                     │ │
│ │ (•) No                                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Submit Case]                               │
└─────────────────────────────────────────────┘
```

### Final Review (Before Submit)
```
┌─────────────────────────────────────────────┐
│ Case Summary - Ready to Submit?             │
│                                             │
│ Patient: 6yo Male | ENC_12345               │
│ Metric: ORTHO_I25 - In OR <18 hrs          │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ ✅ MEETS QUALITY STANDARD               │ │
│ │ Surgery completed in 8.5 hours          │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Data Sources:                               │
│ • 8 signals from EHR ✓                     │
│ • 1 AI-enriched (accepted) ⚠️              │
│ • 1 manual entry ✏️                        │
│ • 2 followup responses ✏️                  │
│                                             │
│ Abstractor: Jane Doe                        │
│ Time spent: 3 minutes                       │
│                                             │
│ [← Edit] [Submit & Close Case]              │
└─────────────────────────────────────────────┘
```

### Pros
- ✅ **Fast for clean cases** (3 min vs 30 min)
- ✅ **Outcome-first** (see result immediately)
- ✅ **Progressive disclosure** (details on demand)
- ✅ **Context-aware** (explains WHY each question matters)
- ✅ **Trust through transparency** (show evidence/sources)
- ✅ **Smart defaults** (AI suggestions, not mandates)
- ✅ **Flexible** (can drill deep or accept quickly)
- ✅ **Quality feedback** (real-time calculation)
- ✅ **Audit trail** (tracks data sources)

### Cons
- ⚠️ Requires sophisticated AI (evidence extraction, confidence scoring)
- ⚠️ Users might over-trust and skip review
- ⚠️ Need good error handling for AI failures

### Key Insight
**This is the winner.** It respects user expertise (can drill into details) while maximizing efficiency (smart defaults for clean cases).

---

## Comparison Matrix

| Aspect | Iteration 1 | Iteration 2 | Iteration 3 | Iteration 4 | Iteration 5 ⭐ |
|--------|-------------|-------------|-------------|-------------|---------------|
| **Speed** | ❌ 30-60 min | ✅ <1 min | ⚠️ 10-15 min | ✅ 3-5 min | ✅ 3 min (clean) / 10 min (complex) |
| **Accuracy** | ⚠️ Human errors | ⚠️ AI errors | ✅ Human verified | ✅ Human verified | ✅ Human verified |
| **Transparency** | ✅ Full | ❌ None | ✅ Full | ✅ Full | ✅ Full + context |
| **User Trust** | ✅ High | ❌ Low | ✅ High | ✅ High | ✅ Very high |
| **Cognitive Load** | ❌ Very high | ✅ Very low | ⚠️ High | ✅ Low | ✅ Very low |
| **Flexibility** | ✅ Full control | ❌ No control | ✅ Full control | ✅ Full control | ✅ Full control |
| **Regulatory** | ✅ Compliant | ❌ Questionable | ✅ Compliant | ✅ Compliant | ✅ Compliant |
| **Scalability** | ❌ Poor | ✅ Excellent | ⚠️ Moderate | ✅ Good | ✅ Excellent |
| **Learning Curve** | ✅ Easy | ✅ Easy | ⚠️ Moderate | ⚠️ Moderate | ✅ Easy |

---

## Design Principles (Distilled from Iterations)

### 1. **Outcome-First, Details-On-Demand**
Don't make users hunt for the answer. Show the quality result FIRST, then let them verify the underlying data.

### 2. **Trust Through Transparency**
Every AI decision must show:
- What was decided
- How confident (%)
- What evidence supports it
- How to override it

### 3. **Progressive Disclosure**
- Show summary by default
- Expand to groups
- Drill to individual signals
- View raw evidence

### 4. **Context-Aware Intelligence**
Don't just ask questions. Explain WHY:
- "We're asking this because patient age <10"
- "This matters for calculating time to OR"

### 5. **Smart Defaults, Not Mandates**
AI should suggest, never force:
- "We found 'intact' in the nursing note" [Accept] [Edit]
- NOT: "Neurovascular status: Intact (locked)"

### 6. **Respect User Expertise**
Power users should be able to:
- Skip AI suggestions
- Drill into raw data
- Override anything
- See provenance for everything

### 7. **Optimize for the Common Case**
- 80% of cases should be clean (3 min review)
- 20% of cases need deep review (10-15 min)
- Don't slow down the 80% to accommodate the 20%

---

## Recommended Architecture (Iteration 5)

### Component Hierarchy
```
CaseDashboard (Landing)
├─ ResultCard (outcome first)
│  ├─ Quality result (pass/fail)
│  ├─ Key metric (8.5 hrs)
│  └─ Confidence score
├─ SignalSummary (collapsed by default)
│  ├─ Count: 8 verified, 1 AI, 1 missing
│  └─ [Expand to review]
└─ Actions
   ├─ [Review Signals] (if uncertain)
   └─ [Quick Submit] (if confident)

SignalReviewPage (On demand)
├─ GroupedSignalTabs
│  ├─ Demographics ✓
│  ├─ Clinical ⚠️
│  └─ Timing ✓
└─ SignalCards (prioritized)
   ├─ Attention Needed (top)
   │  ├─ Missing signals ❌
   │  └─ AI-enriched <90% ⚠️
   └─ Verified (collapsed)
      └─ [Expand to review]

FollowupPage (Context-aware)
├─ For each question:
│  ├─ Question text
│  ├─ "Why we're asking" (trigger)
│  ├─ AI suggestion (if found)
│  └─ User input/accept

ReviewPage (Final check)
├─ Quality result
├─ Data source summary
├─ Time spent
└─ Submit button
```

### Data Flow
```
1. Case arrives
   ↓
2. Background: AI enriches all signals
   ↓
3. Show: Result Card (outcome)
   ↓
4. User: Reviews summary
   ├─ Confident? → Skip to followups
   └─ Uncertain? → Review signals
   ↓
5. User: Answers followups (with AI suggestions)
   ↓
6. User: Final review
   ↓
7. Submit (3 min total for clean case)
```

### API Design
```typescript
// Single enrichment endpoint
POST /api/cases/:caseId/enrich
→ Returns complete enriched case with:
  - Applicable metrics
  - All signals (with confidence & sources)
  - Quality result
  - Generated followup questions
  - Evidence citations

// User actions
PUT /api/cases/:caseId/signals/:signalCode/accept
PUT /api/cases/:caseId/signals/:signalCode/edit
PUT /api/cases/:caseId/followups/:followupId/answer
POST /api/cases/:caseId/submit
```

---

## Implementation Roadmap

### Phase 1: Proof of Concept (1-2 weeks)
1. Build CaseDashboard with mock data
2. Build ResultCard (show quality outcome)
3. Build SignalSummary (collapsed/expanded states)
4. Build SignalReviewPage (grouped tabs)
5. Wire to existing `signalLedger` table

### Phase 2: AI Enrichment (2-3 weeks)
1. Implement signal extraction from `encounterContext`
2. Implement AI enrichment service
3. Add confidence scoring
4. Add evidence extraction
5. Wire to `aiRun` / `aiResponse` tables

### Phase 3: Followups & Completion (1 week)
1. Implement conditional followup logic
2. Build FollowupPage with context
3. Build ReviewPage
4. Implement submission workflow

### Phase 4: Polish (1 week)
1. Mobile responsive
2. Loading states
3. Error handling
4. Accessibility
5. Performance optimization

**Total: 5-7 weeks to production**

---

## Success Metrics

### User Metrics
- Average time per case: <5 min (vs 30-60 min baseline)
- User acceptance rate of AI suggestions: >80%
- Error rate: <2% (vs 5-10% manual baseline)
- User satisfaction: >4.5/5

### System Metrics
- AI confidence >90%: 70% of signals
- Cases requiring deep review: <20%
- API response time: <500ms for enrichment
- Uptime: >99.9%

### Business Metrics
- Cases per abstractor per day: 50+ (vs 10-15 baseline)
- Cost per case: $5 (vs $25 manual)
- Time to results: Same day (vs 3-5 days)

---

## Conclusion

**Iteration 5 is the optimal design** because it:

1. ✅ **Maximizes efficiency** (3 min for clean cases)
2. ✅ **Maintains accuracy** (human verification)
3. ✅ **Builds trust** (transparency + evidence)
4. ✅ **Reduces cognitive load** (outcome-first, progressive disclosure)
5. ✅ **Scales** (AI handles 80%, human handles exceptions)
6. ✅ **Regulatory compliant** (audit trail, human accountability)
7. ✅ **Flexible** (works for simple AND complex cases)

This is the architecture we should build.
