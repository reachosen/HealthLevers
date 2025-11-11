import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import { Pool as NodePool } from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Make database optional for development/demo purposes
let pool: any = null;
let db: any = null;

if (process.env.DATABASE_URL) {
  const isNeon = process.env.DATABASE_URL.includes('neon.tech');

  if (isNeon) {
    // Use Neon serverless driver for cloud PostgreSQL
    pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
    db = drizzleNeon({ client: pool, schema });
    console.log('✅ Connected to Neon PostgreSQL database');
  } else {
    // Use standard node-postgres for local PostgreSQL
    pool = new NodePool({ connectionString: process.env.DATABASE_URL });
    db = drizzleNode({ client: pool, schema });
    console.log('✅ Connected to local PostgreSQL database');
  }
} else {
  console.log('⚠️  Running without database (demo mode)');
  console.log('   The AI Review Workbench will work with sample data only');
}

export { pool, db };