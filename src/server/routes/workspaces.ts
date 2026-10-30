import { Hono } from 'hono';
import type { WorkspaceRepository } from '../db/workspaceRepository';
import type { WorkspaceData } from '../../core/types/workspace';

export interface WorkspaceRoutesOptions {
  repo: WorkspaceRepository;
}

export function createWorkspaceRoutes(options: WorkspaceRoutesOptions) {
  const { repo } = options;
  const workspaces = new Hono<{ Variables: { userId?: string } }>();

  // GET /api/workspaces -> { success: true, workspaces: WorkspaceMeta[] }
  workspaces.get('/', (c) => {
    const userId = c.get('userId');
    const list = repo.listWorkspaces(userId);
    return c.json({ success: true, workspaces: list });
  });

  // GET /api/workspaces/:id -> { success: true, workspace: WorkspaceData } (404 if not found)
  workspaces.get('/:id', (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const ws = repo.getWorkspace(id, userId);
    if (!ws) {
      return c.json({ success: false, error: 'Workspace not found' }, 404);
    }
    return c.json({ success: true, workspace: ws });
  });

  // POST /api/workspaces -> Body: WorkspaceData -> { success: true, id: string }
  workspaces.post('/', async (c) => {
    const userId = c.get('userId');
    let body: WorkspaceData;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    if (!body || !body.id || !body.name) {
      return c.json({ success: false, error: 'Workspace id and name are required' }, 400);
    }

    const res = repo.saveWorkspace(body, userId);
    return c.json({ success: true, id: res.id });
  });

  // PUT /api/workspaces/:id -> Body: WorkspaceData -> { success: true, id: string }
  workspaces.put('/:id', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    let body: WorkspaceData;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    if (!body || !body.name) {
      return c.json({ success: false, error: 'Workspace name is required' }, 400);
    }

    // Ensure body ID matches URL param
    body.id = id;

    const res = repo.saveWorkspace(body, userId);
    return c.json({ success: true, id: res.id });
  });

  // DELETE /api/workspaces/:id -> { success: true }
  workspaces.delete('/:id', (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const deleted = repo.deleteWorkspace(id, userId);
    if (!deleted) {
      return c.json({ success: false, error: 'Workspace not found' }, 404);
    }
    return c.json({ success: true });
  });

  // PATCH /api/workspaces/:id/rename -> Body: { name: string } -> { success: true }
  workspaces.patch('/:id/rename', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    let body: { name?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    if (!body || !body.name || typeof body.name !== 'string') {
      return c.json({ success: false, error: 'Name is required' }, 400);
    }

    const renamed = repo.renameWorkspace(id, body.name, userId);
    if (!renamed) {
      return c.json({ success: false, error: 'Workspace not found' }, 404);
    }
    return c.json({ success: true });
  });

  // POST /api/workspaces/:id/revisions -> Body: { snapshot: WorkspaceData, diffSummary?: any } -> { success: true, revisionId: string }
  workspaces.post('/:id/revisions', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');

    // Check workspace existence
    const ws = repo.getWorkspace(id, userId);
    if (!ws) {
      return c.json({ success: false, error: 'Workspace not found' }, 404);
    }

    let body: { snapshot?: WorkspaceData; diffSummary?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    if (!body || !body.snapshot) {
      return c.json({ success: false, error: 'Snapshot is required' }, 400);
    }

    const revisionId = repo.createRevision(id, body.snapshot, body.diffSummary);
    return c.json({ success: true, revisionId });
  });

  // GET /api/workspaces/:id/revisions -> { success: true, revisions: [...] }
  workspaces.get('/:id/revisions', (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');

    const ws = repo.getWorkspace(id, userId);
    if (!ws) {
      return c.json({ success: false, error: 'Workspace not found' }, 404);
    }

    const revisions = repo.listRevisions(id);
    return c.json({ success: true, revisions });
  });

  return workspaces;
}
