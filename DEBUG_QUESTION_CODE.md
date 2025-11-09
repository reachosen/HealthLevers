# Debug Guide: Question Code Not Showing in Dropdown

Let's check each step systematically to find where the data is getting lost.

---

## Step 1: Verify Data in Database

**Open Command Prompt/PowerShell:**

```bash
psql -U postgres -d healthlevers
```

**Run this query:**

```sql
SELECT
  metric_id,
  question_code,
  specialty_id,
  metric_name,
  active
FROM metric
ORDER BY metric_id
LIMIT 10;
```

### ✅ What You SHOULD See:

```
   metric_id      | question_code | specialty_id |              metric_name                | active
------------------+---------------+--------------+-----------------------------------------+--------
 CARDIOLOGY_E24   | E24           | CARDIOLOGY   | Transplant survival – 3 years...        | t
 ORTHO_I25        | I25           | ORTHO        | In OR <18 hrs – Supracondylar fracture  | t
 ORTHO_I26        | I26           | ORTHO        | In OR <18 hrs – Femoral shaft fracture  | t
```

### ❌ If You See NULL:

```
   metric_id    | question_code | specialty_id |              metric_name                | active
----------------+---------------+--------------+-----------------------------------------+--------
 ORTHO_I25      | <null>        | <null>       | In OR <18 hrs – Supracondylar fracture  | <null>
```

**FIX:** Re-run seed script:
```bash
# Exit psql first
\q

# Then run seed
npm run seed
```

---

## Step 2: Check Backend API Response

**Keep dev server running, open a NEW terminal/PowerShell:**

```bash
curl http://localhost:5000/api/metadata/metrics | jq
```

**On Windows PowerShell (if curl doesn't work):**
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/metadata/metrics" | ConvertTo-Json -Depth 10
```

**Or just open in browser:**
```
http://localhost:5000/api/metadata/metrics
```

### ✅ What You SHOULD See:

Look for this structure in the JSON:
```json
{
  "specialties": {
    "Ortho": [
      {
        "metricId": "ORTHO_I25",
        "specialty": "Ortho",
        "specialtyId": "ORTHO",          ← SHOULD BE HERE
        "questionCode": "I25",           ← SHOULD BE HERE
        "metricName": "In OR <18 hrs – Supracondylar fracture",
        "domain": "timeliness",
        "priority": 1,                   ← SHOULD BE HERE
        "active": true,                  ← SHOULD BE HERE
        "version": "0.0.1"              ← SHOULD BE HERE
      }
    ]
  }
}
```

### ❌ If You See OLD Format (missing fields):

```json
{
  "metricId": "ORTHO_I25",
  "specialty": "Ortho",
  "metricName": "In OR <18 hrs...",
  "domain": "timeliness",
  "thresholdHours": "18",
  "contentVersion": null
  // ← Missing: questionCode, specialtyId, priority, active, version
}
```

**FIX:** Cache is returning old data. Clear it:

```bash
curl -X POST http://localhost:5000/api/metadata/cache/clear
```

**Or restart the server:**
```bash
# Press Ctrl+C in the terminal running npm run dev
npm run dev
```

Then check the API again.

---

## Step 3: Check Frontend Receives Data

**Open your browser, press F12 to open DevTools**

**Go to the Network tab**

**Refresh the page**

**Look for the request to:** `http://localhost:5000/api/metadata/metrics`

**Click on it, then click "Response" tab**

### ✅ What You SHOULD See:

```json
{
  "specialties": {
    "Ortho": [
      {
        "questionCode": "I25",  ← CHECK THIS
        "metricName": "In OR <18 hrs..."
      }
    ]
  }
}
```

### ❌ If questionCode is missing in the Response:

The backend is not sending it. Go back to Step 2.

---

## Step 4: Check Frontend Console

**In DevTools, go to Console tab**

**Look for any errors**

**Type this in the console:**

```javascript
// This will show you the raw data the frontend has
localStorage.clear(); // Clear any frontend cache
location.reload(); // Reload page
```

---

## Step 5: Force Full Refresh

Sometimes the browser caches old JavaScript code:

**Press Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)

This does a hard refresh bypassing cache.

---

## Step 6: Check Vite Dev Server

If using Vite dev server, it might be serving old built files:

```bash
# Stop the dev server (Ctrl+C)

# Clear Vite cache
rm -rf node_modules/.vite

# On Windows PowerShell:
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue

# Restart
npm run dev
```

---

## Quick Test Script

**Run this all at once to check everything:**

```bash
# Check database
echo "=== DATABASE CHECK ==="
psql -U postgres -d healthlevers -c "SELECT metric_id, question_code, specialty_id FROM metric LIMIT 3;"

# Check API
echo ""
echo "=== API CHECK ==="
curl -s http://localhost:5000/api/metadata/metrics | grep -o "questionCode" | head -1

# Clear cache
echo ""
echo "=== CLEARING CACHE ==="
curl -X POST http://localhost:5000/api/metadata/cache/clear
```

---

## Expected Results Summary

| Check | What to Look For | If Broken |
|-------|-----------------|-----------|
| **Database** | `question_code` column has values (I25, E24) | Run `npm run seed` |
| **API Response** | JSON includes `questionCode: "I25"` | Clear cache or restart server |
| **Network Tab** | Response has `questionCode` field | Backend issue - check server logs |
| **Console** | No errors | Check for JavaScript errors |
| **Dropdown** | Shows "I25 - Metric name" | Hard refresh (Ctrl+Shift+R) |

---

## Nuclear Option: Full Reset

If nothing works, do a complete reset:

```bash
# 1. Stop dev server (Ctrl+C)

# 2. Clear all caches
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

# 3. Reset database
psql -U postgres -c "DROP DATABASE healthlevers;"
psql -U postgres -c "CREATE DATABASE healthlevers;"

# 4. Pull latest code
git pull

# 5. Apply schema
npm run db:push

# 6. Seed data
npm run seed

# 7. Start fresh
npm run dev
```

---

## What to Send Me

Run these and send me the output:

```bash
# 1. Database check
psql -U postgres -d healthlevers -c "SELECT metric_id, question_code, metric_name FROM metric WHERE metric_id = 'ORTHO_I25';"

# 2. API check (copy the output)
curl http://localhost:5000/api/metadata/metrics

# 3. Browser check
# Open http://localhost:5000/api/metadata/metrics in your browser
# Copy the JSON and send it to me
```

This will help me pinpoint exactly where the data is getting lost!
