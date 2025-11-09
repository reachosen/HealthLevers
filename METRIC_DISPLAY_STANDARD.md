# Metric Display Standard
## Consistent Formatting Across All UI Components

**Date**: 2025-11-09
**Version**: 1.0

---

## Purpose

This document defines the **standard format for displaying metrics** across all dropdowns, selectors, and UI components in the HealthLevers application.

### Goal
Users need to see both the **USNWR question code** (e.g., "I25", "E24") AND the **metric name** to understand what they're selecting.

---

## Standard Format

### **Primary Display** (Dropdowns, Selectors, Lists)

**Format**: `{questionCode} - {metricName}`

**Examples**:
```
I25 - In OR <18 hrs – Supracondylar fracture
E24 - Transplant survival – 3 years, observed to expected
I32a - Idiopathic scoliosis – unplanned admission within 30 days
```

**When to use**: Everywhere a metric is displayed as a selectable option or in a list.

---

### **Compact Display** (Chips, Badges, Tags)

**Format**: `{questionCode}`

**Examples**:
```
I25
E24
I32a
```

**When to use**: Space-constrained displays like chips, badges, or tags.

---

### **Full Display** (Page Titles, Headers)

**Format**: `{specialtyId} {questionCode} - {metricName}`

**Examples**:
```
ORTHO I25 - In OR <18 hrs – Supracondylar fracture
CARDIOLOGY E24 - Transplant survival – 3 years
ORTHO I32a - Idiopathic scoliosis – unplanned admission
```

**When to use**: Page headers, breadcrumbs, or when full context is needed.

---

### **Subtitle Info** (Secondary Details)

**Format**: `{domain} • ≤{thresholdHours}h • v{version}`

**Examples**:
```
timeliness • ≤18h • v0.0.1
survival • v0.0.1
readmission • ≤30d • v0.0.1
```

**When to use**: Secondary information below the main metric name.

---

## Implementation

### Utility Functions

Location: `client/src/lib/metricDisplay.ts`

**Available functions**:
```typescript
// Primary display format
formatMetricDisplay(metric: Metric): string
// Returns: "I25 - In OR <18 hrs – Supracondylar fracture"

// Compact display format
formatMetricCompact(metric: Metric): string
// Returns: "I25"

// Full display format
formatMetricFull(metric: Metric): string
// Returns: "ORTHO I25 - In OR <18 hrs – Supracondylar fracture"

// Subtitle information
formatMetricSubtitle(metric: Metric): string
// Returns: "timeliness • ≤18h • v0.0.1"
```

### Usage Example

```typescript
import { formatMetricDisplay, formatMetricSubtitle } from '@/lib/metricDisplay';
import type { Metric } from '@/hooks/useMetadataApi';

function MetricDropdown({ metrics }: { metrics: Metric[] }) {
  return (
    <select>
      {metrics.map((metric) => (
        <option key={metric.metricId} value={metric.metricId}>
          {formatMetricDisplay(metric)}
        </option>
      ))}
    </select>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  const displayName = formatMetricDisplay(metric);
  const subtitle = formatMetricSubtitle(metric);

  return (
    <div>
      <h3>{displayName}</h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
```

---

## Components Updated

### ✅ Already Standardized

1. **MetricSelector** (`client/src/components/MetricSelector.tsx`)
   - Dropdown list: Uses `formatMetricDisplay()`
   - Subtitle: Uses `formatMetricSubtitle()`
   - Badges: Shows `specialtyId`, `priority`, `active` status

2. **Metrics Page** (`client/src/pages/metrics.tsx`)
   - Selected metric display: Uses `formatMetricDisplay()`
   - Configuration alert: Uses `formatMetricDisplay()`

### 🔄 Migration Instructions

When adding new components or updating existing ones, follow this pattern:

**Before** (❌ Non-standard):
```typescript
<h4>{metric.metricName}</h4>
<p>{metric.metricId}</p>
```

**After** (✅ Standard):
```typescript
import { formatMetricDisplay } from '@/lib/metricDisplay';

<h4>{formatMetricDisplay(metric)}</h4>
<p className="text-xs text-muted-foreground">
  {formatMetricSubtitle(metric)}
</p>
```

---

## Data Requirements

### Required Fields

For the standard to work, the `Metric` interface must include:

```typescript
interface Metric {
  metricId: string;           // Required
  metricName: string;         // Required
  questionCode?: string;      // NEW - USNWR question identifier (I25, E24)
  specialtyId?: string;       // NEW - Specialty code (ORTHO, CARDIOLOGY)
  specialty: string;          // Display name
  domain?: string;            // Measurement category (timeliness, safety)
  thresholdHours?: string;    // Threshold value
  version?: string;           // Version (0.0.1)
  priority?: number;          // Priority order
  active?: boolean;           // Active status
}
```

### Database Schema

The `metric` table must have these columns:
- `question_code` VARCHAR(50) - USNWR question identifier
- `specialty_id` VARCHAR(50) - Specialty code
- `metric_name` TEXT - Full metric name
- `domain` TEXT - Measurement category
- `threshold_hours` NUMERIC - Threshold value
- `version` VARCHAR(20) - Version number
- `priority` INTEGER - Priority order
- `active` BOOLEAN - Active status

**Migration**: See `RUN_MIGRATION_NOW.md` for instructions to populate these fields.

---

## Fallback Behavior

The utility functions handle missing data gracefully:

**If `questionCode` is missing**:
- `formatMetricDisplay()` returns just `metricName`
- `formatMetricCompact()` returns truncated `metricName`
- `formatMetricFull()` returns `metricName` without prefix

**If `specialtyId` is missing**:
- `formatMetricFull()` omits the specialty prefix

**If subtitle fields are missing**:
- `formatMetricSubtitle()` only includes available fields

---

## Search Functionality

When implementing search, include ALL relevant fields:

```typescript
const searchQuery = "I25";

metrics.filter((m) =>
  m.metricName.toLowerCase().includes(searchQuery) ||
  m.metricId.toLowerCase().includes(searchQuery) ||
  m.questionCode?.toLowerCase().includes(searchQuery) ||
  m.specialty.toLowerCase().includes(searchQuery) ||
  m.domain?.toLowerCase().includes(searchQuery)
);
```

✅ Already implemented in `MetricSelector.tsx`

---

## Testing

After migration, verify:

1. **✅ Dropdown shows question code + name**
   - Example: "I25 - In OR <18 hrs – Supracondylar fracture"

2. **✅ Search finds metrics by question code**
   - Search "I25" → finds ORTHO_I25

3. **✅ Subtitle shows domain, threshold, version**
   - Example: "timeliness • ≤18h • v0.0.1"

4. **✅ Badges show specialty ID**
   - Example: Badge "ORTHO"

5. **✅ Fallback works without question code**
   - Shows metric name only if questionCode is null

---

## Benefits

1. **User Clarity**: Users immediately see the USNWR question they're working on
2. **Consistency**: Same format everywhere in the app
3. **Searchability**: Can search by question code (I25) or metric name
4. **Maintainability**: Centralized formatting logic
5. **Graceful Degradation**: Works even if new fields are missing

---

## Future Enhancements

Consider adding:
- **Tooltip**: Show full details on hover
- **Icon**: Display specialty icon next to name
- **Status indicator**: Visual indicator for active/inactive metrics
- **Favorite/Pin**: Allow users to favorite frequently used metrics

---

**Status**: ✅ Implemented and ready for testing after migration

**Files Changed**:
- `client/src/lib/metricDisplay.ts` (NEW - utility functions)
- `client/src/hooks/useMetadataApi.ts` (Updated Metric interface)
- `client/src/components/MetricSelector.tsx` (Updated to use new format)
- `client/src/pages/metrics.tsx` (Updated to use new format)
