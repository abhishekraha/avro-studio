import React, { useState } from 'react';
import type { AvroProtocol } from '../../../core/types/schema';
import { buildLinkageExport } from '../../../core/utils/exportLinkages';
import { runRecon, type ReconReport } from '../../../core/utils/reconEngine';
import { X, GitCompare, Play, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

export interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  original: AvroProtocol | null;
  edited: AvroProtocol | null;
}

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({
  isOpen,
  onClose,
  original,
  edited,
}) => {
  const [sourceJson, setSourceJson] = useState('[\n  {"id": "1001", "amount": 99.5, "status": "PENDING"}\n]');
  const [targetJson, setTargetJson] = useState('[\n  {"id": "1001", "amount": 99.5, "order_status": "PENDING"}\n]');
  const [keyFieldsInput, setKeyFieldsInput] = useState('id');
  const [numericEpsilon, setNumericEpsilon] = useState(0.001);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(true);

  const [report, setReport] = useState<ReconReport | null>(null);
  const [reconError, setReconError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunRecon = () => {
    setReconError(null);
    setReport(null);

    if (!original || !edited) {
      setReconError('Both baseline and edited schemas must be present to establish linkages.');
      return;
    }

    try {
      const sourceRows = JSON.parse(sourceJson);
      const targetRows = JSON.parse(targetJson);

      if (!Array.isArray(sourceRows) || !Array.isArray(targetRows)) {
        throw new Error('Source and Target data must be JSON arrays of objects.');
      }

      const keyFields = keyFieldsInput
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      if (keyFields.length === 0) {
        throw new Error('Please specify at least one key field (e.g. id).');
      }

      const linkages = buildLinkageExport(original, edited);

      const result = runRecon({
        sourceRows,
        targetRows,
        keyFields,
        linkages,
        tolerance: {
          numericEpsilon,
          ignoreWhitespace,
        },
      });

      setReport(result);
    } catch (err) {
      setReconError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-teal-950/60 text-teal-400 border border-teal-800/60">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-100">Data Reconciliation Engine</h3>
              <p className="text-xs text-gray-400">
                Validate migration parity using ID-linked schema mappings
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

        {/* Configuration Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Source JSON Input */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-medium text-gray-300">
                Source Data (Baseline Schema JSON array)
              </label>
              <textarea
                value={sourceJson}
                onChange={(e) => setSourceJson(e.target.value)}
                rows={6}
                className="bg-gray-950 border border-gray-800 rounded-lg p-2.5 font-mono text-xs text-gray-200 focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Target JSON Input */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-medium text-gray-300">
                Target Data (Migrated / Target Schema JSON array)
              </label>
              <textarea
                value={targetJson}
                onChange={(e) => setTargetJson(e.target.value)}
                rows={6}
                className="bg-gray-950 border border-gray-800 rounded-lg p-2.5 font-mono text-xs text-gray-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Key fields & Tolerance */}
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-800 text-xs">
            <div className="flex flex-col space-y-1">
              <label className="text-gray-400 font-medium">Join Key Field(s):</label>
              <input
                type="text"
                value={keyFieldsInput}
                onChange={(e) => setKeyFieldsInput(e.target.value)}
                placeholder="e.g. id, tenant_id"
                className="bg-gray-950 border border-gray-800 rounded px-2.5 py-1.5 font-mono text-gray-200 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-gray-400 font-medium">Numeric Epsilon:</label>
              <input
                type="number"
                step="0.0001"
                value={numericEpsilon}
                onChange={(e) => setNumericEpsilon(Number(e.target.value))}
                className="bg-gray-950 border border-gray-800 rounded px-2.5 py-1.5 font-mono text-gray-200 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ignoreWhitespace}
                  onChange={(e) => setIgnoreWhitespace(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-800 text-teal-500 focus:ring-0"
                />
                <span>Ignore Whitespace in Strings</span>
              </label>
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleRunRecon}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Parity Verification</span>
            </button>
          </div>

          {/* Error display */}
          {reconError && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{reconError}</span>
            </div>
          )}

          {/* Results Display */}
          {report && (
            <div className="pt-4 border-t border-gray-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Reconciliation Summary
              </h4>

              {/* Stats badges */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg">
                  <div className="text-lg font-bold text-gray-100">{report.totalSourceRows}</div>
                  <div className="text-[11px] text-gray-400">Source Rows</div>
                </div>
                <div className="bg-gray-950 border border-emerald-900/50 p-2.5 rounded-lg">
                  <div className="text-lg font-bold text-emerald-400">{report.matchedRows}</div>
                  <div className="text-[11px] text-gray-400">Identical Rows</div>
                </div>
                <div className="bg-gray-950 border border-amber-900/50 p-2.5 rounded-lg">
                  <div className="text-lg font-bold text-amber-400">
                    {report.mismatchedRows.length}
                  </div>
                  <div className="text-[11px] text-gray-400">Mismatches</div>
                </div>
                <div className="bg-gray-950 border border-rose-900/50 p-2.5 rounded-lg">
                  <div className="text-lg font-bold text-rose-400">
                    {report.missingInTarget.length + report.extraInTarget.length}
                  </div>
                  <div className="text-[11px] text-gray-400">Unpaired Rows</div>
                </div>
              </div>

              {/* Mismatch breakdown list */}
              {report.mismatchedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Value Differences:</span>
                  </div>
                  <div className="divide-y divide-gray-800 border border-gray-800 rounded-lg max-h-40 overflow-y-auto bg-gray-950">
                    {report.mismatchedRows.map((m, idx) => (
                      <div key={idx} className="p-2.5 text-xs">
                        <div className="font-mono text-gray-300 font-semibold mb-1">
                          Row Key: {m.key}
                        </div>
                        {m.mismatches.map((diff, dIdx) => (
                          <div key={dIdx} className="font-mono text-[11px] text-gray-400 pl-3">
                            <span className="text-indigo-400">{diff.field}</span>: "
                            {String(diff.sourceValue)}" ≠ "{String(diff.targetValue)}"
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.mismatchedRows.length === 0 &&
                report.missingInTarget.length === 0 &&
                report.extraInTarget.length === 0 && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-400 text-xs rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>100% data parity verified across all linkage-mapped fields!</span>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
