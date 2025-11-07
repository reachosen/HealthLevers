# HealthLevers v9.2 User Stories & Incremental Implementation Plan
## Test-Driven, Incremental Delivery Approach

---

## Overview

This document contains **user stories** organized for **incremental implementation and testing**. Each story:
- ✅ Can be implemented independently
- ✅ Has clear acceptance criteria
- ✅ Includes testing steps
- ✅ Has a "Definition of Done"
- ✅ Builds on previous stories

**Implementation Rule:** Do NOT move to the next story until current story is fully tested and verified.

---

## Story Organization

### Epic 1: Database Foundation (Stories 1-3)
Setup v9.2 schema and validate infrastructure

### Epic 2: Excel Data Pipeline (Stories 4-6)
Parse Excel and load metadata into database

### Epic 3: Metadata API (Stories 7-9)
Build backend API for metadata consumption

### Epic 4: Dynamic Frontend (Stories 10-14)
Transform UI to load from database

### Epic 5: Expression Engine (Stories 15-16)
Implement dynamic validation logic

### Epic 6: Production Ready (Stories 17-20)
Admin UI, testing, and cutover

---

## Incremental Implementation Sequence

```
Story 1 → Test ✅ → Story 2 → Test ✅ → Story 3 → Test ✅ → ...
         Verify         Verify         Verify
```

**CRITICAL RULE:** Only proceed to next story when:
1. ✅ All acceptance criteria met
2. ✅ All tests passing
3. ✅ Manual verification complete
4. ✅ Code reviewed and committed

---

# EPIC 1: Database Foundation

## Story 1: Create v9.2 PostgreSQL Schema

**As a** developer
**I want** to create all v9.2 database tables in PostgreSQL
**So that** I have the foundation for metadata and runtime data

### Acceptance Criteria
- [ ] All 19 v9.2 tables created successfully
- [ ] Tables include: metric, signal_def, signal_group, followup, display_plan, prompt, provenance_rule, prompt_bind, encounter_context, case, ai_run, ai_response, signal_ledger, evidence, feedback, test_suite, test_case, test_run, test_assertion
- [ ] All indexes created
- [ ] All views created (cases_last_week, cases_last_month)
- [ ] Foreign key relationships NOT added yet (will add incrementally)

### Implementation Steps

#### Step 1.1: Create Migration File
```bash
# Create new migration
npm run db:generate -- --name create_v92_schema
```

#### Step 1.2: Add DDL to Migration
Copy PostgreSQL DDL from `V92_IMPLEMENTATION_GUIDE.md` Part 2 into migration file.

**File:** `migrations/0001_create_v92_schema.sql`

#### Step 1.3: Run Migration
```bash
npm run db:migrate
```

### Testing Steps

#### Test 1.1: Verify Tables Created
```bash
# Connect to database
psql $DATABASE_URL

# List all tables
\dt

# Expected output: 19 tables
# case, encounter_context, metric, signal_def, signal_group,
# followup, display_plan, prompt, provenance_rule, prompt_bind,
# ai_run, ai_response, signal_ledger, evidence, feedback,
# test_suite, test_case, test_run, test_assertion
```

**Expected Result:** All 19 tables listed

#### Test 1.2: Verify Table Structure
```sql
-- Check metric table structure
\d metric

-- Expected columns:
-- metric_id (TEXT, PRIMARY KEY)
-- specialty (TEXT, NOT NULL)
-- metric_name (TEXT, NOT NULL)
-- domain (TEXT)
-- threshold_hours (NUMERIC)
-- content_version (TEXT)
```

**Expected Result:** Correct columns and types

#### Test 1.3: Verify Indexes
```sql
-- Check indexes on metric table
\di metric*

-- Expected: At least one index (primary key)
```

**Expected Result:** Indexes exist

#### Test 1.4: Verify Views
```sql
-- Check views
\dv

-- Expected: cases_last_week, cases_last_month
```

**Expected Result:** 2 views created

### Definition of Done
- [x] All 19 tables exist in database
- [x] Can describe table structure with \d command
- [x] Views created successfully
- [x] Migration committed to git
- [x] Can connect to database without errors

### Estimated Effort: 2 hours

### Rollback Plan
```bash
# If migration fails, rollback
npm run db:rollback
```

---

## Story 2: Update Drizzle Schema Definitions

**As a** developer
**I want** to add v9.2 table definitions to Drizzle ORM
**So that** I can use type-safe database queries

### Acceptance Criteria
- [ ] All 19 table definitions added to `shared/schema.ts`
- [ ] TypeScript types exported for each table
- [ ] No TypeScript compilation errors
- [ ] Can import and use schema definitions in code

### Implementation Steps

#### Step 2.1: Add Table Definitions
**File:** `shared/schema.ts`

Copy Drizzle definitions from `V92_IMPLEMENTATION_GUIDE.md` Part 3.

Add after existing `users` and `sessions` tables:

```typescript
// v9.2 Schema Tables
export const metric = pgTable('metric', {
  metricId: text('metric_id').primaryKey(),
  specialty: text('specialty').notNull(),
  metricName: text('metric_name').notNull(),
  domain: text('domain'),
  thresholdHours: numeric('threshold_hours'),
  contentVersion: text('content_version'),
});

// ... (add all 19 table definitions)
```

#### Step 2.2: Export Types
```typescript
// Export types for each table
export type Metric = typeof metric.$inferSelect;
export type InsertMetric = typeof metric.$inferInsert;

export type SignalDef = typeof signalDef.$inferSelect;
export type InsertSignalDef = typeof signalDef.$inferInsert;

// ... (export types for all tables)
```

### Testing Steps

#### Test 2.1: TypeScript Compilation
```bash
npm run typecheck
```

**Expected Result:** No TypeScript errors

#### Test 2.2: Import Schema in Test File
**File:** `tests/schema.test.ts`
```typescript
import { metric, signalDef, encounterContext } from '../shared/schema';

test('schema imports successfully', () => {
  expect(metric).toBeDefined();
  expect(signalDef).toBeDefined();
  expect(encounterContext).toBeDefined();
});
```

```bash
npm test tests/schema.test.ts
```

**Expected Result:** Test passes

#### Test 2.3: Use Schema in Query
**File:** `tests/schema-query.test.ts`
```typescript
import { db } from '../server/db';
import { metric } from '../shared/schema';

test('can query metric table', async () => {
  const metrics = await db.select().from(metric);
  expect(Array.isArray(metrics)).toBe(true);
});
```

```bash
npm test tests/schema-query.test.ts
```

**Expected Result:** Query executes (even if table is empty)

### Definition of Done
- [x] All 19 Drizzle table definitions added
- [x] All types exported
- [x] TypeScript compiles without errors
- [x] Can import schema in other files
- [x] Can run queries using schema
- [x] Changes committed to git

### Estimated Effort: 2 hours

---

## Story 3: Validate Database Connection & Queries

**As a** developer
**I want** to validate that I can read/write to all v9.2 tables
**So that** I know the database setup is correct

### Acceptance Criteria
- [ ] Can INSERT into each table
- [ ] Can SELECT from each table
- [ ] Can UPDATE records
- [ ] Can DELETE records
- [ ] No database errors

### Implementation Steps

#### Step 3.1: Create Validation Script
**File:** `scripts/validate-database.ts`

```typescript
import { db } from '../server/db';
import {
  metric, signalDef, signalGroup, followup, displayPlan,
  prompt, provenanceRule, promptBind, encounterContext,
  caseTable, aiRun, aiResponse, signalLedger, evidence, feedback
} from '../shared/schema';
import { eq } from 'drizzle-orm';

async function validateDatabase() {
  console.log('🔍 Validating database setup...\n');

  // Test 1: Insert into metric
  console.log('1️⃣ Testing metric table...');
  const [testMetric] = await db.insert(metric).values({
    metricId: 'TEST_001',
    specialty: 'Test',
    metricName: 'Test Metric',
    domain: 'test',
    thresholdHours: '10',
    contentVersion: '1.0',
  }).returning();
  console.log('   ✅ INSERT successful:', testMetric.metricId);

  // Test 2: Select from metric
  const metrics = await db.select().from(metric).where(eq(metric.metricId, 'TEST_001'));
  console.log('   ✅ SELECT successful:', metrics.length, 'row(s)');

  // Test 3: Update metric
  await db.update(metric)
    .set({ metricName: 'Updated Test Metric' })
    .where(eq(metric.metricId, 'TEST_001'));
  console.log('   ✅ UPDATE successful');

  // Test 4: Delete metric
  await db.delete(metric).where(eq(metric.metricId, 'TEST_001'));
  console.log('   ✅ DELETE successful\n');

  // Test 5: Insert into signal_def
  console.log('2️⃣ Testing signal_def table...');
  await db.insert(metric).values({
    metricId: 'TEST_002',
    specialty: 'Test',
    metricName: 'Test Metric 2',
    domain: 'test',
  });

  await db.insert(signalDef).values({
    metricId: 'TEST_002',
    signalCode: 'test_signal',
    groupId: 'test_group',
    severity: 'info',
    status: 'active',
  });
  console.log('   ✅ INSERT successful');

  // Cleanup
  await db.delete(signalDef).where(eq(signalDef.metricId, 'TEST_002'));
  await db.delete(metric).where(eq(metric.metricId, 'TEST_002'));
  console.log('   ✅ Cleanup successful\n');

  // Test remaining tables (similar pattern)
  console.log('3️⃣ Testing signal_group table...');
  // ... (test insert/select/update/delete)

  console.log('4️⃣ Testing followup table...');
  // ... (test CRUD operations)

  console.log('5️⃣ Testing display_plan table...');
  // ... (test CRUD operations)

  // ... (test all 19 tables)

  console.log('\n✅ All database validations passed!');
}

validateDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
```

#### Step 3.2: Run Validation Script
```bash
npm run validate-db
```

### Testing Steps

#### Test 3.1: Run Full Validation
```bash
npm run validate-db
```

**Expected Output:**
```
🔍 Validating database setup...

1️⃣ Testing metric table...
   ✅ INSERT successful: TEST_001
   ✅ SELECT successful: 1 row(s)
   ✅ UPDATE successful
   ✅ DELETE successful

2️⃣ Testing signal_def table...
   ✅ INSERT successful
   ✅ Cleanup successful

... (all 19 tables)

✅ All database validations passed!
```

#### Test 3.2: Verify Database is Clean
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM metric;"
```

**Expected Result:** Count = 0 (all test data cleaned up)

### Definition of Done
- [x] Validation script runs successfully
- [x] All 19 tables tested for CRUD operations
- [x] No database errors
- [x] Database is clean after validation
- [x] Script committed to git
- [x] Can run validation script anytime

### Estimated Effort: 3 hours

---

# EPIC 2: Excel Data Pipeline

## Story 4: Create Excel Parser Service

**As a** developer
**I want** to parse the USNWR Excel file into structured data
**So that** I can load metadata into the database

### Acceptance Criteria
- [ ] Excel parser reads all 8 sheets successfully
- [ ] Data validated with Zod schemas
- [ ] Parser handles missing/invalid data gracefully
- [ ] Can export parsed data as JSON

### Implementation Steps

#### Step 4.1: Install Dependencies
```bash
npm install xlsx
```

#### Step 4.2: Create Excel Parser
**File:** `server/services/excelParser.ts`

```typescript
import * as XLSX from 'xlsx';
import { z } from 'zod';

// Define Zod schemas for validation
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

// ... (add schemas for remaining sheets)

export class ExcelParser {
  private workbook: XLSX.WorkBook | null = null;

  async loadExcel(filePath: string) {
    this.workbook = XLSX.readFile(filePath);
    console.log('✅ Loaded Excel file:', filePath);
    console.log('📄 Sheets found:', this.workbook.SheetNames);
  }

  parseSheet<T>(sheetName: string, schema: z.ZodSchema<T>): T[] {
    if (!this.workbook) throw new Error('Workbook not loaded');

    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`Sheet ${sheetName} not found`);

    // Convert sheet to JSON
    const rawData = XLSX.utils.sheet_to_json(sheet);

    // Validate each row
    const validatedData = rawData.map((row, index) => {
      try {
        return schema.parse(row);
      } catch (error) {
        console.error(`❌ Validation error in ${sheetName} row ${index}:`, error);
        throw error;
      }
    });

    console.log(`✅ Parsed ${validatedData.length} rows from ${sheetName}`);
    return validatedData;
  }

  async parseAllSheets() {
    const metrics = this.parseSheet('metrics', MetricSchema);
    const signals = this.parseSheet('signals', SignalSchema);
    // ... (parse all 8 sheets)

    return { metrics, signals /* ... */ };
  }
}

export const excelParser = new ExcelParser();
```

#### Step 4.3: Create Test Script
**File:** `scripts/test-excel-parser.ts`

```typescript
import { excelParser } from '../server/services/excelParser';
import path from 'path';

async function testParser() {
  const excelPath = path.join(__dirname, '../data/USNWR_Master_AllMetrics_v4.xlsx');

  console.log('🧪 Testing Excel Parser...\n');

  await excelParser.loadExcel(excelPath);
  const data = await excelParser.parseAllSheets();

  console.log('\n📊 Parsing Results:');
  console.log(`  Metrics: ${data.metrics.length}`);
  console.log(`  Signals: ${data.signals.length}`);
  // ... (log counts for all sheets)

  // Export to JSON for inspection
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '../data/parsed-metadata.json'),
    JSON.stringify(data, null, 2)
  );

  console.log('\n✅ Parsed data exported to data/parsed-metadata.json');
}

testParser();
```

### Testing Steps

#### Test 4.1: Verify Excel File Exists
```bash
ls -lh data/USNWR_Master_AllMetrics_v4.xlsx
```

**Expected Result:** File exists and is ~500KB-2MB

#### Test 4.2: Run Parser Test
```bash
npm run test-parser
```

**Expected Output:**
```
🧪 Testing Excel Parser...

✅ Loaded Excel file: /path/to/USNWR_Master_AllMetrics_v4.xlsx
📄 Sheets found: [ 'metrics', 'signals', 'groups', 'followups', 'display_plan', 'prompts', 'provenance_rules', 'versions' ]

✅ Parsed 54 rows from metrics
✅ Parsed 542 rows from signals
✅ Parsed 223 rows from groups
✅ Parsed 301 rows from followups
✅ Parsed 323 rows from display_plan
✅ Parsed 108 rows from prompts
✅ Parsed 108 rows from provenance_rules

📊 Parsing Results:
  Metrics: 54
  Signals: 542
  Groups: 223
  Followups: 301
  Display Plan: 323
  Prompts: 108
  Provenance Rules: 108

✅ Parsed data exported to data/parsed-metadata.json
```

#### Test 4.3: Inspect Parsed JSON
```bash
cat data/parsed-metadata.json | head -50
```

**Expected Result:** Valid JSON with structured data

#### Test 4.4: Verify Data Integrity
```bash
# Count metrics by specialty
cat data/parsed-metadata.json | jq '.metrics | group_by(.specialty) | map({specialty: .[0].specialty, count: length})'
```

**Expected Result:** Grouped counts match Excel sheet

### Definition of Done
- [x] Excel parser successfully reads all 8 sheets
- [x] All rows validated with Zod schemas
- [x] Parsed data exported to JSON
- [x] Row counts match Excel file
- [x] No parsing errors
- [x] Code committed to git

### Estimated Effort: 4 hours

---

## Story 5: Validate Excel Data Relationships

**As a** developer
**I want** to validate relationships between Excel sheets
**So that** I catch data integrity issues before database insertion

### Acceptance Criteria
- [ ] All foreign keys validated (signal.metric_id exists in metrics)
- [ ] No orphaned records
- [ ] Required fields present
- [ ] Data types correct

### Implementation Steps

#### Step 5.1: Add Validation Method
**File:** `server/services/excelParser.ts` (add to class)

```typescript
validateRelationships(data: ReturnType<ExcelParser['parseAllSheets']>) {
  console.log('\n🔍 Validating relationships...');

  const errors: string[] = [];
  const { metrics, signals, groups, followups, displayPlan, prompts, provenanceRules } = data;

  // Build set of valid metric IDs
  const metricIds = new Set(metrics.map(m => m.metric_id));
  console.log(`  Found ${metricIds.size} unique metrics`);

  // Validate signals reference valid metrics
  console.log('  Checking signal → metric references...');
  for (const signal of signals) {
    if (!metricIds.has(signal.metric_id)) {
      errors.push(`Signal '${signal.signal_code}' references unknown metric '${signal.metric_id}'`);
    }
  }

  // Validate groups reference valid metrics
  console.log('  Checking group → metric references...');
  for (const group of groups) {
    if (!metricIds.has(group.metric_id)) {
      errors.push(`Group '${group.group_id}' references unknown metric '${group.metric_id}'`);
    }
  }

  // Validate followups reference valid metrics
  console.log('  Checking followup → metric references...');
  for (const followup of followups) {
    if (!metricIds.has(followup.metric_id)) {
      errors.push(`Followup '${followup.followup_id}' references unknown metric '${followup.metric_id}'`);
    }
  }

  // Validate signals reference valid groups
  console.log('  Checking signal → group references...');
  const groupKeys = new Set(groups.map(g => `${g.metric_id}:${g.group_id}`));
  for (const signal of signals) {
    const key = `${signal.metric_id}:${signal.group_id}`;
    if (!groupKeys.has(key)) {
      errors.push(`Signal '${signal.signal_code}' references unknown group '${signal.group_id}' for metric '${signal.metric_id}'`);
    }
  }

  // Report results
  if (errors.length > 0) {
    console.error('\n❌ Validation Errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    throw new Error(`${errors.length} validation error(s) found`);
  }

  console.log('✅ All relationships validated successfully\n');
}
```

#### Step 5.2: Update Test Script
**File:** `scripts/test-excel-parser.ts` (add validation)

```typescript
async function testParser() {
  // ... existing parsing code ...

  const data = await excelParser.parseAllSheets();

  // Add validation step
  excelParser.validateRelationships(data);

  // ... rest of code ...
}
```

### Testing Steps

#### Test 5.1: Run Validation
```bash
npm run test-parser
```

**Expected Output:**
```
🔍 Validating relationships...
  Found 54 unique metrics
  Checking signal → metric references...
  Checking group → metric references...
  Checking followup → metric references...
  Checking signal → group references...
✅ All relationships validated successfully
```

#### Test 5.2: Test with Invalid Data (Intentional Error)
Create temporary test Excel file with orphaned signal:

```typescript
// In test file
const testData = {
  metrics: [{ metric_id: 'M1', ... }],
  signals: [
    { metric_id: 'M1', signal_code: 'S1', group_id: 'G1' },
    { metric_id: 'M999', signal_code: 'S2', group_id: 'G1' }, // Invalid!
  ],
  groups: [{ metric_id: 'M1', group_id: 'G1' }],
  // ...
};

excelParser.validateRelationships(testData);
```

**Expected Output:**
```
❌ Validation Errors:
  - Signal 'S2' references unknown metric 'M999'
Error: 1 validation error(s) found
```

### Definition of Done
- [x] Validation method implemented
- [x] All foreign key relationships checked
- [x] Test passes with valid data
- [x] Test fails with invalid data (intentional)
- [x] Clear error messages for violations
- [x] Code committed to git

### Estimated Effort: 2 hours

---

## Story 6: Create Database Seeding Script

**As a** developer
**I want** to load parsed Excel data into PostgreSQL
**So that** the database is populated with metadata

### Acceptance Criteria
- [ ] Script inserts all parsed data into database
- [ ] Maintains referential integrity (inserts in correct order)
- [ ] Can be run multiple times (idempotent)
- [ ] Reports success/failure clearly

### Implementation Steps

#### Step 6.1: Create Seeding Script
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
  console.log('🌱 Starting metadata seed...\n');

  try {
    // Step 1: Load and parse Excel
    console.log('1️⃣ Loading Excel file...');
    const excelPath = path.join(__dirname, '../data/USNWR_Master_AllMetrics_v4.xlsx');
    await excelParser.loadExcel(excelPath);

    console.log('\n2️⃣ Parsing all sheets...');
    const data = await excelParser.parseAllSheets();

    console.log('\n3️⃣ Validating relationships...');
    excelParser.validateRelationships(data);

    // Step 2: Clear existing metadata
    console.log('\n4️⃣ Clearing existing metadata...');
    console.log('   ⚠️  This will delete all existing metadata!');

    await db.delete(provenanceRule);
    console.log('   ✅ Cleared provenance_rule');

    await db.delete(displayPlan);
    console.log('   ✅ Cleared display_plan');

    await db.delete(followup);
    console.log('   ✅ Cleared followup');

    await db.delete(signalDef);
    console.log('   ✅ Cleared signal_def');

    await db.delete(signalGroup);
    console.log('   ✅ Cleared signal_group');

    await db.delete(prompt);
    console.log('   ✅ Cleared prompt');

    await db.delete(promptBind);
    console.log('   ✅ Cleared prompt_bind');

    await db.delete(metric);
    console.log('   ✅ Cleared metric');

    // Step 3: Insert metrics
    console.log(`\n5️⃣ Inserting ${data.metrics.length} metrics...`);
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
    console.log('   ✅ Metrics inserted');

    // Step 4: Insert signal groups
    console.log(`\n6️⃣ Inserting ${data.groups.length} signal groups...`);
    for (const g of data.groups) {
      await db.insert(signalGroup).values({
        metricId: g.metric_id,
        groupId: g.group_id,
        groupCode: g.group_code,
      });
    }
    console.log('   ✅ Signal groups inserted');

    // Step 5: Insert signal definitions
    console.log(`\n7️⃣ Inserting ${data.signals.length} signal definitions...`);
    for (const s of data.signals) {
      await db.insert(signalDef).values({
        metricId: s.metric_id,
        signalCode: s.signal_code,
        groupId: s.group_id,
        severity: s.severity,
        status: null, // Computed at runtime
      });
    }
    console.log('   ✅ Signal definitions inserted');

    // ... (continue for remaining tables)

    // Step 6: Verify counts
    console.log('\n8️⃣ Verifying inserted data...');
    const metricCount = await db.select().from(metric);
    const signalCount = await db.select().from(signalDef);
    const groupCount = await db.select().from(signalGroup);

    console.log(`   📊 Metrics: ${metricCount.length}`);
    console.log(`   📊 Signals: ${signalCount.length}`);
    console.log(`   📊 Groups: ${groupCount.length}`);

    console.log('\n✅ Metadata seeding complete!\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedMetadata()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedMetadata };
```

#### Step 6.2: Add NPM Script
**File:** `package.json`

```json
{
  "scripts": {
    "seed-metadata": "tsx scripts/seed-metadata.ts"
  }
}
```

### Testing Steps

#### Test 6.1: Run Seeding Script
```bash
npm run seed-metadata
```

**Expected Output:**
```
🌱 Starting metadata seed...

1️⃣ Loading Excel file...
✅ Loaded Excel file

2️⃣ Parsing all sheets...
✅ Parsed 54 rows from metrics
✅ Parsed 542 rows from signals
...

3️⃣ Validating relationships...
✅ All relationships validated

4️⃣ Clearing existing metadata...
   ⚠️  This will delete all existing metadata!
   ✅ Cleared provenance_rule
   ✅ Cleared display_plan
   ...

5️⃣ Inserting 54 metrics...
   ✅ Metrics inserted

6️⃣ Inserting 223 signal groups...
   ✅ Signal groups inserted

7️⃣ Inserting 542 signal definitions...
   ✅ Signal definitions inserted

8️⃣ Verifying inserted data...
   📊 Metrics: 54
   📊 Signals: 542
   📊 Groups: 223

✅ Metadata seeding complete!
```

#### Test 6.2: Verify Data in Database
```bash
psql $DATABASE_URL
```

```sql
-- Count metrics
SELECT COUNT(*) FROM metric;
-- Expected: 54

-- Count signals
SELECT COUNT(*) FROM signal_def;
-- Expected: 542

-- Check sample metric
SELECT * FROM metric LIMIT 1;

-- Check signals for a metric
SELECT sd.signal_code, sg.group_code
FROM signal_def sd
JOIN signal_group sg ON sd.metric_id = sg.metric_id AND sd.group_id = sg.group_id
WHERE sd.metric_id = 'ORTHO_I25'
LIMIT 10;
```

#### Test 6.3: Run Seeding Twice (Idempotency)
```bash
npm run seed-metadata
npm run seed-metadata
```

**Expected Result:** Second run completes successfully with same counts

### Definition of Done
- [x] Seeding script runs successfully
- [x] All Excel data inserted into database
- [x] Counts match Excel file
- [x] Can query inserted data
- [x] Script is idempotent (can run multiple times)
- [x] Clear success/error messages
- [x] Code committed to git

### Estimated Effort: 4 hours

---

## ⏸️ CHECKPOINT 1: Validate Foundation

**Before proceeding to Epic 3, verify:**

### Checklist
- [ ] All 19 tables exist in database
- [ ] Drizzle schema compiles without errors
- [ ] Validation script passes
- [ ] Excel parser works for all 8 sheets
- [ ] Relationships validated
- [ ] Database seeded with 1,509+ rows
- [ ] Can query metrics, signals, groups

### Verification Commands
```bash
# 1. Check database tables
psql $DATABASE_URL -c "\dt" | wc -l
# Expected: 19+ tables

# 2. Run TypeScript check
npm run typecheck
# Expected: No errors

# 3. Run validation
npm run validate-db
# Expected: All tests pass

# 4. Check row counts
psql $DATABASE_URL -c "
  SELECT
    (SELECT COUNT(*) FROM metric) as metrics,
    (SELECT COUNT(*) FROM signal_def) as signals,
    (SELECT COUNT(*) FROM signal_group) as groups;
"
# Expected: metrics=54, signals=542, groups=223

# 5. Test parser
npm run test-parser
# Expected: No errors

# 6. Re-seed
npm run seed-metadata
# Expected: Completes successfully
```

### If All Checks Pass: ✅ Proceed to Epic 3
### If Any Check Fails: ❌ Fix before continuing

---

# EPIC 3: Metadata API

## Story 7: Create Metadata API Endpoints

**As a** frontend developer
**I want** REST endpoints to fetch metadata
**So that** I can load specialties, modules, and signals dynamically

### Acceptance Criteria
- [ ] GET /api/metadata/metrics returns all metrics grouped by specialty
- [ ] GET /api/metadata/signals/:metric_id returns signals with groups
- [ ] GET /api/metadata/followups/:metric_id returns followup questions
- [ ] All endpoints return JSON
- [ ] Response times < 200ms

### Implementation Steps

#### Step 7.1: Create Metadata Routes File
**File:** `server/routes/metadata.ts`

```typescript
import { Router } from 'express';
import { db } from '../db';
import { metric, signalDef, signalGroup, followup } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/metadata/metrics
// Returns all metrics grouped by specialty
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await db.select().from(metric);

    // Group by specialty
    const grouped = metrics.reduce((acc, m) => {
      if (!acc[m.specialty]) acc[m.specialty] = [];
      acc[m.specialty].push(m);
      return acc;
    }, {} as Record<string, typeof metrics>);

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/metadata/signals/:metric_id
// Returns signals and groups for a metric
router.get('/signals/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;

    const signals = await db.select()
      .from(signalDef)
      .where(eq(signalDef.metricId, metric_id));

    const groups = await db.select()
      .from(signalGroup)
      .where(eq(signalGroup.metricId, metric_id));

    res.json({
      metric_id,
      signals,
      groups,
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// GET /api/metadata/followups/:metric_id
router.get('/followups/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;

    const followups = await db.select()
      .from(followup)
      .where(eq(followup.metricId, metric_id));

    res.json(followups);
  } catch (error) {
    console.error('Error fetching followups:', error);
    res.status(500).json({ error: 'Failed to fetch followups' });
  }
});

export default router;
```

#### Step 7.2: Mount Routes in Server
**File:** `server/index.ts` (add)

```typescript
import metadataRoutes from './routes/metadata';

// ... existing code ...

app.use('/api/metadata', metadataRoutes);
```

### Testing Steps

#### Test 7.1: Start Server
```bash
npm run dev
```

#### Test 7.2: Test Metrics Endpoint
```bash
curl http://localhost:5000/api/metadata/metrics | jq '.'
```

**Expected Response:**
```json
{
  "Ortho": [
    {
      "metricId": "ORTHO_I25",
      "specialty": "Ortho",
      "metricName": "In OR <18 hrs – Supracondylar fracture",
      "domain": "timeliness",
      "thresholdHours": "18.0",
      "contentVersion": "0.0.1"
    },
    ...
  ],
  "BehavioralHealth": [...]
}
```

#### Test 7.3: Test Signals Endpoint
```bash
curl http://localhost:5000/api/metadata/signals/ORTHO_I25 | jq '.signals | length'
```

**Expected Response:** Number of signals (e.g., 12)

#### Test 7.4: Test Followups Endpoint
```bash
curl http://localhost:5000/api/metadata/followups/ORTHO_I25 | jq '.[] | .questionText'
```

**Expected Response:** List of follow-up questions

#### Test 7.5: Measure Response Time
```bash
time curl -s http://localhost:5000/api/metadata/metrics > /dev/null
```

**Expected Result:** < 0.2 seconds

### Definition of Done
- [x] All 3 endpoints implemented
- [x] Endpoints return correct data
- [x] Response times acceptable
- [x] Error handling in place
- [x] Server starts without errors
- [x] Manual tests pass
- [x] Code committed to git

### Estimated Effort: 3 hours

---

## Story 8: Add API Response Caching

**As a** backend developer
**I want** to cache API responses
**So that** repeated requests are faster

### Acceptance Criteria
- [ ] Responses cached for 1 hour
- [ ] Cache hit rate > 80% in testing
- [ ] Can clear cache manually
- [ ] Cache status visible in logs

### Implementation Steps

#### Step 8.1: Add Caching to Metadata Routes
**File:** `server/routes/metadata.ts` (update)

```typescript
// Add at top of file
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, { data: any; timestamp: number }>();

function getFromCache(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`✅ Cache HIT: ${key}`);
    return cached.data;
  }
  console.log(`❌ Cache MISS: ${key}`);
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
  console.log(`💾 Cached: ${key}`);
}

// Update metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const cacheKey = 'all_metrics';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const metrics = await db.select().from(metric);
    const grouped = /* ... grouping logic ... */;

    setCache(cacheKey, grouped);
    res.json(grouped);
  } catch (error) {
    // ... error handling
  }
});

// Add cache clear endpoint
router.post('/reload', async (req, res) => {
  cache.clear();
  console.log('🗑️  Cache cleared');
  res.json({ message: 'Cache cleared successfully' });
});
```

### Testing Steps

#### Test 8.1: Cold Start (Cache Miss)
```bash
# Clear cache first
curl -X POST http://localhost:5000/api/metadata/reload

# First request (cache miss)
time curl -s http://localhost:5000/api/metadata/metrics > /dev/null
```

**Expected Server Log:**
```
❌ Cache MISS: all_metrics
💾 Cached: all_metrics
```

**Expected Time:** ~100-200ms

#### Test 8.2: Warm Request (Cache Hit)
```bash
# Second request (cache hit)
time curl -s http://localhost:5000/api/metadata/metrics > /dev/null
```

**Expected Server Log:**
```
✅ Cache HIT: all_metrics
```

**Expected Time:** ~10-50ms (much faster!)

#### Test 8.3: Multiple Requests (Measure Cache Hit Rate)
```bash
# Bash script to test cache
for i in {1..100}; do
  curl -s http://localhost:5000/api/metadata/metrics > /dev/null
done
```

**Check server logs:**
```bash
# Count cache hits
grep "Cache HIT" server.log | wc -l
# Expected: 99 (all but first request)

# Count cache misses
grep "Cache MISS" server.log | wc -l
# Expected: 1
```

**Cache Hit Rate:** 99/100 = 99% ✅

#### Test 8.4: Cache Expiry
```bash
# Request now
curl http://localhost:5000/api/metadata/metrics

# Wait 61 minutes (or mock time in test)
# Request again

# Expected: Cache miss (expired)
```

### Definition of Done
- [x] Caching implemented for all metadata endpoints
- [x] Cache hit rate > 80%
- [x] Cache expiry works after 1 hour
- [x] Cache clear endpoint works
- [x] Logs show cache status
- [x] Performance improved (faster responses)
- [x] Code committed to git

### Estimated Effort: 2 hours

---

## Story 9: Create API Integration Tests

**As a** developer
**I want** automated tests for metadata API
**So that** I can verify endpoints work correctly

### Acceptance Criteria
- [ ] Tests for all metadata endpoints
- [ ] Tests verify response structure
- [ ] Tests verify data correctness
- [ ] All tests passing

### Implementation Steps

#### Step 9.1: Create Test File
**File:** `tests/api/metadata.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index'; // Export app from server

describe('Metadata API', () => {
  beforeAll(async () => {
    // Ensure database is seeded
    // (In real setup, use test database)
  });

  describe('GET /api/metadata/metrics', () => {
    it('should return metrics grouped by specialty', async () => {
      const response = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('Ortho');
      expect(Array.isArray(response.body.Ortho)).toBe(true);
      expect(response.body.Ortho.length).toBeGreaterThan(0);
    });

    it('should include metric properties', async () => {
      const response = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      const firstMetric = response.body.Ortho[0];
      expect(firstMetric).toHaveProperty('metricId');
      expect(firstMetric).toHaveProperty('specialty');
      expect(firstMetric).toHaveProperty('metricName');
    });

    it('should respond in < 200ms', async () => {
      const start = Date.now();
      await request(app).get('/api/metadata/metrics');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
    });
  });

  describe('GET /api/metadata/signals/:metric_id', () => {
    it('should return signals for valid metric', async () => {
      const response = await request(app)
        .get('/api/metadata/signals/ORTHO_I25')
        .expect(200);

      expect(response.body).toHaveProperty('metric_id', 'ORTHO_I25');
      expect(response.body).toHaveProperty('signals');
      expect(response.body).toHaveProperty('groups');
      expect(Array.isArray(response.body.signals)).toBe(true);
    });

    it('should return empty arrays for unknown metric', async () => {
      const response = await request(app)
        .get('/api/metadata/signals/UNKNOWN')
        .expect(200);

      expect(response.body.signals).toHaveLength(0);
      expect(response.body.groups).toHaveLength(0);
    });
  });

  describe('GET /api/metadata/followups/:metric_id', () => {
    it('should return followup questions', async () => {
      const response = await request(app)
        .get('/api/metadata/followups/ORTHO_I25')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('questionText');
      }
    });
  });

  describe('Caching', () => {
    it('should cache responses', async () => {
      // Clear cache
      await request(app).post('/api/metadata/reload');

      // First request
      const start1 = Date.now();
      await request(app).get('/api/metadata/metrics');
      const duration1 = Date.now() - start1;

      // Second request (should be cached)
      const start2 = Date.now();
      await request(app).get('/api/metadata/metrics');
      const duration2 = Date.now() - start2;

      // Cached request should be faster
      expect(duration2).toBeLessThan(duration1);
    });
  });
});
```

#### Step 9.2: Install Test Dependencies
```bash
npm install -D supertest @types/supertest
```

### Testing Steps

#### Test 9.1: Run API Tests
```bash
npm test tests/api/metadata.test.ts
```

**Expected Output:**
```
✓ Metadata API > GET /api/metadata/metrics > should return metrics grouped by specialty
✓ Metadata API > GET /api/metadata/metrics > should include metric properties
✓ Metadata API > GET /api/metadata/metrics > should respond in < 200ms
✓ Metadata API > GET /api/metadata/signals/:metric_id > should return signals for valid metric
✓ Metadata API > GET /api/metadata/signals/:metric_id > should return empty arrays for unknown metric
✓ Metadata API > GET /api/metadata/followups/:metric_id > should return followup questions
✓ Metadata API > Caching > should cache responses

Test Files  1 passed (1)
     Tests  7 passed (7)
```

### Definition of Done
- [x] All API endpoints have tests
- [x] Tests verify response structure
- [x] Tests verify performance
- [x] Tests verify caching
- [x] All tests passing
- [x] Test coverage > 80% for metadata routes
- [x] Code committed to git

### Estimated Effort: 3 hours

---

## ⏸️ CHECKPOINT 2: Validate API Layer

**Before proceeding to Epic 4, verify:**

### Checklist
- [ ] All 3 metadata endpoints working
- [ ] Responses cached for 1 hour
- [ ] Cache clear endpoint works
- [ ] All integration tests passing
- [ ] Response times < 200ms
- [ ] Can fetch metrics, signals, followups via API

### Verification Commands
```bash
# 1. Start server
npm run dev

# 2. Test endpoints (in another terminal)
curl http://localhost:5000/api/metadata/metrics | jq '. | keys'
# Expected: ["BehavioralHealth", "Ortho"]

curl http://localhost:5000/api/metadata/signals/ORTHO_I25 | jq '.signals | length'
# Expected: number > 0

# 3. Run tests
npm test tests/api/metadata.test.ts
# Expected: All tests pass

# 4. Check cache
# Request twice, second should be faster
time curl -s http://localhost:5000/api/metadata/metrics > /dev/null
time curl -s http://localhost:5000/api/metadata/metrics > /dev/null
```

### If All Checks Pass: ✅ Proceed to Epic 4
### If Any Check Fails: ❌ Fix before continuing

---

# EPIC 4: Dynamic Frontend

## Story 10: Create React Metadata Hooks

**As a** frontend developer
**I want** React hooks to fetch metadata
**So that** I can use metadata in components

### Acceptance Criteria
- [ ] useMetrics() hook fetches all metrics
- [ ] useSignals(metricId) hook fetches signals for a metric
- [ ] useFollowups(metricId) hook fetches followup questions
- [ ] Hooks use React Query for caching
- [ ] Loading and error states handled

### Implementation Steps

#### Step 10.1: Create Hooks File
**File:** `client/src/hooks/useMetadata.ts`

```typescript
import { useQuery } from '@tanstack/react-query';

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

// Helper: Get unique specialties from metrics
export function useSpecialties() {
  const { data: metricsGrouped, isLoading } = useMetrics();

  const specialties = metricsGrouped ? Object.keys(metricsGrouped) : [];

  return { specialties, isLoading };
}

// Helper: Get metrics for a specialty
export function useMetricsForSpecialty(specialty: string | null) {
  const { data: metricsGrouped, isLoading } = useMetrics();

  const metrics = specialty && metricsGrouped ? metricsGrouped[specialty] || [] : [];

  return { metrics, isLoading };
}
```

### Testing Steps

#### Test 10.1: Create Test Component
**File:** `client/src/tests/MetadataHooksTest.tsx`

```typescript
import { useMetrics, useSpecialties, useSignals } from '../hooks/useMetadata';

export function MetadataHooksTest() {
  const { data: metrics, isLoading: loadingMetrics } = useMetrics();
  const { specialties } = useSpecialties();
  const { data: signals } = useSignals('ORTHO_I25');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Metadata Hooks Test</h1>

      <div className="mb-4">
        <h2 className="font-semibold">Specialties:</h2>
        {loadingMetrics ? (
          <p>Loading...</p>
        ) : (
          <ul>
            {specialties.map(s => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">All Metrics:</h2>
        {metrics && (
          <pre className="bg-gray-100 p-2 text-xs">
            {JSON.stringify(metrics, null, 2).slice(0, 500)}...
          </pre>
        )}
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Signals for ORTHO_I25:</h2>
        {signals && (
          <p>Found {signals.signals.length} signals in {signals.groups.length} groups</p>
        )}
      </div>
    </div>
  );
}
```

#### Test 10.2: Add Test Route
**File:** `client/src/App.tsx` (add route)

```typescript
<Route path="/test-hooks" component={MetadataHooksTest} />
```

#### Test 10.3: Manual Browser Test
```bash
# Start dev server
npm run dev

# Open browser
http://localhost:5000/test-hooks
```

**Expected Display:**
```
Specialties:
- Ortho
- BehavioralHealth

All Metrics:
{
  "Ortho": [
    { "metricId": "ORTHO_I25", ... },
    ...
  ]
}

Signals for ORTHO_I25:
Found 12 signals in 4 groups
```

#### Test 10.4: Check React Query DevTools
Open React Query DevTools in browser.

**Expected:**
- See queries: `['metadata', 'metrics']`, `['metadata', 'signals', 'ORTHO_I25']`
- Status: "success"
- Cache time: ~1 hour

### Definition of Done
- [x] All hooks implemented
- [x] Hooks use React Query
- [x] Loading states handled
- [x] Error states handled
- [x] Test component displays data correctly
- [x] React Query caching working
- [x] Code committed to git

### Estimated Effort: 3 hours

---

## Story 11: Update Intake Page - Dynamic Specialty Selection

**As a** user
**I want** to see all available specialties from the database
**So that** I can select the correct specialty for my case

### Acceptance Criteria
- [ ] Specialty chips load from database (not hardcoded)
- [ ] Shows loading state while fetching
- [ ] Shows error if fetch fails
- [ ] Clicking specialty highlights it

### Implementation Steps

#### Step 11.1: Update Intake Page
**File:** `client/src/pages/intake.tsx` (update)

```typescript
import { useState } from 'react';
import { useSpecialties, useMetricsForSpecialty } from '@/hooks/useMetadata';
import { ChipButton } from '@/components/ui/ChipButton';

export default function IntakePage() {
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);

  // Load specialties dynamically from database
  const { specialties, isLoading } = useSpecialties();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Case Intake</h1>

      {/* Dynamic Specialty Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Select Specialty
        </label>

        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-gray-600">Loading specialties...</span>
          </div>
        ) : specialties.length === 0 ? (
          <div className="text-red-600">
            No specialties found. Please run: npm run seed-metadata
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {specialties.map((specialty) => (
              <ChipButton
                key={specialty}
                variant={selectedSpecialty === specialty ? 'primary' : 'secondary'}
                onClick={() => setSelectedSpecialty(specialty)}
              >
                {specialty}
              </ChipButton>
            ))}
          </div>
        )}
      </div>

      {/* Show selected specialty */}
      {selectedSpecialty && (
        <div className="mt-4 p-4 bg-blue-50 rounded">
          <p className="text-sm text-blue-800">
            Selected: <strong>{selectedSpecialty}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
```

### Testing Steps

#### Test 11.1: Visual Test - Loading State
```bash
# Start dev server
npm run dev

# Open browser (before database seeded)
http://localhost:5000/intake
```

**Expected:** Shows "Loading specialties..." spinner

#### Test 11.2: Visual Test - Loaded State
```bash
# Ensure database is seeded
npm run seed-metadata

# Refresh browser
http://localhost:5000/intake
```

**Expected:**
- Shows 2 specialty chips: "Ortho", "BehavioralHealth"
- Chips are clickable
- No loading spinner

#### Test 11.3: Interaction Test - Click Specialty
1. Click "Ortho" chip
2. Chip should highlight (primary variant)
3. Blue box appears showing "Selected: Ortho"
4. Click "BehavioralHealth"
5. "Ortho" chip de-highlights
6. "BehavioralHealth" highlights
7. Box shows "Selected: BehavioralHealth"

#### Test 11.4: Network Test - Check API Call
Open browser DevTools → Network tab

**Expected:**
- See GET request to `/api/metadata/metrics`
- Status: 200
- Response contains specialty data
- Only ONE request (React Query caches)

### Definition of Done
- [x] Specialty selection loads from database
- [x] Loading state displays correctly
- [x] Specialty chips render correctly
- [x] Clicking specialty updates selection
- [x] No hardcoded specialty data
- [x] React Query caches API response
- [x] Code committed to git

### Estimated Effort: 2 hours

---

## Story 12: Update Intake Page - Dynamic Module Selection

**As a** user
**I want** to see all available modules for my selected specialty
**So that** I can choose the correct quality metric to abstract

### Acceptance Criteria
- [ ] Module chips only appear after specialty selected
- [ ] Modules load from database for selected specialty
- [ ] Shows module name and threshold (if applicable)
- [ ] Clicking module highlights it

### Implementation Steps

#### Step 12.1: Update Intake Page - Add Module Selection
**File:** `client/src/pages/intake.tsx` (update)

```typescript
import { useState } from 'react';
import { useSpecialties, useMetricsForSpecialty } from '@/hooks/useMetadata';

export default function IntakePage() {
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  const { specialties, isLoading: loadingSpecialties } = useSpecialties();

  // Load metrics for selected specialty
  const { metrics, isLoading: loadingMetrics } = useMetricsForSpecialty(selectedSpecialty);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Case Intake</h1>

      {/* Specialty Selector (from Story 11) */}
      <div className="mb-6">
        {/* ... specialty selector code ... */}
      </div>

      {/* Module/Metric Selector (NEW) */}
      {selectedSpecialty && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Select Module / Quality Metric
          </label>

          {loadingMetrics ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span className="text-gray-600">Loading modules...</span>
            </div>
          ) : metrics.length === 0 ? (
            <div className="text-yellow-600">
              No modules found for {selectedSpecialty}
            </div>
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
                    <span className="ml-2 text-xs opacity-75">
                      ≤{metric.thresholdHours}h
                    </span>
                  )}
                </ChipButton>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Show selected metric */}
      {selectedMetricId && (
        <div className="mt-4 p-4 bg-green-50 rounded">
          <p className="text-sm text-green-800">
            Selected Metric: <strong>{selectedMetricId}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
```

### Testing Steps

#### Test 12.1: Module Visibility Test
1. Navigate to `/intake`
2. **Before selecting specialty:** Module selector should NOT be visible
3. Select "Ortho" specialty
4. **After selecting specialty:** Module selector appears

#### Test 12.2: Module Loading Test
1. Select "Ortho"
2. See "Loading modules..." (briefly)
3. Module chips appear (expect ~31 modules for Ortho)

#### Test 12.3: Module Display Test
Check that modules show:
- ✅ Module name (e.g., "In OR <18 hrs – Supracondylar fracture")
- ✅ Threshold hours badge (e.g., "≤18.0h")

#### Test 12.4: Module Selection Test
1. Click "In OR <18 hrs – Supracondylar fracture" module
2. Chip highlights
3. Green box shows "Selected Metric: ORTHO_I25"
4. Click different module
5. First module de-highlights
6. New module highlights
7. Box updates with new metric ID

#### Test 12.5: Specialty Switch Test
1. Select "Ortho" → Select a module
2. Switch to "BehavioralHealth" specialty
3. Selected metric should reset
4. New modules for BehavioralHealth load
5. Module chips update

### Definition of Done
- [x] Module selector only visible after specialty selection
- [x] Modules load from database
- [x] Threshold hours displayed when present
- [x] Module selection works correctly
- [x] Switching specialty resets module selection
- [x] No hardcoded module data
- [x] Code committed to git

### Estimated Effort: 2 hours

---

## Story 13: Update Intake Page - Dynamic Signal Preview

**As a** user
**I want** to see which signals are available for my selected metric
**So that** I understand what the AI will evaluate

### Acceptance Criteria
- [ ] Signal preview only appears after metric selected
- [ ] Signals load from database
- [ ] Signals grouped by category
- [ ] Shows signal code and severity

### Implementation Steps

#### Step 13.1: Update Intake Page - Add Signal Preview
**File:** `client/src/pages/intake.tsx` (update)

```typescript
import { useSignals } from '@/hooks/useMetadata';

export default function IntakePage() {
  // ... existing state ...

  const { data: signalsData, isLoading: loadingSignals } = useSignals(selectedMetricId);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* ... specialty and module selectors ... */}

      {/* Signal Preview (NEW) */}
      {selectedMetricId && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Available Signals</h2>

          {loadingSignals ? (
            <div className="text-gray-600">Loading signals...</div>
          ) : !signalsData ? (
            <div className="text-yellow-600">No signals found</div>
          ) : (
            <div className="space-y-4">
              {signalsData.groups.map((group) => {
                const groupSignals = signalsData.signals.filter(
                  (s) => s.groupId === group.groupId
                );

                return (
                  <div key={group.groupId} className="border rounded p-4">
                    <h3 className="font-medium mb-2 text-gray-700">
                      {group.groupCode}
                    </h3>
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
        </div>
      )}
    </div>
  );
}
```

### Testing Steps

#### Test 13.1: Signal Preview Visibility
1. Navigate to `/intake`
2. Select specialty: "Ortho"
3. **Before selecting module:** Signal preview NOT visible
4. Select module: "In OR <18 hrs – Supracondylar fracture"
5. **After selecting module:** Signal preview appears

#### Test 13.2: Signal Grouping Test
Select module "ORTHO_I25"

**Expected:**
- See multiple groups (e.g., "Core", "Delay Drivers", "Documentation")
- Each group has a border and label
- Signals organized under correct groups

#### Test 13.3: Signal Severity Color Test
Check signal color coding:
- ✅ `severity: 'info'` → Green background
- ✅ `severity: 'warn'` → Yellow background
- ✅ `severity: 'error'` → Red background

#### Test 13.4: Signal Count Test
For "ORTHO_I25" metric:
- Check database: `SELECT COUNT(*) FROM signal_def WHERE metric_id = 'ORTHO_I25';`
- Count signals in UI
- **Expected:** Counts match

### Definition of Done
- [x] Signal preview loads from database
- [x] Signals grouped correctly
- [x] Severity colors applied
- [x] No hardcoded signal data
- [x] UI updates when metric changes
- [x] Code committed to git

### Estimated Effort: 2 hours

---

## ⏸️ CHECKPOINT 3: Validate Dynamic Frontend

**Before proceeding to Epic 5, verify:**

### Checklist
- [ ] All metadata hooks working
- [ ] Specialty selection loads from database
- [ ] Module selection loads from database
- [ ] Signal preview loads from database
- [ ] No hardcoded specialty/module/signal data in intake page
- [ ] React Query caching working
- [ ] UI updates correctly when selections change

### Verification Steps
```bash
# 1. Start application
npm run dev

# 2. Open intake page
http://localhost:5000/intake

# 3. Manual test flow:
#    a. See specialty chips (from database)
#    b. Click "Ortho"
#    c. See module chips (from database)
#    d. Click "In OR <18 hrs"
#    e. See signal preview grouped by category
#    f. All data should be from database, not hardcoded

# 4. Check network tab:
#    - Only 3 API requests (metrics, signals, followups)
#    - Subsequent visits use cache (no new requests)

# 5. Test error handling:
#    - Stop backend server
#    - Refresh page
#    - Should see error messages, not crashes
```

### If All Checks Pass: ✅ Proceed to Epic 5
### If Any Check Fails: ❌ Fix before continuing

---

**TO BE CONTINUED...**

Would you like me to continue with:
- Epic 5: Expression Engine (Stories 14-16)
- Epic 6: Production Ready (Stories 17-20)
- Additional test scenarios
- Specific story deep-dive

**Total Stories So Far:** 13 complete stories with testing steps
**Estimated Time:** ~30-35 hours of implementation

Each story is:
✅ Testable independently
✅ Has clear acceptance criteria
✅ Includes manual and automated tests
✅ Has "Definition of Done"
✅ Builds incrementally on previous stories
