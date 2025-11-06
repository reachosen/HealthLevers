# Schema Design Comparison & Strategic Recommendations
## Evaluating v4 Schema Proposal vs. HealthLevers Requirements

---

## Executive Summary

**Verdict: The proposed v4 schema will NOT serve the HealthLevers project well in its current form.**

### Critical Issues:
1. ❌ **Platform mismatch**: Designed for Snowflake, but HealthLevers uses PostgreSQL
2. ❌ **Terminology mismatch**: "Encounters" vs. "Cases" - fundamentally different concepts
3. ❌ **Missing core entities**: No Patients, Specialties, Modules, or Followup Questions
4. ❌ **Incomplete signal tracking**: No evidence/cites table (critical for AI transparency)
5. ❌ **Overly complex**: Assumes mature data platform, but project stores data in localStorage

### What to Do Instead:
✅ Implement the **PostgreSQL-native schema** in `RECOMMENDED_SCHEMA_DESIGN.md`
✅ Follow the **3-phase migration** from localStorage to database
✅ Start with **core tables** (patients, cases, case_payloads, specialties, modules)
✅ Add **signal tracking** (signal_definitions, abstraction_runs, abstraction_results, signal_evidence)

---

## Detailed Comparison

### 1. Database Platform

| Aspect | Proposed v4 | HealthLevers Reality |
|--------|-------------|----------------------|
| **Database** | Snowflake | PostgreSQL (Neon serverless) |
| **ORM** | None (procedural SQL) | Drizzle ORM (TypeScript-first) |
| **Type System** | VARIANT (Snowflake) | JSONB (PostgreSQL) |
| **Identity Columns** | IDENTITY | SERIAL / UUID with gen_random_uuid() |
| **Secure Views** | CREATE SECURE VIEW | Row-level security policies / roles |
| **Clustering** | CLUSTER BY | CREATE INDEX / partial indexes |

**Impact**: All DDL statements in v4 would fail on PostgreSQL. Complete rewrite needed.

---

### 2. Data Model Conceptual Differences

#### Proposed v4: Encounter-Centric

```
Patient → Encounter → Episode → AI Run → Signals
         (admits/ED)  (multi-enc)
```

**Assumptions:**
- Encounters are primary unit (ED visits, admits)
- Episodes link multiple encounters
- Encounter context is core table
- `encounter_id` + `encounter_key` for dual-keying

#### HealthLevers Reality: Case-Centric

```
Patient → Case → AI Processing → Signals → Review
         (abstraction unit)
```

**Reality:**
- **Cases** are the primary unit (not encounters)
- Each case represents a quality abstraction question
- Cases have embedded encounter data (nested JSON)
- `case.id` is the primary key (e.g., "E12345")
- No episode tracking - single encounter per case

**Example from `sampleCase.USNWR_SCH.json`:**
```json
{
  "id": "E12345",  // ← This is the CASE ID
  "patient": { "mrn": "00112233", "name": "J. Doe", "age": 7 },
  "encounter": {   // ← Encounter is nested WITHIN the case
    "id": "E12345",
    "location": "ED",
    "disposition": "Admit"
  },
  // ... rest of clinical data
}
```

**The v4 schema reverses this**: It treats encounters as primary and would lose the case-centric abstraction workflow.

---

### 3. Missing Core Entities

| Entity | In v4 Schema? | HealthLevers Needs It? | Why Critical |
|--------|---------------|------------------------|--------------|
| **Patients** | ❌ No | ✅ Yes | Separate from cases; tracks MRN, demographics |
| **Specialties** | ❌ No | ✅ Yes | 8 specialties hardcoded in `routes.ts:120` |
| **Modules** | ❌ No | ✅ Yes | 11 orthopedics modules in `specialtyMetadata.ts:30` |
| **Signal Definitions** | ⚠️ Partial | ✅ Yes | 483+ signals in `orthoSignalMatrix.ts` need to be database-driven |
| **Followup Questions** | ❌ No | ✅ Yes | Module-specific questions in `planningConfig.tsx:120` |
| **Evidence/Cites** | ❌ No | ✅ CRITICAL | AI must cite data sources; `signal.cites` in current app |
| **Prompts** | ⚠️ Partial | ✅ Yes | Versioned prompts in `promptStore.ts:20` |
| **Feedback** | ⚠️ Minimal | ✅ Yes | User feedback on AI signals |

**Impact**: v4 schema cannot support the current application workflow without major additions.

---

### 4. Table-by-Table Comparison

#### CORE__ENCOUNTER_CONTEXT (v4) vs. cases + case_payloads (HealthLevers)

| Feature | v4: CORE__ENCOUNTER_CONTEXT | HealthLevers: cases + case_payloads |
|---------|------------------------------|-------------------------------------|
| **Primary Key** | encounter_id (STRING) | cases.id (UUID) |
| **Display ID** | encounter_key | cases.case_number (e.g., "E12345") |
| **Patient Link** | patient_key (no FK) | cases.patient_id (FK to patients) |
| **Clinical Data** | context VARIANT | case_payloads.payload (JSONB) |
| **Specialty/Module** | ❌ Not tracked | cases.specialty_id + module_id |
| **Status** | ❌ Not tracked | cases.status (DRAFT/IN_PROGRESS/REVIEWED) |
| **Assignment** | ❌ Not tracked | cases.assigned_to, reviewed_by |
| **Audit** | created_ts only | created_at, updated_at, created_by, updated_by |

**Winner**: HealthLevers schema - more detailed workflow tracking, proper foreign keys, audit trail.

---

#### CORE__EPISODE_MAP (v4) vs. (Not Needed in HealthLevers)

| Feature | v4: CORE__EPISODE_MAP | HealthLevers |
|---------|------------------------|--------------|
| **Purpose** | Link multiple encounters into episodes | ❌ Not needed - single encounter per case |
| **Use Case** | Patient readmissions, multi-visit care | Quality abstraction is per-case, not longitudinal |

**Winner**: HealthLevers doesn't need this. Each case is self-contained.

---

#### OPS__ENCOUNTER_CASE (v4) vs. case_reviews (HealthLevers)

| Feature | v4: OPS__ENCOUNTER_CASE | HealthLevers: case_reviews |
|---------|-------------------------|----------------------------|
| **Primary Key** | encounter_id (FK) | id (UUID), case_id (FK) |
| **State** | case_state (OPEN/IN_REVIEW/CLOSED) | review_status (PENDING/IN_PROGRESS/COMPLETED/REJECTED) |
| **Comments** | state_comment (single field) | reviewer_comment + clinical_notes |
| **History** | ❌ No versioning | ✅ Multiple reviews per case possible |
| **Metrics** | ❌ None | signals_correct, signals_incorrect, signals_modified |
| **Assignment** | updated_by | assigned_to + reviewed_by (separate) |

**Winner**: HealthLevers schema - richer workflow, quality metrics, multi-review support.

---

#### ENRICH__AI_RUN (v4) vs. abstraction_runs (HealthLevers)

| Feature | v4: ENRICH__AI_RUN | HealthLevers: abstraction_runs |
|---------|---------------------|--------------------------------|
| **Run ID** | run_id | id (UUID) |
| **Foreign Key** | encounter_id + encounter_key | case_id (FK to cases) |
| **Prompt** | prompt_id + prompt_version | prompt_version_id (FK to prompt_versions) |
| **Input** | input_snapshot VARIANT + input_hash | input_payload JSONB + input_hash |
| **Model** | model_id + params VARIANT | model_name + model_params JSONB |
| **Status** | status | status (with CANCELLED state) |
| **Metrics** | ❌ Not specified | tokens_prompt, tokens_completion, cost_usd, duration_ms |
| **Error Handling** | ❌ None | error_message field |

**Winner**: HealthLevers schema - better metrics, error handling, versioned prompts.

---

#### ENRICH__SIGNAL_LEDGER (v4) vs. abstraction_results + signal_evidence (HealthLevers)

| Feature | v4: ENRICH__SIGNAL_LEDGER | HealthLevers: abstraction_results + signal_evidence |
|---------|---------------------------|-----------------------------------------------------|
| **Granularity** | One row per signal | One row per signal (abstraction_results) + N rows for evidence (signal_evidence) |
| **Signal Value** | signal_value VARIANT | status (pass/fail/caution) + finding (text) + reason (text) |
| **Confidence** | confidence | confidence (0.00-1.00) |
| **Evidence** | ❌ Not tracked | ✅ signal_evidence table with field_path, field_value, excerpt |
| **Source** | ❌ Not tracked | source (AI/RULE/HUMAN) + is_enriched (boolean) |
| **Validation** | ❌ Not tracked | validated_by + validated_at |
| **Time Range** | start_ts + end_ts | created_at (signals are point-in-time) |

**Winner**: HealthLevers schema - **critical difference**. Evidence tracking is essential for AI transparency and debugging.

**Why Evidence Matters:**
- Users need to see **which data fields** the AI used to determine a signal
- Prevents hallucinations (AI citing non-existent data)
- Enables debugging ("Why did the AI fail this signal?")
- Required for regulatory compliance (show your work)

**Example from current app (`routes.ts:270`):**
```typescript
{
  signal: "on_time_19h",
  status: "pass",
  finding: "Surgery within 19 hours",
  cites: [
    "times.ArrivalInstant",
    "times.IncisionStartInstant",
    "derived.arrival_to_surgery_min"
  ]
}
```

The v4 schema has **no way to store these cites**. This is a critical gap.

---

#### PROMPT__DEF (v4) vs. prompts + prompt_versions (HealthLevers)

| Feature | v4: PROMPT__DEF | HealthLevers: prompts + prompt_versions |
|---------|-----------------|----------------------------------------|
| **Versioning** | version column | ✅ Separate prompt_versions table |
| **Routing** | ❌ Not specified | specialty_id + module_id + prompt_type (from `promptRouting.ts`) |
| **History** | ❌ Single row | ✅ Full version history |
| **Approval** | is_prod_approved | prompt_versions.status (DRAFT/TESTING/APPROVED/ARCHIVED) |
| **Ownership** | owner | owner_id (FK to users) |
| **Current Version** | ❌ Not tracked | prompts.current_version_id (FK) |

**Winner**: HealthLevers schema - proper versioning, routing keys, approval workflow.

---

#### EVAL__TEST_* (v4) vs. (Not Implemented Yet in HealthLevers)

| Feature | v4: Test Tables | HealthLevers |
|---------|-----------------|--------------|
| **Test Suites** | EVAL__TEST_SUITE | ⏸️ Deferred - test cases currently in JSON files |
| **Test Cases** | EVAL__TEST_CASE | ⏸️ Deferred - `testCases.json` |
| **Test Runs** | EVAL__TEST_RUN | ⏸️ Deferred |
| **Assertions** | EVAL__TEST_ASSERTION | ⏸️ Deferred |

**Winner**: Tie - both projects defer formal test management. HealthLevers uses JSON files for now.

---

### 5. Workflow Alignment

#### Current HealthLevers Workflow (`intake.tsx` → `home.tsx`)

```
1. User selects Specialty → Module → Case
2. User uploads/pastes patient JSON (or selects test case)
3. System calls /api/ai_signals (OpenAI GPT-4o)
4. AI returns signals with status + evidence + cites
5. User reviews signals in ModuleInlinePanel
6. User provides feedback or edits signals
7. Case saved to localStorage
```

#### How v4 Schema Would Handle This:

```
1. ❌ No specialties table - hardcoded
2. ❌ No modules table - hardcoded
3. ✅ CORE__ENCOUNTER_CONTEXT stores payload
4. ✅ ENRICH__AI_RUN tracks AI call
5. ⚠️ ENRICH__SIGNAL_LEDGER stores signals BUT NO CITES
6. ❌ No feedback table
7. ❌ No case status tracking
```

**Impact**: v4 schema cannot support steps 1, 2, 5, 6, 7 without major additions.

---

### 6. Data Migration Complexity

#### Migrating from localStorage to v4 Schema:

**localStorage structure:**
```typescript
{
  patient_payload: { /* full JSON */ },
  mergedSignals: [
    { id, label, status, evidence, group, enriched, cites }
  ],
  category_counts: { Core: 5, "Delay Drivers": 3 },
  selectedSpecialty: "Orthopedics",
  selectedModule: "timeliness_sch",
  selectedModuleId: "timeliness_sch",
  selectedCaseId: "E12345"
}
```

**Mapping to v4 tables:**
- ❌ `patient_payload` → CORE__ENCOUNTER_CONTEXT (but no patient FK)
- ⚠️ `mergedSignals[].id` → ENRICH__SIGNAL_LEDGER.signal_id (but must create ENRICH__SIGNAL_DEF first)
- ⚠️ `mergedSignals[].status` → ENRICH__SIGNAL_LEDGER.signal_value (but lose granularity)
- ❌ `mergedSignals[].cites` → **NO TABLE TO STORE THIS**
- ❌ `selectedSpecialty` → **NO TABLE**
- ❌ `selectedModule` → **NO TABLE**
- ❌ Case status → **NO TABLE**

**Result**: ~40% of localStorage data cannot be migrated without schema additions.

---

#### Migrating from localStorage to HealthLevers v1.0 Schema:

**Mapping:**
- ✅ `patient_payload.patient` → patients table
- ✅ `selectedCaseId` → cases.case_number
- ✅ `patient_payload` → case_payloads.payload
- ✅ `selectedSpecialty` → cases.specialty_id (FK to specialties)
- ✅ `selectedModule` → cases.module_id (FK to modules)
- ✅ AI processing → abstraction_runs
- ✅ `mergedSignals[]` → abstraction_results
- ✅ `mergedSignals[].cites` → signal_evidence
- ✅ Case status → cases.status

**Result**: 100% of localStorage data can be migrated. Clean migration path.

---

### 7. Extensibility & Future-Proofing

#### v4 Schema Extensibility:

| Feature | v4 Support | Notes |
|---------|------------|-------|
| **Add new specialty** | ❌ Code changes | No specialties table |
| **Add new module** | ❌ Code changes | No modules table |
| **Add new signal** | ⚠️ Manual INSERT | Must manually add to ENRICH__SIGNAL_DEF |
| **Change prompt** | ⚠️ Manual UPDATE | No versioning workflow |
| **Track evidence** | ❌ Cannot add | No cites table |
| **Multi-user workflow** | ⚠️ Limited | No assignment, only updated_by |
| **A/B test prompts** | ❌ Cannot | No version history |
| **Quality metrics** | ❌ Cannot | No feedback table |

#### HealthLevers v1.0 Extensibility:

| Feature | v1.0 Support | Notes |
|---------|--------------|-------|
| **Add new specialty** | ✅ INSERT INTO specialties | No code changes |
| **Add new module** | ✅ INSERT INTO modules | No code changes |
| **Add new signal** | ✅ INSERT INTO signal_definitions | Includes validation rules, cites config |
| **Change prompt** | ✅ New prompt version | Full version history |
| **Track evidence** | ✅ signal_evidence table | Built-in |
| **Multi-user workflow** | ✅ assigned_to + reviewed_by | Full workflow |
| **A/B test prompts** | ✅ prompt_versions | Compare versions |
| **Quality metrics** | ✅ feedback + audit_log | Built-in |

**Winner**: HealthLevers schema is metadata-driven and much more extensible.

---

### 8. Security & Compliance (PHI Handling)

#### v4 Schema:

| Aspect | v4 | Notes |
|--------|----|----- |
| **PHI Boundary** | CORE__* tables | Documented |
| **Encryption** | ❌ Not specified | No encryption fields |
| **Access Control** | Secure views (TEST/PROD) | Role-based access |
| **Audit Trail** | ❌ Minimal | Only created_ts, updated_by |
| **De-identification** | ❌ Not specified | No de-id fields |

#### HealthLevers v1.0:

| Aspect | v1.0 | Notes |
|--------|------|----- |
| **PHI Boundary** | patients, case_payloads | Clear separation |
| **Encryption** | ✅ name_encrypted field | Encrypt at rest |
| **Access Control** | PostgreSQL RLS policies | Row-level security |
| **Audit Trail** | ✅ audit_log table | Full change tracking |
| **De-identification** | ⚠️ Can add | mrn_deidentified field can be added |

**Winner**: HealthLevers schema is more compliance-ready.

---

## Strategic Recommendations

### ❌ DO NOT Use the Proposed v4 Schema

**Reasons:**
1. Platform incompatibility (Snowflake vs. PostgreSQL)
2. Conceptual mismatch (encounter-centric vs. case-centric)
3. Missing critical entities (patients, specialties, modules, evidence)
4. No migration path from current localStorage data
5. Limited extensibility (hardcoded metadata)
6. No evidence tracking (critical for AI transparency)

### ✅ DO Use the HealthLevers v1.0 Schema (RECOMMENDED_SCHEMA_DESIGN.md)

**Benefits:**
1. ✅ PostgreSQL-native (matches your database)
2. ✅ Drizzle ORM compatible (matches your ORM)
3. ✅ Case-centric (matches your app logic)
4. ✅ Includes all missing entities (patients, specialties, modules, evidence)
5. ✅ Clear migration path from localStorage
6. ✅ Metadata-driven (add specialties without code changes)
7. ✅ Evidence tracking (AI transparency)
8. ✅ Full audit trail (compliance-ready)

---

## Phased Implementation Plan

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Create core tables and establish dual-write pattern.

**Tasks:**
1. Create Drizzle migration: `0001_create_core_tables.ts`
   - patients
   - cases
   - case_payloads
   - specialties (seed data)
   - modules (seed from `specialtyMetadata.ts`)

2. Implement dual-write in `server/storage.ts`:
   ```typescript
   async saveCaseResult(caseData: ProcessedCase) {
     // WRITE 1: localStorage (existing)
     localStorage.setItem('abstraction.cases', JSON.stringify(cases));

     // WRITE 2: PostgreSQL (new)
     await db.insert(cases).values({ /* ... */ });
     await db.insert(case_payloads).values({ /* ... */ });
   }
   ```

3. Keep reads from localStorage (no API changes)

4. Test in development

**Success Criteria:**
- ✅ All new cases saved to both localStorage and database
- ✅ No user-facing changes
- ✅ Database populates correctly

---

### Phase 2: Signal Persistence (Weeks 3-4)

**Goal**: Persist AI signals and evidence.

**Tasks:**
1. Create migration: `0002_create_signal_tables.ts`
   - signal_definitions (seed from `orthoSignalMatrix.ts`)
   - abstraction_runs
   - abstraction_results
   - signal_evidence

2. Update `/api/ai_signals` endpoint:
   ```typescript
   // After AI call completes
   const run = await db.insert(abstraction_runs).values({
     caseId: caseId,
     promptVersionId: promptVersionId,
     modelName: 'gpt-4o',
     inputPayload: patientData,
     status: 'COMPLETED',
     rawResponse: aiResponse,
   }).returning();

   for (const signal of aiResponse.signals) {
     const result = await db.insert(abstraction_results).values({
       runId: run.id,
       caseId: caseId,
       signalId: signal.id,
       status: signal.status,
       finding: signal.finding,
       source: 'AI',
     }).returning();

     // Store cites
     for (const cite of signal.cites) {
       await db.insert(signal_evidence).values({
         resultId: result.id,
         fieldPath: cite,
         fieldValue: extractFieldValue(patientData, cite),
       });
     }
   }
   ```

3. Still read from localStorage (API unchanged)

**Success Criteria:**
- ✅ All AI runs logged to database
- ✅ Signals and evidence persisted
- ✅ Can query signal accuracy over time

---

### Phase 3: Migration & Cutover (Weeks 5-6)

**Goal**: Switch to database-backed reads, deprecate localStorage.

**Tasks:**
1. Write migration script: `backfill-localstorage.ts`
   - Read all localStorage cases
   - Create patients, cases, case_payloads
   - Create mock abstraction_runs (historical)
   - Create abstraction_results

2. Update API endpoints to read from database:
   ```typescript
   // /api/cases
   router.get('/api/cases', async (req, res) => {
     const cases = await db.select()
       .from(cases)
       .where(eq(cases.specialtyId, req.query.specialty))
       .orderBy(desc(cases.updatedAt));

     res.json(cases);
   });

   // /api/cases/:id
   router.get('/api/cases/:id', async (req, res) => {
     const caseData = await db.select()
       .from(cases)
       .leftJoin(case_payloads, eq(cases.id, case_payloads.caseId))
       .leftJoin(abstraction_results, eq(cases.id, abstraction_results.caseId))
       .where(eq(cases.id, req.params.id));

     res.json(formatCaseData(caseData));
   });
   ```

3. Keep localStorage writes for 1 week (rollback safety)

4. Monitor error rates

5. Remove localStorage writes after validation

**Success Criteria:**
- ✅ All API reads from database
- ✅ No localStorage dependencies
- ✅ Performance acceptable (<200ms p95 latency)
- ✅ Zero data loss

---

### Phase 4: Metadata-Driven (Weeks 7-8)

**Goal**: Remove hardcoded specialties/modules/signals from code.

**Tasks:**
1. Create admin UI for metadata management:
   - `/admin/specialties` - Add/edit specialties
   - `/admin/modules` - Add/edit modules per specialty
   - `/admin/signals` - Add/edit signal definitions

2. Update frontend to load metadata from API:
   ```typescript
   // Before (hardcoded):
   import { specialtyMetadata } from '@/data/specialtyMetadata';

   // After (API):
   const { data: specialties } = useQuery('specialties', () =>
     ApiLoader.getSpecialties()
   );
   ```

3. Migrate `orthoSignalMatrix.ts` → database

4. Remove hardcoded metadata files

**Success Criteria:**
- ✅ All metadata in database
- ✅ No hardcoded specialties/modules/signals
- ✅ Can add new specialty via UI (no code deploy)

---

### Phase 5: Advanced Features (Weeks 9-12)

**Tasks:**
1. Implement prompt versioning UI
2. Add case review workflow (case_reviews table)
3. Add feedback system (feedback table)
4. Implement audit log
5. Add quality metrics dashboard

**Success Criteria:**
- ✅ Prompt A/B testing enabled
- ✅ Multi-user case assignment working
- ✅ Signal accuracy dashboard live

---

## Cost-Benefit Analysis

### Proposed v4 Schema

**Costs:**
- ❌ Complete rewrite from Snowflake → PostgreSQL (2-3 weeks)
- ❌ Add missing entities (patients, specialties, modules, evidence) (2 weeks)
- ❌ Rework terminology (encounters → cases) (1 week)
- ❌ Build migration tooling (1 week)
- ❌ Test and validate (1 week)
- **Total: 7-9 weeks**

**Benefits:**
- ⚠️ TEST/PROD separation (but can achieve with schemas in PostgreSQL)
- ⚠️ Time-window views (easy to add to v1.0)

**Net: Negative ROI**

---

### HealthLevers v1.0 Schema

**Costs:**
- ✅ Write Drizzle migrations (3 days)
- ✅ Implement dual-write (2 days)
- ✅ Migration script (3 days)
- ✅ Update API layer (5 days)
- ✅ Test and validate (3 days)
- **Total: 16 days (~3 weeks)**

**Benefits:**
- ✅ Clean migration from localStorage
- ✅ Evidence tracking (AI transparency)
- ✅ Metadata-driven (extensible)
- ✅ Audit trail (compliance)
- ✅ Multi-user workflow
- ✅ Prompt versioning
- ✅ Quality metrics

**Net: High ROI**

---

## Conclusion

**The proposed v4 schema will NOT serve the HealthLevers project well.**

### Key Takeaways:

1. **Platform Mismatch**: v4 is Snowflake; HealthLevers is PostgreSQL
2. **Conceptual Mismatch**: v4 is encounter-centric; HealthLevers is case-centric
3. **Missing Entities**: v4 lacks patients, specialties, modules, evidence
4. **No Migration Path**: Cannot migrate localStorage data to v4 without major additions
5. **Limited Extensibility**: v4 is not metadata-driven

### What to Do:

✅ **Adopt the HealthLevers v1.0 schema** (RECOMMENDED_SCHEMA_DESIGN.md)
✅ **Follow the 5-phase implementation plan**
✅ **Start with Phase 1** (core tables + dual-write)
✅ **Incrementally migrate** from localStorage to database
✅ **Build metadata management UI** to remove hardcoded config

### Timeline:

- **Phase 1** (Weeks 1-2): Core tables + dual-write
- **Phase 2** (Weeks 3-4): Signal persistence
- **Phase 3** (Weeks 5-6): Migration + cutover
- **Phase 4** (Weeks 7-8): Metadata-driven
- **Phase 5** (Weeks 9-12): Advanced features

**Total: 12 weeks to full production-ready schema**

---

## Next Steps

1. **Review** this comparison with your team
2. **Approve** the HealthLevers v1.0 schema design
3. **Create** first Drizzle migration (`0001_create_core_tables.ts`)
4. **Implement** dual-write in `server/storage.ts`
5. **Test** in development environment
6. **Plan** localStorage migration for production

**Ready to proceed?** Let me know and I can help with:
- ✅ Writing the Drizzle migration files
- ✅ Implementing the dual-write storage layer
- ✅ Creating the localStorage migration script
- ✅ Updating the API endpoints
- ✅ Building the metadata admin UI

---

## Questions to Consider

Before finalizing the schema, discuss with your team:

1. **Multi-tenancy**: Will you have multiple hospitals/facilities? (If yes, add `tenant_id` to core tables)
2. **Data retention**: How long to keep historical AI runs? (Consider partitioning)
3. **Compliance**: HIPAA/GDPR requirements? (May need audit log enhancements)
4. **Scalability**: Expected case volume? (May need indexing optimizations)
5. **Internationalization**: Multiple languages? (Add `locale` fields)
6. **Test/Prod separation**: Separate databases or single database with mode flags?

Let me know how you'd like to proceed!
