import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { AvroProtocol } from '../../core/types/schema';
import type { ContractItem } from '../../core/types/workspace';

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    name: text('name').notNull(),
    isNew: integer('is_new', { mode: 'boolean' }).notNull().default(false),
    savedAt: text('saved_at').notNull(),
    activeContractId: text('active_contract_id'),
    contracts: text('contracts', { mode: 'json' }).$type<ContractItem[] | null>(),
    originalSchema: text('original_schema', { mode: 'json' }).$type<AvroProtocol | null>(),
    editedSchema: text('edited_schema', { mode: 'json' }).$type<AvroProtocol | null>(),
    manualLinks: text('manual_links', { mode: 'json' }).$type<Array<[string, string]>>().notNull().default(sql`'[]'`),
    recordLinks: text('record_links', { mode: 'json' }).$type<Array<[string, string]> | null>(),
    originalFieldNotes: text('original_field_notes', { mode: 'json' }).$type<Array<[string, string]> | null>(),
    editedFieldNotes: text('edited_field_notes', { mode: 'json' }).$type<Array<[string, string]> | null>(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index('workspaces_user_id_idx').on(table.userId),
  })
);

export const workspaceRevisions = sqliteTable('workspace_revisions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  diffSummary: text('diff_summary', { mode: 'json' }).$type<unknown>(),
  snapshot: text('snapshot', { mode: 'json' }).$type<unknown>().notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const stats = sqliteTable('stats', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const users = sqliteTable('users', {
  handle: text('handle').primaryKey(),
  displayName: text('display_name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export type WorkspaceSelect = typeof workspaces.$inferSelect;
export type WorkspaceInsert = typeof workspaces.$inferInsert;
export type WorkspaceRevisionSelect = typeof workspaceRevisions.$inferSelect;
export type WorkspaceRevisionInsert = typeof workspaceRevisions.$inferInsert;
export type StatSelect = typeof stats.$inferSelect;
export type StatInsert = typeof stats.$inferInsert;
