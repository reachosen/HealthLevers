# Stories 9-13 Implementation Guide

**Status:** Ready for Implementation
**Progress:** Stories 1-8 Complete (62%)
**Remaining:** Stories 9-13 (38%)

This document provides detailed implementation guidance for the remaining stories to complete the v9.2 dynamic application transformation.

---

## 📋 Story 9: Create API Integration Tests

**Epic:** 3 - Metadata API
**Estimated Time:** 3 hours
**Priority:** High (validates Epic 3 completion)

### Overview
Create automated tests for all metadata API endpoints to ensure correctness and performance.

### Prerequisites
- Stories 7-8 complete (Metadata API with caching)
- Test framework setup (vitest + supertest)
- Test database configuration

### Implementation Steps

#### Step 1: Install Testing Dependencies

```bash
npm install --save-dev vitest supertest @vitest/ui
npm install --save-dev @types/supertest
```

#### Step 2: Configure Vitest

**File:** `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
});
```

#### Step 3: Create Test Setup

**File:** `tests/setup.ts`
```typescript
import { beforeAll, afterAll } from 'vitest';
import { db } from '../server/db';

beforeAll(async () => {
  // Set up test database
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  console.log('📝 Test database connected');
});

afterAll(async () => {
  // Cleanup
  console.log('🧹 Test cleanup complete');
});
```

#### Step 4: Create Metadata API Tests

**File:** `tests/api/metadata.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';

describe('Metadata API', () => {
  beforeAll(async () => {
    // Ensure test database is seeded
    // Run: npm run seed-metadata (with TEST_DATABASE_URL)
  });

  // Test 1: GET /api/metadata/metrics
  describe('GET /api/metadata/metrics', () => {
    it('should return metrics grouped by specialty', async () => {
      const response = await request(app)
        .get('/api/metadata/metrics')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('specialties');
      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary.totalMetrics).toBeGreaterThan(0);
    });

    it('should group metrics by specialty', async () => {
      const response = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      const specialties = Object.keys(response.body.specialties);
      expect(specialties.length).toBeGreaterThan(0);

      // Check first specialty has metrics
      const firstSpecialty = response.body.specialties[specialties[0]];
      expect(Array.isArray(firstSpecialty)).toBe(true);
      expect(firstSpecialty.length).toBeGreaterThan(0);
    });

    it('should include required metric fields', async () => {
      const response = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      const firstSpecialty = Object.keys(response.body.specialties)[0];
      const firstMetric = response.body.specialties[firstSpecialty][0];

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

  // Test 2: GET /api/metadata/signals/:metric_id
  describe('GET /api/metadata/signals/:metric_id', () => {
    const testMetricId = 'ORTHO_HIP_001'; // Use real metric from seeded data

    it('should return signals and groups', async () => {
      const response = await request(app)
        .get(`/api/metadata/signals/${testMetricId}`)
        .expect(200);

      expect(response.body).toHaveProperty('metric_id', testMetricId);
      expect(response.body).toHaveProperty('signals');
      expect(response.body).toHaveProperty('groups');
      expect(response.body).toHaveProperty('signalsByGroup');
      expect(response.body).toHaveProperty('summary');
    });

    it('should return 404 for unknown metric', async () => {
      const response = await request(app)
        .get('/api/metadata/signals/INVALID_METRIC')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should group signals correctly', async () => {
      const response = await request(app)
        .get(`/api/metadata/signals/${testMetricId}`)
        .expect(200);

      const { signalsByGroup } = response.body;
      expect(typeof signalsByGroup).toBe('object');

      // Verify all signals are in groups
      const totalSignalsInGroups = Object.values(signalsByGroup)
        .reduce((sum: number, group: any) => sum + group.length, 0);
      expect(totalSignalsInGroups).toBe(response.body.summary.totalSignals);
    });
  });

  // Test 3: GET /api/metadata/followups/:metric_id
  describe('GET /api/metadata/followups/:metric_id', () => {
    const testMetricId = 'ORTHO_HIP_001';

    it('should return followup questions', async () => {
      const response = await request(app)
        .get(`/api/metadata/followups/${testMetricId}`)
        .expect(200);

      expect(response.body).toHaveProperty('followups');
      expect(response.body).toHaveProperty('summary');
      expect(Array.isArray(response.body.followups)).toBe(true);
    });

    it('should include required followup fields', async () => {
      const response = await request(app)
        .get(`/api/metadata/followups/${testMetricId}`)
        .expect(200);

      if (response.body.followups.length > 0) {
        const followup = response.body.followups[0];
        expect(followup).toHaveProperty('followupId');
        expect(followup).toHaveProperty('questionText');
      }
    });
  });

  // Test 4: GET /api/metadata/complete/:metric_id
  describe('GET /api/metadata/complete/:metric_id', () => {
    const testMetricId = 'ORTHO_HIP_001';

    it('should return complete metadata package', async () => {
      const response = await request(app)
        .get(`/api/metadata/complete/${testMetricId}`)
        .expect(200);

      expect(response.body).toHaveProperty('metric');
      expect(response.body).toHaveProperty('signals');
      expect(response.body).toHaveProperty('groups');
      expect(response.body).toHaveProperty('followups');
      expect(response.body).toHaveProperty('displayPlans');
      expect(response.body).toHaveProperty('provenanceRules');
      expect(response.body).toHaveProperty('prompts');
      expect(response.body).toHaveProperty('summary');
    });

    it('should have matching counts in summary', async () => {
      const response = await request(app)
        .get(`/api/metadata/complete/${testMetricId}`)
        .expect(200);

      const { signals, groups, followups, displayPlans, prompts, summary } = response.body;

      expect(summary.totalSignals).toBe(signals.length);
      expect(summary.totalGroups).toBe(groups.length);
      expect(summary.totalFollowups).toBe(followups.length);
      expect(summary.totalDisplayFields).toBe(displayPlans.length);
      expect(summary.totalPrompts).toBe(prompts.length);
    });
  });

  // Test 5: GET /api/metadata/specialties
  describe('GET /api/metadata/specialties', () => {
    it('should return specialty list', async () => {
      const response = await request(app)
        .get('/api/metadata/specialties')
        .expect(200);

      expect(response.body).toHaveProperty('specialties');
      expect(response.body).toHaveProperty('summary');
      expect(Array.isArray(response.body.specialties)).toBe(true);
    });

    it('should include metric counts', async () => {
      const response = await request(app)
        .get('/api/metadata/specialties')
        .expect(200);

      const specialty = response.body.specialties[0];
      expect(specialty).toHaveProperty('name');
      expect(specialty).toHaveProperty('metricCount');
      expect(specialty.metricCount).toBeGreaterThan(0);
    });
  });

  // Test 6: GET /api/metadata/search
  describe('GET /api/metadata/search', () => {
    it('should search by query string', async () => {
      const response = await request(app)
        .get('/api/metadata/search?q=hip')
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should filter by specialty', async () => {
      const response = await request(app)
        .get('/api/metadata/search?specialty=ORTHO')
        .expect(200);

      response.body.results.forEach((metric: any) => {
        expect(metric.specialty).toBe('ORTHO');
      });
    });

    it('should return 400 without search params', async () => {
      const response = await request(app)
        .get('/api/metadata/search')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  // Test 7: Cache Management
  describe('Cache Management', () => {
    it('should clear cache', async () => {
      const response = await request(app)
        .post('/api/metadata/cache/clear')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('cleared');
    });

    it('should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/metadata/cache/stats')
        .expect(200);

      expect(response.body).toHaveProperty('hits');
      expect(response.body).toHaveProperty('misses');
      expect(response.body).toHaveProperty('hitRate');
      expect(response.body).toHaveProperty('cacheSize');
    });

    it('should demonstrate cache hit', async () => {
      // Clear cache
      await request(app).post('/api/metadata/cache/clear');

      // First request (cache miss)
      const response1 = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      // Second request (cache hit - should be faster)
      const start = Date.now();
      const response2 = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);
      const duration = Date.now() - start;

      // Cache hit should be very fast
      expect(duration).toBeLessThan(50);

      // Responses should be identical
      expect(response1.body).toEqual(response2.body);
    });
  });
});
```

#### Step 5: Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

### Testing

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

### Acceptance Criteria

- [x] Tests for all 10 metadata endpoints
- [x] Response structure validation
- [x] Data correctness verification
- [x] Performance testing (< 200ms)
- [x] Cache behavior testing
- [x] Error handling (404, 400, 500)

---

## 📋 Story 10: Create Dynamic Metric Selector

**Epic:** 4 - Dynamic Frontend
**Estimated Time:** 4 hours
**Priority:** High

### Overview
Replace hardcoded specialty/metric selection with dynamic component powered by metadata API.

### Implementation

**File:** `client/src/components/MetricSelector.tsx`

```typescript
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MetricSelectorProps {
  onMetricSelect: (metricId: string) => void;
  selectedMetricId?: string;
}

export function MetricSelector({ onMetricSelect, selectedMetricId }: MetricSelectorProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['metadata', 'metrics'],
    queryFn: async () => {
      const response = await fetch('/api/metadata/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour (matches server cache)
  });

  if (isLoading) return <div>Loading metrics...</div>;
  if (error) return <div>Error loading metrics</div>;

  return (
    <div className="space-y-4">
      <Select value={selectedMetricId} onValueChange={onMetricSelect}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a metric" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(data.specialties).map(([specialty, metrics]: [string, any[]]) => (
            <SelectGroup key={specialty}>
              <SelectLabel>{specialty}</SelectLabel>
              {metrics.map((metric) => (
                <SelectItem key={metric.metricId} value={metric.metricId}>
                  {metric.metricName}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {selectedMetricId && (
        <div className="text-sm text-muted-foreground">
          Selected: {selectedMetricId}
        </div>
      )}
    </div>
  );
}
```

### React Query Hooks

**File:** `client/src/hooks/useMetadata.ts`

```typescript
import { useQuery } from '@tanstack/react-query';

export function useMetrics() {
  return useQuery({
    queryKey: ['metadata', 'metrics'],
    queryFn: async () => {
      const response = await fetch('/api/metadata/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useSignals(metricId: string | undefined) {
  return useQuery({
    queryKey: ['metadata', 'signals', metricId],
    queryFn: async () => {
      const response = await fetch(`/api/metadata/signals/${metricId}`);
      if (!response.ok) throw new Error('Failed to fetch signals');
      return response.json();
    },
    enabled: !!metricId,
    staleTime: 60 * 60 * 1000,
  });
}

export function useCompleteMetadata(metricId: string | undefined) {
  return useQuery({
    queryKey: ['metadata', 'complete', metricId],
    queryFn: async () => {
      const response = await fetch(`/api/metadata/complete/${metricId}`);
      if (!response.ok) throw new Error('Failed to fetch metadata');
      return response.json();
    },
    enabled: !!metricId,
    staleTime: 60 * 60 * 1000,
  });
}
```

---

## 📋 Story 11: Create Dynamic Signal Display

**Epic:** 4 - Dynamic Frontend
**Estimated Time:** 5 hours
**Priority:** High

### Overview
Render signal chips dynamically based on signal_def and signal_group metadata.

### Implementation

**File:** `client/src/components/SignalDisplay.tsx`

```typescript
import { useSignals } from '@/hooks/useMetadata';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface SignalDisplayProps {
  metricId: string;
  activeSignals?: Set<string>; // Signals that are triggered
}

export function SignalDisplay({ metricId, activeSignals = new Set() }: SignalDisplayProps) {
  const { data, isLoading } = useSignals(metricId);

  if (isLoading) return <div>Loading signals...</div>;
  if (!data) return null;

  const { signalsByGroup, summary } = data;

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        {summary.totalSignals} signals in {summary.totalGroups} groups
      </div>

      {Object.entries(signalsByGroup).map(([groupId, signals]: [string, any[]]) => (
        <Card key={groupId} className="p-4">
          <h3 className="font-semibold mb-3">{groupId}</h3>
          <div className="flex flex-wrap gap-2">
            {signals.map((signal) => (
              <Badge
                key={signal.signalCode}
                variant={activeSignals.has(signal.signalCode) ? 'default' : 'outline'}
                className={getSeverityClass(signal.severity)}
              >
                {signal.signalCode}
              </Badge>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function getSeverityClass(severity: string | null) {
  switch (severity) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-blue-100 text-blue-800';
    default:
      return '';
  }
}
```

---

## 📋 Story 12: Create Dynamic Followup Forms

**Epic:** 4 - Dynamic Frontend
**Estimated Time:** 5 hours
**Priority:** Medium

### Overview
Generate follow-up question forms dynamically based on followup metadata.

### Implementation

**File:** `client/src/components/FollowupForm.tsx`

```typescript
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface FollowupFormProps {
  metricId: string;
  onSubmit: (data: Record<string, any>) => void;
}

export function FollowupForm({ metricId, onSubmit }: FollowupFormProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['metadata', 'followups', metricId],
    queryFn: async () => {
      const response = await fetch(`/api/metadata/followups/${metricId}`);
      return response.json();
    },
  });

  const { register, handleSubmit } = useForm();

  if (isLoading) return <div>Loading questions...</div>;
  if (!data?.followups?.length) return <div>No followup questions</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {data.followups.map((followup: any) => (
        <div key={followup.followupId} className="space-y-2">
          <Label>{followup.questionText}</Label>

          {followup.responseType === 'yes_no' ? (
            <RadioGroup {...register(followup.followupId)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id={`${followup.followupId}-yes`} />
                <Label htmlFor={`${followup.followupId}-yes`}>Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id={`${followup.followupId}-no`} />
                <Label htmlFor={`${followup.followupId}-no`}>No</Label>
              </div>
            </RadioGroup>
          ) : (
            <Input {...register(followup.followupId)} />
          )}
        </div>
      ))}

      <Button type="submit">Submit</Button>
    </form>
  );
}
```

---

## 📋 Story 13: End-to-End Testing

**Epic:** 4 - Dynamic Frontend
**Estimated Time:** 4 hours
**Priority:** Medium

### Overview
Verify complete workflow from specialty selection to signal validation.

### Test Scenarios

#### Scenario 1: Complete Metric Workflow

```typescript
describe('E2E: Metric Workflow', () => {
  it('should complete full metric selection flow', async () => {
    // 1. Load application
    cy.visit('/');

    // 2. Select specialty from dropdown
    cy.get('[data-testid="specialty-select"]').click();
    cy.contains('ORTHO').click();

    // 3. Select metric
    cy.get('[data-testid="metric-select"]').click();
    cy.contains('Hip Fracture Repair Time').click();

    // 4. Verify signals load
    cy.get('[data-testid="signal-display"]').should('be.visible');
    cy.get('[data-testid="signal-chip"]').should('have.length.greaterThan', 0);

    // 5. Trigger a signal
    cy.get('[data-testid="signal-chip"]').first().click();

    // 6. Fill followup form if shown
    cy.get('[data-testid="followup-form"]').then(($form) => {
      if ($form.length) {
        cy.get('[data-testid="followup-response"]').first().click();
        cy.get('[data-testid="submit-followup"]').click();
      }
    });

    // 7. Verify result
    cy.contains('Validation complete').should('be.visible');
  });
});
```

---

## 🎯 Summary: Remaining Work

### Story 9: API Integration Tests
- **Time:** 3 hours
- **Deliverable:** Complete test suite for all endpoints
- **Acceptance:** 100% test coverage, all passing

### Story 10: Dynamic Metric Selector
- **Time:** 4 hours
- **Deliverable:** React component + hooks
- **Acceptance:** Metrics loaded from API, no hardcoded values

### Story 11: Dynamic Signal Display
- **Time:** 5 hours
- **Deliverable:** Signal chips grouped by signal_group
- **Acceptance:** All signals rendered dynamically

### Story 12: Dynamic Followup Forms
- **Time:** 5 hours
- **Deliverable:** Form generation from followup metadata
- **Acceptance:** Questions rendered based on whenCond

### Story 13: E2E Testing
- **Time:** 4 hours
- **Deliverable:** Cypress test suite
- **Acceptance:** Full workflow tested

**Total Remaining:** ~21 hours

---

## 🚀 Ready to Deploy

After completing Stories 9-13:

```bash
# Run all tests
npm test

# Build for production
npm run build

# Deploy
# (Your deployment process)
```

---

**Next Steps:** Implement Stories 9-13 following this guide.
