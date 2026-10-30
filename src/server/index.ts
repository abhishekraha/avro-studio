import { serve } from '@hono/node-server';
import path from 'node:path';
import { createApp } from './app';
import { createDatabase } from './db/client';
import { WorkspaceRepository } from './db/workspaceRepository';

export * from './app';
export * from './routes/workspaces';
export * from './routes/proxy';
export * from './db/workspaceRepository';
export * from './db/client';

const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'avro-editor.db');

export function startServer() {
  const dbContext = createDatabase(DB_PATH);
  const repo = new WorkspaceRepository(dbContext);
  const app = createApp({ repo });

  console.log(`Starting server on port ${PORT}...`);
  return serve({
    fetch: app.fetch,
    port: PORT,
  });
}

// Auto-start if run directly as main module
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer();
}
