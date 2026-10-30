import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, type AppInstance } from '../../src/server/app';
import { createDatabase, type AppDatabase } from '../../src/server/db/client';
import { WorkspaceRepository } from '../../src/server/db/workspaceRepository';
import { createDefaultWorkspace } from '../../src/core/types/workspace';

describe('Server API Endpoints & Proxy', () => {
  let dbContext: AppDatabase;
  let repo: WorkspaceRepository;
  let app: AppInstance;

  beforeEach(() => {
    dbContext = createDatabase(':memory:');
    repo = new WorkspaceRepository(dbContext);
    app = createApp({ repo });
  });

  afterEach(() => {
    if (dbContext?.sqlite?.open) {
      dbContext.sqlite.close();
    }
  });

  describe('Workspace Management Endpoints', () => {
    it('GET /api/workspaces returns empty list initially', async () => {
      const res = await app.request('/api/workspaces');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true, workspaces: [] });
    });

    it('POST /api/workspaces creates a new workspace', async () => {
      const ws = createDefaultWorkspace('ws-1', 'My Test Workspace');
      const res = await app.request('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ws),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true, id: 'ws-1' });

      // Check it appears in listing
      const listRes = await app.request('/api/workspaces');
      const listBody = await listRes.json();
      expect(listBody.success).toBe(true);
      expect(listBody.workspaces).toHaveLength(1);
      expect(listBody.workspaces[0].id).toBe('ws-1');
      expect(listBody.workspaces[0].name).toBe('My Test Workspace');
    });

    it('GET /api/workspaces/:id returns workspace or 404', async () => {
      const ws = createDefaultWorkspace('ws-fetch', 'Fetch Me');
      repo.saveWorkspace(ws);

      const foundRes = await app.request('/api/workspaces/ws-fetch');
      expect(foundRes.status).toBe(200);
      const foundBody = await foundRes.json();
      expect(foundBody.success).toBe(true);
      expect(foundBody.workspace.id).toBe('ws-fetch');
      expect(foundBody.workspace.name).toBe('Fetch Me');

      const notFoundRes = await app.request('/api/workspaces/non-existent');
      expect(notFoundRes.status).toBe(404);
      const notFoundBody = await notFoundRes.json();
      expect(notFoundBody.success).toBe(false);
      expect(notFoundBody.error).toBeDefined();
    });

    it('PATCH /api/workspaces/:id/rename renames workspace', async () => {
      const ws = createDefaultWorkspace('ws-rename', 'Old Name');
      repo.saveWorkspace(ws);

      const renameRes = await app.request('/api/workspaces/ws-rename/rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
      expect(renameRes.status).toBe(200);
      const renameBody = await renameRes.json();
      expect(renameBody).toEqual({ success: true });

      const fetched = repo.getWorkspace('ws-rename');
      expect(fetched?.name).toBe('New Name');

      // 404 for non-existent workspace rename
      const missingRes = await app.request('/api/workspaces/non-existent/rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
      expect(missingRes.status).toBe(404);
    });

    it('DELETE /api/workspaces/:id deletes workspace', async () => {
      const ws = createDefaultWorkspace('ws-delete', 'To Delete');
      repo.saveWorkspace(ws);

      const deleteRes = await app.request('/api/workspaces/ws-delete', {
        method: 'DELETE',
      });
      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody).toEqual({ success: true });

      expect(repo.getWorkspace('ws-delete')).toBeNull();

      // 404 for non-existent delete
      const missingRes = await app.request('/api/workspaces/non-existent', {
        method: 'DELETE',
      });
      expect(missingRes.status).toBe(404);
    });

    it('POST & GET /api/workspaces/:id/revisions manages revisions', async () => {
      const ws = createDefaultWorkspace('ws-rev', 'Rev Testing');
      repo.saveWorkspace(ws);

      const postRevRes = await app.request('/api/workspaces/ws-rev/revisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: ws, diffSummary: { added: 1 } }),
      });
      expect(postRevRes.status).toBe(200);
      const postRevBody = await postRevRes.json();
      expect(postRevBody.success).toBe(true);
      expect(postRevBody.revisionId).toBeDefined();

      const getRevRes = await app.request('/api/workspaces/ws-rev/revisions');
      expect(getRevRes.status).toBe(200);
      const getRevBody = await getRevRes.json();
      expect(getRevBody.success).toBe(true);
      expect(getRevBody.revisions).toHaveLength(1);
      expect(getRevBody.revisions[0].id).toBe(postRevBody.revisionId);
      expect(getRevBody.revisions[0].diffSummary).toEqual({ added: 1 });
    });
  });

  describe('User Tenancy & Isolation via X-User-Id', () => {
    it('isolates workspaces when X-User-Id header is provided', async () => {
      const wsA = createDefaultWorkspace('ws-user-1', 'User 1 WS', 'alice');
      const wsB = createDefaultWorkspace('ws-user-2', 'User 2 WS', 'bob');

      // Alice creates wsA
      await app.request('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'alice' },
        body: JSON.stringify(wsA),
      });

      // Bob creates wsB
      await app.request('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'bob' },
        body: JSON.stringify(wsB),
      });

      // Alice lists
      const aliceListRes = await app.request('/api/workspaces', {
        headers: { 'X-User-Id': 'alice' },
      });
      const aliceList = await aliceListRes.json();
      expect(aliceList.workspaces.map((w: any) => w.id)).toEqual(['ws-user-1']);

      // Bob lists
      const bobListRes = await app.request('/api/workspaces', {
        headers: { 'X-User-Id': 'bob' },
      });
      const bobList = await bobListRes.json();
      expect(bobList.workspaces.map((w: any) => w.id)).toEqual(['ws-user-2']);

      // Alice cannot access Bob's workspace
      const aliceAccessBob = await app.request('/api/workspaces/ws-user-2', {
        headers: { 'X-User-Id': 'alice' },
      });
      expect(aliceAccessBob.status).toBe(404);
    });

    it('falls back to default tenancy when X-User-Id is omitted', async () => {
      const ws = createDefaultWorkspace('ws-default', 'Default User WS');
      await app.request('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ws),
      });

      const listRes = await app.request('/api/workspaces');
      const listBody = await listRes.json();
      expect(listBody.workspaces.map((w: any) => w.id)).toContain('ws-default');
    });
  });

  describe('Secure Schema Registry Proxy (/api/proxy) & SSRF Protection', () => {
    it('blocks loopback addresses (localhost, 127.0.0.1, ::1)', async () => {
      const loopbacks = [
        'http://localhost/subjects',
        'http://127.0.0.1:8081/schemas',
        'http://127.0.0.2:8081/schemas',
        'http://[::1]:8081/schemas',
      ];

      for (const url of loopbacks) {
        const res = await app.request('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Target URL not permitted');
      }
    });

    it('blocks private IPv4 networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)', async () => {
      const privateUrls = [
        'http://10.0.0.1/schema',
        'http://10.255.255.255/schema',
        'http://172.16.0.1/schema',
        'http://172.31.255.255/schema',
        'http://192.168.1.100/schema',
        'http://169.254.169.254/latest/meta-data',
        'http://0.0.0.0:8080/schema',
      ];

      for (const url of privateUrls) {
        const res = await app.request('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Target URL not permitted');
      }
    });

    it('allows valid external URLs and forwards authorization headers', async () => {
      const originalFetch = globalThis.fetch;
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ schema: 'record User {}' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
      globalThis.fetch = mockFetch;

      try {
        const res = await app.request('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://registry.example.com/subjects/user/versions/latest',
            headers: {
              Authorization: 'Bearer test-token-123',
            },
          }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual({ schema: 'record User {}' });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://registry.example.com/subjects/user/versions/latest',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token-123',
            }),
          })
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('returns 502 when upstream fetch fails', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      try {
        const res = await app.request('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/schema',
          }),
        });

        expect(res.status).toBe(502);
        const data = await res.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Connection refused');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Static Asset Serving (Production mode)', () => {
    it('serves index.html fallback for non-API routes when configured', async () => {
      const prodApp = createApp({
        repo,
        clientDistPath: 'src/client', // existing directory with index.html
      });

      const res = await prodApp.request('/some/client/route');
      // In non-production env, this returns 404
      expect(res.status).toBe(404);

      // Now set NODE_ENV to production
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const prodAppReal = createApp({
          repo,
          clientDistPath: 'src/client',
        });
        const prodRes = await prodAppReal.request('/some/client/route');
        expect(prodRes.status).toBe(200);
        const html = await prodRes.text();
        expect(html).toContain('<html');
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });
  });
});
