import React from 'react';
import type { AvroProtocol, AvroRecordType, AvroField } from '../../../core/types/schema';
import type { LinkType } from '../../../core/types/linkage';
import { isRecordType } from '../../../core/types/schema';
import { formatAvdlType } from '../../../core/serializer/avdlSerializer';
import { BookOpen, FileText } from 'lucide-react';

export interface SchemaViewerProps {
  protocol: AvroProtocol | null;
  annotations?: Map<string, LinkType | 'unchanged'>;
}

export const SchemaViewer: React.FC<SchemaViewerProps> = ({ protocol, annotations }) => {
  if (!protocol || protocol.types.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 select-none">
        <BookOpen className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-base font-medium text-gray-400">No Original Schema Loaded</p>
        <p className="text-xs text-gray-600 mt-1">Import a schema or protocol to see the baseline</p>
      </div>
    );
  }

  const renderBadge = (diffStatus?: LinkType | 'unchanged') => {
    switch (diffStatus) {
      case 'deleted':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-rose-950 text-rose-400 border border-rose-800">
            deleted
          </span>
        );
      case 'moved':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-sky-950 text-sky-400 border border-sky-800">
            moved-out
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
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded text-gray-500">
            unchanged
          </span>
        );
    }
  };

  const getRowDiffStyle = (diffStatus?: LinkType | 'unchanged') => {
    switch (diffStatus) {
      case 'deleted':
        return 'bg-rose-950/20 border-l-2 border-l-rose-500 line-through opacity-75';
      case 'moved':
      case 'moved-renamed':
        return 'bg-sky-950/20 border-l-2 border-l-sky-500';
      case 'type-changed':
        return 'bg-amber-950/20 border-l-2 border-l-amber-500';
      case 'renamed':
        return 'bg-indigo-950/20 border-l-2 border-l-indigo-500';
      default:
        return 'border-l-2 border-l-transparent';
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6">
      {/* Protocol Header */}
      <div className="border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono uppercase tracking-wider">
          <span>Protocol</span>
        </div>
        <h2 className="text-lg font-bold text-gray-100">{protocol.protocol}</h2>
        {protocol.namespace && (
          <p className="text-xs text-gray-400 font-mono mt-0.5">{protocol.namespace}</p>
        )}
        {protocol.doc && <p className="text-xs text-gray-400 mt-2 italic">{protocol.doc}</p>}
      </div>

      {/* Record list */}
      <div className="space-y-6">
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

          return (
            <div
              key={record.name}
              className="bg-gray-900/90 border border-gray-800 rounded-xl overflow-hidden shadow-sm"
            >
              {/* Record Banner */}
              <div className="bg-gray-800/80 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-sm text-gray-200">{record.name}</span>
                  <span className="text-xs text-gray-500 font-mono">
                    ({record.fields.length} {record.fields.length === 1 ? 'field' : 'fields'})
                  </span>
                </div>
                {record.namespace && (
                  <span className="text-[11px] text-gray-500 font-mono">{record.namespace}</span>
                )}
              </div>

              {/* Fields Table */}
              <div className="divide-y divide-gray-800/60">
                {record.fields.map((field: AvroField) => {
                  const diffStatus = annotations?.get(field.id);
                  return (
                    <div
                      key={field.id}
                      className={`px-4 py-2 flex items-center justify-between text-xs transition-colors hover:bg-gray-800/40 ${getRowDiffStyle(
                        diffStatus
                      )}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-600 font-mono select-none">
                          {field.id}
                        </span>
                        <span className="font-medium text-gray-200 font-mono">{field.name}</span>
                        <span className="text-indigo-400 font-mono text-[11px]">
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

                      <div>{renderBadge(diffStatus)}</div>
                    </div>
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
