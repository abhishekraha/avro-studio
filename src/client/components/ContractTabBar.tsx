import React, { useState, useRef, useEffect } from 'react';
import { FileCode2, Plus, X, Edit2, Check } from 'lucide-react';
import type { ContractItem } from '../../core/types/workspace';

export interface ContractTabBarProps {
  contracts: ContractItem[];
  activeContractId: string;
  onSelectContract: (id: string) => void;
  onAddContract: (name: string) => void;
  onRenameContract: (id: string, name: string) => void;
  onRemoveContract: (id: string) => void;
  protocolNamespace?: string;
  activeLinkCount?: number;
}

export const ContractTabBar: React.FC<ContractTabBarProps> = ({
  contracts,
  activeContractId,
  onSelectContract,
  onAddContract,
  onRenameContract,
  onRemoveContract,
  protocolNamespace = '',
  activeLinkCount = 0,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newContractName, setNewContractName] = useState<string>('');

  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (isAdding && addInputRef.current) {
      addInputRef.current.focus();
      addInputRef.current.select();
    }
  }, [isAdding]);

  const startEditing = (contract: ContractItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setEditingId(contract.id);
    setEditName(contract.name);
  };

  const saveEditing = (id: string) => {
    const trimmed = editName.trim();
    if (trimmed && trimmed.length > 0) {
      onRenameContract(id, trimmed);
    }
    setEditingId(null);
  };

  const handleEditKeyDown = (id: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEditing(id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingId(null);
    }
  };

  const startAdding = () => {
    setIsAdding(true);
    setNewContractName(`Contract_${contracts.length + 1}.avdl`);
  };

  const submitNewContract = () => {
    const trimmed = newContractName.trim();
    if (trimmed) {
      // Ensure .avdl extension if not specified
      const finalName = trimmed.includes('.') ? trimmed : `${trimmed}.avdl`;
      onAddContract(finalName);
    }
    setIsAdding(false);
    setNewContractName('');
  };

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitNewContract();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsAdding(false);
      setNewContractName('');
    }
  };

  return (
    <div className="studio-tabs">
      <div className="studio-tab-list">
        {contracts.map((contract) => {
          const isActive = contract.id === activeContractId;
          const isCurrentlyEditing = editingId === contract.id;

          return (
            <div
              key={contract.id}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => onSelectContract(contract.id)}
              onDoubleClick={(e) => startEditing(contract, e)}
              className={`studio-contract-tab group relative flex items-center gap-2 text-xs font-medium cursor-pointer transition-colors border-t border-l border-r ${
                isActive
                  ? 'bg-gray-950 text-indigo-400 border-gray-700/80 shadow-sm'
                  : 'bg-gray-900/60 text-gray-400 border-transparent hover:bg-gray-800/80 hover:text-gray-200'
              }`}
            >
              <FileCode2
                className={`w-3.5 h-3.5 flex-shrink-0 ${
                  isActive ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-400'
                }`}
              />

              {isCurrentlyEditing ? (
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => saveEditing(contract.id)}
                    onKeyDown={(e) => handleEditKeyDown(contract.id, e)}
                    className="bg-gray-800 text-gray-100 text-xs px-1.5 py-0.5 rounded border border-indigo-500 focus:outline-none w-28"
                  />
                  <button
                    type="button"
                    onClick={() => saveEditing(contract.id)}
                    className="p-0.5 text-emerald-400 hover:text-emerald-300"
                    title="Confirm rename"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="truncate max-w-[140px]" title={contract.name}>
                  {contract.name}
                </span>
              )}

              {!isCurrentlyEditing && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => startEditing(contract, e)}
                    className="p-0.5 text-gray-500 hover:text-gray-300 rounded"
                    title="Rename contract"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>

                  {contracts.length > 1 && (
                    <button
                      type="button"
                      aria-label="Close tab"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveContract(contract.id);
                      }}
                      className="p-0.5 text-gray-500 hover:text-rose-400 rounded"
                      title="Close contract tab"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Contract Button / Inline Input */}
      {isAdding ? (
        <div className="flex items-center gap-1 ml-1">
          <input
            ref={addInputRef}
            type="text"
            value={newContractName}
            placeholder="ContractName.avdl"
            onChange={(e) => setNewContractName(e.target.value)}
            onBlur={submitNewContract}
            onKeyDown={handleAddKeyDown}
            className="bg-gray-800 text-gray-100 text-xs px-2 py-1 rounded border border-indigo-500 focus:outline-none w-36"
          />
          <button
            type="button"
            onClick={submitNewContract}
            className="p-1 text-emerald-400 hover:text-emerald-300"
            title="Create"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewContractName('');
            }}
            className="p-1 text-gray-400 hover:text-gray-200"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startAdding}
          className="studio-new-contract flex items-center gap-1 px-2.5 py-1 text-xs"
          title="Add new contract"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-400" />
          <span>New Contract</span>
        </button>
      )}
      <div className="studio-tab-meta">
        <span>Protocol: <strong>{protocolNamespace || '—'}</strong></span>
        <span className="studio-link-count">{activeLinkCount} Active Links</span>
      </div>
    </div>
  );
};
