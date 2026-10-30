import React from 'react';
import {
  Undo2,
  Redo2,
  Save,
  Download,
  Database,
  GitCompare,
  GitBranch,
  FolderOpen,
  Plus,
  RefreshCw,
  CheckCircle2,
  Code2,
} from 'lucide-react';

export interface HeaderProps {
  workspaceName: string;
  onRenameWorkspace: (name: string) => void;
  isSaving: boolean;
  lastSavedAt?: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onExportAvdl: () => void;
  onExportBigQuery: () => void;
  onExportLinkages: () => void;
  onOpenAvdlPreview: () => void;
  onOpenRecon: () => void;
  onOpenImport: () => void;
  onNewWorkspace: () => void;
  onOpenWorkspaceModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  workspaceName,
  onRenameWorkspace,
  isSaving,
  lastSavedAt,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onExportAvdl,
  onExportBigQuery,
  onExportLinkages,
  onOpenAvdlPreview,
  onOpenRecon,
  onOpenImport,
  onNewWorkspace,
}) => {
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleInput, setTitleInput] = React.useState(workspaceName);

  React.useEffect(() => {
    setTitleInput(workspaceName);
  }, [workspaceName]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput !== workspaceName) {
      onRenameWorkspace(titleInput.trim());
    } else {
      setTitleInput(workspaceName);
    }
  };

  return (
    <header className="h-14 border-b border-gray-800 bg-gray-900 px-4 flex items-center justify-between select-none">
      {/* Left: Branding & Workspace title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-bold text-white tracking-wide">
          <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white text-xs font-mono font-bold shadow-sm">
            AS
          </div>
          <span>Avro Studio</span>
        </div>

        <div className="h-5 w-px bg-gray-700 mx-1" />

        {/* Editable Workspace Name */}
        {isEditingTitle ? (
          <input
            type="text"
            className="bg-gray-800 text-gray-100 text-sm px-2 py-1 rounded border border-indigo-500 focus:outline-none"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit();
              if (e.key === 'Escape') {
                setTitleInput(workspaceName);
                setIsEditingTitle(false);
              }
            }}
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditingTitle(true)}
            className="text-sm font-medium text-gray-200 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
            title="Click to rename workspace"
          >
            {workspaceName || 'Untitled Workspace'}
          </button>
        )}

        {/* Autosave status indicator */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 ml-1">
          {isSaving ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span className="text-amber-400">Saving...</span>
            </>
          ) : lastSavedAt ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-gray-400">
                Saved {new Date(lastSavedAt).toLocaleTimeString()}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* Center: Undo / Redo controls */}
      <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-lg border border-gray-800">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded hover:bg-gray-800 text-gray-300 disabled:opacity-30 disabled:hover:bg-transparent transition"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded hover:bg-gray-800 text-gray-300 disabled:opacity-30 disabled:hover:bg-transparent transition"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenImport}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 rounded transition border border-gray-700"
          title="Import schema from URL or text"
        >
          <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span>Import</span>
        </button>

        <button
          onClick={onNewWorkspace}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 rounded transition border border-gray-700"
          title="Create clean empty workspace"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>New</span>
        </button>

        <button
          onClick={onOpenAvdlPreview}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 rounded transition border border-gray-700"
          title="Preview side-by-side original and restructured AVDL"
        >
          <Code2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Preview AVDL</span>
        </button>

        <button
          onClick={onExportAvdl}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 rounded transition border border-gray-700"
          title="Export AVDL schema file"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Export AVDL</span>
        </button>

        <button
          onClick={onExportBigQuery}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 rounded transition border border-gray-700"
          title="Generate BigQuery table schema"
        >
          <Database className="w-3.5 h-3.5 text-amber-400" />
          <span>BigQuery</span>
        </button>

        <button
          onClick={onExportLinkages}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 rounded transition border border-gray-700"
          title="View and export migration linkage JSON"
        >
          <GitBranch className="w-3.5 h-3.5 text-purple-400" />
          <span>Linkages</span>
        </button>

        <button
          onClick={onOpenRecon}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 rounded transition border border-gray-700"
          title="Reconcile source and target data against linkages"
        >
          <GitCompare className="w-3.5 h-3.5 text-teal-400" />
          <span>Recon</span>
        </button>

        <button
          onClick={onSave}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded transition shadow-sm"
          title="Save workspace"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save</span>
        </button>
      </div>
    </header>
  );
};
