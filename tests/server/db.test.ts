import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, type AppDatabase } from '../../src/server/db/client';
import { WorkspaceRepository } from '../../src/server/db/workspaceRepository';
import { createDefaultWorkspace, type WorkspaceData } from '../../src/core/types/workspace';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('SQLite Persistence & Database Schema', () => {
  let tmpDbPath: string;
  let dbContext: AppDatabase;
  let repo: WorkspaceRepository;

  beforeEach(() => {
    tmpDbPath = path.join(os.tmpdir(), `avro-test-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    dbContext = createDatabase(tmpDbPath);
    repo = new WorkspaceRepository(dbContext);
  });

  afterEach(() => {
    if (dbContext?.sqlite?.open) {
      dbContext.sqlite.close();
    }
    // Clean up temporary sqlite files
    for (const ext of ['', '-wal', '-shm']) {
      const file = tmpDbPath + ext;
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch {
          // ignore cleanup errors on windows if file handle released slowly
        }
      }
    }
  });

  describe('PRAGMA and Client Configuration', () => {
    it('enables WAL mode, NORMAL synchronous, busy_timeout, and foreign_keys', () => {
      const sqlite = dbContext.sqlite;

      const journalMode = sqlite.pragma('journal_mode', { simple: true });
      expect(String(journalMode).toLowerCase()).toBe('wal');

      const synchronous = sqlite.pragma('synchronous', { simple: true });
      // synchronous: 1 is NORMAL in SQLite
      expect(Number(synchronous)).toBe(1);

      const busyTimeout = sqlite.pragma('busy_timeout', { simple: true });
      expect(Number(busyTimeout)).toBe(5000);

      const foreignKeys = sqlite.pragma('foreign_keys', { simple: true });
      expect(Number(foreignKeys)).toBe(1);
    });
  });

  describe('Workspace CRUD operations', () => {
    it('saves a new workspace and retrieves it by id', () => {
      const ws = createDefaultWorkspace('ws-1', 'Test Workspace', 'user-1');
      ws.isNew = false;
      ws.manualLinks = [['field1', 'field2']];

      const saveResult = repo.saveWorkspace(ws, 'user-1');
      expect(saveResult).toEqual({ id: 'ws-1' });

      const retrieved = repo.getWorkspace('ws-1', 'user-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('ws-1');
      expect(retrieved?.name).toBe('Test Workspace');
      expect(retrieved?.userId).toBe('user-1');
      expect(retrieved?.isNew).toBe(false);
      expect(retrieved?.manualLinks).toEqual([['field1', 'field2']]);
    });

    it('upserts an existing workspace on subsequent save', () => {
      const ws = createDefaultWorkspace('ws-upsert', 'Initial Title');
      repo.saveWorkspace(ws);

      const updatedWs: WorkspaceData = {
        ...ws,
        name: 'Updated Title',
        isNew: false,
        recordLinks: [['recA', 'recB']],
      };

      const updateResult = repo.saveWorkspace(updatedWs);
      expect(updateResult).toEqual({ id: 'ws-upsert' });

      const fetched = repo.getWorkspace('ws-upsert');
      expect(fetched?.name).toBe('Updated Title');
      expect(fetched?.isNew).toBe(false);
      expect(fetched?.recordLinks).toEqual([['recA', 'recB']]);
    });

    it('renames a workspace', () => {
      const ws = createDefaultWorkspace('ws-rename', 'Old Name', 'user-alpha');
      repo.saveWorkspace(ws, 'user-alpha');

      const renamed = repo.renameWorkspace('ws-rename', 'New Name', 'user-alpha');
      expect(renamed).toBe(true);

      const fetched = repo.getWorkspace('ws-rename', 'user-alpha');
      expect(fetched?.name).toBe('New Name');
    });

    it('returns false when renaming non-existent workspace', () => {
      const renamed = repo.renameWorkspace('non-existent', 'New Name');
      expect(renamed).toBe(false);
    });

    it('deletes a workspace', () => {
      const ws = createDefaultWorkspace('ws-delete', 'To Delete');
      repo.saveWorkspace(ws);

      const deleted = repo.deleteWorkspace('ws-delete');
      expect(deleted).toBe(true);

      const fetched = repo.getWorkspace('ws-delete');
      expect(fetched).toBeNull();
    });

    it('returns false when deleting non-existent workspace', () => {
      const deleted = repo.deleteWorkspace('non-existent');
      expect(deleted).toBe(false);
    });

    it('lists workspaces sorted by updatedAt desc, limited to 50', () => {
      for (let i = 1; i <= 55; i++) {
        const ws = createDefaultWorkspace(`ws-${i}`, `Workspace ${i}`, 'list-user');
        repo.saveWorkspace(ws, 'list-user');
      }

      const list = repo.listWorkspaces('list-user');
      expect(list.length).toBe(50);
      expect(list[0].id).toBe('ws-55');
    });
  });

  describe('Workspace Revisions and Cascade Delete', () => {
    it('creates and lists revisions for a workspace', () => {
      const ws = createDefaultWorkspace('ws-rev', 'Rev Workspace');
      repo.saveWorkspace(ws);

      const rev1Id = repo.createRevision('ws-rev', ws, { action: 'initial' });
      expect(rev1Id).toBeDefined();

      const rev2Id = repo.createRevision('ws-rev', { ...ws, name: 'Rev Workspace V2' }, { action: 'rename' });
      expect(rev2Id).toBeDefined();

      const revisions = repo.listRevisions('ws-rev');
      expect(revisions.length).toBe(2);
      expect(revisions[0].id).toBe(rev2Id); // newest first
      expect(revisions[0].diffSummary).toEqual({ action: 'rename' });
      expect(revisions[1].id).toBe(rev1Id);
      expect(revisions[1].diffSummary).toEqual({ action: 'initial' });
      expect(revisions[0].createdAt).toBeInstanceOf(Date);
    });

    it('cascades deletion of revisions when workspace is deleted', () => {
      const ws = createDefaultWorkspace('ws-cascade', 'Cascade Workspace');
      repo.saveWorkspace(ws);

      repo.createRevision('ws-cascade', ws, { test: 1 });
      repo.createRevision('ws-cascade', ws, { test: 2 });

      expect(repo.listRevisions('ws-cascade').length).toBe(2);

      repo.deleteWorkspace('ws-cascade');

      expect(repo.listRevisions('ws-cascade').length).toBe(0);
    });
  });

  describe('Multi-user Isolation', () => {
    it('isolates workspaces between users', () => {
      const wsA = createDefaultWorkspace('ws-user-a', 'User A Workspace', 'user-A');
      const wsB = createDefaultWorkspace('ws-user-b', 'User B Workspace', 'user-B');

      repo.saveWorkspace(wsA, 'user-A');
      repo.saveWorkspace(wsB, 'user-B');

      // User A can see wsA, but not wsB
      expect(repo.getWorkspace('ws-user-a', 'user-A')?.id).toBe('ws-user-a');
      expect(repo.getWorkspace('ws-user-b', 'user-A')).toBeNull();

      // User B can see wsB, but not wsA
      expect(repo.getWorkspace('ws-user-b', 'user-B')?.id).toBe('ws-user-b');
      expect(repo.getWorkspace('ws-user-a', 'user-B')).toBeNull();

      // Listing workspaces only returns the caller's workspaces
      const listA = repo.listWorkspaces('user-A');
      expect(listA.map(w => w.id)).toEqual(['ws-user-a']);

      const listB = repo.listWorkspaces('user-B');
      expect(listB.map(w => w.id)).toEqual(['ws-user-b']);

      // User A cannot rename User B's workspace
      const renameForbidden = repo.renameWorkspace('ws-user-b', 'Hacked Name', 'user-A');
      expect(renameForbidden).toBe(false);
      expect(repo.getWorkspace('ws-user-b', 'user-B')?.name).toBe('User B Workspace');

      // User A cannot delete User B's workspace
      const deleteForbidden = repo.deleteWorkspace('ws-user-b', 'user-A');
      expect(deleteForbidden).toBe(false);
      expect(repo.getWorkspace('ws-user-b', 'user-B')).not.toBeNull();
    });
  });

  describe('Concurrent Write Operations (WAL mode)', () => {
    it('handles concurrent writes from multiple database connections without locking errors', () => {
      // Open a second connection to the same file
      const dbContext2 = createDatabase(tmpDbPath);
      const repo2 = new WorkspaceRepository(dbContext2);

      try {
        const operations: Promise<void>[] = [];

        // Concurrently write 20 items across both connection repos
        for (let i = 0; i < 20; i++) {
          const activeRepo = i % 2 === 0 ? repo : repo2;
          const ws = createDefaultWorkspace(`concurrent-ws-${i}`, `Concurrent ${i}`);
          // Execute synchronous calls in promises to interleave event-loop concurrency
          operations.push(
            new Promise<void>((resolve, reject) => {
              try {
                activeRepo.saveWorkspace(ws);
                activeRepo.createRevision(ws.id, ws, { index: i });
                resolve();
              } catch (err) {
                reject(err);
              }
            })
          );
        }

        return Promise.all(operations).then(() => {
          const count = dbContext.sqlite.prepare('SELECT count(*) as count FROM workspaces').get() as { count: number };
          expect(count.count).toBe(20);

          const revCount = dbContext.sqlite.prepare('SELECT count(*) as count FROM workspace_revisions').get() as { count: number };
          expect(revCount.count).toBe(20);
        });
      } finally {
        if (dbContext2?.sqlite?.open) {
          dbContext2.sqlite.close();
        }
      }
    });
  });
});
