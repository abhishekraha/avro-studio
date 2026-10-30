import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Edit2, Check, X, Link as LinkIcon, X as XIcon } from 'lucide-react';
import type { AvroField, AvroSchemaType, PrimitiveType } from '../../../core/types/schema';
import type { LinkType } from '../../../core/types/linkage';
import { PRIMITIVE_TYPES } from '../../../core/types/schema';
import { formatAvdlType } from '../../../core/serializer/avdlSerializer';
import type { LinkedPartnerInfo } from '../SchemaViewer';

export interface SortableFieldProps {
  recordName: string;
  field: AvroField;
  diffStatus?: LinkType | 'unchanged';
  linkedPartner?: LinkedPartnerInfo;
  isLinkingActive?: boolean;
  isSelfLinking?: boolean;
  onRename: (newName: string) => void;
  onUpdateType: (newType: AvroSchemaType) => void;
  onRemove: () => void;
  onStartLinking?: () => void;
  onLinkToThis?: () => void;
  onUnlink?: () => void;
  availableNamedTypes: string[];
  existingFieldNames?: string[];
}

export const SortableField: React.FC<SortableFieldProps> = ({
  recordName: _recordName,
  field,
  diffStatus,
  linkedPartner,
  isLinkingActive,
  isSelfLinking,
  onRename,
  onUpdateType,
  onRemove,
  onStartLinking,
  onLinkToThis,
  onUnlink,
  availableNamedTypes,
  existingFieldNames = [],
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(field.name);
  const [renameError, setRenameError] = useState<string | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isDuplicate = existingFieldNames.some(
    (n) => n.toLowerCase() === nameValue.trim().toLowerCase() && n.toLowerCase() !== field.name.toLowerCase()
  );

  const handleNameSave = () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameValue(field.name);
      setRenameError(null);
      setIsEditingName(false);
      return;
    }

    if (isDuplicate) {
      setRenameError(`Duplicate field name '${trimmed}'`);
      return;
    }

    try {
      if (trimmed !== field.name) {
        onRename(trimmed);
      }
      setRenameError(null);
      setIsEditingName(false);
    } catch (err: any) {
      setRenameError(err.message || 'Duplicate field name');
    }
  };

  const currentTypeString = formatAvdlType(field.type);

  const renderBadge = () => {
    switch (diffStatus) {
      case 'added':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
            added
          </span>
        );
      case 'moved':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-sky-950 text-sky-400 border border-sky-800">
            moved-in
          </span>
        );
      case 'moved-renamed':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-purple-950 text-purple-400 border border-purple-800">
            moved-renamed
          </span>
        );
      case 'type-changed':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-amber-950 text-amber-400 border border-amber-800">
            type-changed
          </span>
        );
      case 'renamed':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
            renamed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      id={`field-edit-${field.id}`}
      style={style}
      className={`group px-3 py-2 flex items-center justify-between text-xs bg-gray-900 border border-gray-800/80 rounded-lg hover:border-gray-700 transition shadow-sm ${
        isDragging ? 'shadow-lg border-indigo-500' : ''
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-gray-500 hover:text-gray-300 rounded"
          title="Drag to reorder or move across records"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {/* Stable synthetic ID pill */}
        <span className="text-[10px] text-gray-500 font-mono select-none px-1 py-0.5 bg-gray-800/60 rounded">
          {field.id}
        </span>

        {/* Field name (in-place editable) */}
        {isEditingName ? (
          <div className="flex items-center gap-1 relative">
            <input
              type="text"
              value={nameValue}
              onChange={(e) => {
                setNameValue(e.target.value);
                setRenameError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') {
                  setNameValue(field.name);
                  setRenameError(null);
                  setIsEditingName(false);
                }
              }}
              autoFocus
              className={`bg-gray-800 text-gray-100 font-mono text-xs px-2 py-0.5 rounded border focus:outline-none ${
                isDuplicate || renameError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-indigo-500'
              }`}
            />
            {/* Tooltip / error banner */}
            {(isDuplicate || renameError) && (
              <span className="absolute -top-7 left-0 z-20 px-2 py-0.5 text-[10px] font-medium bg-rose-950 text-rose-300 border border-rose-800 rounded shadow-md whitespace-nowrap">
                {renameError || `Field '${nameValue.trim()}' already exists in record`}
              </span>
            )}
            <button
              onClick={handleNameSave}
              className="p-1 hover:text-emerald-400 text-gray-400"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setNameValue(field.name);
                setRenameError(null);
                setIsEditingName(false);
              }}
              className="p-1 hover:text-rose-400 text-gray-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group/name">
            <span className="font-mono font-medium text-gray-200">{field.name}</span>
            <button
              onClick={() => setIsEditingName(true)}
              className="opacity-0 group-hover/name:opacity-100 p-0.5 text-gray-500 hover:text-gray-300 transition"
              title="Rename field"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* In-place Type selector */}
        <select
          value={currentTypeString}
          onChange={(e) => onUpdateType(e.target.value as PrimitiveType)}
          className="bg-gray-800 text-indigo-400 font-mono text-[11px] px-2 py-0.5 rounded border border-gray-700 hover:border-gray-600 focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <optgroup label="Primitives">
            {PRIMITIVE_TYPES.map((pt) => (
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </optgroup>
          {availableNamedTypes.length > 0 && (
            <optgroup label="Named Types">
              {availableNamedTypes.map((nt) => (
                <option key={nt} value={nt}>
                  {nt}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        {/* Link / Unlink Controls */}
        {linkedPartner ? (
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
              title="Link to original field"
            >
              Link
            </button>
          )
        )}

        {/* Diff badge */}
        {renderBadge()}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={onRemove}
          className="p-1 hover:bg-rose-950/60 hover:text-rose-400 text-gray-500 rounded transition"
          title="Delete field"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

