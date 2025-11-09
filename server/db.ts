import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Make database optional for development/demo purposes
let pool: Pool | null = null;
let db: any = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
  console.log('✅ Connected to PostgreSQL database');
} else {
  console.log('⚠️  Running without database (demo mode)');
  console.log('   The AI Review Workbench will work with sample data only');
}

export { pool, db };