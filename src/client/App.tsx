import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Header } from './components/Header';
import { ContractTabBar } from './components/ContractTabBar';
import { SchemaViewer, type LinkedPartnerInfo } from './components/SchemaViewer';
import { SchemaEditor } from './components/SchemaEditor';
import { BigQueryExportModal } from './components/Modals/BigQueryExportModal';
import { ReconciliationModal } from './components/Modals/ReconciliationModal';
import { LinkagesExportModal } from './components/Modals/LinkagesExportModal';
import { ImportModal } from './components/Modals/ImportModal';
import { AvdlPreviewModal } from './components/Modals/AvdlPreviewModal';
import { ContractExportModal } from './components/Modals/ContractExportModal';
import { UserModal } from './components/Modals/UserModal';
import { SchemaConnectionOverlay, type FieldConnection } from './components/SchemaConnectionOverlay';
import { useSchemaState } from './hooks/useSchemaState';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useUserIdentity } from './hooks/useUserIdentity';
import { computeDiff } from '../core/utils/schemaDiff';
import { serializeAvdl } from '../core/serializer/avdlSerializer';
import type { AvroProtocol, AvroRecordType } from '../core/types/schema';
import { isRecordType } from '../core/types/schema';
import type { WorkspaceData, ContractItem } from '../core/types/workspace';
import { createDefaultWorkspace, ensureMultiContractWorkspace } from '../core/types/workspace';

const DEFAULT_PROTOCOL: AvroProtocol = {
  protocol: 'OrderServiceProtocol',
  namespace: 'com.example.services',
  types: [
    {
      type: 'record',
      name: 'Order',
      doc: 'Represents an e-commerce customer order',
      fields: [
        { id: 'f-101', name: 'orderId', type: 'string', doc: 'Unique identifier' },
        { id: 'f-102', name: 'customerId', type: 'string' },
        { id: 'f-103', name: 'orderTotal', type: 'double' },
        { id: 'f-104', name: 'status', type: 'string', default: 'CREATED' },
      ],
    },
    {
      type: 'record',
      name: 'Payment',
      doc: 'Payment transaction record',
      fields: [
        { id: 'f-201', name: 'paymentId', type: 'string' },
        { id: 'f-202', name: 'amount', type: 'double' },
        { id: 'f-203', name: 'method', type: 'string' },
      ],
    },
  ],
};

export const ACTIVE_WORKSPACE_STORAGE_KEY = 'avro_active_workspace_id';

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData>(() => {
    // Check if there is an active workspace saved in localStorage
    if (typeof window !== 'undefined') {
      try {
        const cachedWs = window.localStorage.getItem('avro_last_cached_workspace');
        if (cachedWs) {
          const parsed = JSON.parse(cachedWs);
          if (parsed && parsed.id && parsed.contracts) {
            return ensureMultiContractWorkspace(parsed);
          }
        }
      } catch {}
    }

    return ensureMultiContractWorkspace({
      id: `ws-${Date.now()}`,
      name: 'E-Commerce Rebuild',
      savedAt: new Date().toISOString(),
      isNew: true,
      activeContractId: 'contract-1',
      contracts: [
        {
          id: 'contract-1',
          name: 'OrderService.avdl',
          original: DEFAULT_PROTOCOL,
          edited: DEFAULT_PROTOCOL,
          manualLinks: [],
        },
      ],
    });
  });

  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'compare' | 'create'>('compare');

  // Modals state
  const [isBqModalOpen, setIsBqModalOpen] = useState(false);
  const [isReconModalOpen, setIsReconModalOpen] = useState(false);
  const [isLinkagesModalOpen, setIsLinkagesModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAvdlPreviewOpen, setIsAvdlPreviewOpen] = useState(false);
  const [isContractSchemaOpen, setIsContractSchemaOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  const { userId, setUserId, isInitialized } = useUserIdentity();
  const { saveWorkspace, loadWorkspace } = useWorkspaces();

  // On mount or user initialization, load the last active workspace from server or localStorage
  useEffect(() => {
    if (!isInitialized) return;

    let isMounted = true;
    const restoreWorkspace = async () => {
      try {
        const storedWsId = typeof window !== 'undefined'
          ? window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)
          : null;

        if (storedWsId) {
          const loaded = await loadWorkspace(storedWsId);
          if (isMounted && loaded) {
            const multiWs = ensureMultiContractWorkspace(loaded);
            setWorkspace(multiWs);
            setLastSavedAt(multiWs.savedAt);
            return;
          }
        }

        // Fallback: fetch user's workspaces and pick the latest one
        const res = await fetch('/api/workspaces', {
          headers: {
            'X-User-Id': userId || '',
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.workspaces) && data.workspaces.length > 0) {
            const latestMeta = data.workspaces[0];
            const latest = await loadWorkspace(latestMeta.id);
            if (isMounted && latest) {
              const multiWs = ensureMultiContractWorkspace(latest);
              setWorkspace(multiWs);
              setLastSavedAt(multiWs.savedAt);
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, multiWs.id);
                window.localStorage.setItem('avro_last_cached_workspace', JSON.stringify(multiWs));
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not restore last workspace:', err);
      }
    };

    restoreWorkspace();
    return () => {
      isMounted = false;
    };
  }, [isInitialized, userId, loadWorkspace]);

  // Active contract computed from workspace
  const activeContract = useMemo(() => {
    return (
      workspace.contracts.find((c) => c.id === workspace.activeContractId) ||
      workspace.contracts[0]
    );
  }, [workspace.contracts, workspace.activeContractId]);

  // Keep a ref to the latest workspace to avoid closure race conditions during saves and callbacks
  const workspaceRef = useRef(workspace);
  useEffect(() => {
    workspaceRef.current = workspace;
    // Cache to localStorage on every change so page refresh never loses uncommitted work
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspace.id);
        window.localStorage.setItem('avro_last_cached_workspace', JSON.stringify(workspace));
      } catch {}
    }
  }, [workspace]);

  // Autosave handler callback triggered by useSchemaState debounce
  const handleAutoSave = useCallback(
    async (currentEdited: AvroProtocol) => {
      const currentWs = workspaceRef.current;
      setIsSaving(true);
      try {
        const updatedContracts = currentWs.contracts.map((c) =>
          c.id === currentWs.activeContractId ? { ...c, edited: currentEdited } : c
        );
        const payload: WorkspaceData = {
          ...currentWs,
          savedAt: new Date().toISOString(),
          isNew: false,
          contracts: updatedContracts,
          edited: currentEdited,
        };
        await saveWorkspace(payload);
        setWorkspace(payload);
        setLastSavedAt(payload.savedAt);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, payload.id);
          window.localStorage.setItem('avro_last_cached_workspace', JSON.stringify(payload));
        }
      } catch (err) {
        console.error('Autosave error:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [saveWorkspace]
  );

  const schemaState = useSchemaState({
    initialProtocol: activeContract?.edited || DEFAULT_PROTOCOL,
    onAutoSave: handleAutoSave,
    debounceMs: 1500,
  });

  // Track the contract ID that schemaState is currently displaying
  const activeContractIdRef = useRef<string>(workspace.activeContractId);

  // Synchronize schemaState whenever active contract changes
  useEffect(() => {
    if (activeContract && activeContract.id !== activeContractIdRef.current) {
      activeContractIdRef.current = activeContract.id;
      schemaState.setProtocol(activeContract.edited || activeContract.original || null);
    }
  }, [activeContract, schemaState]);

  // Whenever schemaState.edited changes within the current contract, sync it back into workspace.contracts
  useEffect(() => {
    if (!schemaState.edited) return;
    setWorkspace((prevWs) => {
      const contract = prevWs.contracts.find((c) => c.id === prevWs.activeContractId);
      if (contract && contract.edited === schemaState.edited) {
        return prevWs;
      }
      return {
        ...prevWs,
        contracts: prevWs.contracts.map((c) =>
          c.id === prevWs.activeContractId ? { ...c, edited: schemaState.edited } : c
        ),
        edited: schemaState.edited,
      };
    });
  }, [schemaState.edited]);

  // Track manual linking mode state
  const [linkingState, setLinkingState] = useState<{
    fieldId: string;
    isOriginal: boolean;
  } | null>(null);

  // Global keyboard shortcuts: Undo, Redo, and Escape modal closer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key: close all open modals immediately
      if (e.key === 'Escape') {
        setIsBqModalOpen(false);
        setIsReconModalOpen(false);
        setIsLinkagesModalOpen(false);
        setIsImportModalOpen(false);
        setIsAvdlPreviewOpen(false);
        setIsContractSchemaOpen(false);
        setIsUserModalOpen(false);
        return;
      }

      // Don't intercept undo/redo if user is typing inside an input/textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (!modKey) return;

      // Undo: Ctrl+Z / Cmd+Z (without Shift)
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (schemaState.canUndo) {
          schemaState.undo();
        }
      }

      // Redo: Ctrl+Y / Cmd+Y OR Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        (e.key.toLowerCase() === 'y' && !e.shiftKey) ||
        (e.key.toLowerCase() === 'z' && e.shiftKey)
      ) {
        e.preventDefault();
        if (schemaState.canRedo) {
          schemaState.redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [schemaState]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate live diff annotations between original and edited schemas of active contract
  const diffResult = useMemo(() => {
    const orig = activeContract?.original ?? schemaState.original;
    const edit = schemaState.edited;
    const links = activeContract?.manualLinks;
    const recordLinks = activeContract?.recordLinks;
    return computeDiff(orig, edit, links, recordLinks);
  }, [activeContract?.original, schemaState.original, schemaState.edited, activeContract?.manualLinks, activeContract?.recordLinks]);

  // Build lookups for original and edited fields for linking pills
  const { origPartnerMap, editedPartnerMap } = useMemo(() => {
    const origMap = new Map<string, LinkedPartnerInfo>();
    const editMap = new Map<string, LinkedPartnerInfo>();

    const origProto = activeContract?.original ?? schemaState.original;
    const editProto = schemaState.edited;

    const origFieldsById = new Map<string, { fieldName: string; recordName: string }>();
    if (origProto?.types) {
      for (const t of origProto.types) {
        if (isRecordType(t)) {
          for (const f of t.fields) {
            origFieldsById.set(f.id, { fieldName: f.name, recordName: t.name });
          }
        }
      }
    }

    const editFieldsById = new Map<string, { fieldName: string; recordName: string }>();
    if (editProto?.types) {
      for (const t of editProto.types) {
        if (isRecordType(t)) {
          for (const f of t.fields) {
            editFieldsById.set(f.id, { fieldName: f.name, recordName: t.name });
          }
        }
      }
    }

    // 1. First populate matching synthetic IDs OR matching canonical record.field name
    const origByRecordField = new Map<string, { id: string; name: string; recordName: string }>();
    if (origProto?.types) {
      for (const t of origProto.types) {
        if (isRecordType(t)) {
          for (const f of t.fields) {
            origByRecordField.set(`${(t.namespace || origProto.namespace || '').toLowerCase()}.${t.name.toLowerCase()}.${f.name.toLowerCase()}`, {
              id: f.id,
              name: f.name,
              recordName: t.name,
            });
          }
        }
      }
    }

    if (origProto?.types && editProto?.types) {
      for (const origType of origProto.types) {
        if (isRecordType(origType)) {
          for (const origField of origType.fields) {
            const editInfo = editFieldsById.get(origField.id);
            if (editInfo) {
              origMap.set(origField.id, {
                fieldId: origField.id,
                fieldName: editInfo.fieldName,
                recordName: editInfo.recordName,
              });
              editMap.set(origField.id, {
                fieldId: origField.id,
                fieldName: origField.name,
                recordName: origType.name,
              });
            }
          }
        }
      }

      // Also check canonical match: same record name + same field name
      for (const editType of editProto.types) {
        if (isRecordType(editType)) {
          for (const editField of editType.fields) {
            if (!editMap.has(editField.id)) {
              const semanticKey = `${(editType.namespace || editProto.namespace || '').toLowerCase()}.${editType.name.toLowerCase()}.${editField.name.toLowerCase()}`;
              const origMatch = origByRecordField.get(semanticKey);
              if (origMatch && !origMap.has(origMatch.id)) {
                origMap.set(origMatch.id, {
                  fieldId: editField.id,
                  fieldName: editField.name,
                  recordName: editType.name,
                });
                editMap.set(editField.id, {
                  fieldId: origMatch.id,
                  fieldName: origMatch.name,
                  recordName: origMatch.recordName,
                });
              }
            }
          }
        }
      }
    }

    // 2. Override/supplement with manualLinks (manual mappings take precedence)
    const manualLinks = activeContract?.manualLinks || [];
    for (const [editedFieldId, originalFieldId] of manualLinks) {
      const origInfo = origFieldsById.get(originalFieldId);
      const editInfo = editFieldsById.get(editedFieldId);

      if (origInfo) {
        editMap.set(editedFieldId, {
          fieldId: originalFieldId,
          fieldName: origInfo.fieldName,
          recordName: origInfo.recordName,
        });
      }

      if (editInfo) {
        origMap.set(originalFieldId, {
          fieldId: editedFieldId,
          fieldName: editInfo.fieldName,
          recordName: editInfo.recordName,
        });
      }
    }

    return { origPartnerMap: origMap, editedPartnerMap: editMap };
  }, [activeContract?.original, schemaState.original, schemaState.edited, activeContract?.manualLinks]);

  // Compute connections list for overlay lines
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const studioContainerRef = useRef<HTMLDivElement | null>(null);

  const connections = useMemo<FieldConnection[]>(() => {
    const list: FieldConnection[] = [];
    const origProto = activeContract?.original ?? schemaState.original;
    const editProto = schemaState.edited;
    if (!origProto || !editProto) return list;

    // Track added pairs to avoid duplicates
    const seen = new Set<string>();

    // Manual links
    const manualLinks = activeContract?.manualLinks || [];
    for (const [editedFieldId, originalFieldId] of manualLinks) {
      const pairKey = `${originalFieldId}::${editedFieldId}`;
      if (!seen.has(pairKey)) {
        seen.add(pairKey);
        const locateField = (protocol: AvroProtocol, fieldId: string) => {
          for (const type of protocol.types) {
            if (!isRecordType(type)) continue;
            const field = type.fields.find((item) => item.id === fieldId);
            if (field) return { recordName: type.name, fieldName: field.name, namespace: type.namespace || protocol.namespace || '' };
          }
          return undefined;
        };
        const source = locateField(origProto, originalFieldId);
        const target = locateField(editProto, editedFieldId);
        list.push({
          originalFieldId,
          editedFieldId,
          origElementId: `field-orig-${originalFieldId}`,
          editElementId: `field-edit-${editedFieldId}`,
          isManual: true,
          isCrossRecord: !!source && !!target && source.recordName !== target.recordName,
          originalRecordName: source?.recordName,
          editedRecordName: target?.recordName,
          originalFieldName: source?.fieldName,
          editedFieldName: target?.fieldName,
          originalNamespace: source?.namespace,
          editedNamespace: target?.namespace,
        });
      }
    }

    // Default matching synthetic ID links
    const manualEditedIds = new Set(manualLinks.map(([e]) => e));
    const manualOrigIds = new Set(manualLinks.map(([, o]) => o));

    const origFieldsById = new Set<string>();
    if (origProto.types) {
      for (const t of origProto.types) {
        if (isRecordType(t)) {
          for (const f of t.fields) {
            origFieldsById.add(f.id);
          }
        }
      }
    }

    // Canonical record.field matching for connections when IDs differ
    const origByRecordField = new Map<string, string>();
    if (origProto.types) {
      for (const t of origProto.types) {
        if (isRecordType(t)) {
          for (const f of t.fields) {
            origByRecordField.set(`${(t.namespace || origProto.namespace || '').toLowerCase()}.${t.name.toLowerCase()}.${f.name.toLowerCase()}`, f.id);
          }
        }
      }
    }

    if (editProto.types) {
      for (const t of editProto.types) {
        if (isRecordType(t)) {
          for (const f of t.fields) {
            if (
              origFieldsById.has(f.id) &&
              !manualEditedIds.has(f.id) &&
              !manualOrigIds.has(f.id)
            ) {
              const pairKey = `${f.id}::${f.id}`;
              if (!seen.has(pairKey)) {
                seen.add(pairKey);
                list.push({
                  originalFieldId: f.id,
                  editedFieldId: f.id,
                  origElementId: `field-orig-${f.id}`,
                  editElementId: `field-edit-${f.id}`,
                  isManual: false,
                });
              }
            } else if (!manualEditedIds.has(f.id)) {
              // Check canonical record.field match
              const origId = origByRecordField.get(`${(t.namespace || editProto.namespace || '').toLowerCase()}.${t.name.toLowerCase()}.${f.name.toLowerCase()}`);
              if (origId && !manualOrigIds.has(origId)) {
                const pairKey = `${origId}::${f.id}`;
                if (!seen.has(pairKey)) {
                  seen.add(pairKey);
                  list.push({
                    originalFieldId: origId,
                    editedFieldId: f.id,
                    origElementId: `field-orig-${origId}`,
                    editElementId: `field-edit-${f.id}`,
                    isManual: false,
                  });
                }
              }
            }
          }
        }
      }
    }

    return list;
  }, [activeContract?.original, schemaState.original, schemaState.edited, activeContract?.manualLinks]);

  // Click on a field box highlights its connection line and makes it glow
  const handleSelectField = useCallback(
    (fieldId: string | null) => {
      if (!fieldId) {
        setSelectedConnectionId(null);
        return;
      }
      // Find matching connection where this field is either original or edited
      const matchedConn = connections.find(
        (c) => c.originalFieldId === fieldId || c.editedFieldId === fieldId
      );
      if (matchedConn) {
        setSelectedConnectionId(`${matchedConn.originalFieldId}::${matchedConn.editedFieldId}`);
      } else {
        setSelectedConnectionId(null);
      }
    },
    [connections]
  );

  // Active selected field ID for highlighting boxes
  const activeSelectedFieldId = useMemo(() => {
    if (!selectedConnectionId) return null;
    const parts = selectedConnectionId.split('::');
    return parts[0] || null;
  }, [selectedConnectionId]);

  const selectedCrossRecordConnection = useMemo(() =>
    connections.find((connection) =>
      connection.isCrossRecord && `${connection.originalFieldId}::${connection.editedFieldId}` === selectedConnectionId
    ), [connections, selectedConnectionId]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedConnectionId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  // Linking actions
  const handleStartLinking = useCallback((fieldId: string, isOriginal: boolean) => {
    setLinkingState((prev) => {
      if (prev && prev.fieldId === fieldId) {
        return null; // toggle off
      }
      return { fieldId, isOriginal };
    });
  }, []);

  const handleLinkField = useCallback(
    (targetFieldId: string) => {
      if (!linkingState) return;
      if (linkingState.fieldId === targetFieldId) {
        setLinkingState(null);
        return;
      }

      const editedFieldId = linkingState.isOriginal ? targetFieldId : linkingState.fieldId;
      const originalFieldId = linkingState.isOriginal ? linkingState.fieldId : targetFieldId;

      setWorkspace((prevWs) => {
        const contracts = prevWs.contracts.map((c) => {
          if (c.id !== prevWs.activeContractId) return c;
          const currentLinks = c.manualLinks || [];
          // Remove any links involving either field
          const filtered = currentLinks.filter(
            ([e, o]) => e !== editedFieldId && o !== originalFieldId
          );
          return {
            ...c,
            manualLinks: [...filtered, [editedFieldId, originalFieldId] as [string, string]],
          };
        });
        return {
          ...prevWs,
          contracts,
          manualLinks: contracts.find((c) => c.id === prevWs.activeContractId)?.manualLinks || [],
        };
      });

      setLinkingState(null);
    },
    [linkingState]
  );

  const handleUnlink = useCallback((fieldId: string) => {
    setWorkspace((prevWs) => {
      const contracts = prevWs.contracts.map((c) => {
        if (c.id !== prevWs.activeContractId) return c;
        const currentLinks = c.manualLinks || [];
        const filtered = currentLinks.filter(
          ([e, o]) => e !== fieldId && o !== fieldId
        );
        return {
          ...c,
          manualLinks: filtered,
        };
      });
      return {
        ...prevWs,
        contracts,
        manualLinks: contracts.find((c) => c.id === prevWs.activeContractId)?.manualLinks || [],
      };
    });
  }, []);

  const handleCopyRecord = useCallback(
    (record: AvroRecordType) => {
      try {
        const { createdLinks } = schemaState.copyRecordFromOriginal(record);
        if (createdLinks.length > 0) {
          setWorkspace((prevWs) => {
            const contracts = prevWs.contracts.map((c) => {
              if (c.id !== prevWs.activeContractId) return c;
              const currentLinks = c.manualLinks || [];
              const newLinks = [...currentLinks];
              for (const pair of createdLinks) {
                // remove existing if any
                const filtered = newLinks.filter(
                  ([e, o]) => e !== pair[0] && o !== pair[1]
                );
                filtered.push(pair);
                newLinks.length = 0;
                newLinks.push(...filtered);
              }
              return {
                ...c,
                manualLinks: newLinks,
              };
            });
            return {
              ...prevWs,
              contracts,
              manualLinks: contracts.find((c) => c.id === prevWs.activeContractId)?.manualLinks || [],
            };
          });
        }
      } catch (err) {
        console.error('Failed to copy record:', err);
      }
    },
    [schemaState]
  );

  const handleLinkRecord = useCallback(
    (originalRecordName: string, editedRecordName: string) => {
      setWorkspace((prevWs) => {
        const contracts = prevWs.contracts.map((c) => {
          if (c.id !== prevWs.activeContractId) return c;
          const currentRecLinks = c.recordLinks || [];
          // Pair is [editedRecordName, originalRecordName]
          const filtered = currentRecLinks.filter(
            ([e, o]) => e !== editedRecordName && o !== originalRecordName
          );
          return {
            ...c,
            recordLinks: [...filtered, [editedRecordName, originalRecordName] as [string, string]],
          };
        });
        const activeC = contracts.find((c) => c.id === prevWs.activeContractId);
        return {
          ...prevWs,
          contracts,
          recordLinks: activeC?.recordLinks || [],
        };
      });
    },
    []
  );

  const handleUnlinkRecord = useCallback(
    (originalRecordName: string) => {
      setWorkspace((prevWs) => {
        const contracts = prevWs.contracts.map((c) => {
          if (c.id !== prevWs.activeContractId) return c;
          const currentRecLinks = c.recordLinks || [];
          const filtered = currentRecLinks.filter(([, o]) => o !== originalRecordName);
          return {
            ...c,
            recordLinks: filtered,
          };
        });
        const activeC = contracts.find((c) => c.id === prevWs.activeContractId);
        return {
          ...prevWs,
          contracts,
          recordLinks: activeC?.recordLinks || [],
        };
      });
    },
    []
  );

  // Top-level drag and drop end handler for both cross-pane and within-pane
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;
      const overId = String(over.id);

      // Check if dropped from original schema onto edited record card
      if (activeData?.source === 'original' && activeData.field) {
        let targetRecordName: string | undefined;

        if (overId.startsWith('drop-rec-')) {
          targetRecordName = overId.replace('drop-rec-', '');
        } else {
          // If dropped over a sortable field in edited schema, find enclosing record
          if (schemaState.edited?.types) {
            for (const t of schemaState.edited.types) {
              if (isRecordType(t) && t.fields.some((f) => f.id === overId)) {
                targetRecordName = t.name;
                break;
              }
            }
          }
        }

        if (targetRecordName) {
          const originalField = activeData.field;

          // Check if this original field is ALREADY present/linked on the right side in another record
          // Look up in edited schema by ID, or by manualLinks pointing to this originalField.id
          let existingEditedFieldInfo: { recordName: string; fieldId: string } | undefined;

          if (schemaState.edited?.types) {
            // 1. Direct ID match
            for (const t of schemaState.edited.types) {
              if (isRecordType(t)) {
                const found = t.fields.find((f) => f.id === originalField.id);
                if (found) {
                  existingEditedFieldInfo = { recordName: t.name, fieldId: found.id };
                  break;
                }
              }
            }

            // 2. Or mapped via manualLinks
            if (!existingEditedFieldInfo) {
              const currentLinks = activeContract?.manualLinks || [];
              const linkPair = currentLinks.find(([, o]) => o === originalField.id);
              if (linkPair) {
                const [linkedEditedId] = linkPair;
                for (const t of schemaState.edited.types) {
                  if (isRecordType(t)) {
                    const found = t.fields.find((f) => f.id === linkedEditedId);
                    if (found) {
                      existingEditedFieldInfo = { recordName: t.name, fieldId: found.id };
                      break;
                    }
                  }
                }
              }
            }

            // 3. Or matching canonical name
            if (!existingEditedFieldInfo) {
              for (const t of schemaState.edited.types) {
                if (isRecordType(t)) {
                  const found = t.fields.find((f) => f.name.toLowerCase() === originalField.name.toLowerCase());
                  if (found) {
                    existingEditedFieldInfo = { recordName: t.name, fieldId: found.id };
                    break;
                  }
                }
              }
            }
          }

          if (existingEditedFieldInfo) {
            // Field is already linked in an edited record.
            // If dragging into a different record, MOVE the right-side field instead of creating a duplicate!
            if (existingEditedFieldInfo.recordName !== targetRecordName) {
              schemaState.moveField({
                sourceRecordName: existingEditedFieldInfo.recordName,
                targetRecordName,
                fieldId: existingEditedFieldInfo.fieldId,
              });

              // Ensure manualLinks points to this existing field and target original field
              setWorkspace((prevWs) => {
                const contracts = prevWs.contracts.map((c) => {
                  if (c.id !== prevWs.activeContractId) return c;
                  const currentLinks = c.manualLinks || [];
                  const filtered = currentLinks.filter(
                    ([e, o]) => e !== existingEditedFieldInfo!.fieldId && o !== originalField.id
                  );
                  return {
                    ...c,
                    manualLinks: [
                      ...filtered,
                      [existingEditedFieldInfo!.fieldId, originalField.id] as [string, string],
                    ],
                  };
                });
                return {
                  ...prevWs,
                  contracts,
                  manualLinks: contracts.find((c) => c.id === prevWs.activeContractId)?.manualLinks || [],
                };
              });
            }
            return;
          }

          // If not already on right side, create new field & link
          const syntheticId = `g-${Math.random().toString(36).substring(2, 6)}`;

          // 1. Add field to target record
          schemaState.addField(targetRecordName, {
            id: syntheticId,
            name: originalField.name,
            type: originalField.type,
            doc: originalField.doc,
            default: originalField.default,
          });

          // 2. Automatically append [newFieldId, originalField.id] to activeContract.manualLinks
          setWorkspace((prevWs) => {
            const contracts = prevWs.contracts.map((c) => {
              if (c.id !== prevWs.activeContractId) return c;
              const currentLinks = c.manualLinks || [];
              const filtered = currentLinks.filter(
                ([e, o]) => e !== syntheticId && o !== originalField.id
              );
              return {
                ...c,
                manualLinks: [...filtered, [syntheticId, originalField.id] as [string, string]],
              };
            });
            return {
              ...prevWs,
              contracts,
              manualLinks: contracts.find((c) => c.id === prevWs.activeContractId)?.manualLinks || [],
            };
          });
        }
        return;
      }

      // Otherwise, handle intra-editor reorder / move across records
      if (active.id === over.id || !schemaState.edited) return;

      // Build field to record map for edited schema
      const fieldToRecordMap = new Map<string, { recordName: string; index: number }>();
      for (const t of schemaState.edited.types) {
        if (isRecordType(t)) {
          t.fields.forEach((f, idx) => {
            fieldToRecordMap.set(f.id, { recordName: t.name, index: idx });
          });
        }
      }

      const activeInfo = fieldToRecordMap.get(String(active.id));
      if (!activeInfo) return;

      if (overId.startsWith('drop-rec-')) {
        const targetRec = overId.replace('drop-rec-', '');
        if (activeInfo.recordName !== targetRec) {
          schemaState.moveField({
            sourceRecordName: activeInfo.recordName,
            targetRecordName: targetRec,
            fieldId: String(active.id),
          });
        }
        return;
      }

      const overInfo = fieldToRecordMap.get(overId);
      if (overInfo) {
        if (activeInfo.recordName === overInfo.recordName) {
          schemaState.reorderField(activeInfo.recordName, activeInfo.index, overInfo.index);
        } else {
          schemaState.moveField({
            sourceRecordName: activeInfo.recordName,
            targetRecordName: overInfo.recordName,
            fieldId: String(active.id),
            targetIndex: overInfo.index,
          });
        }
      }
    },
    [schemaState]
  );

  const handleExplicitSave = async () => {
    if (!schemaState.edited) return;
    setIsSaving(true);
    try {
      const currentWs = workspaceRef.current;
      const updatedContracts = currentWs.contracts.map((c) =>
        c.id === currentWs.activeContractId ? { ...c, edited: schemaState.edited } : c
      );
      const payload: WorkspaceData = {
        ...currentWs,
        savedAt: new Date().toISOString(),
        isNew: false,
        contracts: updatedContracts,
        edited: schemaState.edited,
      };
      await saveWorkspace(payload);
      setWorkspace(payload);
      setLastSavedAt(payload.savedAt);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRenameWorkspace = (name: string) => {
    setWorkspace((prev) => ({ ...prev, name }));
  };

  // Multi-Contract Tab Bar Handlers
  const handleSelectContract = (id: string) => {
    if (id === workspace.activeContractId) return;
    setWorkspace((prev) => ({
      ...prev,
      activeContractId: id,
    }));
  };

  const handleAddContract = (name: string) => {
    const newId = `contract-${Date.now()}`;
    const newContract: ContractItem = {
      id: newId,
      name,
      original: null,
      edited: null,
      manualLinks: [],
    };
    setWorkspace((prev) => ({
      ...prev,
      activeContractId: newId,
      contracts: [...prev.contracts, newContract],
    }));
  };

  const handleRenameContract = (id: string, name: string) => {
    setWorkspace((prev) => ({
      ...prev,
      contracts: prev.contracts.map((c) => (c.id === id ? { ...c, name } : c)),
    }));
  };

  const handleRemoveContract = (id: string) => {
    setWorkspace((prev) => {
      if (prev.contracts.length <= 1) return prev;
      const idx = prev.contracts.findIndex((c) => c.id === id);
      const remaining = prev.contracts.filter((c) => c.id !== id);
      let nextActiveId = prev.activeContractId;
      if (prev.activeContractId === id) {
        const nextActive = remaining[Math.max(0, idx - 1)] || remaining[0];
        nextActiveId = nextActive.id;
      }
      return {
        ...prev,
        activeContractId: nextActiveId,
        contracts: remaining,
      };
    });
  };

  const handleExportAvdl = () => {
    if (!schemaState.edited) return;
    const avdlText = serializeAvdl(schemaState.edited);
    const blob = new Blob([avdlText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = activeContract?.name?.replace(/\.[^/.]+$/, '') || schemaState.edited.protocol || 'schema';
    a.download = `${baseName}.avdl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProtocol = (proto: AvroProtocol) => {
    schemaState.setProtocol(proto);
    setWorkspace((prev) => ({
      ...prev,
      contracts: prev.contracts.map((c) =>
        c.id === prev.activeContractId ? { ...c, original: proto, edited: proto } : c
      ),
      original: proto,
      edited: proto,
    }));
  };

  const handleNewWorkspace = () => {
    const blankProtocol: AvroProtocol = {
      protocol: 'NewServiceProtocol',
      namespace: 'com.example.schema',
      schemaVersion: '1.0.0',
      types: [
        {
          type: 'record',
          name: 'NewRecord',
          doc: 'Initial schema record',
          fields: [
            { id: `f-${Date.now()}-1`, name: 'id', type: 'string', doc: 'Primary identifier' },
          ],
        },
      ],
    };

    const newWs = createDefaultWorkspace(`ws-${Date.now()}`, 'New Schema Project', userId || undefined);
    newWs.contracts[0].name = 'NewService.avdl';
    newWs.contracts[0].original = null; // Clean slate: no original compare baseline in create-new
    newWs.contracts[0].edited = blankProtocol;
    newWs.contracts[0].manualLinks = [];
    newWs.original = null;
    newWs.edited = blankProtocol;
    newWs.manualLinks = [];
    setWorkspace(newWs);
    setLastSavedAt(undefined);
    schemaState.setProtocol(blankProtocol);
    setViewMode('create');
  };

  return (
    <div className="studio-shell">
      {/* Header Bar */}
      <Header
        workspaceName={workspace.name}
        onRenameWorkspace={handleRenameWorkspace}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
        canUndo={schemaState.canUndo}
        canRedo={schemaState.canRedo}
        onUndo={schemaState.undo}
        onRedo={schemaState.redo}
        onSave={handleExplicitSave}
        onExportAvdl={handleExportAvdl}
        onOpenContractSchema={() => setIsContractSchemaOpen(true)}
        onOpenAvdlPreview={() => setIsAvdlPreviewOpen(true)}
        onExportBigQuery={() => setIsBqModalOpen(true)}
        onExportLinkages={() => setIsLinkagesModalOpen(true)}
        onOpenRecon={() => setIsReconModalOpen(true)}
        onOpenImport={() => setIsImportModalOpen(true)}
        onNewWorkspace={handleNewWorkspace}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        userId={userId}
        onOpenUserModal={() => setIsUserModalOpen(true)}
        schemaVersion={schemaState.edited?.schemaVersion}
        onUpdateSchemaVersion={schemaState.setSchemaVersion}
      />

      {/* Multi-Contract Tab Bar */}
      <ContractTabBar
        contracts={workspace.contracts}
        activeContractId={workspace.activeContractId}
        onSelectContract={handleSelectContract}
        onAddContract={handleAddContract}
        onRenameContract={handleRenameContract}
        onRemoveContract={handleRemoveContract}
        protocolNamespace={schemaState.original?.namespace || schemaState.edited?.namespace || ''}
        activeLinkCount={connections.length}
      />

      {/* Dual-Pane or Full Create Workspace wrapped in top-level DndContext */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <main ref={studioContainerRef} className={'studio-main ' + (viewMode === 'create' ? 'studio-main-create' : 'studio-main-compare') + (selectedCrossRecordConnection ? ' studio-main-move-selected' : '')}>
          {/* Connecting lines overlay (only active in Compare & Edit mode) */}
          {viewMode === 'compare' && (
            <SchemaConnectionOverlay
              connections={connections}
              selectedConnectionId={selectedConnectionId}
              onSelectConnection={setSelectedConnectionId}
              containerRef={studioContainerRef}
            />
          )}
          {selectedCrossRecordConnection && (
            <aside className="studio-cross-record-detail" onClick={(event) => event.stopPropagation()}>
              <div className="studio-cross-record-detail-title">● &nbsp;CROSS-RECORD LINK DETECTED</div>
              <div><strong>Source:</strong> {selectedCrossRecordConnection.originalNamespace}.{selectedCrossRecordConnection.originalRecordName}.{selectedCrossRecordConnection.originalFieldName}</div>
              <div><strong>Target:</strong> {selectedCrossRecordConnection.editedNamespace}.{selectedCrossRecordConnection.editedRecordName}.{selectedCrossRecordConnection.editedFieldName}</div>
              <hr />
              <p>Field restructured across record boundaries.</p>
              <p>Bi-directional lineage preserved for reconciliation.</p>
              <button type="button" onClick={() => setSelectedConnectionId(null)}>Close</button>
            </aside>
          )}

          {/* Left Pane: Read-only Original Schema (Compare mode only) */}
          {viewMode === 'compare' && (
            <section className="studio-pane studio-pane-original">
              <div className="studio-pane-heading">
                <div className="studio-pane-title">
                  <h2>Original Protocol</h2>
                  <span className="studio-readonly-badge">READ-ONLY</span>
                </div>
                <span className="studio-pane-count">{schemaState.original?.types.filter(isRecordType).length || 0} Records</span>
              </div>
              <div className="studio-pane-body">
              <SchemaViewer
                protocol={schemaState.original}
                annotations={diffResult.originalAnnotations}
                recordLinks={activeContract?.recordLinks}
                partnerFieldsMap={origPartnerMap}
                selectedFieldId={activeSelectedFieldId}
                onSelectField={handleSelectField}
              />
              </div>
            </section>
          )}

          {/* Right/Full Pane: Interactive Drag-and-Drop Editor */}
          <section
            className={viewMode === 'create' ? 'studio-pane studio-pane-working studio-create-pane' : 'studio-pane studio-pane-working'}
          >
            <SchemaEditor
              protocol={schemaState.edited}
              workspaceName={workspace.name}
              onRenameWorkspace={handleRenameWorkspace}
              onUpdateProtocolName={schemaState.setProtocolName}
              onUpdateProtocolNamespace={schemaState.setProtocolNamespace}
              schemaVersion={schemaState.edited?.schemaVersion || '1.0.0'}
              onUpdateSchemaVersion={schemaState.setSchemaVersion}
              annotations={viewMode === 'compare' ? diffResult.editedAnnotations : undefined}
              partnerFieldsMap={viewMode === 'compare' ? editedPartnerMap : undefined}
              linkingFieldId={viewMode === 'compare' ? linkingState?.fieldId : undefined}
              selectedFieldId={activeSelectedFieldId}
              onSelectField={handleSelectField}
              onStartLinking={handleStartLinking}
              onLinkField={handleLinkField}
              onUnlink={handleUnlink}
              onAddField={(rec, name, type, recNs) => schemaState.addField(rec, { name, type }, undefined, recNs)}
              onRemoveField={schemaState.removeField}
              onRenameField={schemaState.renameField}
              onUpdateFieldType={schemaState.updateFieldType}
              onReorderField={schemaState.reorderField}
              onMoveField={(sourceRecord, targetRecord, fieldId, targetIndex) =>
                schemaState.moveField({
                  sourceRecordName: sourceRecord,
                  targetRecordName: targetRecord,
                  fieldId,
                  targetIndex,
                })
              }
              onAddRecord={schemaState.addRecord}
              onRemoveRecord={schemaState.removeRecord}
              onRenameRecord={schemaState.renameRecord}
              onUpdateRecordNamespace={schemaState.updateRecordNamespace}
              onReset={() => {
                // Reset edited protocol back to original
                schemaState.reset();
                // Clear manual links, record links on active contract
                setWorkspace((prev) => {
                  const contracts = prev.contracts.map((c) =>
                    c.id === prev.activeContractId
                      ? { ...c, manualLinks: [], recordLinks: [] }
                      : c
                  );
                  return { ...prev, contracts };
                });
                // Clear linking mode
                setLinkingState(null);
              }}
            />
          </section>
        </main>
      </DndContext>

      <footer className="studio-footer">
        Shortcuts: <kbd>Ctrl+Z</kbd> Undo <kbd>Ctrl+Y</kbd> Redo <kbd>Esc</kbd> Close Modals
        <span className="studio-footer-note">Avro Studio Rebuild &bull; Production Ready</span>
      </footer>

      {/* Modals */}
      <BigQueryExportModal
        isOpen={isBqModalOpen}
        onClose={() => setIsBqModalOpen(false)}
        protocol={schemaState.edited}
      />

      <ReconciliationModal
        isOpen={isReconModalOpen}
        onClose={() => setIsReconModalOpen(false)}
        original={schemaState.original}
        edited={schemaState.edited}
      />

      <LinkagesExportModal
        isOpen={isLinkagesModalOpen}
        onClose={() => setIsLinkagesModalOpen(false)}
        original={schemaState.original}
        edited={schemaState.edited}
        manualLinks={activeContract?.manualLinks}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportProtocol}
      />

      {/* Side-by-Side AVDL Preview Modal */}
      <AvdlPreviewModal
        isOpen={isAvdlPreviewOpen}
        onClose={() => setIsAvdlPreviewOpen(false)}
        originalProtocol={schemaState.original}
        editedProtocol={schemaState.edited}
      />

      {/* Contract Schema Export Modal (AVDL & AVSC) */}
      <ContractExportModal
        isOpen={isContractSchemaOpen}
        onClose={() => setIsContractSchemaOpen(false)}
        contract={activeContract}
      />

      {/* User Identity Modal */}
      <UserModal
        isOpen={isInitialized && (!userId || isUserModalOpen)}
        currentUserId={userId}
        onSave={(newId) => {
          setUserId(newId);
          setIsUserModalOpen(false);
        }}
        onClose={() => setIsUserModalOpen(false)}
      />
    </div>
  );
}

export default App;
