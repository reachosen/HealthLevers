import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";

// Session storage table for express-session
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Specialty Configuration Schema
export const specialtyQuestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  key_fields: z.array(z.string()),
  validation: z.string(),
  signal_chips: z.array(z.string()).optional(),
  signal_defs: z.record(z.string(), z.object({
    definition: z.string(),
    rule: z.string()
  })).optional()
});

export const specialtyConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  questions: z.array(specialtyQuestionSchema)
});

// Patient Data Schema
export const patientDataSchema = z.object({
  id: z.string(),
  description: z.string(),
  specialty: z.string(),
  data: z.record(z.string(), z.any()),
  editable_notes: z.string().optional()
});

// Test Case Schema
export const testCaseSchema = z.object({
  patient_id: z.string(),
  specialty: z.string(),
  question_id: z.string(),
  fields: z.record(z.string(), z.any()),
  editable_notes: z.string().optional()
});

// Validation Result Schema
export const validationResultSchema = z.object({
  signal: z.string(),
  status: z.enum(["VALIDATED", "REJECTED"]),
  finding: z.string(),
  evidence: z.string(),
  category: z.string().optional()
});

// Abstraction Result Schema
export const abstractionResultSchema = z.object({
  id: z.string(),
  patient_id: z.string(),
  specialty: z.string(),
  question_id: z.string(),
  question_label: z.string(),
  validated_signals: z.array(validationResultSchema),
  processing_status: z.object({
    llm_inference: z.boolean(),
    signal_validation: z.boolean(),
    domain_rules_check: z.boolean(),
    evidence_compilation: z.boolean()
  }),
  created_at: z.string(),
  signals: z.array(z.object({
    check: z.string(),
    status: z.enum(["pass", "fail", "caution", "inactive"]),
    evidence: z.string()
  })).optional()
});

// Export types
export type SpecialtyQuestion = z.infer<typeof specialtyQuestionSchema>;
export type SpecialtyConfig = z.infer<typeof specialtyConfigSchema>;
export type PatientData = z.infer<typeof patientDataSchema>;
export type TestCase = z.infer<typeof testCaseSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type AbstractionResult = z.infer<typeof abstractionResultSchema>;

// Insert schemas
export const insertTestCaseSchema = testCaseSchema.omit({ patient_id: true }).extend({
  patient_id: z.string(),
  specialty: z.string(),
  question_id: z.string()
});

export type InsertTestCase = z.infer<typeof insertTestCaseSchema>;
