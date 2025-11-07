/**
 * Excel Parser Service
 *
 * Parses USNWR_Master_AllMetrics_v4.xlsx into structured, validated data.
 * Validates all 8 sheets using Zod schemas before database insertion.
 */

import * as XLSX from 'xlsx';
import { z } from 'zod';

// =============================================================================
// ZOD SCHEMAS - Match database table definitions
// =============================================================================

// Sheet 1: metrics
const MetricSchema = z.object({
  metric_id: z.string(),
  specialty: z.string(),
  metric_name: z.string(),
  domain: z.string().nullable().optional(),
  threshold_hours: z.union([z.number(), z.string()]).nullable().optional(),
  content_version: z.string().nullable().optional(),
});

// Sheet 2: groups
const SignalGroupSchema = z.object({
  metric_id: z.string(),
  group_id: z.string(),
  group_code: z.string(),
});

// Sheet 3: signals
const SignalDefSchema = z.object({
  metric_id: z.string(),
  signal_code: z.string(),
  group_id: z.string().nullable().optional(),
  severity: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
});

// Sheet 4: followups
const FollowupSchema = z.object({
  metric_id: z.string(),
  followup_id: z.string(),
  when_cond: z.string().nullable().optional(),
  question_text: z.string(),
  response_type: z.string().nullable().optional(),
});

// Sheet 5: display_plan
const DisplayPlanSchema = z.object({
  metric_id: z.string(),
  field_name: z.string(),
  label: z.string(),
  tier: z.string().nullable().optional(),
  visibility_cond: z.string().nullable().optional(),
  order_nbr: z.union([z.number(), z.string()]),
});

// Sheet 6: provenance_rules
const ProvenanceRuleSchema = z.object({
  metric_id: z.string(),
  field_name: z.string(),
  table_name: z.string().nullable().optional(),
  key_name: z.string().nullable().optional(),
  field_ref: z.string().nullable().optional(),
  fallback_json: z.any().nullable().optional(), // Will be parsed as JSONB
});

// Sheet 7: prompts
const PromptSchema = z.object({
  metric_id: z.string(),
  prompt_type: z.string(),
  persona: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  prompt_text: z.string(),
  classifier_1: z.string().nullable().optional(),
  classifier_2: z.string().nullable().optional(),
  content_version: z.string().nullable().optional(),
  last_changed_at: z.union([z.date(), z.string()]).nullable().optional(),
});

// Sheet 8: versions (if exists - for tracking content versions)
const VersionSchema = z.object({
  version_id: z.string(),
  version_name: z.string(),
  created_at: z.union([z.date(), z.string()]).nullable().optional(),
  description: z.string().nullable().optional(),
}).catchall(z.any()); // Allow additional fields

// =============================================================================
// TYPES - Inferred from Zod schemas
// =============================================================================

export type Metric = z.infer<typeof MetricSchema>;
export type SignalGroup = z.infer<typeof SignalGroupSchema>;
export type SignalDef = z.infer<typeof SignalDefSchema>;
export type Followup = z.infer<typeof FollowupSchema>;
export type DisplayPlan = z.infer<typeof DisplayPlanSchema>;
export type ProvenanceRule = z.infer<typeof ProvenanceRuleSchema>;
export type Prompt = z.infer<typeof PromptSchema>;
export type Version = z.infer<typeof VersionSchema>;

export interface ParsedExcelData {
  metrics: Metric[];
  signalGroups: SignalGroup[];
  signalDefs: SignalDef[];
  followups: Followup[];
  displayPlans: DisplayPlan[];
  provenanceRules: ProvenanceRule[];
  prompts: Prompt[];
  versions: Version[];
}

// =============================================================================
// EXCEL PARSER CLASS
// =============================================================================

export class ExcelParser {
  private workbook: XLSX.WorkBook | null = null;
  private filePath: string = '';

  /**
   * Load Excel file into memory
   */
  async loadExcel(filePath: string): Promise<void> {
    try {
      this.filePath = filePath;
      this.workbook = XLSX.readFile(filePath);
      console.log('✅ Loaded Excel file:', filePath);
      console.log('📄 Sheets found:', this.workbook.SheetNames.join(', '));
    } catch (error) {
      console.error('❌ Failed to load Excel file:', error);
      throw new Error(`Failed to load Excel file: ${error}`);
    }
  }

  /**
   * Parse a specific sheet with validation
   */
  parseSheet<T>(
    sheetName: string,
    schema: z.ZodSchema<T>,
    options: { required?: boolean } = {}
  ): T[] {
    if (!this.workbook) {
      throw new Error('Workbook not loaded. Call loadExcel() first.');
    }

    const sheet = this.workbook.Sheets[sheetName];

    if (!sheet) {
      if (options.required) {
        throw new Error(`Required sheet '${sheetName}' not found`);
      }
      console.log(`⚠️  Sheet '${sheetName}' not found (optional) - skipping`);
      return [];
    }

    try {
      // Convert sheet to JSON with header row
      const rawData = XLSX.utils.sheet_to_json(sheet, {
        raw: false, // Keep strings as strings
        defval: null, // Use null for empty cells
      });

      if (rawData.length === 0) {
        console.log(`⚠️  Sheet '${sheetName}' is empty`);
        return [];
      }

      // Validate each row
      const validatedData: T[] = [];
      const errors: Array<{ row: number; error: any }> = [];

      rawData.forEach((row, index) => {
        try {
          const validated = schema.parse(row);
          validatedData.push(validated);
        } catch (error) {
          errors.push({ row: index + 2, error }); // +2 for Excel row (1-indexed + header)
          if (errors.length <= 5) { // Show first 5 errors only
            console.error(`❌ Validation error in ${sheetName} row ${index + 2}:`, error);
          }
        }
      });

      if (errors.length > 0) {
        const errorSummary = `${errors.length} validation error(s) in sheet '${sheetName}'`;
        console.error(`❌ ${errorSummary}`);
        if (errors.length > 5) {
          console.error(`   (showing first 5 errors, ${errors.length - 5} more suppressed)`);
        }
        throw new Error(errorSummary);
      }

      console.log(`✅ Parsed ${validatedData.length} rows from '${sheetName}'`);
      return validatedData;

    } catch (error) {
      console.error(`❌ Failed to parse sheet '${sheetName}':`, error);
      throw error;
    }
  }

  /**
   * Parse all sheets and return structured data
   */
  async parseAllSheets(): Promise<ParsedExcelData> {
    console.log('\n📊 Parsing all sheets...\n');

    const metrics = this.parseSheet('metrics', MetricSchema, { required: true });
    const signalGroups = this.parseSheet('groups', SignalGroupSchema, { required: true });
    const signalDefs = this.parseSheet('signals', SignalDefSchema, { required: true });
    const followups = this.parseSheet('followups', FollowupSchema, { required: true });
    const displayPlans = this.parseSheet('display_plan', DisplayPlanSchema, { required: true });
    const provenanceRules = this.parseSheet('provenance_rules', ProvenanceRuleSchema, { required: true });
    const prompts = this.parseSheet('prompts', PromptSchema, { required: true });
    const versions = this.parseSheet('versions', VersionSchema, { required: false });

    console.log('\n📈 Parsing Summary:');
    console.log(`   Metrics: ${metrics.length}`);
    console.log(`   Signal Groups: ${signalGroups.length}`);
    console.log(`   Signal Definitions: ${signalDefs.length}`);
    console.log(`   Followups: ${followups.length}`);
    console.log(`   Display Plans: ${displayPlans.length}`);
    console.log(`   Provenance Rules: ${provenanceRules.length}`);
    console.log(`   Prompts: ${prompts.length}`);
    console.log(`   Versions: ${versions.length}`);

    return {
      metrics,
      signalGroups,
      signalDefs,
      followups,
      displayPlans,
      provenanceRules,
      prompts,
      versions,
    };
  }

  /**
   * Get list of all sheet names in workbook
   */
  getSheetNames(): string[] {
    if (!this.workbook) {
      throw new Error('Workbook not loaded. Call loadExcel() first.');
    }
    return this.workbook.SheetNames;
  }

  /**
   * Get column headers from a specific sheet
   */
  getSheetHeaders(sheetName: string): string[] {
    if (!this.workbook) {
      throw new Error('Workbook not loaded. Call loadExcel() first.');
    }

    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length === 0) return [];

    return (data[0] as string[]) || [];
  }

  /**
   * Export parsed data to JSON file
   */
  exportToJSON(data: ParsedExcelData, outputPath: string): void {
    const fs = require('fs');
    const path = require('path');

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write JSON file
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`\n💾 Exported parsed data to: ${outputPath}`);
  }

  /**
   * Validate relationships between sheets
   * Ensures referential integrity before database insertion
   */
  validateRelationships(data: ParsedExcelData): void {
    console.log('\n🔍 Validating relationships between sheets...\n');

    const errors: string[] = [];
    const warnings: string[] = [];
    const {
      metrics,
      signalGroups,
      signalDefs,
      followups,
      displayPlans,
      provenanceRules,
      prompts,
    } = data;

    // Build sets for efficient lookup
    const metricIds = new Set(metrics.map(m => m.metric_id));
    console.log(`   📊 Found ${metricIds.size} unique metrics`);

    const groupKeys = new Set(
      signalGroups.map(g => `${g.metric_id}:${g.group_id}`)
    );
    console.log(`   📊 Found ${groupKeys.size} unique groups`);

    // Validate signal_group → metric references
    console.log('\n   🔗 Checking signal_group → metric references...');
    let validCount = 0;
    for (const group of signalGroups) {
      if (!metricIds.has(group.metric_id)) {
        errors.push(
          `Signal group '${group.group_id}' references unknown metric '${group.metric_id}'`
        );
      } else {
        validCount++;
      }
    }
    console.log(`      ✅ ${validCount}/${signalGroups.length} valid`);

    // Validate signal_def → metric references
    console.log('   🔗 Checking signal_def → metric references...');
    validCount = 0;
    for (const signal of signalDefs) {
      if (!metricIds.has(signal.metric_id)) {
        errors.push(
          `Signal '${signal.signal_code}' references unknown metric '${signal.metric_id}'`
        );
      } else {
        validCount++;
      }
    }
    console.log(`      ✅ ${validCount}/${signalDefs.length} valid`);

    // Validate signal_def → signal_group references (optional)
    console.log('   🔗 Checking signal_def → signal_group references...');
    let referencedCount = 0;
    let nullCount = 0;
    for (const signal of signalDefs) {
      if (signal.group_id === null || signal.group_id === undefined) {
        nullCount++;
        continue;
      }

      referencedCount++;
      const key = `${signal.metric_id}:${signal.group_id}`;
      if (!groupKeys.has(key)) {
        warnings.push(
          `Signal '${signal.signal_code}' references unknown group '${signal.group_id}' for metric '${signal.metric_id}'`
        );
      }
    }
    console.log(`      ✅ ${referencedCount} signals reference groups, ${nullCount} have no group`);

    // Validate followup → metric references
    console.log('   🔗 Checking followup → metric references...');
    validCount = 0;
    for (const followup of followups) {
      if (!metricIds.has(followup.metric_id)) {
        errors.push(
          `Followup '${followup.followup_id}' references unknown metric '${followup.metric_id}'`
        );
      } else {
        validCount++;
      }
    }
    console.log(`      ✅ ${validCount}/${followups.length} valid`);

    // Validate display_plan → metric references
    console.log('   🔗 Checking display_plan → metric references...');
    validCount = 0;
    for (const plan of displayPlans) {
      if (!metricIds.has(plan.metric_id)) {
        errors.push(
          `Display plan field '${plan.field_name}' references unknown metric '${plan.metric_id}'`
        );
      } else {
        validCount++;
      }
    }
    console.log(`      ✅ ${validCount}/${displayPlans.length} valid`);

    // Validate provenance_rule → metric references
    console.log('   🔗 Checking provenance_rule → metric references...');
    validCount = 0;
    for (const rule of provenanceRules) {
      if (!metricIds.has(rule.metric_id)) {
        errors.push(
          `Provenance rule for field '${rule.field_name}' references unknown metric '${rule.metric_id}'`
        );
      } else {
        validCount++;
      }
    }
    console.log(`      ✅ ${validCount}/${provenanceRules.length} valid`);

    // Validate prompt → metric references
    console.log('   🔗 Checking prompt → metric references...');
    validCount = 0;
    for (const promptItem of prompts) {
      if (!metricIds.has(promptItem.metric_id)) {
        errors.push(
          `Prompt '${promptItem.prompt_type}' references unknown metric '${promptItem.metric_id}'`
        );
      } else {
        validCount++;
      }
    }
    console.log(`      ✅ ${validCount}/${prompts.length} valid`);

    // Report warnings
    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      warnings.slice(0, 10).forEach(warn => console.log(`   - ${warn}`));
      if (warnings.length > 10) {
        console.log(`   ... and ${warnings.length - 10} more warning(s)`);
      }
    }

    // Report errors
    if (errors.length > 0) {
      console.error('\n❌ Validation Errors:');
      errors.slice(0, 20).forEach(err => console.error(`   - ${err}`));
      if (errors.length > 20) {
        console.error(`   ... and ${errors.length - 20} more error(s)`);
      }
      throw new Error(`${errors.length} referential integrity error(s) found`);
    }

    console.log('\n✅ All relationship validations passed!');
    console.log(`   Total relationships validated: ${
      signalGroups.length +
      signalDefs.length +
      followups.length +
      displayPlans.length +
      provenanceRules.length +
      prompts.length
    }\n`);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const excelParser = new ExcelParser();
