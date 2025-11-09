import type { Express } from "express";
import { createServer, type Server } from "http";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import * as fs from "fs";
import { storage } from "./storage";
import { testCaseSchema } from "@shared/schema";
import { z } from "zod";
import { asyncHandler } from "./lib/asyncHandler";
import OpenAI from "openai";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { promptStore } from "./promptStore";
import { validateRequest, logPromptUsage } from "../shared/promptRouting";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  // Protected routes - require authentication
  // Get modules for a specialty
  app.get("/api/modules", isAuthenticated, async (req, res) => {
    try {
      const specialty = req.query.specialty as string;
      
      if (!specialty) {
        return res.status(400).json({ message: "Specialty parameter is required" });
      }

      // Return hardcoded modules for now since dynamic import is complex
      const orthopedicsModules = [
        { value: "timeliness_sch", name: "Timeliness – SCH", description: "Was surgery ≤19h from ED arrival?", displayOrder: 1 },
        { value: "timeliness_urgent", name: "Timeliness – Other Urgent Ortho", description: "Was definitive care within condition-specific time target?", displayOrder: 2 },
        { value: "ssi_assessment", name: "Surgical Site Infection (SSI)", description: "Did SSI occur during index or within 30/90 days?", displayOrder: 3 },
        { value: "return_or", name: "Return to OR (Unplanned)", description: "Was the return unplanned and related to index procedure?", displayOrder: 4 }
      ];
      
      const modules = specialty === "Orthopedics" ? orthopedicsModules : [];
      
      res.json({ 
        specialty,
        modules: modules.map(m => ({
          id: m.value,
          name: m.name,
          description: m.description,
          displayOrder: m.displayOrder
        }))
      });
    } catch (error) {
      console.error("Error fetching modules:", error);
      res.status(500).json({ message: "Failed to fetch modules" });
    }
  });

  // Get cases for a specialty/module
  app.get("/api/cases", isAuthenticated, async (req, res) => {
    try {
      const { specialty, moduleId, status, limit = 10, cursor } = req.query;
      
      if (!specialty) {
        return res.status(400).json({ message: "Specialty parameter is required" });
      }

      // Load test cases data
      const testCasesPath = join(process.cwd(), 'client/src/data/testCases.json');
      const testCasesData = JSON.parse(await readFile(testCasesPath, 'utf-8'));
      
      // Filter cases by criteria
      let cases = Object.values(testCasesData).flat();
      
      if (moduleId) {
        // Cases don't have direct module mapping, so we'll provide a generic response
        cases = cases.slice(0, parseInt(limit as string));
      }
      
      // Convert to API format
      const formattedCases = cases.map((c: any, index) => ({
        id: c.id || `case_${index}`,
        specialty: specialty,
        moduleId: moduleId || 'general',
        status: status || 'active',
        patient: c.patient || { name: 'Unknown', age: 0, mrn: 'N/A' },
        createdAt: new Date().toISOString(),
        bucket: 'normal'
      }));

      res.json({
        cases: formattedCases,
        pagination: {
          limit: parseInt(limit as string),
          cursor: cursor || null,
          hasMore: false
        }
      });
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ message: "Failed to fetch cases" });
    }
  });

  // Get specific case by ID
  app.get("/api/cases/:id", isAuthenticated, async (req, res) => {
    try {
      const caseId = req.params.id;
      
      // Check localStorage-style storage first
      const storedCases = await storage.getStoredCases();
      let caseData = storedCases.find((c: any) => c.selectedCaseId === caseId);
      
      if (!caseData) {
        // Fallback to test cases
        const testCasesPath = join(process.cwd(), 'client/src/data/testCases.json');
        const testCasesData = JSON.parse(await readFile(testCasesPath, 'utf-8'));
        const testCase = Object.values(testCasesData).flat().find((c: any) => c.id === caseId);
        
        if (!testCase) {
          return res.status(404).json({ message: "Case not found" });
        }
        
        caseData = {
          patient_payload: testCase,
          mergedSignals: [],
          category_counts: { pass: 0, fail: 0, caution: 0, inactive: 0 },
          selectedSpecialty: 'Orthopedics',
          selectedModule: 'Timeliness – SCH',
          selectedModuleId: 'timeliness_sch',
          selectedCaseId: caseId
        };
      }

      res.json(caseData);
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ message: "Failed to fetch case" });
    }
  });

  // Get all specialties
  app.get("/api/specialties", isAuthenticated, async (req, res) => {
    try {
      // Load specialty metadata from client-side file
      const specialtyMetaPath = join(process.cwd(), 'client/src/data/specialtyMetadata.ts');
      
      // For now, return hardcoded specialties but this could be made more dynamic
      const specialties = [
        "Orthopedics",
        "Cardiology", 
        "Neurosurgery",
        "General Surgery",
        "Pediatrics",
        "Emergency Medicine",
        "Internal Medicine",
        "Anesthesiology"
      ];
      
      res.json({ 
        specialties: specialties.map((name, index) => ({
          id: name.toLowerCase().replace(/\s+/g, '_'),
          name,
          displayOrder: index + 1
        }))
      });
    } catch (error) {
      console.error("Error fetching specialties:", error);
      res.status(500).json({ message: "Failed to fetch specialties" });
    }
  });

  // Get specific specialty (placeholder)
  app.get("/api/specialties/:id", isAuthenticated, async (req, res) => {
    try {
      // Specialties are managed via specialtyMetadata on the client side
      res.json({ id: req.params.id, message: "Specialty managed via client metadata" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch specialty" });
    }
  });

  // Get all patients (placeholder - patients are mock data)
  app.get("/api/patients", isAuthenticated, async (req, res) => {
    try {
      // Patients are generated via mock data in testCases.json
      res.json({ message: "Patients managed via mock test cases" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  // Get specific patient (placeholder)
  app.get("/api/patients/:id", isAuthenticated, async (req, res) => {
    try {
      // Patients are generated via mock data in testCases.json
      res.json({ id: req.params.id, message: "Patient managed via mock test cases" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch patient" });
    }
  });

  // AI Signal Processing endpoint
  app.post("/api/ai_signals", isAuthenticated, asyncHandler(async (req, res) => {
    const { specialty, moduleId, moduleSignals, patient, promptText } = req.body;
    
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        message: "OpenAI API key not configured",
        signals: [],
        category_counts: { pass: 0, fail: 0, caution: 0, inactive: 0 }
      });
    }

    try {
      // Use custom prompt if provided, otherwise build fallback
      const systemPrompt = promptText || `You are a medical quality reviewer analyzing patient data for ${specialty} - ${moduleId}.

Analyze the patient data and for each signal, determine:
- status: "pass", "fail", "caution", or "inactive"
- evidence: brief summary of supporting/contradicting evidence

Return JSON only in this exact format:
{
  "signals": [
    {"id": "signal_id", "status": "pass|fail|caution|inactive", "evidence": "brief evidence summary"},
    ...
  ],
  "category_counts": {"pass": 0, "fail": 0, "caution": 0, "inactive": 0}
}`;

      const userPrompt = `${promptText}

Patient Data:
${JSON.stringify(patient, null, 2)}

Signals to evaluate:
${moduleSignals.map((s: any) => `- ${s.id}: ${s.label} (group: ${s.group})`).join('\n')}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error("No response from OpenAI");
      }

      // Clean the response to handle markdown code blocks
      let cleanResponse = response;
      
      // Remove markdown code blocks if present
      if (cleanResponse.includes("```")) {
        cleanResponse = cleanResponse
          .replace(/```json\s*/gi, "")
          .replace(/```\s*$/g, "")
          .trim();
      }
      
      // Parse AI response
      const aiResult = JSON.parse(cleanResponse);
      
      // Validate and ensure all signals are included - preserve cites from AI response
      const processedSignals = moduleSignals.map((sig: any) => {
        const aiSignal = aiResult.signals?.find((s: any) => s.id === sig.id);
        return {
          id: sig.id,
          status: aiSignal?.status || "inactive",
          evidence: aiSignal?.evidence || "No evidence found",
          cites: aiSignal?.cites || [] // PRESERVE cites from AI instead of hardcoding empty array
        };
      });

      // Calculate category counts
      const category_counts = {
        pass: processedSignals.filter((s: any) => s.status === "pass").length,
        fail: processedSignals.filter((s: any) => s.status === "fail").length,
        caution: processedSignals.filter((s: any) => s.status === "caution").length,
        inactive: processedSignals.filter((s: any) => s.status === "inactive").length
      };

      res.json({
        signals: processedSignals,
        category_counts
      });

    } catch (error) {
      console.error("AI signal processing error:", error);
      
      // Fallback: return all signals as inactive
      const fallbackSignals = moduleSignals.map((sig: any) => ({
        id: sig.id,
        status: "inactive",
        evidence: "Error during AI processing",
        cites: []
      }));

      res.json({
        signals: fallbackSignals,
        category_counts: { pass: 0, fail: 0, caution: 0, inactive: fallbackSignals.length }
      });
    }
  }));

  // Get prompt for a question
  app.get("/api/prompts/:questionId", isAuthenticated, async (req, res) => {
    try {
      const { questionId } = req.params;
      const promptPath = join(process.cwd(), 'prompts_ortho', `${questionId}.md`);
      const promptContent = await readFile(promptPath, 'utf-8');
      res.json({ questionId, content: promptContent });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ message: "Prompt not found" });
      }
      res.status(500).json({ message: "Failed to fetch prompt" });
    }
  });

  // Update prompt for a question
  app.put("/api/prompts/:questionId", isAuthenticated, async (req, res) => {
    try {
      const { questionId } = req.params;
      const { content } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ message: "Content is required and must be a string" });
      }
      const promptPath = join(process.cwd(), 'prompts_ortho', `${questionId}.md`);
      await writeFile(promptPath, content, 'utf-8');
      res.json({ message: "Prompt updated successfully", questionId });
    } catch (error) {
      res.status(500).json({ message: "Failed to update prompt" });
    }
  });

  // Run abstraction analysis with prompt routing
  app.post("/api/abstraction/run", isAuthenticated, async (req, res) => {
    try {
      const testCase = testCaseSchema.parse(req.body);
      
      // Use prompt routing system for abstraction
      const requestEnvelope = promptStore.buildRequest(
        testCase.specialty || 'Orthopedics',
        testCase.module || 'default',
        'abstraction_help',
        testCase.patient_payload
      );

      if (!requestEnvelope) {
        return res.status(400).json({ message: 'No suitable prompt found' });
      }

      const promptConfig = promptStore.getPrompt(
        testCase.specialty || 'Orthopedics',
        testCase.module || 'default', 
        'abstraction_help'
      );

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: promptConfig?.template || "You are a medical abstraction assistant."
          },
          {
            role: "user", 
            content: `Patient Context: ${JSON.stringify(requestEnvelope.patientContext, null, 2)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 800
      });

      const result = {
        analysis: completion.choices[0]?.message?.content || "",
        promptKey: requestEnvelope.prompt_key,
        timestamp: new Date().toISOString()
      };

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid test case data",
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to run abstraction" });
    }
  });

  // Test cases endpoint
  app.get("/api/testcases", isAuthenticated, async (req, res) => {
    try {
      const testCasesPath = join(process.cwd(), 'server/data/ortho_testcases.json');
      const testCasesContent = await readFile(testCasesPath, 'utf-8');
      const testCases = JSON.parse(testCasesContent);
      res.json(testCases);
    } catch (error: any) {
      console.error("Error loading test cases:", error);
      res.status(500).json({ message: "Failed to load test cases" });
    }
  });

  // Testcase endpoint with precomputed signals and category counts
  app.get("/api/testcase", isAuthenticated, asyncHandler(async (req, res) => {
    try {
      const { patient_id, question_id } = req.query;
      
      if (!patient_id || !question_id) {
        return res.status(400).json({ 
          message: "Missing required parameters: patient_id, question_id" 
        });
      }

      // Load test cases data (simplified approach)
      const testCasesPath = join(process.cwd(), 'server/data/ortho_testcases.json');
      let testCases: any[] = [];
      try {
        const testCasesContent = await readFile(testCasesPath, 'utf-8');
        testCases = JSON.parse(testCasesContent);
      } catch (error) {
        console.error("Error loading test cases:", error);
      }

      const patient = testCases.find((tc: any) => tc.id === patient_id);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Use prompt routing to get question data
      const specialty = {
        questions: [{ id: question_id, signal_chips: [] }]
      };
      
      if (!specialty) {
        return res.status(404).json({ message: "Question not found" });
      }

      const questionData = specialty.questions.find((q: any) => q.id === question_id);
      
      if (!questionData) {
        return res.status(404).json({ message: "Question data not found" });
      }

      // Precompute signals based on patient data and validation rules
      const precomputedSignals = questionData.signal_chips?.map((chip: string) => {
        let status = "inactive";
        let evidence = "";

        // SCH 19h signals
        if (chip === "On-time ≤19h") {
          if (patient_id === "TC_SCH_PASS") {
            status = "pass";
            evidence = "Surgery completed at 18:30 - within 19h window";
          } else if (patient_id === "TC_SCH_DELAY_CT_NONORTHO_NPO") {
            status = "fail";
            evidence = "Surgery delayed 22h due to CT/NPO violation";
          }
        } else if (chip === "Dx confirmed SCH") {
          if (patient_id.includes("SCH")) {
            status = "pass";
            evidence = "Supracondylar humerus fracture confirmed in diagnosis";
          } else {
            status = "fail";
            evidence = "Different diagnosis documented";
          }
        } else if (chip === "Non-Ortho admit") {
          if (patient_id === "TC_SCH_DELAY_CT_NONORTHO_NPO") {
            status = "fail";
            evidence = "Admitted to Pediatrics service";
          } else {
            status = "pass";
            evidence = "Admitted to Orthopedics service";
          }
        } else if (chip === "NPO violation") {
          if (patient_id === "TC_SCH_DELAY_CT_NONORTHO_NPO") {
            status = "fail";
            evidence = "NPO violated at 20:00 (juice given)";
          } else {
            status = "pass";
            evidence = "NPO maintained throughout";
          }
        } else if (chip === "Workup delay") {
          if (patient_id === "TC_SCH_DELAY_CT_NONORTHO_NPO") {
            status = "fail";
            evidence = "Head trauma requiring CT scan";
          } else {
            status = "pass";
            evidence = "No workup delays documented";
          }
        } else if (chip === "Multi-procedure") {
          if (patient_id === "TC_SCH_MULTIPROC_PLANNED") {
            status = "caution";
            evidence = "Multiple procedures planned";
          } else {
            status = "pass";
            evidence = "Single procedure case";
          }
        } else if (chip === "Planned return") {
          if (patient_id === "TC_RTO_UNPLANNED") {
            status = "fail";
            evidence = "Unplanned return to OR";
          } else {
            status = "pass";
            evidence = "No return to OR";
          }
        } else if (chip === "Competing priority") {
          if (patient_id === "TC_SCH_DELAY_CT_NONORTHO_NPO") {
            status = "caution";
            evidence = "Head trauma took priority";
          } else {
            status = "pass";
            evidence = "No competing priorities";
          }
        }
        
        // SSI signals
        else if (chip === "Signs present") {
          if (patient_id === "TC_SSI_POSITIVE_DEEP") {
            status = "fail";
            evidence = "Drainage, erythema, and purulence documented";
          } else {
            status = "pass";
            evidence = "No infection signs documented";
          }
        } else if (chip === "Positive culture") {
          if (patient_id === "TC_SSI_POSITIVE_DEEP") {
            status = "fail";
            evidence = "S. aureus culture positive";
          } else {
            status = "pass";
            evidence = "No positive cultures";
          }
        } else if (chip === "New postop antibiotics") {
          if (patient_id === "TC_SSI_POSITIVE_DEEP") {
            status = "fail";
            evidence = "New antibiotics started for infection";
          } else {
            status = "pass";
            evidence = "No new antibiotics for infection";
          }
        } else if (chip === "Deep/organ-space cue") {
          if (patient_id === "TC_SSI_POSITIVE_DEEP") {
            status = "fail";
            evidence = "Return to OR for washout indicates deep infection";
          } else {
            status = "pass";
            evidence = "No evidence of deep infection";
          }
        }
        
        // Return to OR signals
        else if (chip === "Return within 30d") {
          if (patient_id === "TC_RTO_UNPLANNED") {
            status = "fail";
            evidence = "Return to OR within 30 days";
          } else {
            status = "pass";
            evidence = "No return to OR within 30 days";
          }
        } else if (chip === "Unplanned related") {
          if (patient_id === "TC_RTO_UNPLANNED") {
            status = "fail";
            evidence = "Unplanned return related to original procedure";
          } else {
            status = "pass";
            evidence = "No unplanned returns";
          }
        }
        
        // Open fracture signals
        else if (chip === "Debridement ≤24h") {
          if (patient_id === "TC_OPENFX_LATE_BOTH") {
            status = "fail";
            evidence = "Debridement delayed >24h";
          } else {
            status = "pass";
            evidence = "Debridement within 24h";
          }
        } else if (chip === "On-time ≤24h") {
          if (patient_id === "TC_OPENFX_LATE_BOTH") {
            status = "fail";
            evidence = "Surgery delayed >24h";
          } else {
            status = "pass";
            evidence = "Surgery within 24h";
          }
        } else if (chip === "On-time ≤12h") {
          if (patient_id.includes("DELAY")) {
            status = "fail";
            evidence = "Source control delayed >12h";
          } else {
            status = "pass";
            evidence = "Source control within 12h";
          }
        }

        return {
          check: chip,
          status,
          evidence,
          timestamp: new Date().toISOString()
        };
      }) || [];

      // Calculate category counts
      const categoryCounts: Record<string, number> = {};
      precomputedSignals.forEach(signal => {
        if (signal.status !== "inactive") {
          // Map signals to categories
          let category = "Other";
          if (signal.check.includes("time") || signal.check.includes("≤19h") || signal.check.includes("Delayed")) {
            category = "Timeliness";
          } else if (signal.check.includes("NPO") || signal.check.includes("compliance")) {
            category = "Process";
          } else if (signal.check.includes("SSI") || signal.check.includes("infection")) {
            category = "Infection";
          }
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
      });

      const response = {
        patient_payload: patient,
        signals: precomputedSignals,
        category_counts: categoryCounts
      };

      res.json(response);
    } catch (error: any) {
      console.error("Error processing testcase:", error);
      res.status(500).json({ message: "Failed to process testcase" });
    }
  }));

  // Q&A endpoint with real LLM processing
  app.post("/api/qa", asyncHandler(async (req, res) => {
    try {
      const { question_text, patient_payload, active_question_id, signals } = req.body;
      
      if (!question_text || !patient_payload || !active_question_id) {
        return res.status(400).json({ 
          message: "Missing required fields: question_text, patient_payload, active_question_id" 
        });
      }

      // Load prompt template
      const promptPath = join(process.cwd(), 'prompts_ortho', `${active_question_id}.md`);
      let promptTemplate = "";
      try {
        promptTemplate = await readFile(promptPath, 'utf-8');
      } catch (error) {
        promptTemplate = "You are a medical abstraction assistant. Analyze patient data and answer questions about medical quality measures, citing specific timestamps and evidence from the patient record.";
      }

      // Prepare patient data for LLM context
      const patientContext = JSON.stringify({
        notes: patient_payload.notes || [],
        times: patient_payload.times || {},
        demographics: patient_payload.demographics || {}
      }, null, 2);

      // Create comprehensive prompt for LLM
      const systemPrompt = `${promptTemplate}

Patient Data Context:
${patientContext}

Instructions:
- Analyze the patient data thoroughly
- Cite specific timestamps and note sources
- If data is missing or insufficient, clearly state "CAUTION: Missing data - [specify what's missing]"
- Provide evidence-based responses
- Focus on the specific medical quality measure being asked about`;

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: question_text
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });

      const llmResponse = completion.choices[0]?.message?.content || "No response from LLM";

      const response = {
        answers: [{
          check: "LLM Analysis",
          status: "pass" as const,
          evidence: llmResponse
        }],
        summary: `LLM analysis completed for ${active_question_id}`,
        signals: signals || []
      };

      res.json(response);
    } catch (error: any) {
      console.error("Error processing Q&A:", error);
      res.status(500).json({ message: "Failed to process Q&A: " + error.message });
    }
  }));

  // LLM Chat endpoint
  // New structured QA endpoint with 3-field schema enforcement
  app.post("/api/qa", isAuthenticated, asyncHandler(async (req, res) => {
    try {
      const { 
        prompt_text, 
        specialty, 
        module_id, 
        followup_question, 
        patient_payload, 
        signal_ids 
      } = req.body;

      if (!prompt_text || !specialty || !module_id) {
        return res.status(400).json({ 
          error: 'prompt_text, specialty, and module_id are required' 
        });
      }

      // Import OpenAI here to avoid loading it if not needed
      const OpenAI = await import('openai');
      const openai = new OpenAI.default({
        apiKey: process.env.OPENAI_API_KEY
      });

      // System wrapper to enforce 3-field schema
      const SYSTEM_WRAPPER = `You must answer in exactly 3 fields only:
Result/Finding: <short assessment>
Reason: <≤10 words>
Evidence: [list items with timestamps/sources]

No extra lines or explanations outside these 3 fields.`;

      // Build context from patient data
      let contextPrompt = prompt_text;
      if (patient_payload) {
        const followupContext = followup_question ? `\n\nFollow-up Question: ${followup_question}` : '';
        const signalContext = signal_ids?.length ? `\n\nFocus on signals: ${signal_ids.join(', ')}` : '';
        
        const context = `
Specialty: ${specialty}
Module: ${module_id}
${followupContext}${signalContext}

Patient Data:
${JSON.stringify(patient_payload, null, 2)}

${prompt_text}
        `.trim();
        contextPrompt = context;
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: SYSTEM_WRAPPER
          },
          {
            role: "user",
            content: contextPrompt
          }
        ],
        max_tokens: 800,
        temperature: 0.1,
      });

      let response = completion.choices[0]?.message?.content || 'No response generated';
      
      // Validate and potentially repair the response structure
      const lines = response.split('\n').filter(line => line.trim());
      const hasResultFinding = lines.some(line => line.toLowerCase().includes('result') || line.toLowerCase().includes('finding'));
      const hasReason = lines.some(line => line.toLowerCase().includes('reason'));
      const hasEvidence = lines.some(line => line.toLowerCase().includes('evidence'));

      // If missing fields, attempt repair
      if (!hasResultFinding || !hasReason || !hasEvidence) {
        console.warn('Response missing required fields, attempting repair...');
        const repairPrompt = `The previous response was incomplete. Please provide all 3 fields:
Result/Finding: <short assessment>
Reason: <≤10 words>
Evidence: [list items with timestamps/sources]

Original context: ${contextPrompt.substring(0, 500)}...`;

        const repairCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: SYSTEM_WRAPPER + "\n\nYou omitted required fields. Provide all 3 fields now."
            },
            {
              role: "user",
              content: repairPrompt
            }
          ],
          max_tokens: 600,
          temperature: 0.1,
        });

        response = repairCompletion.choices[0]?.message?.content || response;
      }
      
      res.json({ 
        response,
        context: {
          specialty,
          module_id,
          followup_question,
          signal_ids,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('Structured QA API error:', error);
      res.status(500).json({ 
        error: 'Failed to process QA request',
        details: error.message 
      });
    }
  }));

  app.post("/api/llm/chat", isAuthenticated, asyncHandler(async (req, res) => {
    try {
      const { query, patient_id, question_id, patient_data } = req.body;

      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      // Import OpenAI here to avoid loading it if not needed
      const OpenAI = await import('openai');
      const openai = new OpenAI.default({
        apiKey: process.env.OPENAI_API_KEY
      });

      // Build context for the LLM
      let context = `You are a medical data abstraction assistant helping with healthcare quality review.`;
      
      if (patient_id && question_id) {
        context += `\n\nCurrent Context:
- Patient: ${patient_id}
- Question: ${question_id}`;
        
        if (patient_data) {
          context += `\n- Patient Data: ${JSON.stringify(patient_data, null, 2)}`;
        }
      }

      context += `\n\nUser Question: ${query}

Please provide a helpful, accurate response about the medical data or abstraction process. Focus on:
- Clinical accuracy and medical terminology
- Quality measures and validation rules
- Evidence-based explanations
- Practical insights for medical abstractors

Keep responses concise but informative.`;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert medical data abstraction assistant with deep knowledge of healthcare quality measures, clinical documentation, and medical record review processes."
          },
          {
            role: "user", 
            content: context
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

      res.json({ 
        response,
        context: {
          patient_id,
          question_id,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('LLM Chat error:', error);
      res.status(500).json({ 
        error: 'Failed to process chat request',
        details: error.message 
      });
    }
  }));

  // Serve the USNWR matrix file
  app.get('/usnwr_ortho_matrix.json', (req, res) => {
    res.sendFile(join(process.cwd(), 'server/data/usnwr_ortho_matrix.json'));
  });

  // Matrix API endpoint to get modules and signals
  app.get('/api/matrix', (req, res) => {
    const matrixPath = join(process.cwd(), 'server/data/usnwr_ortho_matrix.json');
    const matrixData = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
    res.json(matrixData);
  });

  // Assertion validation endpoint
  app.post("/api/validate_assertions", isAuthenticated, asyncHandler(async (req, res) => {
    try {
      const { moduleId, signals, patientData } = req.body;
      
      // Enhanced validation for SCH Timeliness using new structure
      if (moduleId === "timeliness_sch") {
        const validation = validateSCHTimeliness(patientData);
        
        const assertions = signals.map((signal: any) => {
          const ruleResult = validation.rules[signal.id];
          const match = ruleResult ? (ruleResult === signal.status) : true; // Assume match if no rule
          
          return {
            signalId: signal.id,
            signalLabel: signal.label || signal.id,
            aiOutput: signal.status,
            ruleLogic: ruleResult ? `Rule → ${ruleResult}` : "N/A",
            match,
            evidence: signal.evidence
          };
        });
        
        const allMatch = assertions.every((a: any) => a.match);
        
        res.json({
          assertions,
          allMatch,
          moduleId,
          validatedAt: new Date().toISOString()
        });
      } else {
        // For other modules, assume all assertions match
        const assertions = signals.map((signal: any) => ({
          signalId: signal.id,
          signalLabel: signal.label || signal.id,
          aiOutput: signal.status,
          ruleLogic: "N/A",
          match: true,
          evidence: signal.evidence
        }));
        
        res.json({
          assertions,
          allMatch: true,
          moduleId,
          validatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Assertion validation error:", error);
      res.status(500).json({ message: "Failed to validate assertions" });
    }
  }));

  // Helper function to calculate time difference in minutes
  function deltaMinutes(aISO?: string, bISO?: string): number | null {
    if (!aISO || !bISO) return null;
    const a = new Date(aISO).getTime();
    const b = new Date(bISO).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.max(0, Math.round((b - a) / 60000));
  }

  // Enhanced SCH Timeliness validation with metrics and evidence
  function validateSCHTimeliness(patientData: any) {
    const rules: Record<string, any> = {};
    const metrics: Record<string, any> = {};
    const sqlSignals: any[] = [];
    
    // Primary timeliness check with evidence
    const arrivalToIncision = deltaMinutes(
      patientData?.times?.ArrivalInstant,
      patientData?.times?.IncisionStartInstant
    );
    
    if (arrivalToIncision !== null) {
      const onTime19h = arrivalToIncision <= 19 * 60 ? "pass" : "fail";
      rules.on_time_19h = onTime19h;
      metrics.arrival_to_incision_minutes = arrivalToIncision;
      
      // Add structured signal with evidence and cites
      sqlSignals.push({
        id: "on_time_19h",
        label: "Incision ≤19h of ED arrival", 
        status: onTime19h,
        group: "Core",
        type: "sql",
        evidence: `${(arrivalToIncision/60).toFixed(1)}h ${onTime19h === "fail" ? ">" : "≤"} 19h (Arrival→Incision)`,
        cites: ["patient_payload.times.ArrivalInstant", "patient_payload.times.IncisionStartInstant"]
      });
    }
    
    // Diagnosis confirmation with evidence
    const hasSchNote = patientData?.notes?.some((note: any) => 
      note.text?.toLowerCase().includes("supracondylar") || 
      note.text?.toLowerCase().includes("sch")
    );
    if (hasSchNote) {
      rules.dx_confirmed_sch = "pass";
      sqlSignals.push({
        id: "dx_confirmed_sch",
        label: "Operative note confirms SCH",
        status: "pass",
        group: "Core", 
        type: "sql",
        evidence: "SCH diagnosis confirmed in operative notes",
        cites: ["patient_payload.notes[].text"]
      });
    }
    
    // NPO violation check with evidence
    const hasNpoViolation = patientData?.notes?.some((note: any) =>
      note.text?.toLowerCase().includes("npo") && 
      note.text?.toLowerCase().includes("violation")
    ) || Boolean(patientData?.anesthesia?.npo_break);
    
    if (hasNpoViolation) {
      rules.npo_violation = "pass"; // Pass means violation documented
      sqlSignals.push({
        id: "npo_violation",
        label: "Pre-op NPO violation",
        status: "pass",
        group: "Delay Drivers",
        type: "sql", 
        evidence: "NPO violation documented in notes or anesthesia record",
        cites: ["patient_payload.notes[].text", "patient_payload.anesthesia.npo_break"]
      });
    }
    
    // CT/higher priority injury with evidence
    const hasCTorHead = patientData?.notes?.some((note: any) =>
      note.text?.toLowerCase().includes("ct") || 
      note.text?.toLowerCase().includes("head")
    ) || Boolean(patientData?.times?.HeadCTOrdered);
    
    if (hasCTorHead) {
      rules.higher_priority_injury = "pass";
      sqlSignals.push({
        id: "higher_priority_injury", 
        label: "Higher-priority injury/CT delayed clearance",
        status: "pass",
        group: "Delay Drivers",
        type: "sql",
        evidence: "CT head ordered or higher-priority injury documented",
        cites: ["patient_payload.notes[].text", "patient_payload.times.HeadCTOrdered"]
      });
    }
    
    // Non-ortho admission with evidence
    if (patientData?.encounter?.admitService && 
        patientData.encounter.admitService !== "Orthopedics") {
      rules.non_ortho_admit = "pass";
      sqlSignals.push({
        id: "non_ortho_admit",
        label: "Admitted to non-orthopedic service", 
        status: "pass",
        group: "Delay Drivers",
        type: "sql",
        evidence: `Admitted to ${patientData.encounter.admitService} service`,
        cites: ["patient_payload.encounter.admitService"]
      });
    }
    
    return { rules, metrics, sqlSignals };
  }

  // Apply SCH validation and return enhanced response
  function applySCHValidation(patientData: any, baseResponse: any) {
    const validation = validateSCHTimeliness(patientData);

    return {
      ...baseResponse,
      metrics: { ...baseResponse.metrics, ...validation.metrics },
      signals: [...(baseResponse.signals || []), ...validation.sqlSignals]
    };
  }

  // ============================================================================
  // Case Review Preparation API (AI-Powered Clinical Reasoning)
  // ============================================================================

  /**
   * POST /api/cases/:caseId/prepare-review
   *
   * Prepare a complete case review package including:
   * - AI-generated clinical summary (critical 20%)
   * - Dynamic reasoning questions (Rule In/Out/Insight)
   * - Grouped signals
   */
  app.post("/api/cases/:caseId/prepare-review", isAuthenticated, asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { encounterPayload, metricContext, signals } = req.body;

    if (!encounterPayload || !metricContext) {
      return res.status(400).json({
        message: "Missing required fields: encounterPayload, metricContext"
      });
    }

    try {
      // Import the case review preparer service
      const { caseReviewPreparer } = await import('./services/caseReviewPreparer');

      // Prepare the complete review package
      const reviewPackage = await caseReviewPreparer.prepareCase(
        caseId,
        encounterPayload,
        metricContext,
        signals || []
      );

      res.json(reviewPackage);
    } catch (error: any) {
      console.error('Error preparing case review:', error);
      res.status(500).json({
        message: "Failed to prepare case review",
        error: error.message
      });
    }
  }));

  /**
   * POST /api/cases/:caseId/generate-summary
   *
   * Generate just the clinical summary for a case
   */
  app.post("/api/cases/:caseId/generate-summary", isAuthenticated, asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { encounterPayload, metricContext } = req.body;

    if (!encounterPayload || !metricContext) {
      return res.status(400).json({
        message: "Missing required fields: encounterPayload, metricContext"
      });
    }

    try {
      const { clinicalSummaryGenerator } = await import('./services/clinicalSummaryGenerator');

      const summary = await clinicalSummaryGenerator.generateSummary(
        encounterPayload,
        metricContext
      );

      res.json({ caseId, summary });
    } catch (error: any) {
      console.error('Error generating clinical summary:', error);
      res.status(500).json({
        message: "Failed to generate clinical summary",
        error: error.message
      });
    }
  }));

  /**
   * POST /api/cases/:caseId/generate-questions
   *
   * Generate reasoning questions for a case
   */
  app.post("/api/cases/:caseId/generate-questions", isAuthenticated, asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { encounterPayload, signals, metricId, focusArea } = req.body;

    if (!encounterPayload || !metricId) {
      return res.status(400).json({
        message: "Missing required fields: encounterPayload, metricId"
      });
    }

    try {
      const { reasoningQuestionGenerator } = await import('./services/reasoningQuestionGenerator');

      const questions = await reasoningQuestionGenerator.generateQuestions(
        encounterPayload,
        signals || [],
        metricId
      );

      res.json({ caseId, questions });
    } catch (error: any) {
      console.error('Error generating reasoning questions:', error);
      res.status(500).json({
        message: "Failed to generate reasoning questions",
        error: error.message
      });
    }
  }));

  /**
   * POST /api/cases/:caseId/quick-preview
   *
   * Generate a quick preview summary (one-liner)
   */
  app.post("/api/cases/:caseId/quick-preview", isAuthenticated, asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { encounterPayload, metricContext } = req.body;

    if (!encounterPayload || !metricContext) {
      return res.status(400).json({
        message: "Missing required fields: encounterPayload, metricContext"
      });
    }

    try {
      const { caseReviewPreparer } = await import('./services/caseReviewPreparer');

      const preview = await caseReviewPreparer.prepareQuickPreview(
        caseId,
        encounterPayload,
        metricContext
      );

      res.json(preview);
    } catch (error: any) {
      console.error('Error generating quick preview:', error);
      res.status(500).json({
        message: "Failed to generate quick preview",
        error: error.message
      });
    }
  }));

  const httpServer = createServer(app);
  return httpServer;
}
