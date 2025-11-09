# HealthLevers Core Engine Architecture

## Overview
This document defines the core processing engine that powers the quality metrics abstraction workflow, independent of the UI.

---

## Complete Breadcrumb Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CASE INTAKE                                                  │
│    Input: Patient encounter data (JSON/HL7/FHIR)               │
│    Output: Normalized case object                              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. METRIC CLASSIFICATION                                        │
│    Input: Case data (age, specialty, diagnosis, procedure)     │
│    Logic: Match against metric applicability rules             │
│    Output: List of applicable metrics for this case            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. SIGNAL ENRICHMENT (Per Metric)                              │
│    Input: Case data + Metric configuration                     │
│    Process:                                                     │
│      a. Extract signals from case data (provenance rules)      │
│      b. Run AI enrichment for missing signals                  │
│      c. Validate signal values                                 │
│    Output: Enriched signal set with confidence scores          │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. SIGNAL GROUPING                                              │
│    Input: Enriched signals                                     │
│    Logic: Group signals by signal_group metadata               │
│    Output: Grouped signals (e.g., "Demographics", "Clinical")  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. FOLLOW-UP GENERATION                                         │
│    Input: Enriched signals + followup metadata                 │
│    Logic:                                                       │
│      a. Evaluate conditional followups (when_cond)             │
│      b. Generate dynamic followups based on signal values      │
│      c. Apply AI to generate clarifying questions              │
│    Output: List of followup questions for abstractor           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. PERSISTENCE                                                  │
│    Save to database:                                           │
│      - case_instance (encounter metadata)                      │
│      - case_signal_value (all enriched signals)                │
│      - case_followup_response (generated questions)            │
│    Output: Case ID for tracking                                │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. ABSTRACTOR REVIEW (UI Layer - comes later)                  │
│    Present: Grouped signals + followups                        │
│    Collect: User corrections/answers                           │
│    Save: Final abstracted data                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Test Mode vs Production Mode

### Test Mode
- **Purpose**: Development, testing, demos
- **Data Source**: Test JSON files in `/test-data/cases/*.json`
- **Enrichment**: Mock AI responses (fast, deterministic)
- **Database**: Separate test schema or in-memory DB
- **Environment Variable**: `NODE_ENV=test` or `MODE=test`

### Production Mode
- **Purpose**: Real abstraction workflow
- **Data Source**: HL7 feeds, FHIR API, manual entry
- **Enrichment**: Real AI API calls (GPT-4, Claude)
- **Database**: Production PostgreSQL
- **Environment Variable**: `NODE_ENV=production`

**Configuration**:
```typescript
// server/config/mode.ts
export const CONFIG = {
  mode: process.env.MODE || 'test',
  dataSource: {
    test: './test-data/cases',
    production: process.env.DATA_SOURCE_URL
  },
  enrichment: {
    test: 'mock',
    production: 'openai'
  },
  database: {
    test: process.env.TEST_DATABASE_URL,
    production: process.env.DATABASE_URL
  }
};
```

---

## Core Services (Independent Modules)

### 1. CaseClassifier
**Responsibility**: Determine which metrics apply to a case

```typescript
// server/services/caseClassifier.ts

interface CaseInput {
  patientAge: number;
  admissionDate: string;
  specialty: string;
  diagnosis: string[];
  procedures: string[];
}

interface ApplicableMetric {
  metricId: string;
  metricName: string;
  confidence: number; // 0-1 score
  reason: string; // Why this metric applies
}

class CaseClassifier {
  async classifyCase(caseData: CaseInput): Promise<ApplicableMetric[]> {
    // 1. Filter by specialty
    // 2. Check diagnosis codes against metric applicability rules
    // 3. Check age/date constraints
    // 4. Return ranked list of applicable metrics
  }
}
```

### 2. SignalEnricher
**Responsibility**: Extract and enrich signals for a metric

```typescript
// server/services/signalEnricher.ts

interface EnrichmentInput {
  caseData: CaseInput;
  metricId: string;
  mode: 'test' | 'production';
}

interface EnrichedSignal {
  signalCode: string;
  signalName: string;
  value: any;
  confidence: number;
  source: 'extracted' | 'ai_enriched' | 'manual';
  provenance: string; // Source field path
}

class SignalEnricher {
  async enrichSignals(input: EnrichmentInput): Promise<EnrichedSignal[]> {
    // 1. Load provenance rules for metric
    // 2. Extract signals from case data (direct mapping)
    // 3. Identify missing signals
    // 4. Run AI enrichment for missing signals (if mode=production)
    // 5. Return complete signal set
  }
}
```

### 3. SignalGrouper
**Responsibility**: Organize signals into display groups

```typescript
// server/services/signalGrouper.ts

interface GroupedSignals {
  [groupName: string]: EnrichedSignal[];
}

class SignalGrouper {
  async groupSignals(
    metricId: string,
    signals: EnrichedSignal[]
  ): Promise<GroupedSignals> {
    // 1. Load signal_group metadata for metric
    // 2. Map each signal to its group
    // 3. Return organized structure
  }
}
```

### 4. FollowupGenerator
**Responsibility**: Generate followup questions

```typescript
// server/services/followupGenerator.ts

interface FollowupQuestion {
  followupId: string;
  questionText: string;
  responseType: 'text' | 'boolean' | 'date' | 'number';
  required: boolean;
  triggeredBy: string[]; // Signal codes that triggered this
}

class FollowupGenerator {
  async generateFollowups(
    metricId: string,
    signals: EnrichedSignal[]
  ): Promise<FollowupQuestion[]> {
    // 1. Load followup metadata for metric
    // 2. Evaluate conditional followups (when_cond)
    // 3. Run AI to generate dynamic followups
    // 4. Return list of questions for abstractor
  }
}
```

### 5. CasePersistence
**Responsibility**: Save case processing results

```typescript
// server/services/casePersistence.ts

interface ProcessedCase {
  caseId: string;
  metricId: string;
  signals: EnrichedSignal[];
  groupedSignals: GroupedSignals;
  followups: FollowupQuestion[];
  status: 'enriched' | 'under_review' | 'completed';
}

class CasePersistence {
  async saveCase(processedCase: ProcessedCase): Promise<string> {
    // 1. Insert into case_instance
    // 2. Insert signals into case_signal_value
    // 3. Insert followups into case_followup_response
    // 4. Return case ID
  }

  async loadCase(caseId: string): Promise<ProcessedCase> {
    // Retrieve all data for a case
  }
}
```

---

## Core Orchestrator (Wires Everything Together)

```typescript
// server/services/caseProcessor.ts

class CaseProcessor {
  private classifier: CaseClassifier;
  private enricher: SignalEnricher;
  private grouper: SignalGrouper;
  private followupGen: FollowupGenerator;
  private persistence: CasePersistence;

  async processCase(caseData: CaseInput, mode: 'test' | 'production'): Promise<ProcessedCase[]> {
    // 1. Classify case to get applicable metrics
    const applicableMetrics = await this.classifier.classifyCase(caseData);

    const results: ProcessedCase[] = [];

    // 2. For each applicable metric
    for (const metric of applicableMetrics) {
      // 3. Enrich signals
      const signals = await this.enricher.enrichSignals({
        caseData,
        metricId: metric.metricId,
        mode
      });

      // 4. Group signals
      const groupedSignals = await this.grouper.groupSignals(
        metric.metricId,
        signals
      );

      // 5. Generate followups
      const followups = await this.followupGen.generateFollowups(
        metric.metricId,
        signals
      );

      // 6. Persist
      const caseId = await this.persistence.saveCase({
        caseId: `case_${Date.now()}`,
        metricId: metric.metricId,
        signals,
        groupedSignals,
        followups,
        status: 'enriched'
      });

      results.push({
        caseId,
        metricId: metric.metricId,
        signals,
        groupedSignals,
        followups,
        status: 'enriched'
      });
    }

    return results;
  }
}
```

---

## API Endpoints (Thin Layer Over Core Services)

```typescript
// server/routes/cases.ts

// POST /api/cases/process
// Process a new case
router.post('/process', async (req, res) => {
  const { caseData, mode } = req.body;
  const processor = new CaseProcessor();
  const results = await processor.processCase(caseData, mode || 'test');
  res.json(results);
});

// GET /api/cases/:caseId
// Retrieve processed case
router.get('/:caseId', async (req, res) => {
  const persistence = new CasePersistence();
  const caseData = await persistence.loadCase(req.params.caseId);
  res.json(caseData);
});
```

---

## Test Data Structure

```json
// test-data/cases/ortho-supracondylar-6yo.json
{
  "patientAge": 6,
  "admissionDate": "2024-01-15T08:30:00Z",
  "specialty": "Ortho",
  "diagnosis": ["S42.411A"], // Supracondylar fracture ICD-10
  "procedures": ["ORIF"],
  "clinicalData": {
    "injuryTime": "2024-01-15T06:00:00Z",
    "edArrivalTime": "2024-01-15T07:00:00Z",
    "orStartTime": "2024-01-15T14:30:00Z",
    "fractureType": "displaced",
    "neurovascularStatus": "intact"
  }
}
```

---

## Implementation Plan

### Phase 1: Core Services (No UI)
1. ✅ Database schema (already done)
2. Create CaseClassifier service
3. Create SignalEnricher service (test mode only)
4. Create SignalGrouper service
5. Create FollowupGenerator service (basic rules)
6. Create CasePersistence service
7. Create CaseProcessor orchestrator
8. Write unit tests for each service

### Phase 2: API Layer
1. Create REST endpoints for case processing
2. Add mode switching (test/production)
3. Create test data fixtures
4. Integration tests with test data

### Phase 3: UI Wiring (Later)
1. Connect MetricSelector to case classification
2. Create signal review UI
3. Create followup question UI
4. Connect save/submit to persistence

### Phase 4: Production Features
1. Add real AI enrichment
2. Add HL7/FHIR parsers
3. Add production data connectors
4. Add audit logging

---

## Next Steps

1. Do you want me to start implementing the core services?
2. Should we create test JSON files for common case scenarios?
3. Any specific business logic for CaseClassifier we should know?

This approach lets us:
- ✅ Build and test core logic independently
- ✅ Switch between test/production easily
- ✅ Wire UI later without changing core services
- ✅ Run automated tests on core engine
