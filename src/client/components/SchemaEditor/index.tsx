import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { AvroProtocol, AvroRecordType, AvroSchemaType } from '../../../core/types/schema';
import type { LinkType } from '../../../core/types/linkage';
import { isRecordType } from '../../../core/types/schema';
import { SortableField } from './SortableField';
import type { LinkedPartnerInfo } from '../SchemaViewer';
import { Plus, Trash2, Edit3, FolderPlus, Layers, Tag, RotateCcw } from 'lucide-react';
import { displayFieldStatus } from '../fieldStatus';

export interface SchemaEditorProps {
  protocol: AvroProtocol | null;
  workspaceName?: string;
  onRenameWorkspace?: (name: string) => void;
  onUpdateProtocolName?: (name: string) => void;
  onUpdateProtocolNamespace?: (namespace: string) => void;
  schemaVersion?: string;
  onUpdateSchemaVersion?: (version: string) => void;
  annotations?: Map<string, LinkType | 'unchanged'>;
  partnerFieldsMap?: Map<string, LinkedPartnerInfo>; // editedFieldId -> orig partner info
  linkingFieldId?: string | null;
  selectedFieldId?: string | null;
  onSelectField?: (fieldId: string | null) => void;
  onStartLinking?: (fieldId: string, isOriginal: boolean) => void;
  onLinkField?: (targetFieldId: string) => void;
  onUnlink?: (fieldId: string) => void;
  onAddField: (recordName: string, name: string, type: AvroSchemaType, recordNamespace?: string) => void;
  onRemoveField: (recordName: string, fieldId: string, recordNamespace?: string) => void;
  onRenameField: (recordName: string, fieldId: string, newName: string, recordNamespace?: string) => void;
  onUpdateFieldType: (recordName: string, fieldId: string, newType: AvroSchemaType, recordNamespace?: string) => void;
  onReorderField: (recordName: string, oldIndex: number, newIndex: number, recordNamespace?: string) => void;
  onMoveField: (sourceRecord: string, targetRecord: string, fieldId: string, targetIndex?: number) => void;
  onAddRecord: (name: string, namespace?: string) => void;
  onRemoveRecord: (name: string, namespace?: string) => void;
  onRenameRecord: (oldName: string, newName: string, namespace?: string) => void;
  onUpdateRecordNamespace?: (recordName: string, newNamespace: string, currentNamespace?: string) => void;
  onReset?: () => void;
}

interface DroppableRecordCardProps {
  record: AvroRecordType;
  defaultNamespace?: string;
  availableNamedTypes: string[];
  annotations?: Map<string, LinkType | 'unchanged'>;
  partnerFieldsMap?: Map<string, LinkedPartnerInfo>;
  linkingFieldId?: string | null;
  selectedFieldId?: string | null;
  onSelectField?: (fieldId: string | null) => void;
  addingFieldRecord: string | null;
  newFieldName: string;
  newFieldType: AvroSchemaType;
  setAddingFieldRecord: (rec: string | null) => void;
  setNewFieldName: (name: string) => void;
  setNewFieldType: (type: AvroSchemaType) => void;
  onRenameRecord: (oldName: string, newName: string, namespace?: string) => void;
  onRemoveRecord: (name: string, namespace?: string) => void;
  onUpdateRecordNamespace?: (recordName: string, newNamespace: string, currentNamespace?: string) => void;
  onRenameField: (recordName: string, fieldId: string, newName: string, recordNamespace?: string) => void;
  onUpdateFieldType: (recordName: string, fieldId: string, newType: AvroSchemaType, recordNamespace?: string) => void;
  onRemoveField: (recordName: string, fieldId: string, recordNamespace?: string) => void;
  onStartLinking?: (fieldId: string, isOriginal: boolean) => void;
  onLinkField?: (targetFieldId: string) => void;
  onUnlink?: (fieldId: string) => void;
  handleCreateField: (recordName: string, recordNamespace?: string) => void;
}

const DroppableRecordCard: React.FC<DroppableRecordCardProps> = ({
  record,
  defaultNamespace,
  availableNamedTypes,
  annotations,
  partnerFieldsMap,
  linkingFieldId,
  selectedFieldId,
  onSelectField,
  addingFieldRecord,
  newFieldName,
  newFieldType,
  setAddingFieldRecord,
  setNewFieldName,
  setNewFieldType,
  onRenameRecord,
  onRemoveRecord,
  onUpdateRecordNamespace,
  onRenameField,
  onUpdateFieldType,
  onRemoveField,
  onStartLinking,
  onLinkField,
  onUnlink,
  handleCreateField,
}) => {
  const [isEditingNs, setIsEditingNs] = useState(false);
  const [nsInput, setNsInput] = useState(record.namespace || defaultNamespace || '');

  React.useEffect(() => {
    setNsInput(record.namespace || defaultNamespace || '');
  }, [record.namespace, defaultNamespace]);

  const handleNsSubmit = () => {
    setIsEditingNs(false);
    if (onUpdateRecordNamespace && nsInput.trim() !== (record.namespace || '')) {
      onUpdateRecordNamespace(record.name, nsInput.trim(), record.namespace);
    } else {
      setNsInput(record.namespace || defaultNamespace || '');
    }
  };

  const recordKey = record.namespace ? `${record.namespace}.${record.name}` : record.name;

  const { setNodeRef, isOver } = useDroppable({
    id: 'drop-rec-' + recordKey,
    data: {
      type: 'record-droppable',
      recordName: record.name,
      recordNamespace: record.namespace,
    },
  });

  const fieldIds = record.fields.map((f) => f.id);
  const fieldStatuses = record.fields.map((field) => displayFieldStatus(annotations?.get(field.id)));
  const changedFieldCount = fieldStatuses.filter((status) => status !== 'identical').length;
  const isRestructured = fieldStatuses.includes('moved') || fieldStatuses.includes('added');

  return (
    <div
      ref={setNodeRef}
      className={`studio-record-card bg-gray-900/90 border rounded-xl overflow-hidden shadow-sm transition ${
        isOver
          ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-gray-900'
          : 'border-gray-800'
      }`}
    >
      {/* Record Header */}
      <div className="studio-record-header bg-gray-800/80 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
        <div className="studio-record-heading flex items-center gap-2">
          <span className="studio-record-kind is-editable">record</span>
          <span className="studio-record-name font-semibold text-sm text-gray-200">{record.name}</span>

          {isRestructured && <span className="studio-restructured-badge">★ NEW RESTRUCTURED</span>}

          {/* Editable record namespace input badge */}
          {isEditingNs ? (
            <input
              type="text"
              placeholder="namespace..."
              value={nsInput}
              onChange={(e) => setNsInput(e.target.value)}
              onBlur={handleNsSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNsSubmit();
                if (e.key === 'Escape') {
                  setNsInput(record.namespace || '');
                  setIsEditingNs(false);
                }
              }}
              autoFocus
              className="bg-gray-900 text-[11px] font-mono text-gray-300 px-1.5 py-0.5 rounded border border-indigo-500 focus:outline-none"
            />
          ) : (
            <button
              onClick={() => setIsEditingNs(true)}
              className="text-[11px] font-mono text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 px-1.5 py-0.5 rounded transition"
              title="Click to edit record namespace"
            >
              {record.namespace || defaultNamespace ? 'ns: ' + (record.namespace || defaultNamespace) : 'add namespace'}
            </button>
          )}

          <span className="text-xs text-gray-500 font-mono">
            ({record.fields.length} {record.fields.length === 1 ? 'field' : 'fields'})
          </span>
          {isOver && (
            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-700 px-1.5 py-0.5 rounded font-medium">
              Drop field here to link
            </span>
          )}
        </div>

        <div className="studio-record-status-and-actions flex items-center gap-2">
          {changedFieldCount > 0
            ? <span className="studio-record-status">MODIFIED ({changedFieldCount})</span>
            : <span className="studio-record-status is-clean">UNMODIFIED</span>}
          <div className="studio-record-actions flex items-center gap-2">
          <button
            onClick={() => {
              const newName = window.prompt('Rename record to:', record.name);
              if (newName && newName.trim() && newName !== record.name) {
                onRenameRecord(record.name, newName.trim(), record.namespace);
              }
            }}
            className="p-1 text-gray-400 hover:text-gray-200 transition"
            title="Rename record"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onRemoveRecord(record.name, record.namespace)}
            className="p-1 text-gray-400 hover:text-rose-400 transition"
            title="Delete record"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          </div>
        </div>
      </div>

      {/* Sortable Field List */}
      <div className="studio-field-list p-3 space-y-2">
        <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
          {record.fields.map((field) => {
            const linkedPartner = partnerFieldsMap?.get(field.id);
            const isLinkingActive = !!linkingFieldId;
            const isSelfLinking = linkingFieldId === field.id;

            const existingFieldNames = record.fields.map((f) => f.name);

            return (
              <SortableField
                key={field.id}
                recordName={record.name}
                field={field}
                diffStatus={annotations?.get(field.id)}
                linkedPartner={linkedPartner}
                isLinkingActive={isLinkingActive}
                isSelfLinking={isSelfLinking}
                isSelected={selectedFieldId === field.id}
                onSelect={() => onSelectField?.(selectedFieldId === field.id ? null : field.id)}
                onRename={(newName) => onRenameField(record.name, field.id, newName, record.namespace)}
                onUpdateType={(newType) =>
                  onUpdateFieldType(record.name, field.id, newType, record.namespace)
                }
                onRemove={() => onRemoveField(record.name, field.id, record.namespace)}
                onStartLinking={onStartLinking ? () => onStartLinking(field.id, false) : undefined}
                onLinkToThis={onLinkField ? () => onLinkField(field.id) : undefined}
                onUnlink={onUnlink && linkedPartner ? () => onUnlink(field.id) : undefined}
                availableNamedTypes={availableNamedTypes}
                existingFieldNames={existingFieldNames}
              />
            );
          })}
        </SortableContext>

        {record.fields.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-600 italic">
            No fields. Drop fields here or click Add Field below.
          </div>
        )}

        {/* Add Field Inline Form */}
        {addingFieldRecord === recordKey ? (
          <div className="relative mt-2">
            <div className="flex items-center gap-2 p-2 bg-gray-800/80 rounded-lg border border-gray-700 text-xs">
              <input
                type="text"
                placeholder="Field name..."
                value={newFieldName}
                onChange={(e) => {
                  setNewFieldName(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateField(record.name, record.namespace);
                  if (e.key === 'Escape') setAddingFieldRecord(null);
                }}
                autoFocus
                className={`bg-gray-900 text-gray-100 font-mono px-2 py-1 rounded border focus:outline-none flex-1 ${
                  record.fields.some((f) => f.name.toLowerCase() === newFieldName.trim().toLowerCase())
                    ? 'border-rose-500 ring-1 ring-rose-500'
                    : 'border-indigo-500'
                }`}
              />
              <select
                value={typeof newFieldType === 'string' ? newFieldType : 'string'}
                onChange={(e) => setNewFieldType(e.target.value as AvroSchemaType)}
                className="bg-gray-900 text-indigo-400 font-mono px-2 py-1 rounded border border-gray-700 focus:outline-none"
              >
                <option value="string">string</option>
                <option value="int">int</option>
                <option value="long">long</option>
                <option value="double">double</option>
                <option value="boolean">boolean</option>
                <option value="bytes">bytes</option>
                {availableNamedTypes.map((nt) => (
                  <option key={nt} value={nt}>
                    {nt}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleCreateField(record.name, record.namespace)}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
              >
                Add
              </button>
              <button
                onClick={() => setAddingFieldRecord(null)}
                className="px-2 py-1 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
            {record.fields.some((f) => f.name.toLowerCase() === newFieldName.trim().toLowerCase()) && (
              <div className="absolute -top-7 left-2 z-20 px-2 py-0.5 text-[10px] font-medium bg-rose-950 text-rose-300 border border-rose-800 rounded shadow-md whitespace-nowrap">
                Field '{newFieldName.trim()}' already exists in record '{record.name}'
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setAddingFieldRecord(recordKey);
              setNewFieldName('');
            }}
            className="w-full py-2 flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-indigo-400 border border-dashed border-gray-800 hover:border-gray-700 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Field</span>
          </button>
        )}
      </div>
    </div>
  );
};

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  protocol,
  workspaceName,
  onRenameWorkspace,
  onUpdateProtocolName,
  onUpdateProtocolNamespace,
  schemaVersion = '1.0.0',
  onUpdateSchemaVersion,
  annotations,
  partnerFieldsMap,
  linkingFieldId,
  selectedFieldId,
  onSelectField,
  onStartLinking,
  onLinkField,
  onUnlink,
  onAddField,
  onRemoveField,
  onRenameField,
  onUpdateFieldType,
  onReorderField: _onReorderField,
  onMoveField: _onMoveField,
  onAddRecord,
  onRemoveRecord,
  onRenameRecord,
  onUpdateRecordNamespace,
  onReset,
}) => {
  const [newRecordName, setNewRecordName] = useState('');
  const [newRecordNamespace, setNewRecordNamespace] = useState('');
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [addingFieldRecord, setAddingFieldRecord] = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<AvroSchemaType>('string');
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [versionInput, setVersionInput] = useState(schemaVersion);
  const [isEditingWsName, setIsEditingWsName] = useState(false);
  const [wsNameInput, setWsNameInput] = useState(workspaceName || '');
  const [isEditingProtocolName, setIsEditingProtocolName] = useState(false);
  const [protocolNameInput, setProtocolNameInput] = useState(protocol?.protocol || '');
  const [isEditingNamespace, setIsEditingNamespace] = useState(false);
  const [namespaceInput, setNamespaceInput] = useState(protocol?.namespace || '');

  React.useEffect(() => {
    setVersionInput(schemaVersion);
  }, [schemaVersion]);

  React.useEffect(() => {
    setWsNameInput(workspaceName || '');
  }, [workspaceName]);

  React.useEffect(() => {
    setProtocolNameInput(protocol?.protocol || '');
    setNamespaceInput(protocol?.namespace || '');
  }, [protocol?.protocol, protocol?.namespace]);

  const bumpVersion = (type: 'major' | 'minor' | 'patch') => {
    const parts = (schemaVersion || '1.0.0').replace(/^v/i, '').split('.').map((part) => parseInt(part, 10) || 0);
    while (parts.length < 3) parts.push(0);
    if (type === 'major') { parts[0] += 1; parts[1] = 0; parts[2] = 0; }
    else if (type === 'minor') { parts[1] += 1; parts[2] = 0; }
    else parts[2] += 1;
    const nextVersion = parts.slice(0, 3).join('.');
    setVersionInput(nextVersion);
    onUpdateSchemaVersion?.(nextVersion);
  };

  const handleVersionSubmit = () => {
    setIsEditingVersion(false);
    if (versionInput.trim() && versionInput !== schemaVersion) onUpdateSchemaVersion?.(versionInput.trim());
    else setVersionInput(schemaVersion);
  };

  const handleWsNameSubmit = () => {
    setIsEditingWsName(false);
    if (wsNameInput.trim() && wsNameInput !== workspaceName) onRenameWorkspace?.(wsNameInput.trim());
    else setWsNameInput(workspaceName || '');
  };

  const handleProtocolNameSubmit = () => {
    setIsEditingProtocolName(false);
    if (protocolNameInput.trim() && protocolNameInput !== protocol?.protocol && onUpdateProtocolName) {
      onUpdateProtocolName(protocolNameInput.trim());
    } else {
      setProtocolNameInput(protocol?.protocol || '');
    }
  };

  const handleNamespaceSubmit = () => {
    setIsEditingNamespace(false);
    if (namespaceInput !== protocol?.namespace && onUpdateProtocolNamespace) {
      onUpdateProtocolNamespace(namespaceInput.trim());
    } else {
      setNamespaceInput(protocol?.namespace || '');
    }
  };

  if (!protocol) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 select-none">
        <Layers className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-base font-medium text-gray-400">No Editable Schema Active</p>
        <p className="text-xs text-gray-600 mt-1">Create a new schema or import to begin editing</p>
      </div>
    );
  }

  // Collect all named types for field type selection
  const availableNamedTypes = protocol.types.map((t) => t.name);

  const handleCreateRecord = () => {
    if (newRecordName.trim()) {
      onAddRecord(newRecordName.trim(), newRecordNamespace.trim() || undefined);
      setNewRecordName('');
      setNewRecordNamespace('');
      setIsAddingRecord(false);
    }
  };

  const handleCreateField = (recordName: string, recordNamespace?: string) => {
    if (newFieldName.trim()) {
      onAddField(recordName, newFieldName.trim(), newFieldType, recordNamespace);
      setNewFieldName('');
      setAddingFieldRecord(null);
    }
  };

  return (
    <div className="studio-schema-editor">
      <div className="studio-editor-heading">
        <div className="studio-editor-title-block">
          <div className="studio-editor-title-line"><h2>Working Copy (Editable)</h2><span className="studio-live-badge">LIVE DRAFT</span>
            {onReset && (
              <button
                onClick={onReset}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-400 hover:text-rose-400 bg-gray-800/80 hover:bg-rose-950/40 border border-gray-700 hover:border-rose-700/60 rounded-md transition shadow-xs ml-2"
                title="Reset all changes back to original (Ctrl+Z to undo)"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
          <div className="studio-editor-contract-meta">
            {isEditingProtocolName ? (
              <input value={protocolNameInput} autoFocus onChange={(event) => setProtocolNameInput(event.target.value)}
                onBlur={handleProtocolNameSubmit} onKeyDown={(event) => {
                  if (event.key === 'Enter') handleProtocolNameSubmit();
                  if (event.key === 'Escape') { setProtocolNameInput(protocol.protocol); setIsEditingProtocolName(false); }
                }} aria-label="Protocol name" />
            ) : <button onClick={() => setIsEditingProtocolName(true)} title="Rename protocol">{protocol.protocol}</button>}
            <span>/</span>
            {isEditingNamespace ? (
              <input value={namespaceInput} autoFocus onChange={(event) => setNamespaceInput(event.target.value)}
                onBlur={handleNamespaceSubmit} onKeyDown={(event) => {
                  if (event.key === 'Enter') handleNamespaceSubmit();
                  if (event.key === 'Escape') { setNamespaceInput(protocol.namespace || ''); setIsEditingNamespace(false); }
                }} aria-label="Protocol namespace" />
            ) : <button onClick={() => setIsEditingNamespace(true)} title="Edit protocol namespace">{protocol.namespace || '(no namespace)'}</button>}
          </div>
        </div>
        {!isAddingRecord ? (
          <button onClick={() => setIsAddingRecord(true)} className="studio-add-record-button"><FolderPlus size={14} /><span>Add Record</span></button>
        ) : (
          <div className="studio-add-record-form">
            <input placeholder="Record name..." value={newRecordName} autoFocus onChange={(event) => setNewRecordName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleCreateRecord(); if (event.key === 'Escape') setIsAddingRecord(false); }} />
            <input placeholder="Namespace..." value={newRecordNamespace} onChange={(event) => setNewRecordNamespace(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleCreateRecord(); if (event.key === 'Escape') setIsAddingRecord(false); }} />
            <button onClick={handleCreateRecord}>Add</button><button onClick={() => setIsAddingRecord(false)}>Cancel</button>
          </div>
        )}
      </div>
      {/* Header / Protocol & Working Copy Controls */}
      <div className="studio-old-editor-controls flex flex-col gap-3 border-b border-gray-800 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 rounded uppercase tracking-wider">
              Working Copy
            </span>

            {/* Editable Workspace Name */}
            {isEditingWsName ? (
              <input
                type="text"
                className="bg-gray-850 text-gray-100 text-sm font-semibold px-2 py-1 rounded border border-indigo-500 focus:outline-none"
                value={wsNameInput}
                onChange={(e) => setWsNameInput(e.target.value)}
                onBlur={handleWsNameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleWsNameSubmit();
                  if (e.key === 'Escape') {
                    setWsNameInput(workspaceName || '');
                    setIsEditingWsName(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsEditingWsName(true)}
                className="text-base font-bold text-gray-100 hover:text-indigo-400 px-1.5 py-0.5 rounded hover:bg-gray-800/60 transition"
                title="Click to rename workspace"
              >
                {workspaceName || 'Untitled Workspace'}
              </button>
            )}

            <span className="text-gray-600">/</span>
            {isEditingProtocolName ? (
              <input
                type="text"
                className="bg-gray-850 text-indigo-300 text-sm font-mono font-semibold px-2 py-0.5 rounded border border-indigo-500 focus:outline-none"
                value={protocolNameInput}
                onChange={(e) => setProtocolNameInput(e.target.value)}
                onBlur={handleProtocolNameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleProtocolNameSubmit();
                  if (e.key === 'Escape') {
                    setProtocolNameInput(protocol.protocol);
                    setIsEditingProtocolName(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsEditingProtocolName(true)}
                className="text-sm font-mono text-gray-300 hover:text-white px-1 py-0.5 rounded hover:bg-gray-800/60 transition"
                title="Click to rename protocol"
              >
                {protocol.protocol}
              </button>
            )}

            {/* Editable Protocol Namespace */}
            <span className="text-gray-600">@</span>
            {isEditingNamespace ? (
              <input
                type="text"
                placeholder="namespace..."
                className="bg-gray-850 text-gray-300 text-xs font-mono px-2 py-0.5 rounded border border-gray-600 focus:outline-none w-44"
                value={namespaceInput}
                onChange={(e) => setNamespaceInput(e.target.value)}
                onBlur={handleNamespaceSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNamespaceSubmit();
                  if (e.key === 'Escape') {
                    setNamespaceInput(protocol.namespace || '');
                    setIsEditingNamespace(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsEditingNamespace(true)}
                className="text-xs font-mono text-gray-400 hover:text-gray-200 px-1 py-0.5 rounded hover:bg-gray-800/60 transition"
                title="Click to edit protocol namespace"
              >
                {protocol.namespace || '(no namespace)'}
              </button>
            )}
          </div>

          {/* Add Record button */}
          {!isAddingRecord ? (
            <button
              onClick={() => setIsAddingRecord(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/80 rounded-lg transition"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Add Record</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Record name..."
                value={newRecordName}
                onChange={(e) => setNewRecordName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateRecord();
                  if (e.key === 'Escape') setIsAddingRecord(false);
                }}
                autoFocus
                className="bg-gray-800 text-xs px-2.5 py-1 rounded border border-emerald-500 text-gray-100 focus:outline-none"
              />
              <input
                type="text"
                placeholder="namespace (optional)..."
                value={newRecordNamespace}
                onChange={(e) => setNewRecordNamespace(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateRecord();
                  if (e.key === 'Escape') setIsAddingRecord(false);
                }}
                className="bg-gray-800 text-xs px-2.5 py-1 rounded border border-gray-700 font-mono text-gray-300 focus:outline-none w-36"
              />
              <button
                onClick={handleCreateRecord}
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs"
              >
                Add
              </button>
              <button
                onClick={() => setIsAddingRecord(false)}
                className="px-2 py-1 bg-gray-800 text-gray-400 hover:text-white rounded text-xs"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Major / Minor / Patch Version Incrementor Controls */}
        <div className="flex items-center gap-2 bg-gray-900/60 px-3 py-1.5 rounded-lg border border-gray-800/80 w-fit">
          <Tag className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs text-gray-400 font-medium select-none">Schema Version:</span>

          {isEditingVersion ? (
            <input
              type="text"
              value={versionInput}
              onChange={(e) => setVersionInput(e.target.value)}
              onBlur={handleVersionSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVersionSubmit();
                if (e.key === 'Escape') {
                  setVersionInput(schemaVersion);
                  setIsEditingVersion(false);
                }
              }}
              autoFocus
              className="w-16 bg-gray-800 text-white font-mono text-xs px-1.5 py-0.5 rounded border border-indigo-500 focus:outline-none text-center"
            />
          ) : (
            <button
              onClick={() => setIsEditingVersion(true)}
              className="text-xs font-mono font-bold text-indigo-300 hover:text-white bg-indigo-950/60 border border-indigo-800/80 px-2 py-0.5 rounded transition"
              title="Click to edit version directly"
            >
              v{schemaVersion}
            </button>
          )}

          <div className="h-3.5 w-px bg-gray-800 mx-1" />

          {/* Quick Increment buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => bumpVersion('patch')}
              className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition"
              title="Bump patch (+0.0.1)"
            >
              +patch
            </button>
            <button
              onClick={() => bumpVersion('minor')}
              className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition"
              title="Bump minor (+0.1.0)"
            >
              +minor
            </button>
            <button
              onClick={() => bumpVersion('major')}
              className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition"
              title="Bump major (+1.0.0)"
            >
              +major
            </button>
          </div>
        </div>
      </div>

      {/* Record list with droppable cards */}
      <div className="studio-record-list">
        {protocol.types.map((typeDef) => {
          if (!isRecordType(typeDef)) return null;
          const record = typeDef as AvroRecordType;
          const recordKey = record.namespace ? `${record.namespace}.${record.name}` : record.name;

          return (
            <DroppableRecordCard
              key={recordKey}
              record={record}
              defaultNamespace={protocol.namespace}
              availableNamedTypes={availableNamedTypes}
              annotations={annotations}
              partnerFieldsMap={partnerFieldsMap}
              linkingFieldId={linkingFieldId}
              selectedFieldId={selectedFieldId}
              onSelectField={onSelectField}
              addingFieldRecord={addingFieldRecord}
              newFieldName={newFieldName}
              newFieldType={newFieldType}
              setAddingFieldRecord={setAddingFieldRecord}
              setNewFieldName={setNewFieldName}
              setNewFieldType={setNewFieldType}
              onRenameRecord={onRenameRecord}
              onRemoveRecord={onRemoveRecord}
              onUpdateRecordNamespace={onUpdateRecordNamespace}
              onRenameField={onRenameField}
              onUpdateFieldType={onUpdateFieldType}
              onRemoveField={onRemoveField}
              onStartLinking={onStartLinking}
              onLinkField={onLinkField}
              onUnlink={onUnlink}
              handleCreateField={handleCreateField}
            />
          );
        })}
      </div>
    </div>
  );
};

