import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { ContractTabBar } from './components/ContractTabBar';
import { SchemaViewer } from './components/SchemaViewer';
import { SchemaEditor } from './components/SchemaEditor';
import { BigQueryExportModal } from './components/Modals/BigQueryExportModal';
import { ReconciliationModal } from './components/Modals/ReconciliationModal';
import { LinkagesExportModal } from './components/Modals/LinkagesExportModal';
import { ImportModal } from './components/Modals/ImportModal';
import { AvdlPreviewModal } from './components/Modals/AvdlPreviewModal';
import { ContractExportModal } from './components/Modals/ContractExportModal';
import { UserModal } from './components/Modals/UserModal';
import { useSchemaState } from './hooks/useSchemaState';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useUserIdentity } from './hooks/useUserIdentity';
import { computeDiff } from '../core/utils/schemaDiff';
import { serializeAvdl } from '../core/serializer/avdlSerializer';
import type { AvroProtocol } from '../core/types/schema';
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

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData>(() =>
    ensureMultiContractWorkspace({
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
    })
  );

  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

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

  // Calculate live diff annotations between original and edited schemas of active contract
  const diffResult = useMemo(() => {
    const orig = activeContract?.original ?? schemaState.original;
    const edit = schemaState.edited;
    return computeDiff(orig, edit);
  }, [activeContract?.original, schemaState.original, schemaState.edited]);

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
    const newWs = createDefaultWorkspace(`ws-${Date.now()}`, 'Untitled Workspace', userId || undefined);
    newWs.contracts[0].name = 'OrderService.avdl';
    newWs.contracts[0].original = DEFAULT_PROTOCOL;
    newWs.contracts[0].edited = DEFAULT_PROTOCOL;
    newWs.original = DEFAULT_PROTOCOL;
    newWs.edited = DEFAULT_PROTOCOL;
    setWorkspace(newWs);
    setLastSavedAt(undefined);
    schemaState.setProtocol(DEFAULT_PROTOCOL);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">
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
        userId={userId}
        onOpenUserModal={() => setIsUserModalOpen(true)}
      />

      {/* Multi-Contract Tab Bar */}
      <ContractTabBar
        contracts={workspace.contracts}
        activeContractId={workspace.activeContractId}
        onSelectContract={handleSelectContract}
        onAddContract={handleAddContract}
        onRenameContract={handleRenameContract}
        onRemoveContract={handleRemoveContract}
      />

      {/* Diff Stats Banner */}
      <div className="h-8 bg-gray-900/60 border-b border-gray-800/80 px-4 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-4 text-gray-400">
          <span className="font-semibold text-gray-300">Live Diff:</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>+{diffResult.stats.addedCount} added</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            <span>-{diffResult.stats.deletedCount} deleted</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
            <span>~{diffResult.stats.movedCount} moved</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
            <span>~{diffResult.stats.renamedCount} renamed</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            <span>~{diffResult.stats.modifiedCount} type changes</span>
          </span>
        </div>

        <div className="text-[11px] text-gray-500 font-mono">
          {schemaState.isDirty ? '● Unsaved changes' : '✓ Up to date'}
        </div>
      </div>

      {/* Dual-Pane Studio Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Pane: Read-only Original Schema */}
        <section className="w-1/2 border-r border-gray-800 bg-gray-950/40 flex flex-col overflow-hidden">
          <SchemaViewer
            protocol={schemaState.original}
            annotations={diffResult.originalAnnotations}
          />
        </section>

        {/* Right Pane: Interactive Drag-and-Drop Editor */}
        <section className="w-1/2 bg-gray-950 flex flex-col overflow-hidden">
          <SchemaEditor
            protocol={schemaState.edited}
            annotations={diffResult.editedAnnotations}
            onAddField={(rec, name, type) => schemaState.addField(rec, { name, type })}
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
          />
        </section>
      </main>

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
