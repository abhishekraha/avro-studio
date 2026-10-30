import { eq, and, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AppDatabase } from './client';
import { workspaces, workspaceRevisions, type WorkspaceSelect } from './schema';
import type { WorkspaceData } from '../../core/types/workspace';

export interface WorkspaceMeta {
  id: string;
  name: string;
  userId: string | null;
  savedAt: string;
  isNew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class WorkspaceRepository {
  constructor(private dbContext: AppDatabase) {}

  private get db() {
    return this.dbContext.db;
  }

  listWorkspaces(userId?: string): WorkspaceMeta[] {
    const query = this.db.select().from(workspaces);

    const rows = (
      userId !== undefined
        ? query.where(eq(workspaces.userId, userId))
        : query
    )
      .orderBy(desc(workspaces.updatedAt), desc(sql.raw('rowid')))
      .limit(50)
      .all();

    return rows.map((r: WorkspaceSelect) => ({
      id: r.id,
      name: r.name,
      userId: r.userId,
      savedAt: r.savedAt,
      isNew: Boolean(r.isNew),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  getWorkspace(id: string, userId?: string): WorkspaceData | null {
    const conditions = [eq(workspaces.id, id)];
    if (userId !== undefined) {
      conditions.push(eq(workspaces.userId, userId));
    }

    const row = this.db
      .select()
      .from(workspaces)
      .where(and(...conditions))
      .get();

    if (!row) {
      return null;
    }

    return this.mapToWorkspaceData(row);
  }

  saveWorkspace(data: WorkspaceData, userId?: string): { id: string } {
    const effectiveUserId = userId !== undefined ? userId : data.userId ?? null;
    const now = new Date();

    const existingConditions = [eq(workspaces.id, data.id)];
    if (userId !== undefined) {
      existingConditions.push(eq(workspaces.userId, userId));
    }

    const existing = this.db
      .select()
      .from(workspaces)
      .where(and(...existingConditions))
      .get();

    if (existing) {
      this.db
        .update(workspaces)
        .set({
          name: data.name,
          isNew: data.isNew,
          savedAt: data.savedAt || now.toISOString(),
          originalSchema: data.original,
          editedSchema: data.edited,
          manualLinks: data.manualLinks || [],
          recordLinks: data.recordLinks ?? null,
          originalFieldNotes: data.originalFieldNotes ?? null,
          editedFieldNotes: data.editedFieldNotes ?? null,
          updatedAt: now,
        })
        .where(eq(workspaces.id, data.id))
        .run();
    } else {
      this.db
        .insert(workspaces)
        .values({
          id: data.id,
          userId: effectiveUserId,
          name: data.name,
          isNew: data.isNew,
          savedAt: data.savedAt || now.toISOString(),
          originalSchema: data.original,
          editedSchema: data.edited,
          manualLinks: data.manualLinks || [],
          recordLinks: data.recordLinks ?? null,
          originalFieldNotes: data.originalFieldNotes ?? null,
          editedFieldNotes: data.editedFieldNotes ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    return { id: data.id };
  }

  deleteWorkspace(id: string, userId?: string): boolean {
    const conditions = [eq(workspaces.id, id)];
    if (userId !== undefined) {
      conditions.push(eq(workspaces.userId, userId));
    }

    const res = this.db
      .delete(workspaces)
      .where(and(...conditions))
      .run();

    return res.changes > 0;
  }

  renameWorkspace(id: string, name: string, userId?: string): boolean {
    const conditions = [eq(workspaces.id, id)];
    if (userId !== undefined) {
      conditions.push(eq(workspaces.userId, userId));
    }

    const res = this.db
      .update(workspaces)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .run();

    return res.changes > 0;
  }

  createRevision(workspaceId: string, snapshot: WorkspaceData, diffSummary?: unknown): string {
    const id = randomUUID();
    const now = new Date();

    this.db
      .insert(workspaceRevisions)
      .values({
        id,
        workspaceId,
        snapshot,
        diffSummary: diffSummary ?? null,
        createdAt: now,
      })
      .run();

    return id;
  }

  listRevisions(workspaceId: string): Array<{ id: string; createdAt: Date; diffSummary?: unknown }> {
    const rows = this.db
      .select({
        id: workspaceRevisions.id,
        createdAt: workspaceRevisions.createdAt,
        diffSummary: workspaceRevisions.diffSummary,
      })
      .from(workspaceRevisions)
      .where(eq(workspaceRevisions.workspaceId, workspaceId))
      .orderBy(desc(workspaceRevisions.createdAt), desc(sql.raw('rowid')))
      .all();

    return rows.map((r: { id: string; createdAt: Date; diffSummary: unknown }) => ({
      id: r.id,
      createdAt: r.createdAt,
      diffSummary: r.diffSummary,
    }));
  }

  private mapToWorkspaceData(row: WorkspaceSelect): WorkspaceData {
    return {
      id: row.id,
      name: row.name,
      ...(row.userId ? { userId: row.userId } : {}),
      savedAt: row.savedAt,
      isNew: Boolean(row.isNew),
      original: row.originalSchema ?? null,
      edited: row.editedSchema ?? null,
      manualLinks: row.manualLinks ?? [],
      recordLinks: row.recordLinks ?? undefined,
      originalFieldNotes: row.originalFieldNotes ?? undefined,
      editedFieldNotes: row.editedFieldNotes ?? undefined,
    };
  }
}
