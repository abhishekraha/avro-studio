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
import { Plus, Trash2, Edit3, FolderPlus, Layers } from 'lucide-react';

export interface SchemaEditorProps {
  protocol: AvroProtocol | null;
  annotations?: Map<string, LinkType | 'unchanged'>;
  partnerFieldsMap?: Map<string, LinkedPartnerInfo>; // editedFieldId -> orig partner info
  linkingFieldId?: string | null;
  onStartLinking?: (fieldId: string, isOriginal: boolean) => void;
  onLinkField?: (targetFieldId: string) => void;
  onUnlink?: (fieldId: string) => void;
  onAddField: (recordName: string, name: string, type: AvroSchemaType) => void;
  onRemoveField: (recordName: string, fieldId: string) => void;
  onRenameField: (recordName: string, fieldId: string, newName: string) => void;
  onUpdateFieldType: (recordName: string, fieldId: string, newType: AvroSchemaType) => void;
  onReorderField: (recordName: string, oldIndex: number, newIndex: number) => void;
  onMoveField: (sourceRecord: string, targetRecord: string, fieldId: string, targetIndex?: number) => void;
  onAddRecord: (name: string) => void;
  onRemoveRecord: (name: string) => void;
  onRenameRecord: (oldName: string, newName: string) => void;
}

interface DroppableRecordCardProps {
  record: AvroRecordType;
  availableNamedTypes: string[];
  annotations?: Map<string, LinkType | 'unchanged'>;
  partnerFieldsMap?: Map<string, LinkedPartnerInfo>;
  linkingFieldId?: string | null;
  addingFieldRecord: string | null;
  newFieldName: string;
  newFieldType: AvroSchemaType;
  setAddingFieldRecord: (rec: string | null) => void;
  setNewFieldName: (name: string) => void;
  setNewFieldType: (type: AvroSchemaType) => void;
  onRenameRecord: (oldName: string, newName: string) => void;
  onRemoveRecord: (name: string) => void;
  onRenameField: (recordName: string, fieldId: string, newName: string) => void;
  onUpdateFieldType: (recordName: string, fieldId: string, newType: AvroSchemaType) => void;
  onRemoveField: (recordName: string, fieldId: string) => void;
  onStartLinking?: (fieldId: string, isOriginal: boolean) => void;
  onLinkField?: (targetFieldId: string) => void;
  onUnlink?: (fieldId: string) => void;
  handleCreateField: (recordName: string) => void;
}

const DroppableRecordCard: React.FC<DroppableRecordCardProps> = ({
  record,
  availableNamedTypes,
  annotations,
  partnerFieldsMap,
  linkingFieldId,
  addingFieldRecord,
  newFieldName,
  newFieldType,
  setAddingFieldRecord,
  setNewFieldName,
  setNewFieldType,
  onRenameRecord,
  onRemoveRecord,
  onRenameField,
  onUpdateFieldType,
  onRemoveField,
  onStartLinking,
  onLinkField,
  onUnlink,
  handleCreateField,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'drop-rec-' + record.name,
    data: {
      type: 'record-droppable',
      recordName: record.name,
    },
  });

  const fieldIds = record.fields.map((f) => f.id);

  return (
    <div
      ref={setNodeRef}
      className={`bg-gray-900/90 border rounded-xl overflow-hidden shadow-sm transition ${
        isOver
          ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-gray-900'
          : 'border-gray-800'
      }`}
    >
      {/* Record Header */}
      <div className="bg-gray-800/80 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-200">{record.name}</span>
          <span className="text-xs text-gray-500 font-mono">
            ({record.fields.length} {record.fields.length === 1 ? 'field' : 'fields'})
          </span>
          {isOver && (
            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-700 px-1.5 py-0.5 rounded font-medium">
              Drop field here to link
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const newName = window.prompt('Rename record to:', record.name);
              if (newName && newName.trim() && newName !== record.name) {
                onRenameRecord(record.name, newName.trim());
              }
            }}
            className="p-1 text-gray-400 hover:text-gray-200 transition"
            title="Rename record"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onRemoveRecord(record.name)}
            className="p-1 text-gray-400 hover:text-rose-400 transition"
            title="Delete record"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sortable Field List */}
      <div className="p-3 space-y-2">
        <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
          {record.fields.map((field) => {
            const linkedPartner = partnerFieldsMap?.get(field.id);
            const isLinkingActive = !!linkingFieldId;
            const isSelfLinking = linkingFieldId === field.id;

            return (
              <SortableField
                key={field.id}
                recordName={record.name}
                field={field}
                diffStatus={annotations?.get(field.id)}
                linkedPartner={linkedPartner}
                isLinkingActive={isLinkingActive}
                isSelfLinking={isSelfLinking}
                onRename={(newName) => onRenameField(record.name, field.id, newName)}
                onUpdateType={(newType) =>
                  onUpdateFieldType(record.name, field.id, newType)
                }
                onRemove={() => onRemoveField(record.name, field.id)}
                onStartLinking={onStartLinking ? () => onStartLinking(field.id, false) : undefined}
                onLinkToThis={onLinkField ? () => onLinkField(field.id) : undefined}
                onUnlink={onUnlink && linkedPartner ? () => onUnlink(field.id) : undefined}
                availableNamedTypes={availableNamedTypes}
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
        {addingFieldRecord === record.name ? (
          <div className="flex items-center gap-2 p-2 bg-gray-800/80 rounded-lg border border-gray-700 text-xs mt-2">
            <input
              type="text"
              placeholder="Field name..."
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateField(record.name);
                if (e.key === 'Escape') setAddingFieldRecord(null);
              }}
              autoFocus
              className="bg-gray-900 text-gray-100 font-mono px-2 py-1 rounded border border-indigo-500 focus:outline-none flex-1"
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
              onClick={() => handleCreateField(record.name)}
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
        ) : (
          <button
            onClick={() => {
              setAddingFieldRecord(record.name);
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
  annotations,
  partnerFieldsMap,
  linkingFieldId,
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
}) => {
  const [newRecordName, setNewRecordName] = useState('');
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [addingFieldRecord, setAddingFieldRecord] = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<AvroSchemaType>('string');

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
      onAddRecord(newRecordName.trim());
      setNewRecordName('');
      setIsAddingRecord(false);
    }
  };

  const handleCreateField = (recordName: string) => {
    if (newFieldName.trim()) {
      onAddField(recordName, newFieldName.trim(), newFieldType);
      setNewFieldName('');
      setAddingFieldRecord(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6">
      {/* Header / Protocol Info */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono uppercase tracking-wider">
            <span>Working Copy</span>
          </div>
          <h2 className="text-lg font-bold text-gray-100">{protocol.protocol}</h2>
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

      {/* Record list with droppable cards */}
      <div className="space-y-6">
        {protocol.types.map((typeDef) => {
          if (!isRecordType(typeDef)) return null;
          const record = typeDef as AvroRecordType;

          return (
            <DroppableRecordCard
              key={record.name}
              record={record}
              availableNamedTypes={availableNamedTypes}
              annotations={annotations}
              partnerFieldsMap={partnerFieldsMap}
              linkingFieldId={linkingFieldId}
              addingFieldRecord={addingFieldRecord}
              newFieldName={newFieldName}
              newFieldType={newFieldType}
              setAddingFieldRecord={setAddingFieldRecord}
              setNewFieldName={setNewFieldName}
              setNewFieldType={setNewFieldType}
              onRenameRecord={onRenameRecord}
              onRemoveRecord={onRemoveRecord}
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

