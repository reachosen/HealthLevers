# 🚀 Run Migration Now - Step-by-Step Instructions

**Status**: Ready to execute on your local Windows machine
**Branch**: `claude/review-schema-design-011CUrfdr6Zov54M8h9xub7U`

---

## Prerequisites Check

Before running the migration, verify these are ready:

### 1. PostgreSQL Installed and Running

**Check if PostgreSQL is running:**
```powershell
# On Windows PowerShell
Get-Process postgres*

# OR check services
Get-Service -Name postgresql*
```

**If NOT running, start it:**
```powershell
# Start PostgreSQL service (replace with your version number)
Start-Service postgresql-x64-15

# OR if using pgAdmin, start from there
```

### 2. Database Exists

**Check if healthlevers database exists:**
```powershell
# Connect to PostgreSQL
psql -U postgres -l

# Look for 'healthlevers' in the list
```

**If database doesn't exist, create it:**
```powershell
psql -U postgres -c "CREATE DATABASE healthlevers;"
```

### 3. Pull Latest Code

**Make sure you have the latest code from the branch:**
```bash
git fetch origin
git checkout claude/review-schema-design-011CUrfdr6Zov54M8h9xub7U
git pull origin claude/review-schema-design-011CUrfdr6Zov54M8h9xub7U
```

**Verify .env file exists:**
```bash
cat .env
```

Should show:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/healthlevers
PORT=5000
HOST=localhost
NODE_ENV=development
```

**If .env is missing or wrong, create/update it:**
```bash
# Windows (PowerShell)
@"
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/healthlevers
PORT=5000
HOST=localhost
NODE_ENV=development
"@ | Out-File -FilePath .env -Encoding UTF8

# Linux/Mac
cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/healthlevers
PORT=5000
HOST=localhost
NODE_ENV=development
EOF
```

---

## Migration Steps

### Step 1: Apply Schema Changes

This adds 6 new columns and 4 indexes to the `metric` table.

```bash
npm run db:push
```

**✅ Expected Success Output:**
```
> rest-express@1.0.0 db:push
> drizzle-kit push

Reading config file 'drizzle.config.ts'
Using 'pg' driver for database querying

[✓] Pulling schema from database...
[✓] Changes detected:

  ALTER TABLE "metric" ADD COLUMN "specialty_id" varchar(50);
  ALTER TABLE "metric" ADD COLUMN "question_code" varchar(50);
  ALTER TABLE "metric" ADD COLUMN "priority" integer;
  ALTER TABLE "metric" ADD COLUMN "definition_window" text;
  ALTER TABLE "metric" ADD COLUMN "active" boolean DEFAULT true;
  ALTER TABLE "metric" ADD COLUMN "version" varchar(20);

  CREATE INDEX "idx_metric_specialty_id" ON "metric" ("specialty_id");
  CREATE INDEX "idx_metric_question_code" ON "metric" ("question_code");
  CREATE INDEX "idx_metric_active" ON "metric" ("active");

? Do you want to apply the changes? (Y/n) › Y

[✓] Applying changes...
[✓] Done!
```

**❌ Common Errors:**

**Error: `ECONNREFUSED 127.0.0.1:5432`**
- **Problem**: PostgreSQL is not running
- **Solution**: Start PostgreSQL service (see Prerequisites above)

**Error: `database "healthlevers" does not exist`**
- **Problem**: Database not created
- **Solution**: Run `psql -U postgres -c "CREATE DATABASE healthlevers;"`

**Error: `relation "metric" does not exist`**
- **Problem**: Initial schema never applied
- **Solution**: This is the first migration, it's normal. The schema will be created.

---

### Step 2: Run Seed Script

This populates the new columns with data from the Excel file.

```bash
npm run seed
```

**✅ Expected Success Output:**
```
📖 Step 1: Loading Excel file...
   Loading: C:\Users\Public\CodeRepo\HealthLevers\USNWR_Master_AllMetrics_v4.xlsx

✅ Loaded Excel file: USNWR_Master_AllMetrics_v4.xlsx
📄 Sheets found: metrics, groups, signals, followups, display_plan, prompts, provenance_rules, versions

📊 Parsing all sheets...

✅ Parsed 54 rows from 'metrics'
✅ Parsed 223 rows from 'groups'
✅ Parsed 542 rows from 'signals'
✅ Parsed 301 rows from 'followups'
✅ Parsed 323 rows from 'display_plan'
✅ Parsed 108 rows from 'provenance_rules'
✅ Parsed 108 rows from 'prompts'
✅ Parsed 54 rows from 'versions'

📈 Parsing Summary:
   Metrics: 54
   Signal Groups: 223
   Signal Definitions: 542
   Followups: 301
   Display Plans: 323
   Provenance Rules: 108
   Prompts: 108
   Versions: 54

📥 Step 5: Inserting metadata...

1️⃣  Inserting 54 metrics...
   ✅ Inserted 54 metrics

2️⃣  Inserting 223 signal groups...
   ✅ Inserted 223 signal groups

3️⃣  Inserting 542 signal definitions...
   ✅ Inserted 542 signal definitions

4️⃣  Inserting 301 followups...
   ✅ Inserted 301 followups

5️⃣  Inserting 323 display plan entries...
   ✅ Inserted 323 display plan entries

6️⃣  Inserting 108 provenance rules...
   ✅ Inserted 108 provenance rules

7️⃣  Inserting 108 prompts...
   ✅ Inserted 108 prompts

8️⃣  Inserting 54 versions...
   ✅ Inserted 54 versions

✅ Metadata seeding completed successfully!
```

**What this does:**
- Extracts `specialty_id`, `question_code`, `priority`, `definition_window`, `active`, `version` from Excel
- Converts "TRUE"/"FALSE" strings to boolean for `active`
- Converts string numbers to integers for `priority`
- Updates existing rows with new column values (using upsert)

**❌ Common Errors:**

**Error: Validation errors**
- **Problem**: Excel has unexpected data format
- **Solution**: Check the output - it should show which rows/fields failed. The script continues anyway.

---

### Step 3: Verify Migration Success

Connect to the database and run verification queries.

**Windows:**
```powershell
# Connect to database
psql -U postgres -d healthlevers
```

**Once connected, run these queries:**

#### Query 1: Check Columns Were Added
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'metric'
  AND column_name IN ('specialty_id', 'question_code', 'priority',
                      'definition_window', 'active', 'version')
ORDER BY column_name;
```

**✅ Expected Result:**
```
   column_name    | data_type | is_nullable
------------------+-----------+-------------
 active           | boolean   | YES
 definition_window| text      | YES
 priority         | integer   | YES
 question_code    | text      | YES
 specialty_id     | text      | YES
 version          | text      | YES
(6 rows)
```

#### Query 2: Check Data Was Populated
```sql
SELECT
  metric_id,
  specialty,
  specialty_id,
  question_code,
  priority,
  active,
  version,
  domain
FROM metric
WHERE active = TRUE
ORDER BY specialty_id, priority
LIMIT 10;
```

**✅ Expected Result:**
```
     metric_id      | specialty  | specialty_id | question_code | priority | active | version | domain
--------------------+------------+--------------+---------------+----------+--------+---------+-------------
 CARDIOLOGY_E24     | Cardiology | CARDIOLOGY   | E24           |        2 | t      | 0.0.1   | survival
 CARDIOLOGY_E401A   | Cardiology | CARDIOLOGY   | E40.1a        |        2 | t      | 0.0.1   | survival
 ORTHO_I25          | Ortho      | ORTHO        | I25           |        1 | t      | 0.0.1   | timeliness
 ORTHO_I26          | Ortho      | ORTHO        | I26           |        1 | t      | 0.0.1   | timeliness
 ORTHO_I32A_READMIT | Ortho      | ORTHO        | I32a          |        1 | t      | 0.0.1   | readmission
 ORTHO_I32A_RETURNOR| Ortho      | ORTHO        | I32a          |        1 | t      | 0.0.1   | readmission
 ...
```

**Key things to verify:**
- ✅ `specialty_id` populated (ORTHO, CARDIOLOGY)
- ✅ `question_code` populated (I25, E24, I32a) ← **This is the USNWR question!**
- ✅ `priority` populated (1, 2, 3)
- ✅ `active` is TRUE (boolean, not string)
- ✅ `version` populated (0.0.1)
- ✅ `definition_window` populated

#### Query 3: Check Indexes Were Created
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'metric'
  AND indexname LIKE 'idx_metric_%'
ORDER BY indexname;
```

**✅ Expected Result:**
```
       indexname         |                    indexdef
-------------------------+------------------------------------------------
 idx_metric_active       | CREATE INDEX idx_metric_active ON metric USING btree (active)
 idx_metric_question_code| CREATE INDEX idx_metric_question_code ON metric USING btree (question_code)
 idx_metric_specialty    | CREATE INDEX idx_metric_specialty ON metric USING btree (specialty)
 idx_metric_specialty_id | CREATE INDEX idx_metric_specialty_id ON metric USING btree (specialty_id)
(4 rows)
```

#### Query 4: Test New Functionality
```sql
-- Find all metrics for USNWR question I25
SELECT metric_id, specialty, metric_name
FROM metric
WHERE question_code = 'I25' AND active = TRUE;
```

**✅ Expected Result:**
```
 metric_id | specialty |              metric_name
-----------+-----------+---------------------------------------
 ORTHO_I25 | Ortho     | In OR <18 hrs – Supracondylar fracture
(1 row)
```

```sql
-- Find all active Ortho metrics
SELECT metric_id, question_code, metric_name
FROM metric
WHERE specialty_id = 'ORTHO' AND active = TRUE
ORDER BY priority, question_code;
```

**✅ Expected Result:**
```
     metric_id      | question_code |              metric_name
--------------------+---------------+---------------------------------------
 ORTHO_I25          | I25           | In OR <18 hrs – Supracondylar fracture
 ORTHO_I26          | I26           | In OR <18 hrs – Femoral shaft fracture
 ORTHO_I32A_READMIT | I32a          | Idiopathic scoliosis – unplanned admission
 ORTHO_I32A_RETURNOR| I32a          | Idiopathic scoliosis – return to OR
 ORTHO_I32B_READMIT | I32b          | Neuromuscular scoliosis – 30-day readmit
 ORTHO_I32B_RETURNOR| I32b          | Neuromuscular scoliosis – return to OR
(6 rows)
```

```sql
-- Extract unique specialties (for specialty taxonomy)
SELECT DISTINCT specialty_id, specialty
FROM metric
WHERE active = TRUE
ORDER BY specialty_id;
```

**✅ Expected Result:**
```
 specialty_id | specialty
--------------+------------
 CARDIOLOGY   | Cardiology
 ORTHO        | Ortho
(2 rows)
```

**Exit psql:**
```sql
\q
```

---

## ✅ Success Criteria

Migration is successful if ALL of these are true:

- ✅ `npm run db:push` completed without errors
- ✅ `npm run seed` completed without errors
- ✅ 6 new columns exist in `metric` table
- ✅ 4 new indexes created
- ✅ All 54 metrics have `specialty_id` populated
- ✅ All 54 metrics have `question_code` populated
- ✅ All 54 metrics have `active` = TRUE (boolean)
- ✅ Can query by `question_code` and get results
- ✅ Can query by `specialty_id` and get results

---

## 🎉 After Success

Once migration is successful:

1. **Document your results** - Copy the query outputs and save them
2. **Test the application** - Run `npm run dev` and verify UI still works
3. **Next steps** - Ready to create the remaining metadata tables:
   - Extract `specialty` table from metric data
   - Create `case_type` table
   - Create `metric_applicability` table
   - Etc. (see ROUND_TRIP_HANDSHAKE_PLAN.md)

---

## 🚨 If Something Goes Wrong

### Rollback Migration

If you need to undo the changes:

```sql
-- Connect to database
psql -U postgres -d healthlevers

-- Drop new columns
ALTER TABLE metric DROP COLUMN IF EXISTS specialty_id;
ALTER TABLE metric DROP COLUMN IF EXISTS question_code;
ALTER TABLE metric DROP COLUMN IF EXISTS priority;
ALTER TABLE metric DROP COLUMN IF EXISTS definition_window;
ALTER TABLE metric DROP COLUMN IF EXISTS active;
ALTER TABLE metric DROP COLUMN IF EXISTS version;

-- Indexes are automatically dropped with columns
```

### Re-run Migration

If seed failed partway through:

```bash
# Just re-run the seed script
npm run seed

# The script uses upsert, so it's safe to run multiple times
```

---

## 📸 Screenshot Your Results

When done, please take screenshots of:
1. Terminal output from `npm run db:push`
2. Terminal output from `npm run seed`
3. Query results from Step 3

This helps verify everything worked correctly!

---

**Ready? Let's do this!** 🚀

Run the steps above on your Windows machine and let me know how it goes!
