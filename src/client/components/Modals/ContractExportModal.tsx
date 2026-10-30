import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Download, FileCode2 } from 'lucide-react';
import { serializeAvdl } from '../../../core/serializer/avdlSerializer';
import type { ContractItem } from '../../../core/types/workspace';

export interface ContractExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: ContractItem | null;
}

export type ExportFormat = 'avdl' | 'avsc';

export const ContractExportModal: React.FC<ContractExportModalProps> = ({
  isOpen,
  onClose,
  contract,
}) => {
  const [activeTab, setActiveTab] = useState<ExportFormat>('avdl');
  const [copied, setCopied] = useState(false);

  // Compute serialized content based on current tab and contract
  const content = useMemo(() => {
    if (!contract || !contract.edited) {
      return '// No edited contract schema available';
    }

    if (activeTab === 'avdl') {
      try {
        return serializeAvdl(contract.edited);
      } catch (err) {
        return `// Error serializing AVDL: ${(err as Error).message}`;
      }
    } else {
      try {
        return JSON.stringify(contract.edited, null, 2);
      } catch (err) {
        return `// Error formatting AVSC JSON: ${(err as Error).message}`;
      }
    }
  }, [contract, activeTab]);

  // Compute line numbers for styled monospace display
  const lines = useMemo(() => {
    return content.split('\n');
  }, [content]);

  if (!isOpen) return null;

  const baseFileName = contract?.name ? contract.name.replace(/\.[^/.]+$/, '') : 'contract';
  const downloadFileName = `${baseFileName}.${activeTab}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const mimeType = activeTab === 'avdl' ? 'text/plain;charset=utf-8' : 'application/json;charset=utf-8';
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Export Contract Schema</h2>
                {contract?.name && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                    {contract.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Inspect, copy, or download the working schema in Avro IDL (AVDL) or Avro JSON (AVSC) format
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Bar */}
        <div className="px-6 py-3 bg-gray-950/60 border-b border-gray-800/80 flex items-center justify-between">
          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
            <button
              onClick={() => setActiveTab('avdl')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                activeTab === 'avdl'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              AVDL (.avdl)
            </button>
            <button
              onClick={() => setActiveTab('avsc')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                activeTab === 'avsc'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              AVSC (.avsc / JSON)
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-lg transition border border-gray-700 shadow-sm"
              title="Copy schema code to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow-sm"
              title={`Download as ${downloadFileName}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File ({downloadFileName})</span>
            </button>
          </div>
        </div>

        {/* Monospace Code Preview Box with Line Numbers */}
        <div className="flex-1 overflow-hidden p-4 bg-gray-950 flex flex-col">
          <div className="flex-1 overflow-auto rounded-lg border border-gray-800 bg-gray-900/90 font-mono text-xs flex">
            {/* Line numbers gutter */}
            <div className="py-3 pl-3 pr-2 select-none text-right text-gray-600 border-r border-gray-800/80 bg-gray-950/40">
              {lines.map((_, i) => (
                <div key={i} className="leading-5">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code Content */}
            <pre className="flex-1 p-3 overflow-x-auto text-emerald-300/95 leading-5 selection:bg-indigo-900 whitespace-pre">
              <code>{content}</code>
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 flex items-center justify-between bg-gray-900/50">
          <div className="text-xs text-gray-500 font-mono">
            {lines.length} lines • {new Blob([content]).size} bytes • {downloadFileName}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
