#!/usr/bin/env tsx
import { excelParser } from '../server/services/excelParser';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function listMetrics() {
  const excelPath = path.join(__dirname, '../USNWR_Master_AllMetrics_v4.xlsx');
  await excelParser.loadExcel(excelPath);
  const data = await excelParser.parseAllSheets();

  console.log('\n📊 ALL METRICS BY SPECIALTY\n');
  console.log('='.repeat(70));

  // Group by specialty
  const bySpecialty = new Map<string, any[]>();
  data.metrics.forEach(m => {
    const specialty = m.specialty || 'Unknown';
    if (!bySpecialty.has(specialty)) {
      bySpecialty.set(specialty, []);
    }
    bySpecialty.get(specialty)!.push(m);
  });

  bySpecialty.forEach((metrics, specialty) => {
    console.log(`\n${specialty} (${metrics.length} metrics):`);
    metrics.forEach(m => {
      console.log(`  ${m.metric_id}: ${m.metric_name}`);
      if (m.domain) console.log(`    Domain: ${m.domain}`);
      if (m.threshold_hours) console.log(`    Threshold: ${m.threshold_hours}h`);
    });
  });

  console.log('\n' + '='.repeat(70));
}

listMetrics().catch(console.error);
