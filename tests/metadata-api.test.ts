import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/testApp';
import type { Express } from 'express';

describe('Metadata API', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /api/metadata/specialties', () => {
    it('should return list of unique specialties', async () => {
      const response = await request(app)
        .get('/api/metadata/specialties')
        .expect(200);

      expect(response.body).toHaveProperty('specialties');
      expect(Array.isArray(response.body.specialties)).toBe(true);
      expect(response.body.specialties.length).toBeGreaterThan(0);

      // Should contain ORTHO (from our seeded data)
      expect(response.body.specialties).toContain('ORTHO');
    });
  });

  describe('GET /api/metadata/metrics', () => {
    it('should return all metrics grouped by specialty', async () => {
      const response = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('totalCount');
      expect(typeof response.body.totalCount).toBe('number');
      expect(response.body.totalCount).toBeGreaterThan(0);

      // Check structure of metrics object
      const metrics = response.body.metrics;
      expect(typeof metrics).toBe('object');

      // Should have ORTHO specialty
      expect(metrics).toHaveProperty('ORTHO');
      expect(Array.isArray(metrics.ORTHO)).toBe(true);
      expect(metrics.ORTHO.length).toBeGreaterThan(0);

      // Each metric should have required fields
      const firstMetric = metrics.ORTHO[0];
      expect(firstMetric).toHaveProperty('metricId');
      expect(firstMetric).toHaveProperty('metricName');
      expect(firstMetric).toHaveProperty('specialty');
    });

    it('should filter metrics by specialty', async () => {
      const response = await request(app)
        .get('/api/metadata/metrics?specialty=ORTHO')
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      const specialties = Object.keys(response.body.metrics);

      // Should only have ORTHO
      expect(specialties).toEqual(['ORTHO']);
    });

    it('should filter metrics by domain', async () => {
      const response = await request(app)
        .get('/api/metadata/metrics?domain=outcome')
        .expect(200);

      expect(response.body).toHaveProperty('metrics');

      // All metrics should have domain = 'outcome'
      const allMetrics = Object.values(response.body.metrics).flat() as any[];
      allMetrics.forEach(metric => {
        expect(metric.domain).toBe('outcome');
      });
    });

    it('should use cache on second request', async () => {
      // First request - cache miss
      const response1 = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      // Second request - should hit cache
      const response2 = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      // Results should be identical
      expect(response2.body).toEqual(response1.body);
    });
  });

  describe('GET /api/metadata/metrics/:metric_id', () => {
    it('should return a specific metric by ID', async () => {
      // First get all metrics to find a valid ID
      const metricsResponse = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      const firstMetric = metricsResponse.body.metrics.ORTHO[0];
      const metricId = firstMetric.metricId;

      // Now fetch that specific metric
      const response = await request(app)
        .get(`/api/metadata/metrics/${metricId}`)
        .expect(200);

      expect(response.body).toHaveProperty('metric');
      expect(response.body.metric.metricId).toBe(metricId);
      expect(response.body.metric).toHaveProperty('metricName');
      expect(response.body.metric).toHaveProperty('specialty');
    });

    it('should return 404 for non-existent metric', async () => {
      const response = await request(app)
        .get('/api/metadata/metrics/NONEXISTENT')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /api/metadata/signals/:metric_id', () => {
    it('should return signals for a metric', async () => {
      // Get a valid metric ID
      const metricsResponse = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      const firstMetric = metricsResponse.body.metrics.ORTHO[0];
      const metricId = firstMetric.metricId;

      // Fetch signals
      const response = await request(app)
        .get(`/api/metadata/signals/${metricId}`)
        .expect(200);

      expect(response.body).toHaveProperty('metricId');
      expect(response.body.metricId).toBe(metricId);
      expect(response.body).toHaveProperty('signalGroups');
      expect(Array.isArray(response.body.signalGroups)).toBe(true);
    });

    it('should return empty array for metric with no signals', async () => {
      const response = await request(app)
        .get('/api/metadata/signals/NONEXISTENT')
        .expect(200);

      expect(response.body).toHaveProperty('signalGroups');
      expect(response.body.signalGroups).toEqual([]);
    });
  });

  describe('GET /api/metadata/followups/:metric_id', () => {
    it('should return followups for a metric', async () => {
      // Get a valid metric ID
      const metricsResponse = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      const firstMetric = metricsResponse.body.metrics.ORTHO[0];
      const metricId = firstMetric.metricId;

      // Fetch followups
      const response = await request(app)
        .get(`/api/metadata/followups/${metricId}`)
        .expect(200);

      expect(response.body).toHaveProperty('metricId');
      expect(response.body.metricId).toBe(metricId);
      expect(response.body).toHaveProperty('followups');
      expect(Array.isArray(response.body.followups)).toBe(true);
    });
  });

  describe('GET /api/metadata/display-plan/:metric_id', () => {
    it('should return display plan for a metric', async () => {
      // Get a valid metric ID
      const metricsResponse = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      const firstMetric = metricsResponse.body.metrics.ORTHO[0];
      const metricId = firstMetric.metricId;

      // Fetch display plan
      const response = await request(app)
        .get(`/api/metadata/display-plan/${metricId}`)
        .expect(200);

      expect(response.body).toHaveProperty('metricId');
      expect(response.body.metricId).toBe(metricId);
      expect(response.body).toHaveProperty('displayItems');
      expect(Array.isArray(response.body.displayItems)).toBe(true);
    });
  });

  describe('GET /api/metadata/provenance/:metric_id', () => {
    it('should return provenance for a metric', async () => {
      // Get a valid metric ID
      const metricsResponse = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      const firstMetric = metricsResponse.body.metrics.ORTHO[0];
      const metricId = firstMetric.metricId;

      // Fetch provenance
      const response = await request(app)
        .get(`/api/metadata/provenance/${metricId}`)
        .expect(200);

      expect(response.body).toHaveProperty('metricId');
      expect(response.body.metricId).toBe(metricId);
      expect(response.body).toHaveProperty('provenance');
      expect(Array.isArray(response.body.provenance)).toBe(true);
    });
  });

  describe('GET /api/metadata/prompts/:metric_id', () => {
    it('should return prompts for a metric', async () => {
      // Get a valid metric ID
      const metricsResponse = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      const firstMetric = metricsResponse.body.metrics.ORTHO[0];
      const metricId = firstMetric.metricId;

      // Fetch prompts
      const response = await request(app)
        .get(`/api/metadata/prompts/${metricId}`)
        .expect(200);

      expect(response.body).toHaveProperty('metricId');
      expect(response.body.metricId).toBe(metricId);
      expect(response.body).toHaveProperty('prompts');
      expect(Array.isArray(response.body.prompts)).toBe(true);
    });
  });

  describe('GET /api/metadata/complete/:metric_id', () => {
    it('should return complete metric configuration', async () => {
      // Get a valid metric ID
      const metricsResponse = await request(app)
        .get('/api/metadata/metrics')
        .expect(200);

      const firstMetric = metricsResponse.body.metrics.ORTHO[0];
      const metricId = firstMetric.metricId;

      // Fetch complete configuration
      const response = await request(app)
        .get(`/api/metadata/complete/${metricId}`)
        .expect(200);

      expect(response.body).toHaveProperty('metric');
      expect(response.body).toHaveProperty('signalGroups');
      expect(response.body).toHaveProperty('followups');
      expect(response.body).toHaveProperty('displayItems');
      expect(response.body).toHaveProperty('provenance');
      expect(response.body).toHaveProperty('prompts');

      // Check metric details
      expect(response.body.metric.metricId).toBe(metricId);
    });

    it('should return 404 for non-existent metric', async () => {
      const response = await request(app)
        .get('/api/metadata/complete/NONEXISTENT')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/metadata/search', () => {
    it('should search metrics by query', async () => {
      const response = await request(app)
        .get('/api/metadata/search?q=hip')
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('query');
      expect(response.body.query).toBe('hip');
    });

    it('should return 400 if query is missing', async () => {
      const response = await request(app)
        .get('/api/metadata/search')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should filter search by specialty', async () => {
      const response = await request(app)
        .get('/api/metadata/search?q=fracture&specialty=ORTHO')
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);

      // All results should be from ORTHO specialty
      response.body.results.forEach((result: any) => {
        expect(result.specialty).toBe('ORTHO');
      });
    });
  });

  describe('Cache Management', () => {
    describe('GET /api/metadata/cache/stats', () => {
      it('should return cache statistics', async () => {
        const response = await request(app)
          .get('/api/metadata/cache/stats')
          .expect(200);

        expect(response.body).toHaveProperty('stats');
        expect(response.body.stats).toHaveProperty('hits');
        expect(response.body.stats).toHaveProperty('misses');
        expect(response.body.stats).toHaveProperty('sets');
        expect(response.body.stats).toHaveProperty('clears');
        expect(response.body.stats).toHaveProperty('hitRate');
        expect(response.body).toHaveProperty('cacheSize');
        expect(response.body).toHaveProperty('uptime');
      });
    });

    describe('POST /api/metadata/cache/clear', () => {
      it('should clear the cache', async () => {
        // First, make some requests to populate cache
        await request(app).get('/api/metadata/metrics').expect(200);
        await request(app).get('/api/metadata/specialties').expect(200);

        // Clear cache
        const response = await request(app)
          .post('/api/metadata/cache/clear')
          .expect(200);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('cleared');
        expect(response.body).toHaveProperty('clearedCount');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid metric ID format gracefully', async () => {
      const response = await request(app)
        .get('/api/metadata/metrics/invalid-id-with-special-chars-!@#')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed query parameters', async () => {
      // Test with array of specialties (should handle gracefully)
      const response = await request(app)
        .get('/api/metadata/metrics?specialty[]=ORTHO&specialty[]=CARDIO')
        .expect(200);

      // Should still return valid response
      expect(response.body).toHaveProperty('metrics');
    });
  });
});
