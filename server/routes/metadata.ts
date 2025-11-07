/**
 * Metadata API Routes
 *
 * REST endpoints for fetching v9.2 metadata from the database.
 * All endpoints return JSON and are designed for <200ms response times.
 *
 * Features:
 * - In-memory caching with 1-hour TTL
 * - Cache hit/miss logging
 * - Manual cache clearing
 */

import { Router } from 'express';
import { db } from '../db';
import {
  metric,
  signalGroup,
  signalDef,
  followup,
  displayPlan,
  provenanceRule,
  prompt,
} from '../../shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// =============================================================================
// CACHING CONFIGURATION
// =============================================================================

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const cache = new Map<string, { data: any; timestamp: number }>();

// Cache statistics
let cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  clears: 0,
};

/**
 * Get data from cache if not expired
 */
function getFromCache(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    cacheStats.hits++;
    console.log(`✅ Cache HIT: ${key} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
    return cached.data;
  }
  cacheStats.misses++;
  console.log(`❌ Cache MISS: ${key}`);
  return null;
}

/**
 * Set data in cache with current timestamp
 */
function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
  cacheStats.sets++;
  console.log(`💾 Cached: ${key} (total cached: ${cache.size})`);
}

/**
 * Clear all cache entries
 */
function clearCache(): void {
  cache.clear();
  cacheStats.clears++;
  console.log(`🗑️  Cache cleared (hits: ${cacheStats.hits}, misses: ${cacheStats.misses})`);
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  const totalRequests = cacheStats.hits + cacheStats.misses;
  const hitRate = totalRequests > 0 ? (cacheStats.hits / totalRequests) * 100 : 0;

  return {
    ...cacheStats,
    totalRequests,
    hitRate: Math.round(hitRate * 100) / 100,
    cacheSize: cache.size,
  };
}

// All metadata routes require authentication
router.use(isAuthenticated);

// =============================================================================
// GET /api/metadata/metrics
// Returns all metrics grouped by specialty
// =============================================================================
router.get('/metrics', async (req, res) => {
  try {
    const cacheKey = 'all_metrics';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const metrics = await db.select().from(metric);

    // Group by specialty
    const grouped = metrics.reduce((acc, m) => {
      if (!acc[m.specialty]) {
        acc[m.specialty] = [];
      }
      acc[m.specialty].push(m);
      return acc;
    }, {} as Record<string, typeof metrics>);

    // Sort specialties alphabetically
    const sortedGrouped: Record<string, typeof metrics> = {};
    Object.keys(grouped)
      .sort()
      .forEach(specialty => {
        sortedGrouped[specialty] = grouped[specialty].sort((a, b) =>
          a.metricName.localeCompare(b.metricName)
        );
      });

    const response = {
      specialties: sortedGrouped,
      summary: {
        totalMetrics: metrics.length,
        totalSpecialties: Object.keys(grouped).length,
      },
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// =============================================================================
// GET /api/metadata/metrics/:metric_id
// Returns a specific metric by ID
// =============================================================================
router.get('/metrics/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;

    const [metricData] = await db
      .select()
      .from(metric)
      .where(eq(metric.metricId, metric_id));

    if (!metricData) {
      return res.status(404).json({ error: `Metric '${metric_id}' not found` });
    }

    res.json(metricData);
  } catch (error) {
    console.error('Error fetching metric:', error);
    res.status(500).json({ error: 'Failed to fetch metric' });
  }
});

// =============================================================================
// GET /api/metadata/signals/:metric_id
// Returns signals and groups for a specific metric
// =============================================================================
router.get('/signals/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;
    const cacheKey = `signals_${metric_id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    // Verify metric exists
    const [metricData] = await db
      .select()
      .from(metric)
      .where(eq(metric.metricId, metric_id));

    if (!metricData) {
      return res.status(404).json({ error: `Metric '${metric_id}' not found` });
    }

    // Fetch signals and groups in parallel
    const [signals, groups] = await Promise.all([
      db.select().from(signalDef).where(eq(signalDef.metricId, metric_id)),
      db.select().from(signalGroup).where(eq(signalGroup.metricId, metric_id)),
    ]);

    // Group signals by group_id
    const signalsByGroup = signals.reduce((acc, signal) => {
      const groupId = signal.groupId || 'ungrouped';
      if (!acc[groupId]) {
        acc[groupId] = [];
      }
      acc[groupId].push(signal);
      return acc;
    }, {} as Record<string, typeof signals>);

    const response = {
      metric_id,
      metricName: metricData.metricName,
      specialty: metricData.specialty,
      signals,
      groups,
      signalsByGroup,
      summary: {
        totalSignals: signals.length,
        totalGroups: groups.length,
        signalsWithGroups: signals.filter(s => s.groupId).length,
        signalsWithoutGroups: signals.filter(s => !s.groupId).length,
      },
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// =============================================================================
// GET /api/metadata/followups/:metric_id
// Returns followup questions for a specific metric
// =============================================================================
router.get('/followups/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;

    // Verify metric exists
    const [metricData] = await db
      .select()
      .from(metric)
      .where(eq(metric.metricId, metric_id));

    if (!metricData) {
      return res.status(404).json({ error: `Metric '${metric_id}' not found` });
    }

    const followups = await db
      .select()
      .from(followup)
      .where(eq(followup.metricId, metric_id));

    res.json({
      metric_id,
      metricName: metricData.metricName,
      followups,
      summary: {
        totalFollowups: followups.length,
        conditional: followups.filter(f => f.whenCond).length,
        unconditional: followups.filter(f => !f.whenCond).length,
      },
    });
  } catch (error) {
    console.error('Error fetching followups:', error);
    res.status(500).json({ error: 'Failed to fetch followups' });
  }
});

// =============================================================================
// GET /api/metadata/display-plan/:metric_id
// Returns UI field configuration for a specific metric
// =============================================================================
router.get('/display-plan/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;

    // Verify metric exists
    const [metricData] = await db
      .select()
      .from(metric)
      .where(eq(metric.metricId, metric_id));

    if (!metricData) {
      return res.status(404).json({ error: `Metric '${metric_id}' not found` });
    }

    const plans = await db
      .select()
      .from(displayPlan)
      .where(eq(displayPlan.metricId, metric_id));

    // Sort by order_nbr
    const sortedPlans = plans.sort((a, b) => a.orderNbr - b.orderNbr);

    // Group by tier
    const byTier = sortedPlans.reduce((acc, plan) => {
      const tier = plan.tier || 'default';
      if (!acc[tier]) {
        acc[tier] = [];
      }
      acc[tier].push(plan);
      return acc;
    }, {} as Record<string, typeof plans>);

    res.json({
      metric_id,
      metricName: metricData.metricName,
      fields: sortedPlans,
      byTier,
      summary: {
        totalFields: sortedPlans.length,
        tiers: Object.keys(byTier),
      },
    });
  } catch (error) {
    console.error('Error fetching display plan:', error);
    res.status(500).json({ error: 'Failed to fetch display plan' });
  }
});

// =============================================================================
// GET /api/metadata/provenance/:metric_id
// Returns data provenance rules for a specific metric
// =============================================================================
router.get('/provenance/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;

    // Verify metric exists
    const [metricData] = await db
      .select()
      .from(metric)
      .where(eq(metric.metricId, metric_id));

    if (!metricData) {
      return res.status(404).json({ error: `Metric '${metric_id}' not found` });
    }

    const rules = await db
      .select()
      .from(provenanceRule)
      .where(eq(provenanceRule.metricId, metric_id));

    res.json({
      metric_id,
      metricName: metricData.metricName,
      rules,
      summary: {
        totalRules: rules.length,
      },
    });
  } catch (error) {
    console.error('Error fetching provenance rules:', error);
    res.status(500).json({ error: 'Failed to fetch provenance rules' });
  }
});

// =============================================================================
// GET /api/metadata/prompts/:metric_id
// Returns AI prompts for a specific metric
// =============================================================================
router.get('/prompts/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;

    // Verify metric exists
    const [metricData] = await db
      .select()
      .from(metric)
      .where(eq(metric.metricId, metric_id));

    if (!metricData) {
      return res.status(404).json({ error: `Metric '${metric_id}' not found` });
    }

    const prompts = await db
      .select()
      .from(prompt)
      .where(eq(prompt.metricId, metric_id));

    // Group by prompt_type
    const byType = prompts.reduce((acc, p) => {
      if (!acc[p.promptType]) {
        acc[p.promptType] = [];
      }
      acc[p.promptType].push(p);
      return acc;
    }, {} as Record<string, typeof prompts>);

    res.json({
      metric_id,
      metricName: metricData.metricName,
      prompts,
      byType,
      summary: {
        totalPrompts: prompts.length,
        types: Object.keys(byType),
      },
    });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// =============================================================================
// GET /api/metadata/complete/:metric_id
// Returns all metadata for a specific metric (complete package)
// =============================================================================
router.get('/complete/:metric_id', async (req, res) => {
  try {
    const { metric_id } = req.params;
    const cacheKey = `complete_${metric_id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    // Fetch all metadata in parallel
    const [
      [metricData],
      signals,
      groups,
      followups,
      displayPlans,
      provenanceRules,
      prompts,
    ] = await Promise.all([
      db.select().from(metric).where(eq(metric.metricId, metric_id)),
      db.select().from(signalDef).where(eq(signalDef.metricId, metric_id)),
      db.select().from(signalGroup).where(eq(signalGroup.metricId, metric_id)),
      db.select().from(followup).where(eq(followup.metricId, metric_id)),
      db.select().from(displayPlan).where(eq(displayPlan.metricId, metric_id)),
      db.select().from(provenanceRule).where(eq(provenanceRule.metricId, metric_id)),
      db.select().from(prompt).where(eq(prompt.metricId, metric_id)),
    ]);

    if (!metricData) {
      return res.status(404).json({ error: `Metric '${metric_id}' not found` });
    }

    const response = {
      metric: metricData,
      signals,
      groups,
      followups,
      displayPlans: displayPlans.sort((a, b) => a.orderNbr - b.orderNbr),
      provenanceRules,
      prompts,
      summary: {
        totalSignals: signals.length,
        totalGroups: groups.length,
        totalFollowups: followups.length,
        totalDisplayFields: displayPlans.length,
        totalProvenanceRules: provenanceRules.length,
        totalPrompts: prompts.length,
      },
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error('Error fetching complete metadata:', error);
    res.status(500).json({ error: 'Failed to fetch complete metadata' });
  }
});

// =============================================================================
// GET /api/metadata/specialties
// Returns list of all specialties with metric counts
// =============================================================================
router.get('/specialties', async (req, res) => {
  try {
    const metrics = await db.select().from(metric);

    // Group and count by specialty
    const specialtyCounts = metrics.reduce((acc, m) => {
      acc[m.specialty] = (acc[m.specialty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const specialties = Object.keys(specialtyCounts)
      .sort()
      .map(specialty => ({
        name: specialty,
        metricCount: specialtyCounts[specialty],
      }));

    res.json({
      specialties,
      summary: {
        totalSpecialties: specialties.length,
        totalMetrics: metrics.length,
      },
    });
  } catch (error) {
    console.error('Error fetching specialties:', error);
    res.status(500).json({ error: 'Failed to fetch specialties' });
  }
});

// =============================================================================
// GET /api/metadata/search
// Search metrics by name, specialty, or domain
// =============================================================================
router.get('/search', async (req, res) => {
  try {
    const { q, specialty, domain } = req.query;

    if (!q && !specialty && !domain) {
      return res.status(400).json({
        error: 'At least one search parameter required (q, specialty, or domain)',
      });
    }

    let metrics = await db.select().from(metric);

    // Filter by query string (metric name search)
    if (q && typeof q === 'string') {
      const lowerQ = q.toLowerCase();
      metrics = metrics.filter(m =>
        m.metricName.toLowerCase().includes(lowerQ) ||
        m.metricId.toLowerCase().includes(lowerQ)
      );
    }

    // Filter by specialty
    if (specialty && typeof specialty === 'string') {
      metrics = metrics.filter(m =>
        m.specialty.toLowerCase() === specialty.toLowerCase()
      );
    }

    // Filter by domain
    if (domain && typeof domain === 'string') {
      metrics = metrics.filter(m =>
        m.domain?.toLowerCase() === domain.toLowerCase()
      );
    }

    res.json({
      results: metrics,
      summary: {
        totalResults: metrics.length,
        searchParams: { q, specialty, domain },
      },
    });
  } catch (error) {
    console.error('Error searching metrics:', error);
    res.status(500).json({ error: 'Failed to search metrics' });
  }
});

// =============================================================================
// CACHE MANAGEMENT ENDPOINTS
// =============================================================================

// POST /api/metadata/cache/clear
// Clear all cached responses
router.post('/cache/clear', async (req, res) => {
  try {
    clearCache();
    res.json({
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// GET /api/metadata/cache/stats
// Get cache performance statistics
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = getCacheStats();
    res.json({
      ...stats,
      cacheDuration: `${CACHE_DURATION / 1000 / 60} minutes`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({ error: 'Failed to fetch cache stats' });
  }
});

export default router;
