import React, { useState, useEffect } from 'react';
import { User, X, Check } from 'lucide-react';

export interface UserModalProps {
  isOpen: boolean;
  currentUserId: string | null;
  onSave: (userId: string) => void;
  onClose?: () => void;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  currentUserId,
  onSave,
  onClose,
}) => {
  const [handle, setHandle] = useState(currentUserId || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setHandle(currentUserId || '');
      setError(null);
    }
  }, [isOpen, currentUserId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = handle.trim();
    if (!trimmed) {
      setError('Please enter a valid name or handle');
      return;
    }
    setError(null);
    onSave(trimmed);
    if (onClose) {
      onClose();
    }
  };

  const isMandatory = !currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl flex flex-col w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {currentUserId ? 'Switch User' : 'Welcome to Avro Studio'}
              </h2>
              <p className="text-xs text-gray-400">Personal Workspace Access</p>
            </div>
          </div>
          {!isMandatory && onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            Welcome to Avro Studio. Enter your name or handle to access your personal workspace.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              User Handle / Email
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. dev-alex or alex@corp.com"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                if (error) setError(null);
              }}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
            {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
          </div>

          <div className="flex justify-end items-center gap-2 pt-2">
            {!isMandatory && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow-sm font-semibold"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Continue</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
