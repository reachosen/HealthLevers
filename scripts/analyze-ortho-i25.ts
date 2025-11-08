#!/usr/bin/env tsx
/**
 * Analyze ORTHO_I25 (Supracondylar Fracture) Metadata
 * Maps to UI Mock v4 structure
 */

import { excelParser } from '../server/services/excelParser';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function analyzeOrthoI25() {
  const excelPath = path.join(__dirname, '../USNWR_Master_AllMetrics_v4.xlsx');
  await excelParser.loadExcel(excelPath);
  const data = await excelParser.parseAllSheets();

  const metricId = 'ORTHO_I25';
  const metric = data.metrics.find(m => m.metric_id === metricId);

  if (!metric) {
    console.error('❌ Metric not found');
    return;
  }

  console.log('\n📋 ORTHO_I25: Supracondylar Fracture Timeliness (<18h)');
  console.log('='.repeat(70));
  console.log(`Metric ID: ${metric.metric_id}`);
  console.log(`Specialty: ${metric.specialty}`);
  console.log(`Name: ${metric.metric_name}`);
  console.log(`Domain: ${metric.domain}`);
  console.log(`Threshold: ${metric.threshold_hours}h`);

  // Signal Groups
  const groups = data.signalGroups.filter(g => g.metric_id === metricId);
  console.log('\n📁 SIGNAL GROUPS');
  console.log('='.repeat(70));
  groups.forEach(g => {
    const signals = data.signalDefs.filter(s =>
      s.metric_id === metricId && s.group_id === g.group_id
    );
    console.log(`\n[${g.group_id}] ${g.group_code}`);
    console.log(`  Signals: ${signals.length}`);
    signals.forEach(s => {
      console.log(`    • ${s.signal_code}`);
      console.log(`      Severity: ${s.severity || 'standard'}, Status: ${s.status || 'active'}`);
    });
  });

  // Ungrouped signals
  const ungrouped = data.signalDefs.filter(s =>
    s.metric_id === metricId && (!s.group_id || s.group_id === null)
  );
  if (ungrouped.length > 0) {
    console.log(`\n[ungrouped] Ungrouped Signals`);
    console.log(`  Signals: ${ungrouped.length}`);
    ungrouped.forEach(s => {
      console.log(`    • ${s.signal_code}`);
      console.log(`      Severity: ${s.severity || 'standard'}, Status: ${s.status || 'active'}`);
    });
  }

  // Display Plan with tier grouping
  const displayPlan = data.displayPlans
    .filter(d => d.metric_id === metricId)
    .sort((a, b) => {
      const aOrder = typeof a.order_nbr === 'number' ? a.order_nbr : parseInt(String(a.order_nbr) || '9999');
      const bOrder = typeof b.order_nbr === 'number' ? b.order_nbr : parseInt(String(b.order_nbr) || '9999');
      return aOrder - bOrder;
    });

  console.log('\n🎨 DISPLAY PLAN (UI Mapping)');
  console.log('='.repeat(70));

  // Group by tier
  const tierMap = new Map<string, any[]>();
  displayPlan.forEach(d => {
    const tier = d.tier || '1';
    if (!tierMap.has(tier)) {
      tierMap.set(tier, []);
    }
    tierMap.get(tier)!.push(d);
  });

  // Display by tier
  ['1', '2', '3'].forEach(tier => {
    const fields = tierMap.get(tier);
    if (fields && fields.length > 0) {
      const tierName = tier === '1' ? 'Primary (Core)' : tier === '2' ? 'Secondary' : 'Tertiary';
      console.log(`\n${tierName}:`);
      fields.forEach(f => {
        const order = typeof f.order_nbr === 'number' ? f.order_nbr : parseInt(String(f.order_nbr) || '9999');
        const visCondition = f.visibility_cond ? ` [when: ${f.visibility_cond}]` : '';
        console.log(`  [${order}] ${f.field_name}: ${f.label}${visCondition}`);
      });
    }
  });

  // Followup Questions
  const followups = data.followups.filter(f => f.metric_id === metricId);
  console.log('\n❓ FOLLOWUP QUESTIONS');
  console.log('='.repeat(70));
  if (followups.length === 0) {
    console.log('  (none defined)');
  } else {
    followups.forEach(f => {
      console.log(`\n${f.followup_id}:`);
      console.log(`  Question: ${f.question_text}`);
      console.log(`  When: ${f.when_cond || 'always'}`);
      console.log(`  Type: ${f.response_type || 'text'}`);
    });
  }

  // Prompts
  const prompts = data.prompts.filter(p => p.metric_id === metricId);
  console.log('\n💬 PROMPTS');
  console.log('='.repeat(70));
  prompts.forEach(p => {
    console.log(`\n[${p.prompt_type}]`);
    console.log(`  Persona: ${p.persona || 'N/A'}`);
    console.log(`  Purpose: ${p.purpose || 'N/A'}`);
    console.log(`  Preview: ${p.prompt_text.substring(0, 150)}...`);
  });

  // Provenance
  const provenance = data.provenanceRules.filter(p => p.metric_id === metricId);
  console.log('\n🔍 PROVENANCE RULES (Data Source Mapping)');
  console.log('='.repeat(70));
  provenance.forEach(p => {
    console.log(`\n${p.field_name}:`);
    console.log(`  Source: ${p.table_name || 'patient_payload'}.${p.field_ref || p.field_name}`);
    console.log(`  Key: ${p.key_name || 'N/A'}`);
    if (p.fallback_json) {
      console.log(`  Fallback: ${JSON.stringify(p.fallback_json)}`);
    }
  });

  // Create UI mapping
  console.log('\n\n📐 UI COMPONENT MAPPING (Based on UI Mock v4)');
  console.log('='.repeat(70));
  console.log(`
┌─────────────────────────────────────────────────────────────────┐
│ Card Header                                                     │
├─────────────────────────────────────────────────────────────────┤
│ Ortho • I25 — In OR <18h (Supracondylar)   [PASS/FAIL/CAUTION] │
│                                                                 │
│ Patient Info (from display_plan tier 1)                        │
│ ID: TC_SCH_001 • Age: 6 F • Weight: 22.5 kg                    │
│                                                                 │
│ Timeline Bar (progress visualization)                          │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░ 87%                    │
│                                                                 │
│ Primary Fields (tier 1, order_nbr sorted)                      │
│   ${tierMap.get('1')?.slice(0, 3).map((f, i) =>
    `${f.field_name}: [value from patient_payload]`).join('\n│   ') || 'N/A'}
│                                                                 │
│ Secondary Fields (tier 2, collapsible)                         │
│   ${tierMap.get('2')?.slice(0, 3).map((f, i) =>
    `${f.field_name}: [value]`).join('\n│   ') || 'N/A'}
│                                                                 │
│ Signal Chips (from signal_group + signal_def)                  │
│   ${groups.map(g => `[${g.group_code}] ...chips...`).join('\n│   ')}
└─────────────────────────────────────────────────────────────────┘
  `);

  console.log('\n🔧 GROUPING RULES');
  console.log('='.repeat(70));
  console.log(`
1. **Signal Groups** (from signal_group table):
${groups.map((g, i) => `   ${i + 1}. ${g.group_code} (${g.group_id})`).join('\n')}

2. **Display Tiers** (from display_plan.tier):
   - Tier 1: Primary/Core fields (always visible)
   - Tier 2: Secondary fields (collapsible)
   - Tier 3: Tertiary fields (advanced, conditional)

3. **Field Ordering** (display_plan.order_nbr):
   - Within each tier, sort by order_nbr ASC
   - Fields without order_nbr default to 9999 (end of list)

4. **Visibility Conditions** (display_plan.visibility_cond):
   - NULL or empty: always show
   - Conditional expression: evaluate against current signals/state

5. **Chip Colors** (UI Mock v4 standard):
   - core: #007acc (blue)
   - delays: #e0a800 (yellow)
   - complications: #d9534f (red)
   - documentation: #6c757d (gray)
   - exclusions: #28a745 (green)
   - overrides: #17a2b8 (cyan)
  `);

  console.log('\n✅ Analysis Complete');
  console.log('='.repeat(70));
}

analyzeOrthoI25().catch(console.error);
