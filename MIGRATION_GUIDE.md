# Database Migration Guide
## Excel Schema Enhancement - Adding Missing Columns to Metric Table

**Date**: 2025-11-08
**Branch**: `claude/review-schema-design-011CUrfdr6Zov54M8h9xub7U`

---

## What Changed

We enhanced the `metric` table to include **6 missing columns** from the Excel file:

| Column | Type | Source | Example Value |
|--------|------|--------|---------------|
| `specialty_id` | VARCHAR(50) | Excel `specialty_id` | "ORTHO", "CARDIOLOGY" |
| `question_code` | VARCHAR(50) | Excel `question_code` | "I25", "E24", "I32a" |
| `priority` | INTEGER | Excel `priority` | 1, 2, 3 |
| `definition_window` | TEXT | Excel `definition_window` | "start_time -> end_time" |
| `active` | BOOLEAN | Excel `active` | TRUE, FALSE |
| `version` | VARCHAR(20) | Excel `version` | "0.0.1" |

### Why These Columns Matter

1. **specialty_id**: The code used in `metric_id` composition (e.g., ORTHO_I25)
2. **question_code**: The USNWR domain question identifier (e.g., I25, E24) - this is what we're building abstraction solutions for!
3. **priority**: Ordering/importance of metrics
4. **definition_window**: Time window definition for metric calculation
5. **active**: Filter out deprecated metrics
6. **version**: Track metric definition versions

---

## Prerequisites

1. **PostgreSQL Database Running**
   ```bash
   # Check if PostgreSQL is running
   ps aux | grep postgres

   # If not running, start it (Linux)
   sudo service postgresql start

   # Or on macOS
   brew services start postgresql
   ```

2. **Database Exists**
   ```bash
   # Create database if needed
   createdb healthlevers

   # Or via psql
   psql -U postgres -c "CREATE DATABASE healthlevers;"
   ```

3. **.env File Configured**
   ```bash
   # Check .env file exists and has correct DATABASE_URL
   cat .env

   # Should contain:
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/healthlevers
   ```

---

## Migration Steps

### Step 1: Apply Schema Changes

This will add the 6 new columns to the `metric` table:

```bash
npm run db:push
```

**Expected Output:**
```
✅ Pulling schema from database...
✅ Changes:
  - Added column "specialty_id" to "metric"
  - Added column "question_code" to "metric"
  - Added column "priority" to "metric"
  - Added column "definition_window" to "metric"
  - Added column "active" to "metric" with default true
  - Added column "version" to "metric"
  - Added index "idx_metric_specialty_id"
  - Added index "idx_metric_question_code"
  - Added index "idx_metric_active"
✅ Applying changes...
```

**If you see errors:**
- `ECONNREFUSED`: PostgreSQL is not running
- `database "healthlevers" does not exist`: Create the database first
- `relation "metric" does not exist`: Run the initial migration first

---

### Step 2: Populate New Columns

Re-run the seed script to populate the new columns with data from Excel:

```bash
npm run seed
```

**Expected Output:**
```
📖 Step 1: Loading Excel file...
✅ Loaded Excel file: /home/user/HealthLevers/USNWR_Master_AllMetrics_v4.xlsx

📊 Parsing all sheets...
✅ Parsed 54 rows from 'metrics'

📥 Step 5: Inserting metadata...
1️⃣  Inserting 54 metrics...
   ✅ Inserted 54 metrics
```

**What it does:**
- Extracts `specialty_id`, `question_code`, `priority`, `definition_window`, `active`, `version` from Excel
- Converts string "TRUE"/"FALSE" to boolean for `active` field
- Converts string numbers to integers for `priority` field
- Uses `onConflictDoUpdate` to update existing rows with new column values

---

### Step 3: Verify Migration

Check that the new columns are populated:

```bash
# Connect to database
psql $DATABASE_URL

# Run verification queries
```

**Query 1: Check Column Existence**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'metric'
  AND column_name IN ('specialty_id', 'question_code', 'priority',
                      'definition_window', 'active', 'version')
ORDER BY column_name;
```

**Expected Result:**
```
   column_name    | data_type | is_nullable
------------------+-----------+-------------
 active           | boolean   | YES
 definition_window| text      | YES
 priority         | integer   | YES
 question_code    | text      | YES
 specialty_id     | text      | YES
 version          | text      | YES
```

**Query 2: Check Data Population**
```sql
SELECT
  metric_id,
  specialty,
  specialty_id,
  question_code,
  priority,
  active,
  version
FROM metric
WHERE active = TRUE
ORDER BY specialty_id, priority
LIMIT 10;
```

**Expected Result:**
```
    metric_id     | specialty  | specialty_id | question_code | priority | active | version
------------------+------------+--------------+---------------+----------+--------+---------
 ORTHO_I25        | Ortho      | ORTHO        | I25           |        1 | t      | 0.0.1
 ORTHO_I26        | Ortho      | ORTHO        | I26           |        1 | t      | 0.0.1
 ORTHO_I32A_...   | Ortho      | ORTHO        | I32a          |        1 | t      | 0.0.1
 CARDIOLOGY_E24   | Cardiology | CARDIOLOGY   | E24           |        2 | t      | 0.0.1
```

**Query 3: Check Indexes**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'metric'
  AND indexname LIKE 'idx_metric_%'
ORDER BY indexname;
```

**Expected Result:**
```
       indexname         |                    indexdef
-------------------------+------------------------------------------------
 idx_metric_active       | CREATE INDEX idx_metric_active ON metric(active)
 idx_metric_question_code| CREATE INDEX idx_metric_question_code ON metric(question_code)
 idx_metric_specialty    | CREATE INDEX idx_metric_specialty ON metric(specialty)
 idx_metric_specialty_id | CREATE INDEX idx_metric_specialty_id ON metric(specialty_id)
```

---

## Troubleshooting

### Issue: Columns are NULL after seeding

**Cause**: Excel columns might have different names or formatting

**Solution**:
```bash
# Check Excel column names
npm run tsx scripts/list-all-metrics.ts | head -20

# Look for the actual column names in the Excel file
# Update excelParser.ts if column names don't match
```

### Issue: Boolean conversion error for 'active' field

**Cause**: Excel has "TRUE"/"FALSE" as strings, not booleans

**Solution**: Already handled in seed-metadata.ts:
```typescript
let activeValue: boolean | null = null;
if (m.active !== undefined && m.active !== null) {
  if (typeof m.active === 'boolean') {
    activeValue = m.active;
  } else if (typeof m.active === 'string') {
    activeValue = m.active.toUpperCase() === 'TRUE';
  }
}
```

### Issue: Priority is string instead of integer

**Cause**: Excel might read numbers as strings

**Solution**: Already handled in seed-metadata.ts:
```typescript
priority: m.priority ?
  (typeof m.priority === 'number' ? m.priority : parseInt(String(m.priority)))
  : null
```

---

## Rollback (If Needed)

If you need to rollback the migration:

```sql
-- Connect to database
psql $DATABASE_URL

-- Drop new columns
ALTER TABLE metric DROP COLUMN IF EXISTS specialty_id;
ALTER TABLE metric DROP COLUMN IF EXISTS question_code;
ALTER TABLE metric DROP COLUMN IF EXISTS priority;
ALTER TABLE metric DROP COLUMN IF EXISTS definition_window;
ALTER TABLE metric DROP COLUMN IF EXISTS active;
ALTER TABLE metric DROP COLUMN IF EXISTS version;

-- Drop new indexes (automatically dropped with columns)
```

---

## Next Steps After Migration

1. **Extract Specialty Taxonomy**
   ```sql
   -- Create specialty reference table from metric data
   CREATE TABLE specialty AS
   SELECT DISTINCT
     specialty_id AS specialty_code,
     specialty AS specialty_name,
     9999 AS display_order
   FROM metric
   WHERE active = TRUE AND specialty_id IS NOT NULL
   ORDER BY specialty_id;

   -- Add primary key
   ALTER TABLE specialty ADD PRIMARY KEY (specialty_code);
   ```

2. **Query by Question Code**
   ```sql
   -- Find all metrics for a specific USNWR question
   SELECT metric_id, specialty, metric_name, domain
   FROM metric
   WHERE question_code = 'I25' AND active = TRUE;
   ```

3. **Query by Specialty**
   ```sql
   -- Find all active metrics for Orthopedics
   SELECT metric_id, question_code, metric_name, priority
   FROM metric
   WHERE specialty_id = 'ORTHO' AND active = TRUE
   ORDER BY priority, question_code;
   ```

4. **Filter by Active Status**
   ```sql
   -- Get only active metrics
   SELECT COUNT(*) as active_metrics
   FROM metric
   WHERE active = TRUE;

   -- Get deprecated metrics
   SELECT metric_id, specialty, metric_name
   FROM metric
   WHERE active = FALSE OR active IS NULL;
   ```

---

## Files Changed

1. `shared/schema.ts` - Added 6 columns and 4 indexes to metric table
2. `server/services/excelParser.ts` - Updated MetricSchema to extract new columns
3. `scripts/seed-metadata.ts` - Updated insert logic with type conversions
4. `.env` - Created with DATABASE_URL configuration

---

**Migration Status**: ⏳ Pending (database not running during development)
**Applied**: Run the steps above when PostgreSQL is running
