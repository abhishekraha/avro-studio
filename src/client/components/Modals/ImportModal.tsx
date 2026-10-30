import React, { useState } from 'react';
import type { AvroProtocol } from '../../../core/types/schema';
import { parseAvdl } from '../../../core/parser/avdlParser';
import { parseAvroJson } from '../../../core/parser/avroJsonParser';
import { X, Globe, FileCode, Upload, AlertCircle } from 'lucide-react';

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (protocol: AvroProtocol) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [tab, setTab] = useState<'text' | 'registry'>('text');
  const [format, setFormat] = useState<'avdl' | 'json'>('avdl');
  const [sourceText, setSourceText] = useState(`protocol UserService {
  record User {
    string id;
    string name;
    string email;
  }
}`);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [authHeader, setAuthHeader] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleParseAndImport = (text: string, isJson: boolean) => {
    try {
      let protocol: AvroProtocol;
      if (isJson) {
        protocol = parseAvroJson(text);
      } else {
        protocol = parseAvdl(text);
      }
      onImport(protocol);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleFetchRemote = async () => {
    if (!remoteUrl.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (authHeader.trim()) {
        headers['Authorization'] = authHeader.trim();
      }

      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: remoteUrl.trim(),
          headers,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch schema from registry');
      }

      // Detect format based on content
      const fetchedText = typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
      const isJson = fetchedText.trim().startsWith('{') || fetchedText.trim().startsWith('[');
      handleParseAndImport(fetchedText, isJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800/60">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-100">Import Avro Schema</h3>
              <p className="text-xs text-gray-400">
                Load AVDL IDL text, Avro JSON schema, or fetch from Schema Registry
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

        {/* Navigation Tabs */}
        <div className="px-5 border-b border-gray-800 flex gap-4 text-xs font-medium">
          <button
            onClick={() => setTab('text')}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition ${
              tab === 'text'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Paste Text</span>
          </button>
          <button
            onClick={() => setTab('registry')}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition ${
              tab === 'registry'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Remote Registry / URL</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {tab === 'text' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-300">Schema Format:</label>
                <div className="inline-flex rounded-lg border border-gray-800 bg-gray-950 p-0.5 text-xs">
                  <button
                    onClick={() => setFormat('avdl')}
                    className={`px-2.5 py-1 rounded transition font-mono ${
                      format === 'avdl'
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    AVDL (IDL)
                  </button>
                  <button
                    onClick={() => setFormat('json')}
                    className={`px-2.5 py-1 rounded transition font-mono ${
                      format === 'json'
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Avro JSON
                  </button>
                </div>
              </div>

              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={10}
                placeholder={format === 'avdl' ? 'protocol MyProto { ... }' : '{"type": "record", ...}'}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 font-mono text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-gray-300 font-medium">Schema Registry or Schema URL:</label>
                <input
                  type="url"
                  placeholder="https://schema-registry.example.com/subjects/order-value/versions/latest/schema"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 font-mono text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-300 font-medium">
                  Authorization Header (Optional):
                </label>
                <input
                  type="text"
                  placeholder="Basic YWRtaW46cGFzc3dvcmQ="
                  value={authHeader}
                  onChange={(e) => setAuthHeader(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 font-mono text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <p className="text-[11px] text-gray-500">
                Requests are securely proxied through the backend server with private IP & SSRF guards.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 bg-gray-900 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded"
          >
            Cancel
          </button>
          {tab === 'text' ? (
            <button
              onClick={() => handleParseAndImport(sourceText, format === 'json')}
              className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm"
            >
              Parse & Load Schema
            </button>
          ) : (
            <button
              onClick={handleFetchRemote}
              disabled={isLoading || !remoteUrl.trim()}
              className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg shadow-sm"
            >
              {isLoading ? 'Fetching...' : 'Fetch & Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
