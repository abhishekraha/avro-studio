import type { AvroProtocol } from './schema';

/**
 * Individual schema contract item within a workspace.
 */
export interface ContractItem {
  id: string;
  name: string;
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
 * Workspace data model representing the studio editing session.
 */
export interface WorkspaceData {
  id: string;
  name: string;
  userId?: string;
  savedAt: string;
  isNew: boolean;
  activeContractId: string;
  contracts: ContractItem[];

  // Optional backward-compatibility fields (mirrors the active contract or first contract)
  original?: AvroProtocol | null;
  edited?: AvroProtocol | null;
  manualLinks?: Array<[string, string]>;
  recordLinks?: Array<[string, string]>;
  originalFieldNotes?: Array<[string, string]>;
  editedFieldNotes?: Array<[string, string]>;
}

/**
 * Normalizes legacy flat workspace objects or multi-contract objects into a standard WorkspaceData.
 */
export function ensureMultiContractWorkspace(data: any): WorkspaceData {
  if (!data) {
    return createDefaultWorkspace('ws-default', 'Default Workspace');
  }

  // Already modern multi-contract workspace
  if (Array.isArray(data.contracts) && data.contracts.length > 0) {
    const activeId = data.activeContractId || data.contracts[0].id;
    let contracts = [...data.contracts];

    // If top-level legacy fields were directly modified on a multi-contract object, sync them to active contract
    const activeIndex = contracts.findIndex((c: ContractItem) => c.id === activeId);
    if (activeIndex >= 0) {
      const currentActive = contracts[activeIndex];
      contracts[activeIndex] = {
        ...currentActive,
        original: data.original !== undefined ? data.original : currentActive.original,
        edited: data.edited !== undefined ? data.edited : currentActive.edited,
        manualLinks: data.manualLinks !== undefined ? data.manualLinks : currentActive.manualLinks,
        recordLinks: data.recordLinks !== undefined ? data.recordLinks : currentActive.recordLinks,
        originalFieldNotes: data.originalFieldNotes !== undefined ? data.originalFieldNotes : currentActive.originalFieldNotes,
        editedFieldNotes: data.editedFieldNotes !== undefined ? data.editedFieldNotes : currentActive.editedFieldNotes,
      };
    }

    const activeContract = contracts.find((c: ContractItem) => c.id === activeId) || contracts[0];

    return {
      id: data.id,
      name: data.name || 'Untitled Workspace',
      ...(data.userId ? { userId: data.userId } : {}),
      savedAt: data.savedAt || new Date().toISOString(),
      isNew: Boolean(data.isNew),
      activeContractId: activeId,
      contracts,
      // Mirror active contract properties for backward compatibility
      original: activeContract.original ?? null,
      edited: activeContract.edited ?? null,
      manualLinks: activeContract.manualLinks ?? [],
      recordLinks: activeContract.recordLinks,
      originalFieldNotes: activeContract.originalFieldNotes,
      editedFieldNotes: activeContract.editedFieldNotes,
    };
  }

  // Legacy flat workspace conversion
  const contractId = 'contract-1';
  const contractName = data.name || 'Main Contract';
  const singleContract: ContractItem = {
    id: contractId,
    name: contractName,
    original: data.original ?? null,
    edited: data.edited ?? null,
    manualLinks: data.manualLinks || [],
    ...(data.recordLinks ? { recordLinks: data.recordLinks } : {}),
    ...(data.originalFieldNotes ? { originalFieldNotes: data.originalFieldNotes } : {}),
    ...(data.editedFieldNotes ? { editedFieldNotes: data.editedFieldNotes } : {}),
  };

  return {
    id: data.id,
    name: data.name || 'Untitled Workspace',
    ...(data.userId ? { userId: data.userId } : {}),
    savedAt: data.savedAt || new Date().toISOString(),
    isNew: Boolean(data.isNew),
    activeContractId: contractId,
    contracts: [singleContract],
    original: singleContract.original,
    edited: singleContract.edited,
    manualLinks: singleContract.manualLinks,
    recordLinks: singleContract.recordLinks,
    originalFieldNotes: singleContract.originalFieldNotes,
    editedFieldNotes: singleContract.editedFieldNotes,
  };
}

/**
 * Factory to create a clean empty WorkspaceData instance.
 */
export function createDefaultWorkspace(id: string, name: string, userId?: string): WorkspaceData {
  const contractId = 'contract-1';
  const initialContract: ContractItem = {
    id: contractId,
    name,
    original: null,
    edited: null,
    manualLinks: [],
    recordLinks: [],
    originalFieldNotes: [],
    editedFieldNotes: [],
  };

  return {
    id,
    name,
    ...(userId ? { userId } : {}),
    savedAt: new Date().toISOString(),
    isNew: true,
    activeContractId: contractId,
    contracts: [initialContract],
    original: null,
    edited: null,
    manualLinks: [],
    recordLinks: [],
    originalFieldNotes: [],
    editedFieldNotes: [],
  };
}
