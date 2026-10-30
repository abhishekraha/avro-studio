import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { SchemaViewer } from './components/SchemaViewer';
import { SchemaEditor } from './components/SchemaEditor';
import { BigQueryExportModal } from './components/Modals/BigQueryExportModal';
import { ReconciliationModal } from './components/Modals/ReconciliationModal';
import { LinkagesExportModal } from './components/Modals/LinkagesExportModal';
import { ImportModal } from './components/Modals/ImportModal';
import { AvdlPreviewModal } from './components/Modals/AvdlPreviewModal';
import { useSchemaState } from './hooks/useSchemaState';
import { useWorkspaces } from './hooks/useWorkspaces';
import { computeDiff } from '../core/utils/schemaDiff';
import { serializeAvdl } from '../core/serializer/avdlSerializer';
import type { AvroProtocol } from '../core/types/schema';
import type { WorkspaceData } from '../core/types/workspace';

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
  const [workspaceId, setWorkspaceId] = useState<string>(() => `ws-${Date.now()}`);
  const [workspaceName, setWorkspaceName] = useState<string>('E-Commerce Rebuild');
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  // Modals state
  const [isBqModalOpen, setIsBqModalOpen] = useState(false);
  const [isReconModalOpen, setIsReconModalOpen] = useState(false);
  const [isLinkagesModalOpen, setIsLinkagesModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAvdlPreviewOpen, setIsAvdlPreviewOpen] = useState(false);

  const { saveWorkspace, loadWorkspace } = useWorkspaces();

  // Autosave handler callback
  const handleAutoSave = useCallback(
    async (currentEdited: AvroProtocol) => {
      setIsSaving(true);
      try {
        const payload: WorkspaceData = {
          id: workspaceId,
          name: workspaceName,
          savedAt: new Date().toISOString(),
          isNew: false,
          original: schemaState.original,
          edited: currentEdited,
          manualLinks: [],
        };
        await saveWorkspace(payload);
        setLastSavedAt(payload.savedAt);
      } catch (err) {
        console.error('Autosave error:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [workspaceId, workspaceName, saveWorkspace]
  );

  const schemaState = useSchemaState({
    initialProtocol: DEFAULT_PROTOCOL,
    onAutoSave: handleAutoSave,
    debounceMs: 2000,
  });

  // Calculate live diff annotations between original and edited schemas
  const diffResult = useMemo(() => {
    return computeDiff(schemaState.original, schemaState.edited);
  }, [schemaState.original, schemaState.edited]);

  const handleExplicitSave = async () => {
    if (!schemaState.edited) return;
    setIsSaving(true);
    try {
      const payload: WorkspaceData = {
        id: workspaceId,
        name: workspaceName,
        savedAt: new Date().toISOString(),
        isNew: false,
        original: schemaState.original,
        edited: schemaState.edited,
        manualLinks: [],
      };
      await saveWorkspace(payload);
      setLastSavedAt(payload.savedAt);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportAvdl = () => {
    if (!schemaState.edited) return;
    const avdlText = serializeAvdl(schemaState.edited);
    const blob = new Blob([avdlText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schemaState.edited.protocol || 'schema'}.avdl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProtocol = (proto: AvroProtocol) => {
    schemaState.setProtocol(proto);
  };

  const handleNewWorkspace = () => {
    const newId = `ws-${Date.now()}`;
    setWorkspaceId(newId);
    setWorkspaceName('Untitled Workspace');
    setLastSavedAt(undefined);
    schemaState.setProtocol(DEFAULT_PROTOCOL);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">
      {/* Header Bar */}
      <Header
        workspaceName={workspaceName}
        onRenameWorkspace={setWorkspaceName}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
        canUndo={schemaState.canUndo}
        canRedo={schemaState.canRedo}
        onUndo={schemaState.undo}
        onRedo={schemaState.redo}
        onSave={handleExplicitSave}
        onExportAvdl={handleExportAvdl}
        onOpenAvdlPreview={() => setIsAvdlPreviewOpen(true)}
        onExportBigQuery={() => setIsBqModalOpen(true)}
        onExportLinkages={() => setIsLinkagesModalOpen(true)}
        onOpenRecon={() => setIsReconModalOpen(true)}
        onOpenImport={() => setIsImportModalOpen(true)}
        onNewWorkspace={handleNewWorkspace}
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
    </div>
  );
}

export default App;
