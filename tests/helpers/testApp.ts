import express, { type Express } from 'express';
import metadataRoutes from '../../server/routes/metadata';

/**
 * Create a test Express app with only the metadata routes
 * (no auth, no vite, no other routes)
 */
export function createTestApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Mount metadata routes
  app.use('/api/metadata', metadataRoutes);

  // Error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[test-error]', err);
    res.status(err?.status || 500).json({
      ok: false,
      error: err?.message || 'Unexpected error',
    });
  });

  return app;
}
