import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { WorkspaceRepository } from './db/workspaceRepository';
import { createWorkspaceRoutes } from './routes/workspaces';
import { createProxyRoutes } from './routes/proxy';
import { createUserRoutes } from './routes/users';
import fs from 'node:fs';
import path from 'node:path';

export interface AppOptions {
  repo: WorkspaceRepository;
  clientDistPath?: string;
}

export type AppInstance = ReturnType<typeof createApp>;

export function createApp(options: AppOptions) {
  const { repo, clientDistPath = path.resolve(process.cwd(), 'dist/client') } = options;

  const app = new Hono<{ Variables: { userId?: string } }>();

  // Global Error Handler
  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json(
      {
        success: false,
        error: err.message || 'Internal Server Error',
      },
      500
    );
  });

  // Tenancy / User Context Middleware
  app.use('*', async (c, next) => {
    const userHeader = c.req.header('X-User-Id');
    if (userHeader) {
      c.set('userId', userHeader);
    }
    await next();
  });

  // Mount Workspace API routes
  app.route('/api/workspaces', createWorkspaceRoutes({ repo }));

  // Mount User Identity API routes
  app.route('/api/users', createUserRoutes(repo.dbContext));

  // Mount Proxy API routes
  app.route('/api/proxy', createProxyRoutes());

  // Static Assets & Production Fallback
  if (process.env.NODE_ENV === 'production') {
    app.use(
      '/*',
      serveStatic({
        root: path.relative(process.cwd(), clientDistPath) || './dist/client',
      })
    );

    // Fallback unhandled non-API routes to index.html (SPA routing)
    app.get('*', (c) => {
      const indexPath = path.join(clientDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf-8');
        return c.html(html);
      }
      return c.notFound();
    });
  }

  return app;
}
