/**
 * Metric Display Utilities
 *
 * Standardized formatting for metric names across all dropdowns and displays
 */

import type { Metric } from '@/hooks/useMetadataApi';

/**
 * Format metric for display in dropdowns and selectors
 *
 * Standard format: "{questionCode} - {metricName}"
 * Example: "I25 - In OR <18 hrs – Supracondylar fracture"
 *
 * If questionCode is missing, falls back to metricName only
 */
export function formatMetricDisplay(metric: Metric): string {
  if (metric.questionCode) {
    return `${metric.questionCode} - ${metric.metricName}`;
  }
  return metric.metricName;
}

/**
 * Format metric for compact display (e.g., in chips, badges)
 *
 * Standard format: "{questionCode}"
 * Example: "I25"
 *
 * Falls back to first 20 chars of metricName if questionCode missing
 */
export function formatMetricCompact(metric: Metric): string {
  if (metric.questionCode) {
    return metric.questionCode;
  }
  return metric.metricName.length > 20
    ? metric.metricName.substring(0, 20) + '...'
    : metric.metricName;
}

/**
 * Format metric for full display (e.g., page titles, headers)
 *
 * Standard format: "{specialtyId} {questionCode} - {metricName}"
 * Example: "ORTHO I25 - In OR <18 hrs – Supracondylar fracture"
 *
 * Falls back gracefully if fields are missing
 */
export function formatMetricFull(metric: Metric): string {
  const parts: string[] = [];

  if (metric.specialtyId) {
    parts.push(metric.specialtyId);
  }

  if (metric.questionCode) {
    parts.push(metric.questionCode);
  }

  const prefix = parts.length > 0 ? parts.join(' ') + ' - ' : '';
  return prefix + metric.metricName;
}

/**
 * Get metric subtitle (secondary info for display)
 *
 * Shows: domain • threshold • version
 * Example: "timeliness • ≤18h • v0.0.1"
 */
export function formatMetricSubtitle(metric: Metric): string {
  const parts: string[] = [];

  if (metric.domain) {
    parts.push(metric.domain);
  }

  if (metric.thresholdHours) {
    parts.push(`≤${metric.thresholdHours}h`);
  }

  if (metric.version) {
    parts.push(`v${metric.version}`);
  }

  return parts.join(' • ');
}
