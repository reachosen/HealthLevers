#!/usr/bin/env tsx
/**
 * Excel Parser Test Script
 *
 * Tests the ExcelParser service by:
 * 1. Loading the USNWR Excel file
 * 2. Parsing all 8 sheets with validation
 * 3. Exporting parsed data to JSON
 * 4. Displaying summary statistics
 */

import { excelParser } from '../server/services/excelParser';
import * as path from 'path';
import * as fs from 'fs';

async function testParser() {
  console.log('🧪 Testing Excel Parser Service\n');
  console.log('='.repeat(60));

  // Locate Excel file
  const excelPath = path.join(__dirname, '../USNWR_Master_AllMetrics_v4.xlsx');

  // Verify file exists
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Excel file not found at: ${excelPath}`);
    console.error('\nExpected location: USNWR_Master_AllMetrics_v4.xlsx');
    console.error('Please ensure the Excel file is in the project root.');
    process.exit(1);
  }

  const stats = fs.statSync(excelPath);
  console.log(`📁 Excel file: ${path.basename(excelPath)}`);
  console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`📅 Modified: ${stats.mtime.toISOString()}`);
  console.log('='.repeat(60));

  try {
    // Step 1: Load Excel file
    console.log('\n📖 Step 1: Loading Excel file...');
    await excelParser.loadExcel(excelPath);

    // Step 2: Get sheet information
    console.log('\n📋 Step 2: Inspecting workbook structure...');
    const sheetNames = excelParser.getSheetNames();
    console.log(`   Found ${sheetNames.length} sheets:`);
    sheetNames.forEach((name, index) => {
      console.log(`   ${index + 1}. ${name}`);
    });

    // Display headers for each sheet
    console.log('\n🔍 Sheet Headers:');
    for (const sheetName of sheetNames) {
      try {
        const headers = excelParser.getSheetHeaders(sheetName);
        console.log(`\n   ${sheetName} (${headers.length} columns):`);
        console.log(`   ${headers.join(', ')}`);
      } catch (error) {
        console.log(`   ⚠️  Could not read headers for '${sheetName}'`);
      }
    }

    // Step 3: Parse all sheets with validation
    console.log('\n' + '='.repeat(60));
    console.log('📊 Step 3: Parsing and validating all sheets...');
    console.log('='.repeat(60));

    const data = await excelParser.parseAllSheets();

    // Step 3.5: Validate relationships between sheets
    console.log('\n' + '='.repeat(60));
    console.log('🔗 Step 3.5: Validating Relationships');
    console.log('='.repeat(60));

    excelParser.validateRelationships(data);

    // Step 4: Display detailed statistics
    console.log('\n' + '='.repeat(60));
    console.log('📈 Step 4: Data Statistics');
    console.log('='.repeat(60));

    // Metrics statistics
    console.log('\n📊 Metrics:');
    console.log(`   Total: ${data.metrics.length}`);
    if (data.metrics.length > 0) {
      const specialties = [...new Set(data.metrics.map(m => m.specialty))];
      console.log(`   Unique Specialties: ${specialties.length}`);
      console.log(`   Specialties: ${specialties.join(', ')}`);

      // Count by specialty
      const bySp = data.metrics.reduce((acc, m) => {
        acc[m.specialty] = (acc[m.specialty] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('   Breakdown:');
      Object.entries(bySp).forEach(([sp, count]) => {
        console.log(`     - ${sp}: ${count}`);
      });
    }

    // Signal Groups statistics
    console.log('\n📊 Signal Groups:');
    console.log(`   Total: ${data.signalGroups.length}`);
    if (data.signalGroups.length > 0) {
      const uniqueMetrics = [...new Set(data.signalGroups.map(g => g.metric_id))];
      console.log(`   Metrics with groups: ${uniqueMetrics.length}`);
    }

    // Signal Definitions statistics
    console.log('\n📊 Signal Definitions:');
    console.log(`   Total: ${data.signalDefs.length}`);
    if (data.signalDefs.length > 0) {
      const uniqueMetrics = [...new Set(data.signalDefs.map(s => s.metric_id))];
      console.log(`   Metrics with signals: ${uniqueMetrics.length}`);

      const severities = [...new Set(data.signalDefs.map(s => s.severity).filter(Boolean))];
      if (severities.length > 0) {
        console.log(`   Severities: ${severities.join(', ')}`);
      }
    }

    // Followups statistics
    console.log('\n📊 Followups:');
    console.log(`   Total: ${data.followups.length}`);
    if (data.followups.length > 0) {
      const uniqueMetrics = [...new Set(data.followups.map(f => f.metric_id))];
      console.log(`   Metrics with followups: ${uniqueMetrics.length}`);
    }

    // Display Plans statistics
    console.log('\n📊 Display Plans:');
    console.log(`   Total: ${data.displayPlans.length}`);
    if (data.displayPlans.length > 0) {
      const uniqueMetrics = [...new Set(data.displayPlans.map(d => d.metric_id))];
      console.log(`   Metrics with display plans: ${uniqueMetrics.length}`);
    }

    // Provenance Rules statistics
    console.log('\n📊 Provenance Rules:');
    console.log(`   Total: ${data.provenanceRules.length}`);
    if (data.provenanceRules.length > 0) {
      const uniqueMetrics = [...new Set(data.provenanceRules.map(p => p.metric_id))];
      console.log(`   Metrics with provenance rules: ${uniqueMetrics.length}`);
    }

    // Prompts statistics
    console.log('\n📊 Prompts:');
    console.log(`   Total: ${data.prompts.length}`);
    if (data.prompts.length > 0) {
      const uniqueMetrics = [...new Set(data.prompts.map(p => p.metric_id))];
      console.log(`   Metrics with prompts: ${uniqueMetrics.length}`);

      const promptTypes = [...new Set(data.prompts.map(p => p.prompt_type))];
      console.log(`   Prompt Types: ${promptTypes.join(', ')}`);
    }

    // Versions statistics
    console.log('\n📊 Versions:');
    console.log(`   Total: ${data.versions.length}`);

    // Step 5: Export to JSON
    console.log('\n' + '='.repeat(60));
    console.log('💾 Step 5: Exporting parsed data to JSON...');
    console.log('='.repeat(60));

    const outputDir = path.join(__dirname, '../data');
    const outputPath = path.join(outputDir, 'parsed-metadata.json');

    excelParser.exportToJSON(data, outputPath);

    const outputStats = fs.statSync(outputPath);
    console.log(`   File size: ${(outputStats.size / 1024).toFixed(2)} KB`);

    // Step 6: Sample data preview
    console.log('\n' + '='.repeat(60));
    console.log('👀 Step 6: Sample Data Preview');
    console.log('='.repeat(60));

    if (data.metrics.length > 0) {
      console.log('\n📊 First Metric:');
      console.log(JSON.stringify(data.metrics[0], null, 2));
    }

    if (data.signalDefs.length > 0) {
      console.log('\n📊 First Signal Definition:');
      console.log(JSON.stringify(data.signalDefs[0], null, 2));
    }

    if (data.prompts.length > 0) {
      console.log('\n📊 First Prompt (truncated):');
      const firstPrompt = { ...data.prompts[0] };
      if (firstPrompt.prompt_text && firstPrompt.prompt_text.length > 100) {
        firstPrompt.prompt_text = firstPrompt.prompt_text.substring(0, 100) + '...';
      }
      console.log(JSON.stringify(firstPrompt, null, 2));
    }

    // Success summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Excel Parser Test Complete!');
    console.log('='.repeat(60));
    console.log(`\n✅ Successfully parsed ${sheetNames.length} sheets`);
    console.log(`✅ Validated ${
      data.metrics.length +
      data.signalGroups.length +
      data.signalDefs.length +
      data.followups.length +
      data.displayPlans.length +
      data.provenanceRules.length +
      data.prompts.length +
      data.versions.length
    } total rows`);
    console.log(`✅ Exported to: ${outputPath}`);
    console.log('\n📚 Next Steps:');
    console.log('   1. Review parsed-metadata.json for data integrity');
    console.log('   2. Run Story 5 to validate relationships');
    console.log('   3. Load data into database (Story 6)\n');

    process.exit(0);

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Excel Parser Test Failed');
    console.error('='.repeat(60));
    console.error('\nError:', error);

    if (error instanceof Error) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    console.error('\n💡 Troubleshooting:');
    console.error('   1. Verify Excel file exists at project root');
    console.error('   2. Check that all required sheets exist');
    console.error('   3. Verify column names match expected schema');
    console.error('   4. Check for empty or malformed rows\n');

    process.exit(1);
  }
}

// Run test
console.log('');
testParser();
