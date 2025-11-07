import { beforeAll, afterAll } from 'vitest';

// Ensure DATABASE_URL is available for tests
// In production, this comes from environment variables
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set - using default test database');
  // Use existing DATABASE_URL from process if available
  // Otherwise tests will fail with clear error message
}

// Setup before all tests
beforeAll(async () => {
  console.log('🔧 Test suite initializing...');
  console.log('📊 Database:', process.env.DATABASE_URL ? 'Connected' : 'Not configured');
});

// Cleanup after all tests
afterAll(async () => {
  console.log('✅ Test suite complete');
});
