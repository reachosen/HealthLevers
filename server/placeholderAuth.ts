import type { Express, RequestHandler } from "express";

/**
 * Placeholder authentication for development
 *
 * This provides no-op authentication middleware until SSO is implemented.
 * All requests will be allowed through without authentication checks.
 *
 * TODO: Replace with SSO authentication when ready
 */

export async function setupAuth(app: Express) {
  // No-op: No authentication setup needed for development
  console.log('⚠️  Running without authentication (placeholder mode)');
  console.log('   TODO: Implement SSO authentication');
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // No-op: Allow all requests through
  // Mock user for endpoints that expect req.user
  (req as any).user = {
    claims: {
      sub: 'dev-user-id',
      email: 'dev@example.com',
      first_name: 'Dev',
      last_name: 'User'
    }
  };
  next();
};
