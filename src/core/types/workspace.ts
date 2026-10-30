import type { AvroProtocol } from './schema';

/**
 * Workspace data model representing the studio editing session.
 */
export interface WorkspaceData {
  id: string;
  name: string;
  userId?: string;
  savedAt: string;
  isNew: boolean;
  original: AvroProtocol | null;
  edited: AvroProtocol | null;
  /**
   * Field-level manual links: [editedFieldId, originalFieldId]
   */
  manualLinks: Array<[string, string]>;
  /**
   * Record-level links: [editedRecordName, originalRecordName]
   */
  recordLinks?: Array<[string, string]>;
  /**
   * Notes attached to original fields: [originalFieldId, noteText]
   */
  originalFieldNotes?: Array<[string, string]>;
  /**
   * Notes attached to edited fields: [editedFieldId, noteText]
   */
  editedFieldNotes?: Array<[string, string]>;
}

/**
 * Factory to create a clean empty WorkspaceData instance.
 */
export function createDefaultWorkspace(id: string, name: string, userId?: string): WorkspaceData {
  return {
    id,
    name,
    ...(userId ? { userId } : {}),
    savedAt: new Date().toISOString(),
    isNew: true,
    original: null,
    edited: null,
    manualLinks: [],
    recordLinks: [],
    originalFieldNotes: [],
    editedFieldNotes: [],
  };
}
