import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Detect if using Neon (cloud) or local PostgreSQL
const isNeon = process.env.DATABASE_URL.includes('neon.tech') ||
                process.env.DATABASE_URL.includes('neon.');

let pool: NeonPool | PgPool;
let db: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzleNode>;

if (isNeon) {
  // Use Neon serverless driver for cloud
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNeon({ client: pool, schema });
  console.log('📡 Using Neon serverless driver');
} else {
  // Use standard pg driver for local PostgreSQL
  pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNode({ client: pool, schema });
  console.log('🐘 Using local PostgreSQL driver');
}

export { pool, db };