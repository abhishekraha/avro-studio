import React, { useState } from 'react';
import type { AvroProtocol } from '../../../core/types/schema';
import { buildLinkageExport } from '../../../core/utils/exportLinkages';
import { X, Copy, Check, Download, GitBranch } from 'lucide-react';

export interface LinkagesExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  original: AvroProtocol | null;
  edited: AvroProtocol | null;
  manualLinks?: Array<[string, string]>;
  recordLinks?: Array<[string, string]>;
}

export const LinkagesExportModal: React.FC<LinkagesExportModalProps> = ({
  isOpen,
  onClose,
  original,
  edited,
  manualLinks,
  recordLinks,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  if (!original || !edited) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full text-center">
          <p className="text-sm text-gray-300">
            Both original and edited schemas must be present to generate linkages.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const exportData = buildLinkageExport(original, edited, manualLinks, recordLinks);
  const jsonText = JSON.stringify(exportData, null, 2);

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
    a.download = `${exportData.schemaName || 'schema'}-linkages.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-purple-950/60 text-purple-400 border border-purple-800/60">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-100">Migration Linkage Export</h3>
              <p className="text-xs text-gray-400">
                Deterministic ID-based field mappings for downstream database migrations
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

        {/* Code Preview */}
        <div className="flex-1 p-5 overflow-y-auto font-mono text-xs text-gray-300 bg-gray-950">
          <pre className="whitespace-pre">{jsonText}</pre>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-gray-800 bg-gray-900 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {exportData.linkages.length} mappings exported
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Linkage File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
