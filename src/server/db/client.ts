import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type AppDatabase = {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: InstanceType<typeof Database>;
};

export function createDatabase(dbPath: string = ':memory:'): AppDatabase {
  const sqlite = new Database(dbPath);

  // MUST execute PRAGMAs on every connection
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('foreign_keys = ON');

  // Initialize tables if they do not exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      is_new INTEGER NOT NULL DEFAULT 0,
      saved_at TEXT NOT NULL,
      active_contract_id TEXT,
      contracts TEXT,
      original_schema TEXT,
      edited_schema TEXT,
      manual_links TEXT NOT NULL DEFAULT '[]',
      record_links TEXT,
      original_field_notes TEXT,
      edited_field_notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Migrate existing SQLite files created before multi-contract support
  try {
    const columns = sqlite.pragma('table_info(workspaces)') as Array<{ name: string }>;
    const colNames = new Set(columns.map((c) => c.name));
    if (!colNames.has('active_contract_id')) {
      sqlite.exec('ALTER TABLE workspaces ADD COLUMN active_contract_id TEXT;');
    }
    if (!colNames.has('contracts')) {
      sqlite.exec('ALTER TABLE workspaces ADD COLUMN contracts TEXT;');
    }
  } catch {
    // Ignore migration errors if already present
  }

  sqlite.exec(`


    CREATE INDEX IF NOT EXISTS workspaces_user_id_idx ON workspaces (user_id);

    CREATE TABLE IF NOT EXISTS workspace_revisions (
      id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      diff_summary TEXT,
      snapshot TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS stats (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  const db = drizzle(sqlite, { schema });

  return { db, sqlite };
}
