# Task 7 Brief: SQLite Persistence & Database Schema (Drizzle ORM)

## Goal
Implement SQLite persistence layer using Drizzle ORM configured with Write-Ahead Logging (WAL) and busy timeout for high-concurrency multi-user workspace management.

## Files
- Create: `src/server/db/schema.ts`
- Create: `src/server/db/client.ts`
- Create: `src/server/db/workspaceRepository.ts`
- Create: `src/server/db/index.ts`
- Test: `tests/server/db.test.ts`

## Requirements & Constraints
- Schema (`schema.ts`):
  - `workspaces` table:
    - `id`: text (primary key, uuid)
    - `userId`: text (nullable, indexed)
    - `name`: text (not null)
    - `isNew`: integer({ mode: 'boolean' }) (not null, default false)
    - `savedAt`: text (not null)
    - `originalSchema`: text({ mode: 'json' }) (nullable)
    - `editedSchema`: text({ mode: 'json' }) (nullable)
    - `manualLinks`: text({ mode: 'json' }) (not null, default '[]')
    - `recordLinks`: text({ mode: 'json' }) (nullable)
    - `originalFieldNotes`: text({ mode: 'json' }) (nullable)
    - `editedFieldNotes`: text({ mode: 'json' }) (nullable)
    - `createdAt`: integer({ mode: 'timestamp' }) (not null, default now)
    - `updatedAt`: integer({ mode: 'timestamp' }) (not null, default now)
  - `workspaceRevisions` table:
    - `id`: text (primary key, uuid)
    - `workspaceId`: text (foreign key -> workspaces.id on delete cascade)
    - `diffSummary`: text({ mode: 'json' })
    - `snapshot`: text({ mode: 'json' }) (not null)
    - `createdAt`: integer({ mode: 'timestamp' }) (not null, default now)
  - `stats` table:
    - `key`: text (primary key)
    - `value`: text (not null)
    - `updatedAt`: integer({ mode: 'timestamp' }) (not null, default now)
- Client (`client.ts`):
  - `createDatabase(dbPath?: string)`: creates `better-sqlite3` instance and initializes tables.
  - MUST execute PRAGMAs on every connection:
    ```sql
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    ```
  - Expose Drizzle instance: `drizzle(sqlite, { schema })`.
- Workspace Repository (`workspaceRepository.ts`):
  - `listWorkspaces(userId?: string): WorkspaceMeta[]` (sorted by `updatedAt` desc, max 50)
  - `getWorkspace(id: string, userId?: string): WorkspaceData | null`
  - `saveWorkspace(data: WorkspaceData, userId?: string): { id: string }` (upsert: if exists, update; else insert)
  - `deleteWorkspace(id: string, userId?: string): boolean`
  - `renameWorkspace(id: string, name: string, userId?: string): boolean`
  - `createRevision(workspaceId: string, snapshot: WorkspaceData, diffSummary?: unknown): string`
  - `listRevisions(workspaceId: string): Array<{ id: string; createdAt: Date; diffSummary?: unknown }>`
- Tests in `tests/server/db.test.ts`:
  - Test SQLite WAL mode pragmas enabled.
  - Test upsert, retrieval, update, deletion of workspaces.
  - Test revision history creation and cascade delete.
  - Test multi-user isolation (user A cannot see or mutate user B's workspace when `userId` is provided).
  - Test concurrent write operations without database locking exceptions.
- Implement modules, make tests pass.
- Write report to `.superpowers/sdd/avro-studio-rebuild/task-7-report.md`.
