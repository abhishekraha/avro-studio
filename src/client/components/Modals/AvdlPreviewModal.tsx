import React, { useState } from 'react';
import { X, Copy, Check, Code2 } from 'lucide-react';
import { serializeAvdl } from '../../../core/serializer/avdlSerializer';
import type { AvroProtocol } from '../../../core/types/schema';

export interface AvdlPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalProtocol: AvroProtocol | null;
  editedProtocol: AvroProtocol | null;
}

export const AvdlPreviewModal: React.FC<AvdlPreviewModalProps> = ({
  isOpen,
  onClose,
  originalProtocol,
  editedProtocol,
}) => {
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedEdited, setCopiedEdited] = useState(false);

  if (!isOpen) return null;

  const originalAvdl = originalProtocol
    ? serializeAvdl(originalProtocol)
    : '// No original schema loaded';

  const editedAvdl = editedProtocol
    ? serializeAvdl(editedProtocol)
    : '// No edited schema available';

  const copyToClipboard = (text: string, isOriginal: boolean) => {
    navigator.clipboard.writeText(text);
    if (isOriginal) {
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
    } else {
      setCopiedEdited(true);
      setTimeout(() => setCopiedEdited(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl flex flex-col w-full max-w-6xl max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Side-by-Side AVDL Preview</h2>
            <span className="text-xs text-gray-400 ml-2">
              Compare original baseline vs. working restructured AVDL
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Dual Code Editors */}
        <div className="flex-1 overflow-hidden p-6 grid grid-cols-2 gap-4">
          {/* Left: Original AVDL */}
          <div className="flex flex-col rounded-lg border border-gray-800 bg-gray-950 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs">
              <span className="font-semibold text-gray-300">Original AVDL (Baseline)</span>
              <button
                onClick={() => copyToClipboard(originalAvdl, true)}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition px-2 py-0.5 rounded hover:bg-gray-800"
              >
                {copiedOriginal ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="flex-1 p-4 font-mono text-xs text-gray-300 overflow-auto whitespace-pre selection:bg-indigo-900">
              <code>{originalAvdl}</code>
            </pre>
          </div>

          {/* Right: Restructured AVDL */}
          <div className="flex flex-col rounded-lg border border-indigo-950/60 bg-gray-950 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-indigo-950/40 border-b border-indigo-900/40 text-xs">
              <span className="font-semibold text-indigo-300">Restructured AVDL (Working Copy)</span>
              <button
                onClick={() => copyToClipboard(editedAvdl, false)}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition px-2 py-0.5 rounded hover:bg-gray-800"
              >
                {copiedEdited ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="flex-1 p-4 font-mono text-xs text-emerald-300/90 overflow-auto whitespace-pre selection:bg-indigo-900">
              <code>{editedAvdl}</code>
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-800 flex justify-end gap-3 bg-gray-900/50">
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
