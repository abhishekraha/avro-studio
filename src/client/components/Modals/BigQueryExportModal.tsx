import React, { useState } from 'react';
import type { AvroProtocol } from '../../../core/types/schema';
import { generateBqSchema } from '../../../core/utils/bqSchemaGenerator';
import { X, Copy, Check, Download, Database } from 'lucide-react';

export interface BigQueryExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  protocol: AvroProtocol | null;
}

export const BigQueryExportModal: React.FC<BigQueryExportModalProps> = ({
  isOpen,
  onClose,
  protocol,
}) => {
  const [mode, setMode] = useState<'standard' | 'legacy'>('standard');
  const [includeIngestionTime, setIncludeIngestionTime] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !protocol) return null;

  const bqFields = generateBqSchema(protocol, undefined, {
    mode,
    includeIngestionTime,
  });

  const jsonText = JSON.stringify(bqFields, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${protocol.protocol || 'schema'}-bigquery.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-amber-950/60 text-amber-400 border border-amber-800/60">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-100">BigQuery Schema Generator</h3>
              <p className="text-xs text-gray-400">
                Generate standard RECORDs or legacy flattened columns
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Configuration Controls */}
        <div className="px-5 py-3 bg-gray-950 border-b border-gray-800 flex flex-wrap items-center gap-6 text-xs">
          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">Layout Mode:</span>
            <div className="inline-flex rounded-lg border border-gray-800 bg-gray-900 p-0.5">
              <button
                onClick={() => setMode('standard')}
                className={`px-3 py-1 rounded-md transition font-medium ${
                  mode === 'standard'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Standard (Nested)
              </button>
              <button
                onClick={() => setMode('legacy')}
                className={`px-3 py-1 rounded-md transition font-medium ${
                  mode === 'legacy'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Legacy Flattened
              </button>
            </div>
          </div>

          {/* Ingestion time checkbox */}
          <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeIngestionTime}
              onChange={(e) => setIncludeIngestionTime(e.target.checked)}
              className="rounded border-gray-700 bg-gray-800 text-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Include bqIngestionTime column</span>
          </label>
        </div>

        {/* Code Preview */}
        <div className="flex-1 p-5 overflow-y-auto font-mono text-xs text-gray-300 bg-gray-950">
          <pre className="whitespace-pre">{jsonText}</pre>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-gray-800 bg-gray-900 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {bqFields.length} {bqFields.length === 1 ? 'column' : 'columns'} generated
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Schema</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
