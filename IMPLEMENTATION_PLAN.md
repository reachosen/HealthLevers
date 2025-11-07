# HealthLevers v9.2 Schema Implementation & Dynamic Application Migration
## Complete Implementation Plan: Excel → Database → Dynamic Application

---

## Executive Summary

This document provides a **complete, step-by-step implementation plan** to:

1. **Implement v9.2 schema** in PostgreSQL (prototype database)
2. **Migrate Excel metadata** (USNWR_Master_AllMetrics_v4.xlsx) into database tables
3. **Transform HealthLevers** from static/hardcoded → dynamic/database-driven application

### Current State:
- ❌ 483+ signals hardcoded in TypeScript files
- ❌ 11 modules hardcoded in specialtyMetadata.ts
- ❌ Prompts stored in localStorage
- ❌ UI configuration hardcoded
- ❌ No metadata versioning

### Target State:
- ✅ All metadata in PostgreSQL v9.2 schema
- ✅ Dynamic loading from database
- ✅ Excel as authoritative source
- ✅ One-command metadata updates
- ✅ Version tracking & rollback capability

### Timeline: **6-8 weeks**
- Week 1-2: Schema setup + Excel parser
- Week 3-4: Backend API + data migration
- Week 5-6: Frontend transformation
- Week 7-8: Testing + validation + cutover

---

## Part 1: Current State Analysis

### What's Hardcoded Now

#### 1. Specialties & Modules
**File:** `client/src/data/specialtyMetadata.ts` (264 lines)
```typescript
export const specialtyMetadata = {
  "Orthopedics": {
    displayName: "Orthopedics (Pediatric)",
    modules: [
      {
        name: "Timeliness – SCH",
        value: "timeliness_sch",
        description: "Track whether SCH fractures received surgery within 19 hours",
        defaultPrompt: "Analyze the timeline...",
        displayOrder: 1,
        groups: ["Core", "Delay Drivers", "Documentation", "Ruleouts"]
      },
      // ... 10 more modules
    ]
  },
  "Cardiology": { ... },
  // ... 7 more specialties
}
```

**Issues:**
- ❌ Adding new specialty requires code changes
- ❌ No versioning
- ❌ No relationship tracking
- ❌ Deployed with application (can't update independently)

#### 2. Signal Definitions
**File:** `client/src/data/orthoSignalMatrix.ts` (525 lines)
```typescript
export const orthoSignalMatrix = {
  timeliness_sch: [
    {
      id: "on_time_19h",
      label: "Incision within 19h of ED arrival",
      group: "Core",
      definition: "Delta between ED arrival and incision start ≤19 hours",
      tooltip: "Computed from ArrivalInstant → IncisionStartInstant",
      status: "pass",
      triggers: ["arrival_to_surgery_min <= 1140"],
      cites: ["times.ArrivalInstant", "times.IncisionStartInstant"]
    },
    // ... 483+ more signals
  ]
}
```

**Issues:**
- ❌ 483+ signals hardcoded
- ❌ No conditional logic (triggers are strings, not evaluated)
- ❌ No dynamic grouping
- ❌ Update requires deployment

#### 3. UI Configuration
**File:** `client/src/lib/planningConfig.tsx` (localStorage-based)
```typescript
{
  domains: [{
    domainId: "orthopedics",
    questions: [{
      questionId: "timeliness_sch",
      visibleGroups: { "Core": true, "Delay Drivers": true },
      groupOrder: ["Core", "Delay Drivers", "Documentation", "Ruleouts"],
      fieldOrder: { "Core": ["PatientMRN", "PatientName", "ArrivalTime"] },
      followups: [
        "Does operative report confirm SCH?",
        "Were there any documented delays?"
      ]
    }]
  }]
}
```

**Issues:**
- ❌ Stored in localStorage (user-specific, not centralized)
- ❌ No default configuration from server
- ❌ Followup questions hardcoded

### What's in Excel

**File:** `USNWR_Master_AllMetrics_v4.xlsx`

| Sheet | Rows | Purpose | Maps to v9.2 Table |
|-------|------|---------|-------------------|
| `metrics` | 54 | Quality metrics definitions | `metric` |
| `groups` | 223 | Signal groupings | `signal_group` |
| `signals` | 542 | Signal definitions with triggers | `signal_def` |
| `followups` | 301 | Conditional followup questions | `followup` |
| `display_plan` | 323 | UI field visibility config | `display_plan` |
| `prompts` | 108 | AI prompts (intake/abstractor) | `prompt` |
| `provenance_rules` | 108 | Data lineage requirements | `provenance_rule` |
| `versions` | 54 | Version tracking | (version columns in tables) |

**Excel is MORE comprehensive than current code:**
- 542 signals in Excel vs 483 in code
- 301 followup questions vs ~20 hardcoded
- 323 display config entries vs ~50 hardcoded
- Conditional logic (trigger_expr, when_cond) vs static definitions

---

## Part 2: Implementation Architecture

### Data Flow Transformation

#### Before (Current):
```
Hardcoded TS Files → Imported at Build Time → Bundled → Deployed
                                                          ↓
                                              User sees static config
```

#### After (Target):
```
Excel File → Parser → PostgreSQL (v9.2 schema) → API → React Query → UI
                                                                      ↓
                                                     User sees dynamic config
```

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXCEL METADATA SOURCE                         │
│          USNWR_Master_AllMetrics_v4.xlsx (8 sheets)             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ (Manual upload or automated sync)
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                   METADATA INGESTION SERVICE                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Excel Parser (Node.js + xlsx library)                   │  │
│  │    ├─ Read all 8 sheets                                  │  │
│  │    ├─ Validate structure & relationships                 │  │
│  │    ├─ Transform to v9.2 schema format                    │  │
│  │    └─ Generate SQL INSERT statements                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│              POSTGRESQL DATABASE (v9.2 Schema)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Configuration Tables:                                    │  │
│  │    • metric (54 rows from Excel)                         │  │
│  │    • signal_def (542 rows)                               │  │
│  │    • signal_group (223 rows)                             │  │
│  │    • followup (301 rows)                                 │  │
│  │    • display_plan (323 rows)                             │  │
│  │    • prompt (108 rows)                                   │  │
│  │    • provenance_rule (108 rows)                          │  │
│  │    • prompt_bind (routing config)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Runtime Tables:                                          │  │
│  │    • encounter_context (clinical payloads)               │  │
│  │    • case (abstraction cases)                            │  │
│  │    • ai_run (AI processing runs)                         │  │
│  │    • ai_response (AI outputs)                            │  │
│  │    • signal_ledger (computed signals)                    │  │
│  │    • evidence (signal cites)                             │  │
│  │    • feedback (user feedback)                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API (Express.js)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Metadata Endpoints:                                      │  │
│  │    GET  /api/metadata/metrics                            │  │
│  │    GET  /api/metadata/signals/:metric_id                 │  │
│  │    GET  /api/metadata/groups/:metric_id                  │  │
│  │    GET  /api/metadata/followups/:metric_id               │  │
│  │    GET  /api/metadata/prompts/:metric_id                 │  │
│  │    GET  /api/metadata/display/:metric_id                 │  │
│  │    POST /api/metadata/reload (trigger re-parse)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Runtime Endpoints (updated to use v9.2):                │  │
│  │    POST /api/ai_signals (create ai_run + signal_ledger)  │  │
│  │    GET  /api/cases (load from case table)                │  │
│  │    POST /api/feedback (store in feedback table)          │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                   FRONTEND (React + TypeScript)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Dynamic Metadata Hooks:                                  │  │
│  │    • useMetrics() → Fetch all metrics from DB            │  │
│  │    • useSignals(metricId) → Fetch signals dynamically    │  │
│  │    • useGroups(metricId) → Fetch groups                  │  │
│  │    • useFollowups(metricId) → Fetch followups            │  │
│  │    • useDisplayPlan(metricId) → Fetch UI config          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Updated Components:                                      │  │
│  │    • Intake.tsx → Dynamic specialty/module selection     │  │
│  │    • ModuleInlinePanel.tsx → Dynamic signal rendering    │  │
│  │    • Planning.tsx → Load display_plan from DB            │  │
│  │    • EvidenceDrawer.tsx → Show provenance from DB        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Phased Implementation Plan

### Phase 1: Database Schema Setup (Week 1)

#### Task 1.1: Create PostgreSQL v9.2 Schema
**Duration:** 1 day

**Action:** Run the PostgreSQL DDL from `V92_IMPLEMENTATION_GUIDE.md` Part 2

**Steps:**
1. Create migration file:
```bash
npm run db:generate -- --name create_v92_schema
```

2. Edit migration file: `migrations/0001_create_v92_schema.sql`
```sql
-- Copy all DDL from V92_IMPLEMENTATION_GUIDE.md Part 2
-- encounter_context, metric, display_plan, signal_group, signal_def,
-- followup, provenance_rule, prompt, case, feedback, ai_run, ai_response,
-- signal_ledger, evidence, prompt_bind, test_suite, test_case, test_run, test_assertion
```

3. Run migration:
```bash
npm run db:migrate
```

4. Validate:
```bash
psql $DATABASE_URL -c "\dt"
# Should show all 19 tables
```

**Deliverable:** ✅ All v9.2 tables created in PostgreSQL

---

#### Task 1.2: Update Drizzle Schema
**Duration:** 1 day

**Action:** Add v9.2 table definitions to `shared/schema.ts`

**Steps:**
1. Copy Drizzle definitions from `V92_IMPLEMENTATION_GUIDE.md` Part 3

2. Add to `shared/schema.ts`:
```typescript
// Add after existing users/sessions tables:
export const encounterContext = pgTable('encounter_context', { ... });
export const metric = pgTable('metric', { ... });
export const displayPlan = pgTable('display_plan', { ... });
// ... (copy all 19 table definitions)

// Export types
export type EncounterContext = typeof encounterContext.$inferSelect;
export type Metric = typeof metric.$inferSelect;
export type SignalDef = typeof signalDef.$inferSelect;
// ... (export all types)
```

3. Verify TypeScript compilation:
```bash
npm run typecheck
```

**Deliverable:** ✅ Drizzle schema updated with v9.2 tables

---

### Phase 2: Excel Parser & Data Migration (Week 2)

#### Task 2.1: Create Excel Parser Service
**Duration:** 2 days

**Action:** Build service to parse Excel → JSON → SQL

**File:** `server/services/excelParser.ts`
```typescript
import * as XLSX from 'xlsx';
import { z } from 'zod';

// Define schema for each sheet
const MetricSchema = z.object({
  specialty: z.string(),
  specialty_id: z.string(),
  question_code: z.string(),
  metric_name: z.string(),
  priority: z.number().optional(),
  threshold_hours: z.number().optional(),
  definition_window: z.string().optional(),
  active: z.boolean(),
  version: z.string(),
  domain: z.string(),
  metric_id: z.string(),
});

const SignalSchema = z.object({
  metric_id: z.string(),
  signal_code: z.string(),
  group_id: z.string(),
  trigger_expr: z.string().optional(),
  severity: z.enum(['info', 'warn', 'error']),
});

const GroupSchema = z.object({
  metric_id: z.string(),
  group_id: z.string(),
  group_name: z.string(),
  display_order: z.number(),
  group_code: z.string(),
});

const FollowupSchema = z.object({
  metric_id: z.string(),
  followup_id: z.string(),
  when_cond: z.string().optional(),
  question_text: z.string(),
  response_type: z.string(),
});

const DisplayPlanSchema = z.object({
  metric_id: z.string(),
  display_tier: z.enum(['primary', 'secondary']),
  field_name: z.string(),
  order_in_tier: z.number(),
  visibility_cond: z.string().optional(),
  field_label: z.string(),
});

const PromptSchema = z.object({
  metric_id: z.string(),
  prompt_type: z.enum(['intake', 'abstractor']),
  prompt_text: z.string(),
  prompt_version: z.string(),
  prompt_role: z.string(),
  prompt_notes: z.string().optional(),
  last_changed_at: z.string(),
});

const ProvenanceRuleSchema = z.object({
  metric_id: z.string(),
  field_name: z.string(),
  source_table: z.string().optional(),
  key_field: z.string().optional(),
  require_author: z.boolean(),
  require_taken_instant: z.boolean(),
});

export class ExcelParser {
  private workbook: XLSX.WorkBook | null = null;

  async loadExcel(filePath: string) {
    this.workbook = XLSX.readFile(filePath);
    console.log('Loaded Excel file:', filePath);
    console.log('Sheets:', this.workbook.SheetNames);
  }

  parseSheet<T>(sheetName: string, schema: z.ZodSchema<T>): T[] {
    if (!this.workbook) throw new Error('Workbook not loaded');

    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`Sheet ${sheetName} not found`);

    // Convert sheet to JSON
    const rawData = XLSX.utils.sheet_to_json(sheet);

    // Validate and transform
    const validatedData = rawData.map((row, index) => {
      try {
        return schema.parse(row);
      } catch (error) {
        console.error(`Validation error in ${sheetName} row ${index}:`, error);
        throw error;
      }
    });

    return validatedData;
  }

  async parseAllSheets() {
    const metrics = this.parseSheet('metrics', MetricSchema);
    const signals = this.parseSheet('signals', SignalSchema);
    const groups = this.parseSheet('groups', GroupSchema);
    const followups = this.parseSheet('followups', FollowupSchema);
    const displayPlan = this.parseSheet('display_plan', DisplayPlanSchema);
    const prompts = this.parseSheet('prompts', PromptSchema);
    const provenanceRules = this.parseSheet('provenance_rules', ProvenanceRuleSchema);

    return {
      metrics,
      signals,
      groups,
      followups,
      displayPlan,
      prompts,
      provenanceRules,
    };
  }

  validateRelationships(data: ReturnType<ExcelParser['parseAllSheets']>) {
    const { metrics, signals, groups, followups, displayPlan, prompts, provenanceRules } = data;

    const metricIds = new Set(metrics.map(m => m.metric_id));

    // Validate all foreign keys
    const errors: string[] = [];

    for (const signal of signals) {
      if (!metricIds.has(signal.metric_id)) {
        errors.push(`Signal ${signal.signal_code} references unknown metric ${signal.metric_id}`);
      }
    }

    for (const group of groups) {
      if (!metricIds.has(group.metric_id)) {
        errors.push(`Group ${group.group_id} references unknown metric ${group.metric_id}`);
      }
    }

    // ... validate other relationships

    if (errors.length > 0) {
      throw new Error(`Validation errors:\n${errors.join('\n')}`);
    }

    console.log('✅ All relationships validated');
  }
}

// Export singleton instance
export const excelParser = new ExcelParser();
```

**Deliverable:** ✅ Excel parser that validates and extracts all 8 sheets

---

#### Task 2.2: Create Database Seeding Script
**Duration:** 2 days

**Action:** Insert parsed Excel data into PostgreSQL

**File:** `scripts/seed-metadata.ts`
```typescript
import { db } from '../server/db';
import { excelParser } from '../server/services/excelParser';
import {
  metric, signalDef, signalGroup, followup, displayPlan,
  prompt, provenanceRule, promptBind
} from '../shared/schema';
import path from 'path';

async function seedMetadata() {
  console.log('🌱 Starting metadata seed...');

  // 1. Load and parse Excel
  const excelPath = path.join(__dirname, '../data/USNWR_Master_AllMetrics_v4.xlsx');
  await excelParser.loadExcel(excelPath);
  const data = await excelParser.parseAllSheets();

  // 2. Validate relationships
  excelParser.validateRelationships(data);

  // 3. Clear existing metadata (WARNING: Destructive!)
  console.log('🗑️  Clearing existing metadata...');
  await db.delete(provenanceRule);
  await db.delete(displayPlan);
  await db.delete(followup);
  await db.delete(signalDef);
  await db.delete(signalGroup);
  await db.delete(prompt);
  await db.delete(promptBind);
  await db.delete(metric);

  // 4. Insert metrics
  console.log(`📊 Inserting ${data.metrics.length} metrics...`);
  for (const m of data.metrics) {
    await db.insert(metric).values({
      metricId: m.metric_id,
      specialty: m.specialty,
      metricName: m.metric_name,
      domain: m.domain,
      thresholdHours: m.threshold_hours ? String(m.threshold_hours) : null,
      contentVersion: m.version,
    });
  }

  // 5. Insert signal groups
  console.log(`🏷️  Inserting ${data.groups.length} signal groups...`);
  for (const g of data.groups) {
    await db.insert(signalGroup).values({
      metricId: g.metric_id,
      groupId: g.group_id,
      groupCode: g.group_code,
    });
  }

  // 6. Insert signal definitions
  console.log(`🔔 Inserting ${data.signals.length} signal definitions...`);
  for (const s of data.signals) {
    await db.insert(signalDef).values({
      metricId: s.metric_id,
      signalCode: s.signal_code,
      groupId: s.group_id,
      severity: s.severity,
      status: null, // Will be computed at runtime
    });
  }

  // 7. Insert followup questions
  console.log(`❓ Inserting ${data.followups.length} followup questions...`);
  for (const f of data.followups) {
    await db.insert(followup).values({
      metricId: f.metric_id,
      followupId: f.followup_id,
      whenCond: f.when_cond || null,
      questionText: f.question_text,
      responseType: f.response_type,
    });
  }

  // 8. Insert display plan
  console.log(`🎨 Inserting ${data.displayPlan.length} display plan entries...`);
  for (const d of data.displayPlan) {
    await db.insert(displayPlan).values({
      metricId: d.metric_id,
      fieldName: d.field_name,
      label: d.field_label,
      tier: d.display_tier,
      visibilityCond: d.visibility_cond || null,
      orderNbr: d.order_in_tier,
    });
  }

  // 9. Insert prompts
  console.log(`💬 Inserting ${data.prompts.length} prompts...`);
  for (const p of data.prompts) {
    await db.insert(prompt).values({
      metricId: p.metric_id,
      promptType: p.prompt_type,
      persona: 'You are an expert medical quality analyst.', // Default persona
      purpose: `${p.prompt_type} workflow for ${p.metric_id}`,
      description: null,
      promptText: p.prompt_text,
      classifier1: p.prompt_role,
      classifier2: p.prompt_type,
      contentVersion: p.prompt_version,
      lastChangedAt: p.last_changed_at ? new Date(p.last_changed_at) : null,
    });
  }

  // 10. Insert provenance rules
  console.log(`🔍 Inserting ${data.provenanceRules.length} provenance rules...`);
  for (const pr of data.provenanceRules) {
    await db.insert(provenanceRule).values({
      metricId: pr.metric_id,
      fieldName: pr.field_name,
      tableName: pr.source_table || null,
      keyName: pr.key_field || null,
      fieldRef: pr.field_name, // Use field_name as reference
      fallbackJson: null,
    });
  }

  // 11. Create default prompt bindings
  console.log('🔗 Creating prompt bindings...');
  const metrics = await db.select().from(metric);
  for (const m of metrics) {
    await db.insert(promptBind).values({
      appFeature: 'intake',
      metricId: m.metricId,
      promptType: 'intake',
      specialty: m.specialty,
      moduleCode: m.metricId, // Using metric_id as module_code
      enabled: true,
    });

    await db.insert(promptBind).values({
      appFeature: 'abstractor',
      metricId: m.metricId,
      promptType: 'abstractor',
      specialty: m.specialty,
      moduleCode: m.metricId,
      enabled: true,
    });
  }

  console.log('✅ Metadata seeding complete!');
  console.log('📈 Summary:');
  console.log(`  - Metrics: ${data.metrics.length}`);
  console.log(`  - Signals: ${data.signals.length}`);
  console.log(`  - Groups: ${data.groups.length}`);
  console.log(`  - Followups: ${data.followups.length}`);
  console.log(`  - Display plan: ${data.displayPlan.length}`);
  console.log(`  - Prompts: ${data.prompts.length}`);
  console.log(`  - Provenance rules: ${data.provenanceRules.length}`);
}

// Run if called directly
if (require.main === module) {
  seedMetadata()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export { seedMetadata };
```

**Run script:**
```bash
npm run seed-metadata
```

**Deliverable:** ✅ Database populated with all Excel metadata

---

### Phase 3: Backend API Implementation (Week 3)

#### Task 3.1: Create Metadata API Endpoints
**Duration:** 2 days

**File:** `server/routes/metadata.ts`
```typescript
import { Router } from 'express';
import { db } from '../db';
import { metric, signalDef, signalGroup, followup, displayPlan, prompt, provenanceRule } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Cache for 1 hour (metadata changes infrequently)
const CACHE_DURATION = 60 * 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

function getFromCache(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

// GET /api/metadata/metrics
// Returns all metrics grouped by specialty
router.get('/metrics', async (req, res) => {
  try {
    const cacheKey = 'all_metrics';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const metrics = await db.select().from(metric);

    // Group by specialty
    const grouped = metrics.reduce((acc, m) => {
      if (!acc[m.specialty]) acc[m.specialty] = [];
      acc[m.specialty].push(m);
      return acc;
    }, {} as Record<string, typeof metrics>);

    setCache(cacheKey, grouped);
    res.json(grouped);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/metadata/signals/:metric_id
// Returns all signals for a metric with their groups
router.get('/signals/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;
    const cacheKey = `signals_${metric_id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const signals = await db.select()
      .from(signalDef)
      .where(eq(signalDef.metricId, metric_id));

    const groups = await db.select()
      .from(signalGroup)
      .where(eq(signalGroup.metricId, metric_id));

    const result = {
      metric_id,
      signals,
      groups,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// GET /api/metadata/followups/:metric_id
router.get('/followups/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;
    const cacheKey = `followups_${metric_id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const followups = await db.select()
      .from(followup)
      .where(eq(followup.metricId, metric_id));

    setCache(cacheKey, followups);
    res.json(followups);
  } catch (error) {
    console.error('Error fetching followups:', error);
    res.status(500).json({ error: 'Failed to fetch followups' });
  }
});

// GET /api/metadata/display/:metric_id
router.get('/display/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;
    const cacheKey = `display_${metric_id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const plan = await db.select()
      .from(displayPlan)
      .where(eq(displayPlan.metricId, metric_id));

    // Group by tier
    const grouped = plan.reduce((acc, item) => {
      if (!acc[item.tier]) acc[item.tier] = [];
      acc[item.tier].push(item);
      return acc;
    }, {} as Record<string, typeof plan>);

    setCache(cacheKey, grouped);
    res.json(grouped);
  } catch (error) {
    console.error('Error fetching display plan:', error);
    res.status(500).json({ error: 'Failed to fetch display plan' });
  }
});

// GET /api/metadata/prompts/:metric_id
router.get('/prompts/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;
    const { type } = req.query; // 'intake' or 'abstractor'

    const cacheKey = `prompts_${metric_id}_${type || 'all'}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    let query = db.select().from(prompt).where(eq(prompt.metricId, metric_id));

    if (type) {
      query = query.where(eq(prompt.promptType, type as string));
    }

    const prompts = await query;

    setCache(cacheKey, prompts);
    res.json(prompts);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// GET /api/metadata/provenance/:metric_id
router.get('/provenance/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;
    const cacheKey = `provenance_${metric_id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const rules = await db.select()
      .from(provenanceRule)
      .where(eq(provenanceRule.metricId, metric_id));

    setCache(cacheKey, rules);
    res.json(rules);
  } catch (error) {
    console.error('Error fetching provenance rules:', error);
    res.status(500).json({ error: 'Failed to fetch provenance rules' });
  }
});

// POST /api/metadata/reload
// Clear cache and trigger re-parse (admin only)
router.post('/reload', async (req, res) => {
  try {
    cache.clear();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error reloading metadata:', error);
    res.status(500).json({ error: 'Failed to reload metadata' });
  }
});

export default router;
```

**Mount in `server/index.ts`:**
```typescript
import metadataRoutes from './routes/metadata';

app.use('/api/metadata', metadataRoutes);
```

**Deliverable:** ✅ Metadata API endpoints with caching

---

#### Task 3.2: Update Existing Runtime Endpoints
**Duration:** 3 days

**Action:** Update `/api/ai_signals`, `/api/cases`, etc. to use v9.2 schema

**File:** `server/routes.ts` (update existing file)
```typescript
import {
  encounterContext, caseTable, aiRun, aiResponse,
  signalLedger, evidence, feedback
} from '../shared/schema';

// Updated: POST /api/ai_signals
router.post('/api/ai_signals', async (req, res) => {
  const { specialty, moduleId, patient, promptText } = req.body;

  // Map HealthLevers moduleId to metric_id
  const metricId = `${specialty.toUpperCase()}_${moduleId}`;

  // Generate IDs
  const patientId = patient.patient?.mrn || `P_${Date.now()}`;
  const encounterId = patient.id || `E_${Date.now()}`;
  const caseId = `CASE_${Date.now()}`;
  const runId = `RUN_${Date.now()}`;

  try {
    // 1. Store encounter_context
    await db.insert(encounterContext).values({
      encounterId: encounterId,
      patientId: patientId,
      mrn: patient.patient?.mrn,
      context: patient,
      payloadVersion: '1.0',
      createdTs: new Date(),
    });

    // 2. Create case
    await db.insert(caseTable).values({
      caseId: caseId,
      patientId: patientId,
      encounterId: encounterId,
      specialty: specialty,
      moduleCode: moduleId,
      caseState: 'OPEN',
      stateComment: null,
      firstSeenTs: new Date(),
      updatedTs: new Date(),
      updatedBy: req.session?.user?.id || 'anonymous',
    });

    // 3. Create ai_run
    await db.insert(aiRun).values({
      runId: runId,
      patientId: patientId,
      encounterId: encounterId,
      caseId: caseId,
      mode: 'TEST',
      createdTs: new Date(),
      status: 'RUNNING',
      inputSnapshot: patient,
      inputHash: hashObject(patient),
      promptType: 'intake',
      promptVersion: '1.0',
      modelId: 'gpt-4o',
      params: { temperature: 0.7 },
    });

    // 4. Call OpenAI (existing logic)
    const aiResult = await callOpenAI(promptText, patient);

    // 5. Store ai_response
    await db.insert(aiResponse).values({
      runId: runId,
      patientId: patientId,
      encounterId: encounterId,
      mode: 'TEST',
      createdTs: new Date(),
      response: aiResult.response,
      tokens: aiResult.tokens,
      cost: aiResult.cost,
    });

    // 6. Store signals in signal_ledger
    const signals = aiResult.response.signals || [];
    for (const signal of signals) {
      await db.insert(signalLedger).values({
        patientId: patientId,
        encounterId: encounterId,
        signalCode: signal.id,
        metricId: metricId,
        value: {
          status: signal.status,
          label: signal.label,
          finding: signal.finding,
        },
        confidence: signal.confidence || 0.85,
        startTs: new Date(),
        endTs: null,
      });

      // 7. Store evidence
      if (signal.cites && Array.isArray(signal.cites)) {
        for (const cite of signal.cites) {
          await db.insert(evidence).values({
            evidenceId: `${runId}_${signal.id}_${cite}`,
            patientId: patientId,
            runId: runId,
            encounterId: encounterId,
            signalCode: signal.id,
            citeType: determineCiteType(cite),
            citeRef: cite,
            span: null,
            rawExcerpt: extractExcerpt(patient, cite),
            createdTs: new Date(),
          });
        }
      }
    }

    // 8. Update ai_run status
    await db.update(aiRun)
      .set({ status: 'COMPLETED' })
      .where(eq(aiRun.runId, runId));

    // Return response
    res.json({
      signals: signals,
      category_counts: calculateCategoryCounts(signals),
      run_id: runId,
      case_id: caseId,
    });

  } catch (error) {
    console.error('AI processing error:', error);
    await db.update(aiRun)
      .set({ status: 'FAILED' })
      .where(eq(aiRun.runId, runId));

    res.status(500).json({ error: 'AI processing failed' });
  }
});

// Helper functions
function determineCiteType(citePath: string): string {
  if (citePath.includes('notes') || citePath.includes('delay_summary')) return 'note';
  if (citePath.includes('labs')) return 'lab';
  if (citePath.includes('surgery') || citePath.includes('procedure')) return 'op';
  if (citePath.includes('imaging') || citePath.includes('xray') || citePath.includes('ct')) return 'image';
  return 'note';
}

function extractExcerpt(payload: any, path: string): string | null {
  const value = path.split('.').reduce((obj, key) => obj?.[key], payload);
  return value ? String(value) : null;
}
```

**Deliverable:** ✅ Runtime endpoints use v9.2 schema

---

### Phase 4: Frontend Transformation (Weeks 4-5)

#### Task 4.1: Create Metadata React Hooks
**Duration:** 2 days

**File:** `client/src/hooks/useMetadata.ts`
```typescript
import { useQuery } from '@tanstack/react-query';

// Types
export interface Metric {
  metricId: string;
  specialty: string;
  metricName: string;
  domain: string;
  thresholdHours: string | null;
  contentVersion: string;
}

export interface SignalDef {
  metricId: string;
  signalCode: string;
  groupId: string;
  severity: 'info' | 'warn' | 'error';
  status: string | null;
}

export interface SignalGroup {
  metricId: string;
  groupId: string;
  groupCode: string;
}

export interface Followup {
  metricId: string;
  followupId: string;
  whenCond: string | null;
  questionText: string;
  responseType: string;
}

export interface DisplayPlan {
  metricId: string;
  fieldName: string;
  label: string;
  tier: 'primary' | 'secondary';
  visibilityCond: string | null;
  orderNbr: number;
}

// Hook: Fetch all metrics
export function useMetrics() {
  return useQuery({
    queryKey: ['metadata', 'metrics'],
    queryFn: async () => {
      const response = await fetch('/api/metadata/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json() as Promise<Record<string, Metric[]>>;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// Hook: Fetch signals for a metric
export function useSignals(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'signals', metricId],
    queryFn: async () => {
      if (!metricId) return null;
      const response = await fetch(`/api/metadata/signals/${metricId}`);
      if (!response.ok) throw new Error('Failed to fetch signals');
      return response.json() as Promise<{
        metric_id: string;
        signals: SignalDef[];
        groups: SignalGroup[];
      }>;
    },
    enabled: !!metricId,
    staleTime: 1000 * 60 * 60,
  });
}

// Hook: Fetch followups for a metric
export function useFollowups(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'followups', metricId],
    queryFn: async () => {
      if (!metricId) return [];
      const response = await fetch(`/api/metadata/followups/${metricId}`);
      if (!response.ok) throw new Error('Failed to fetch followups');
      return response.json() as Promise<Followup[]>;
    },
    enabled: !!metricId,
    staleTime: 1000 * 60 * 60,
  });
}

// Hook: Fetch display plan for a metric
export function useDisplayPlan(metricId: string | null) {
  return useQuery({
    queryKey: ['metadata', 'display', metricId],
    queryFn: async () => {
      if (!metricId) return null;
      const response = await fetch(`/api/metadata/display/${metricId}`);
      if (!response.ok) throw new Error('Failed to fetch display plan');
      return response.json() as Promise<Record<string, DisplayPlan[]>>;
    },
    enabled: !!metricId,
    staleTime: 1000 * 60 * 60,
  });
}

// Hook: Fetch prompts for a metric
export function usePrompts(metricId: string | null, type?: 'intake' | 'abstractor') {
  return useQuery({
    queryKey: ['metadata', 'prompts', metricId, type],
    queryFn: async () => {
      if (!metricId) return [];
      const url = `/api/metadata/prompts/${metricId}${type ? `?type=${type}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch prompts');
      return response.json();
    },
    enabled: !!metricId,
    staleTime: 1000 * 60 * 60,
  });
}

// Helper: Get unique specialties from metrics
export function useSpecialties() {
  const { data: metricsGrouped } = useMetrics();

  const specialties = metricsGrouped ? Object.keys(metricsGrouped) : [];

  return { specialties, isLoading: !metricsGrouped };
}

// Helper: Get metrics for a specialty
export function useMetricsForSpecialty(specialty: string | null) {
  const { data: metricsGrouped } = useMetrics();

  const metrics = specialty && metricsGrouped ? metricsGrouped[specialty] || [] : [];

  return { metrics, isLoading: !metricsGrouped };
}
```

**Deliverable:** ✅ Metadata hooks for React Query

---

#### Task 4.2: Update Intake Page
**Duration:** 2 days

**File:** `client/src/pages/intake.tsx` (update existing)
```typescript
import { useSpecialties, useMetricsForSpecialty, useSignals } from '@/hooks/useMetadata';

export default function IntakePage() {
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [patientData, setPatientData] = useState<any>(null);

  // Load specialties dynamically
  const { specialties, isLoading: loadingSpecialties } = useSpecialties();

  // Load metrics for selected specialty
  const { metrics, isLoading: loadingMetrics } = useMetricsForSpecialty(selectedSpecialty);

  // Load signals for selected metric
  const { data: signalsData, isLoading: loadingSignals } = useSignals(selectedMetricId);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Case Intake</h1>

      {/* Specialty Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Select Specialty</label>
        {loadingSpecialties ? (
          <div>Loading specialties...</div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {specialties.map((specialty) => (
              <ChipButton
                key={specialty}
                variant={selectedSpecialty === specialty ? 'primary' : 'secondary'}
                onClick={() => {
                  setSelectedSpecialty(specialty);
                  setSelectedMetricId(null); // Reset metric selection
                }}
              >
                {specialty}
              </ChipButton>
            ))}
          </div>
        )}
      </div>

      {/* Module/Metric Selector */}
      {selectedSpecialty && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select Module</label>
          {loadingMetrics ? (
            <div>Loading modules...</div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {metrics.map((metric) => (
                <ChipButton
                  key={metric.metricId}
                  variant={selectedMetricId === metric.metricId ? 'primary' : 'secondary'}
                  onClick={() => setSelectedMetricId(metric.metricId)}
                >
                  {metric.metricName}
                  {metric.thresholdHours && (
                    <span className="ml-2 text-xs">≤{metric.thresholdHours}h</span>
                  )}
                </ChipButton>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Patient Data Input */}
      {selectedMetricId && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Patient Data (JSON)</label>
          <textarea
            className="w-full h-64 p-3 border rounded font-mono text-sm"
            placeholder="Paste patient JSON data here..."
            onChange={(e) => {
              try {
                setPatientData(JSON.parse(e.target.value));
              } catch (error) {
                console.error('Invalid JSON');
              }
            }}
          />
        </div>
      )}

      {/* Signal Preview (from database) */}
      {signalsData && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Available Signals</h3>
          {signalsData.groups.map((group) => {
            const groupSignals = signalsData.signals.filter(
              (s) => s.groupId === group.groupId
            );
            return (
              <div key={group.groupId} className="mb-4">
                <h4 className="font-medium mb-2">{group.groupCode}</h4>
                <div className="flex gap-2 flex-wrap">
                  {groupSignals.map((signal) => (
                    <span
                      key={signal.signalCode}
                      className={`px-3 py-1 rounded text-sm ${
                        signal.severity === 'error'
                          ? 'bg-red-100 text-red-800'
                          : signal.severity === 'warn'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {signal.signalCode}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Process Button */}
      {patientData && selectedMetricId && (
        <button
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={async () => {
            // Call /api/ai_signals (already updated in Task 3.2)
            const response = await fetch('/api/ai_signals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                specialty: selectedSpecialty,
                moduleId: selectedMetricId,
                patient: patientData,
                promptText: 'Evaluate signals...', // Load from usePrompts
              }),
            });

            const result = await response.json();
            console.log('AI Result:', result);
            // Navigate to review page
            window.location.href = `/review?caseId=${result.case_id}`;
          }}
        >
          Process Case
        </button>
      )}
    </div>
  );
}
```

**Deliverable:** ✅ Intake page loads specialties/modules/signals dynamically

---

#### Task 4.3: Update Review/Home Page
**Duration:** 3 days

**File:** `client/src/pages/home.tsx` (update signal rendering)
```typescript
import { useSignals, useDisplayPlan } from '@/hooks/useMetadata';

export default function HomePage() {
  const [selectedCase, setSelectedCase] = useState<any>(null);

  // Load signals for case's metric
  const { data: signalsData } = useSignals(selectedCase?.metricId);

  // Load display plan
  const { data: displayPlanData } = useDisplayPlan(selectedCase?.metricId);

  // Render signals by group
  const renderSignals = () => {
    if (!signalsData || !selectedCase) return null;

    return signalsData.groups.map((group) => {
      const groupSignals = signalsData.signals.filter((s) => s.groupId === group.groupId);

      // Get actual signal results from case
      const signalResults = selectedCase.signals.filter((result: any) =>
        groupSignals.some((def) => def.signalCode === result.signalCode)
      );

      return (
        <CollapsibleGroup key={group.groupId} title={group.groupCode}>
          {signalResults.map((result: any) => (
            <SignalChip
              key={result.signalCode}
              label={result.signalCode}
              status={result.value.status}
              finding={result.value.finding}
              evidence={result.evidence || []}
            />
          ))}
        </CollapsibleGroup>
      );
    });
  };

  // Render fields by display tier
  const renderFields = (tier: 'primary' | 'secondary') => {
    if (!displayPlanData || !selectedCase) return null;

    const fieldsForTier = displayPlanData[tier] || [];

    return fieldsForTier
      .sort((a, b) => a.orderNbr - b.orderNbr)
      .map((field) => {
        const value = field.fieldName.split('.').reduce(
          (obj, key) => obj?.[key],
          selectedCase.patientData
        );

        // Check visibility condition
        if (field.visibilityCond) {
          // Evaluate condition (simple implementation)
          // TODO: Use expression evaluator
        }

        return (
          <div key={field.fieldName} className="mb-2">
            <span className="font-medium">{field.label}:</span>
            <span className="ml-2">{value}</span>
          </div>
        );
      });
  };

  return (
    <div className="p-6">
      {/* Case List */}
      {/* ... case selection UI ... */}

      {/* Signal Display */}
      {selectedCase && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Signals</h2>
          {renderSignals()}
        </div>
      )}

      {/* Primary Fields */}
      {selectedCase && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Primary Fields</h3>
          {renderFields('primary')}
        </div>
      )}

      {/* Secondary Fields (collapsible) */}
      {selectedCase && (
        <details className="mt-4">
          <summary className="cursor-pointer font-medium">Additional Fields</summary>
          <div className="mt-3">{renderFields('secondary')}</div>
        </details>
      )}
    </div>
  );
}
```

**Deliverable:** ✅ Review page renders signals/fields dynamically

---

### Phase 5: Expression Evaluation Engine (Week 6)

#### Task 5.1: Create Expression Evaluator
**Duration:** 3 days

**File:** `shared/expressionEvaluator.ts`
```typescript
import { Parser } from 'expr-eval';

export class ExpressionEvaluator {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  /**
   * Evaluate a trigger expression
   * Examples:
   *   "end_time - start_time < threshold"
   *   "imaging_delay OR extra_imaging"
   *   "start_time is null"
   */
  evaluate(expr: string, context: Record<string, any>): boolean {
    try {
      // Handle "is null" checks
      if (expr.includes(' is null')) {
        const field = expr.replace(' is null', '').trim();
        return context[field] === null || context[field] === undefined;
      }

      // Handle "is not null" checks
      if (expr.includes(' is not null')) {
        const field = expr.replace(' is not null', '').trim();
        return context[field] !== null && context[field] !== undefined;
      }

      // Parse and evaluate
      const parsed = this.parser.parse(expr);
      const result = parsed.evaluate(context);

      return Boolean(result);
    } catch (error) {
      console.error('Expression evaluation failed:', expr, error);
      return false;
    }
  }

  /**
   * Evaluate multiple trigger expressions (OR logic)
   */
  evaluateMultiple(exprs: string[], context: Record<string, any>): boolean {
    return exprs.some((expr) => this.evaluate(expr, context));
  }

  /**
   * Evaluate trigger and return severity
   */
  evaluateSeverity(
    signal: { trigger_expr?: string; severity: string },
    context: Record<string, any>
  ): { triggered: boolean; severity: string } {
    if (!signal.trigger_expr) {
      return { triggered: false, severity: signal.severity };
    }

    const triggered = this.evaluate(signal.trigger_expr, context);
    return { triggered, severity: signal.severity };
  }
}

// Export singleton
export const expressionEvaluator = new ExpressionEvaluator();
```

**Usage in backend:**
```typescript
// In /api/ai_signals endpoint
import { expressionEvaluator } from '../../shared/expressionEvaluator';

// After AI returns signals, evaluate trigger expressions
for (const signalDef of signalsData.signals) {
  const context = {
    start_time: patientData.times?.ArrivalInstant,
    end_time: patientData.times?.IncisionStartInstant,
    threshold: 19,
    // ... other computed values
  };

  const { triggered, severity } = expressionEvaluator.evaluateSeverity(signalDef, context);

  if (triggered) {
    // Store in signal_ledger
    await db.insert(signalLedger).values({
      patientId,
      encounterId,
      signalCode: signalDef.signalCode,
      metricId,
      value: { status: 'fail', severity },
      confidence: 1.0,
      startTs: new Date(),
      endTs: null,
    });
  }
}
```

**Deliverable:** ✅ Expression evaluator for trigger logic

---

### Phase 6: Testing & Validation (Week 7)

#### Task 6.1: Create Test Suite
**Duration:** 3 days

**File:** `tests/metadata.test.ts`
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../server/db';
import { metric, signalDef } from '../shared/schema';

describe('Metadata API', () => {
  it('should load all metrics', async () => {
    const metrics = await db.select().from(metric);
    expect(metrics.length).toBeGreaterThan(0);
  });

  it('should load signals for ORTHO_I25', async () => {
    const signals = await db.select()
      .from(signalDef)
      .where(eq(signalDef.metricId, 'ORTHO_I25'));

    expect(signals.length).toBeGreaterThan(0);
  });

  it('should have valid foreign keys', async () => {
    const signals = await db.select().from(signalDef);
    const metricIds = new Set((await db.select().from(metric)).map((m) => m.metricId));

    for (const signal of signals) {
      expect(metricIds.has(signal.metricId)).toBe(true);
    }
  });
});
```

**File:** `tests/expressionEvaluator.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { expressionEvaluator } from '../shared/expressionEvaluator';

describe('ExpressionEvaluator', () => {
  it('should evaluate simple comparison', () => {
    const result = expressionEvaluator.evaluate('end_time - start_time < threshold', {
      start_time: 2,
      end_time: 20,
      threshold: 19,
    });
    expect(result).toBe(false); // 18 < 19 is true
  });

  it('should handle null checks', () => {
    const result = expressionEvaluator.evaluate('start_time is null', {
      start_time: null,
    });
    expect(result).toBe(true);
  });

  it('should handle OR conditions', () => {
    const result = expressionEvaluator.evaluate('imaging_delay OR extra_imaging', {
      imaging_delay: true,
      extra_imaging: false,
    });
    expect(result).toBe(true);
  });
});
```

**Run tests:**
```bash
npm test
```

**Deliverable:** ✅ Test suite with >80% coverage

---

### Phase 7: Migration & Cutover (Week 8)

#### Task 7.1: Deprecate Hardcoded Files
**Duration:** 2 days

**Action:** Remove old files and update imports

**Files to remove:**
- `client/src/data/specialtyMetadata.ts`
- `client/src/data/orthoSignalMatrix.ts`
- `server/data/specialties.json`
- `client/src/data/moduleIdMapping.ts`

**Create deprecation wrapper (temporary):**
```typescript
// client/src/data/specialtyMetadata.ts (deprecated wrapper)
import { useMetrics } from '@/hooks/useMetadata';

/**
 * @deprecated Use useMetrics() hook instead
 * This file exists only for backward compatibility
 */
export const specialtyMetadata = {
  // Empty - will be removed in next release
};

console.warn('specialtyMetadata.ts is deprecated. Use useMetadata() hooks instead.');
```

**Deliverable:** ✅ Hardcoded files deprecated

---

#### Task 7.2: Create Admin UI for Metadata Updates
**Duration:** 3 days

**File:** `client/src/pages/admin/metadata.tsx`
```typescript
export default function MetadataAdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append('excel', file);

    try {
      const response = await fetch('/api/admin/metadata/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      alert('Metadata updated successfully! Reloading...');
      window.location.reload();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. See console for details.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Metadata Management</h1>

      {/* Upload Excel */}
      <div className="border-2 border-dashed border-gray-300 rounded p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Upload New Metadata Excel</h2>
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mb-3"
        />
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload & Process'}
        </button>
      </div>

      {/* Current Version Info */}
      <div className="border rounded p-4">
        <h2 className="text-lg font-semibold mb-3">Current Metadata Version</h2>
        <div>
          <p>Metrics: {/* Load from API */}</p>
          <p>Signals: {/* Load from API */}</p>
          <p>Last Updated: {/* Load from API */}</p>
        </div>
      </div>
    </div>
  );
}
```

**Backend endpoint:**
```typescript
// server/routes/admin.ts
router.post('/admin/metadata/upload', upload.single('excel'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) throw new Error('No file uploaded');

    // Save to data directory
    const excelPath = path.join(__dirname, '../data/USNWR_Master_AllMetrics_v4.xlsx');
    await fs.promises.writeFile(excelPath, file.buffer);

    // Re-run seeding script
    await seedMetadata();

    // Clear API cache
    cache.clear();

    res.json({ message: 'Metadata updated successfully' });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

**Deliverable:** ✅ Admin UI for metadata updates

---

## Part 4: Summary & Benefits

### Before vs. After

| Aspect | Before (Hardcoded) | After (Dynamic) |
|--------|-------------------|-----------------|
| **Metadata Updates** | Code changes + deployment (2+ hours) | Upload Excel (15 minutes) |
| **Adding Specialty** | Edit TS files, redeploy | Add rows to Excel, upload |
| **Signal Changes** | Edit 525-line TS file | Edit Excel, upload |
| **Version Control** | None | Full version tracking in DB |
| **Testing** | Manual testing required | Expression validation automated |
| **Collaboration** | Developers only | Clinical SMEs can edit Excel |
| **Consistency** | 3 sources of truth (client/server/Excel) | 1 source (Excel → DB) |
| **Audit Trail** | None | Full provenance tracking |

### Key Benefits

1. **✅ Agility**: Add new metrics in minutes, not days
2. **✅ Scalability**: Handle 100+ metrics without code changes
3. **✅ Maintainability**: Single source of truth (Excel)
4. **✅ Collaboration**: Non-developers can update metadata
5. **✅ Version Control**: Track all changes in database
6. **✅ Testability**: Automated validation of expressions
7. **✅ Auditability**: Full provenance tracking
8. **✅ Flexibility**: Conditional logic, dynamic UI

---

## Part 5: Next Steps & Rollout

### Week 9: Production Preparation
- Performance testing (load 1000 cases)
- Security audit (expression evaluation sandboxing)
- Backup & rollback procedures
- User training materials

### Week 10: Gradual Rollout
- Deploy to staging environment
- Beta testing with 5 users
- Monitor API performance
- Address feedback

### Week 11: Full Production
- Deploy to production
- Enable all users
- Monitor metrics (API latency, cache hit rate)
- Deprecate old code

### Week 12: Snowflake Migration Planning
- Set up Snowflake instance
- Begin dual-write to PostgreSQL + Snowflake
- Validate data consistency
- Plan final cutover

---

## Conclusion

This comprehensive implementation plan transforms HealthLevers from a **static, hardcoded application** to a **dynamic, metadata-driven system** while adopting the **standardized v9.2 schema** that will smoothly migrate to Snowflake production.

**Timeline:** 8 weeks to complete transformation
**Effort:** 1 full-time developer + 1 part-time reviewer
**Risk:** Low (phased approach, backward compatibility maintained)

**Ready to start?** Begin with **Phase 1, Task 1.1** - creating the PostgreSQL schema!
