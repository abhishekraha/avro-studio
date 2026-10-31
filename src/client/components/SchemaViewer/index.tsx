import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { AvroProtocol, AvroRecordType, AvroField } from '../../../core/types/schema';
import type { LinkType } from '../../../core/types/linkage';
import { isRecordType } from '../../../core/types/schema';
import { formatAvdlType } from '../../../core/serializer/avdlSerializer';
import { BookOpen, GripVertical, Link as LinkIcon, X as XIcon, Copy, Link2 } from 'lucide-react';
import { displayFieldStatus, fieldStatusLabel } from '../fieldStatus';

export interface LinkedPartnerInfo {
  fieldId: string;
  fieldName: string;
  recordName: string;
}

export interface SchemaViewerProps {
  protocol: AvroProtocol | null;
  annotations?: Map<string, LinkType | 'unchanged'>;
  manualLinks?: Array<[string, string]>;
  recordLinks?: Array<[string, string]>;
  partnerFieldsMap?: Map<string, LinkedPartnerInfo>; // origFieldId -> edited partner info
  availableEditedRecordNames?: string[];
  linkingFieldId?: string | null;
  selectedFieldId?: string | null;
  onSelectField?: (fieldId: string | null) => void;
  onStartLinking?: (fieldId: string, isOriginal: boolean) => void;
  onLinkField?: (targetFieldId: string) => void;
  onUnlink?: (fieldId: string) => void;
  onCopyRecord?: (record: AvroRecordType) => void;
  onLinkRecord?: (originalRecordName: string, editedRecordName: string) => void;
  onUnlinkRecord?: (originalRecordName: string) => void;
}

interface DraggableFieldRowProps {
  recordName: string;
  field: AvroField;
  diffStatus?: LinkType | 'unchanged';
  linkedPartner?: LinkedPartnerInfo;
  isLinkingActive?: boolean;
  isSelfLinking?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onStartLinking?: () => void;
  onLinkToThis?: () => void;
  onUnlink?: () => void;
}

const DraggableFieldRow: React.FC<DraggableFieldRowProps> = ({
  recordName,
  field,
  diffStatus,
  linkedPartner,
  isLinkingActive,
  isSelfLinking,
  isSelected,
  onSelect,
  onStartLinking,
  onLinkToThis,
  onUnlink,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'orig-' + field.id,
    data: {
      source: 'original',
      field,
      recordName,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.4 : 1,
      }
    : undefined;

  const displayStatus = displayFieldStatus(diffStatus);

  return (
    <div
      ref={setNodeRef}
      id={`field-orig-${field.id}`}
      style={style}
      onClick={onSelect}
      data-status={displayStatus}
      className={`studio-field-row group px-3 py-2 flex items-center justify-between text-xs transition-all cursor-pointer hover:bg-gray-800/40 ${isDragging ? 'shadow-lg border-indigo-500 bg-gray-900/90' : ''} ${
        isSelected ? 'bg-indigo-950/40 ring-1 ring-cyan-400 shadow-md' : ''
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Drag Handle */}
        <span className="studio-field-dot" aria-hidden="true" />

        <span className="studio-field-id text-[10px] text-gray-600 font-mono select-none px-1 py-0.2 rounded bg-gray-800/40">
          {field.id}
        </span>
        <span className="studio-field-name font-medium text-gray-200 font-mono">{field.name}</span>
        <span className="studio-field-type text-indigo-400 font-mono text-[11px]">
          {formatAvdlType(field.type)}
        </span>
        {field.default !== undefined && (
          <span className="text-gray-500 text-[11px] font-mono">
            = {JSON.stringify(field.default)}
          </span>
        )}
        {field.doc && (
          <span className="text-gray-500 truncate max-w-xs text-[11px] italic">
            // {field.doc}
          </span>
        )}
      </div>

      <div className="studio-field-links flex items-center gap-2 shrink-0">
        {/* Link / Unlink Controls */}
        {displayStatus === 'moved' && linkedPartner ? (
          <span className="studio-move-destination">✦ MOVES TO {linkedPartner.recordName.toUpperCase()}</span>
        ) : linkedPartner ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-xs">
            <LinkIcon className="w-2.5 h-2.5" />
            <span className="max-w-[80px] truncate" title={`Linked to ${linkedPartner.recordName}.${linkedPartner.fieldName}`}>
              {linkedPartner.fieldName}
            </span>
            {onUnlink && (
              <button
                type="button"
                onClick={onUnlink}
                className="hover:text-emerald-100 hover:bg-emerald-900/50 rounded p-0.5 transition ml-0.5"
                title="Unlink field"
                aria-label="Unlink field"
              >
                <XIcon className="w-2.5 h-2.5" />
              </button>
            )}
          </span>
        ) : isLinkingActive ? (
          <button
            type="button"
            onClick={onLinkToThis}
            disabled={isSelfLinking}
            className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition ${
              isSelfLinking
                ? 'bg-indigo-900 text-indigo-300 ring-1 ring-indigo-500 animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
            }`}
          >
            {isSelfLinking ? 'Linking...' : 'Pair'}
          </button>
        ) : (
          onStartLinking && (
            <button
              type="button"
              onClick={onStartLinking}
              className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-emerald-400 border border-gray-700 hover:border-emerald-600 rounded transition"
              title="Link to edited field"
            >
              Link
            </button>
          )
        )}

        {displayStatus !== 'identical' && (
          <span className="studio-status-badge">{displayStatus === 'moved' ? 'MOVED' : fieldStatusLabel(diffStatus)}</span>
        )}
      </div>
    </div>
  );
};

export const SchemaViewer: React.FC<SchemaViewerProps> = ({
  protocol,
  annotations,
  recordLinks = [],
  partnerFieldsMap,
  availableEditedRecordNames = [],
  linkingFieldId,
  selectedFieldId,
  onSelectField,
  onStartLinking,
  onLinkField,
  onUnlink,
  onCopyRecord,
  onLinkRecord,
  onUnlinkRecord,
}) => {
  const [linkingRecordName, setLinkingRecordName] = useState<string | null>(null);

  // Map of originalRecordName -> editedRecordName from recordLinks
  const origToEditedRecMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const [editedRec, origRec] of recordLinks) {
      map.set(origRec, editedRec);
    }
    return map;
  }, [recordLinks]);
  if (!protocol || protocol.types.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 select-none">
        <BookOpen className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-base font-medium text-gray-400">No Original Schema Loaded</p>
        <p className="text-xs text-gray-600 mt-1">Import a schema or protocol to see the baseline</p>
      </div>
    );
  }

  return (
    <div className="studio-schema-viewer flex flex-col h-full overflow-y-auto">
      <div className="studio-record-list">
        {protocol.types.map((typeDef) => {
          if (!isRecordType(typeDef)) {
            return (
              <div
                key={typeDef.name}
                className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs text-gray-400"
              >
                <div className="font-semibold text-gray-300 font-mono">
                  {typeDef.type} {typeDef.name}
                </div>
              </div>
            );
          }

          const record = typeDef as AvroRecordType;
          const linkedEditedRecordName = origToEditedRecMap.get(record.name);

          return (
            <div
              key={record.name}
              className="studio-record-card bg-gray-900/90 border border-gray-800 rounded-xl overflow-hidden shadow-sm"
            >
              {/* Record Banner */}
              <div className="studio-record-header bg-gray-800/80 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between gap-2">
                <div className="studio-record-heading flex items-center gap-2 min-w-0">
                  <span className="studio-record-kind">record</span>
                  <span className="studio-record-name font-semibold text-sm text-gray-200 truncate">{record.name}</span>
                  <span className="studio-record-count text-xs text-gray-500 font-mono shrink-0">
                    ({record.fields.length} {record.fields.length === 1 ? 'field' : 'fields'})
                  </span>
                  {(record.namespace || protocol.namespace) && (
                    <span className="studio-record-namespace text-[11px] text-gray-500 font-mono truncate hidden sm:inline">
                      ns: {record.namespace || protocol.namespace}
                    </span>
                  )}
                </div>

                {/* Record Linking & Copy Controls */}
                <div className="studio-record-actions flex items-center gap-2 shrink-0">
                  {/* Record Link Status Pill / Link selector */}
                  {linkedEditedRecordName ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-indigo-950/90 text-indigo-300 border border-indigo-700/60 shadow-xs">
                      <Link2 className="w-3 h-3 text-indigo-400" />
                      <span className="max-w-[100px] truncate" title={`Linked to editor record: ${linkedEditedRecordName}`}>
                        {'linked to ' + linkedEditedRecordName}
                      </span>
                      {onUnlinkRecord && (
                        <button
                          type="button"
                          onClick={() => onUnlinkRecord(record.name)}
                          className="hover:text-indigo-100 hover:bg-indigo-900/50 rounded p-0.5 transition ml-0.5"
                          title="Unlink record"
                          aria-label="Unlink record"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ) : linkingRecordName === record.name ? (
                    <div className="flex items-center gap-1 bg-gray-900 px-2 py-0.5 rounded border border-indigo-500 text-xs">
                      <select
                        autoFocus
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && onLinkRecord) {
                            onLinkRecord(record.name, val);
                          }
                          setLinkingRecordName(null);
                        }}
                        className="bg-transparent text-indigo-300 text-xs focus:outline-none cursor-pointer"
                      >
                        <option value="" disabled>Select target record...</option>
                        {availableEditedRecordNames.map((target) => (
                          <option key={target} value={target} className="bg-gray-900 text-gray-100">
                            {target}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setLinkingRecordName(null)}
                        className="text-gray-400 hover:text-rose-400 p-0.5"
                        title="Cancel linking"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    onLinkRecord && availableEditedRecordNames.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setLinkingRecordName(record.name)}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-300 hover:text-indigo-300 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 rounded-md transition shadow-xs"
                        title="Link record to a renamed counterpart in editor"
                      >
                        <Link2 className="w-3 h-3 text-gray-400" />
                        <span>Link Record</span>
                      </button>
                    )
                  )}

                  {/* Copy Record to Editor Button */}
                  {onCopyRecord && (
                    <button
                      type="button"
                      onClick={() => onCopyRecord(record)}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/60 rounded-md transition shadow-xs"
                      title="Copy entire record to editor and bind field linkages"
                    >
                      <Copy className="w-3 h-3 text-emerald-400" />
                      <span>Copy Record to Editor</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Fields Table */}
              <div className="studio-field-list divide-y divide-gray-800/60">
                {record.fields.map((field: AvroField) => {
                  const diffStatus = annotations?.get(field.id);
                  const linkedPartner = partnerFieldsMap?.get(field.id);
                  const isLinkingActive = !!linkingFieldId;
                  const isSelfLinking = linkingFieldId === field.id;

                  return (
                    <DraggableFieldRow
                      key={field.id}
                      recordName={record.name}
                      field={field}
                      diffStatus={diffStatus}
                      linkedPartner={linkedPartner}
                      isLinkingActive={isLinkingActive}
                      isSelfLinking={isSelfLinking}
                      isSelected={selectedFieldId === field.id}
                      onSelect={() => onSelectField?.(selectedFieldId === field.id ? null : field.id)}
                      onStartLinking={onStartLinking ? () => onStartLinking(field.id, true) : undefined}
                      onLinkToThis={onLinkField ? () => onLinkField(field.id) : undefined}
                      onUnlink={onUnlink && linkedPartner ? () => onUnlink(field.id) : undefined}
                    />
                  );
                })}

                {record.fields.length === 0 && (
                  <div className="px-4 py-3 text-xs text-gray-600 italic text-center">
                    No fields in this record
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
