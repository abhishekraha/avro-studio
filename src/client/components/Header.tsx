import React, { useState } from 'react';
import {
  CheckCircle2, Code2, Database, Download, Ellipsis, FileCode2, FolderOpen,
  GitBranch, GitCompare, Plus, RefreshCw, Redo2, Save, Tag, Triangle, Undo2
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
  onExportAvdl?: () => void;
  onOpenContractSchema?: () => void;
  onExportBigQuery: () => void;
  onExportLinkages: () => void;
  onOpenAvdlPreview: () => void;
  onOpenRecon: () => void;
  onOpenImport: () => void;
  onNewWorkspace: () => void;
  viewMode?: 'compare' | 'create';
  onToggleViewMode?: (mode: 'compare' | 'create') => void;
  onOpenWorkspaceModal?: () => void;
  userId?: string | null;
  onOpenUserModal?: () => void;
  schemaVersion?: string;
  onUpdateSchemaVersion?: (version: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  workspaceName, onRenameWorkspace, isSaving, lastSavedAt, canUndo, canRedo,
  onUndo, onRedo, onSave, onExportAvdl, onOpenContractSchema, onExportBigQuery,
  onExportLinkages, onOpenAvdlPreview, onOpenRecon, onOpenImport, onNewWorkspace,
  viewMode = 'compare', onToggleViewMode, userId, onOpenUserModal,
  schemaVersion, onUpdateSchemaVersion,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(workspaceName);
  const [editingVersion, setEditingVersion] = useState(false);
  const [versionInput, setVersionInput] = useState(schemaVersion || '1.0.0');
  const [menuOpen, setMenuOpen] = useState(false);

  React.useEffect(() => setTitleInput(workspaceName), [workspaceName]);
  React.useEffect(() => setVersionInput(schemaVersion || '1.0.0'), [schemaVersion]);

  const saveTitle = () => {
    setEditingTitle(false);
    if (titleInput.trim() && titleInput !== workspaceName) onRenameWorkspace(titleInput.trim());
    else setTitleInput(workspaceName);
  };
  const saveVersion = () => {
    setEditingVersion(false);
    const next = versionInput.trim();
    if (next && next !== (schemaVersion || '1.0.0')) onUpdateSchemaVersion?.(next);
    else setVersionInput(schemaVersion || '1.0.0');
  };
  const bumpVersion = (kind: 'patch' | 'minor' | 'major') => {
    if (!onUpdateSchemaVersion) return;
    const parts = (schemaVersion || '1.0.0').replace(/^v/i, '').split('.').map((part) => parseInt(part, 10) || 0);
    while (parts.length < 3) parts.push(0);
    if (kind === 'major') { parts[0] += 1; parts[1] = 0; parts[2] = 0; }
    else if (kind === 'minor') { parts[1] += 1; parts[2] = 0; }
    else parts[2] += 1;
    onUpdateSchemaVersion(parts.slice(0, 3).join('.'));
  };

  const extraActions = [
    { label: 'Compare & Edit', icon: <GitCompare size={15} />, run: () => onToggleViewMode?.('compare') },
    { label: 'Create New Mode', icon: <Code2 size={15} />, run: () => onToggleViewMode?.('create') },
    { label: 'Import', icon: <FolderOpen size={15} />, run: onOpenImport },
    { label: 'New Workspace', icon: <Plus size={15} />, run: onNewWorkspace },
    { label: 'Contract Schema', icon: <FileCode2 size={15} />, run: () => onOpenContractSchema?.() },
    { label: 'Preview AVDL', icon: <Code2 size={15} />, run: onOpenAvdlPreview },
    ...(onExportAvdl ? [{ label: 'Export AVDL', icon: <Download size={15} />, run: onExportAvdl }] : []),
    { label: 'Linkages', icon: <GitBranch size={15} />, run: onExportLinkages },
    { label: 'Save', icon: <Save size={15} />, run: onSave },
  ];

  return (
    <header className="studio-header">
      <div className="studio-brand-row">
        <div className="studio-brand">
          <span className="studio-logo"><Triangle size={21} strokeWidth={2.5} /></span>
          <span className="studio-wordmark">Avro Studio</span>
          <span className="studio-app-version">v2.4.0</span>
        </div>
        <span className="studio-header-divider" />
        {editingTitle ? (
          <input className="studio-workspace-input" value={titleInput} autoFocus
            onChange={(event) => setTitleInput(event.target.value)} onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveTitle();
              if (event.key === 'Escape') { setTitleInput(workspaceName); setEditingTitle(false); }
            }} />
        ) : (
          <button className="studio-workspace-name" onClick={() => setEditingTitle(true)} title="Rename workspace">
            {workspaceName || 'Untitled Workspace'}
          </button>
        )}
        <div className="studio-save-state" aria-live="polite">
          {isSaving ? <><RefreshCw size={13} className="studio-spinning" /><span>Saving...</span></> :
            lastSavedAt ? <><CheckCircle2 size={13} /><span>Saved {new Date(lastSavedAt).toLocaleTimeString()}</span></> :
            <><CheckCircle2 size={13} /><span>Saved</span></>}
        </div>
        <div className="studio-schema-version">
          <Tag size={13} />
          {editingVersion ? (
            <input value={versionInput} autoFocus onChange={(event) => setVersionInput(event.target.value)}
              onBlur={saveVersion} onKeyDown={(event) => {
                if (event.key === 'Enter') saveVersion();
                if (event.key === 'Escape') { setVersionInput(schemaVersion || '1.0.0'); setEditingVersion(false); }
              }} aria-label="Schema version" />
          ) : (
            <button className="studio-version-value" onClick={() => setEditingVersion(true)} title="Edit schema version">
              v{schemaVersion || '1.0.0'}
            </button>
          )}
          <span className="studio-version-divider" />
          <button onClick={() => bumpVersion('patch')} title="Bump patch version">+P</button>
          <button onClick={() => bumpVersion('minor')} title="Bump minor version">+M</button>
          <button onClick={() => bumpVersion('major')} title="Bump major version">+MJ</button>
        </div>
      </div>

      <div className="studio-actions">
        <div className="studio-history-actions">
          <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 size={16} /></button>
          <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo"><Redo2 size={16} /></button>
        </div>
        <button className="studio-action-button" onClick={onExportBigQuery} title="Generate BigQuery schema">
          <Database size={15} /><span>BigQuery</span>
        </button>
        <button className="studio-action-button" onClick={onOpenRecon} title="Reconcile source and target data">
          <GitCompare size={15} /><span>Reconcile</span>
        </button>
        <button className="studio-action-button studio-export-button"
          onClick={() => onOpenContractSchema ? onOpenContractSchema() : onOpenAvdlPreview()}>
          <FileCode2 size={15} /><span>Export Schema</span>
        </button>
        <div className="studio-menu-wrap">
          <button className="studio-more-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="More actions" title="More actions">
            <Ellipsis size={18} />
          </button>
          {menuOpen && (
            <div className="studio-actions-menu">
              {extraActions.map((action) => (
                <button key={action.label} onClick={() => { setMenuOpen(false); action.run(); }}>
                  {action.icon}<span>{action.label}</span>
                  {action.label === 'Compare & Edit' && viewMode === 'compare' && <i>ACTIVE</i>}
                  {action.label === 'Create New Mode' && viewMode === 'create' && <i>ACTIVE</i>}
                </button>
              ))}
            </div>
          )}
        </div>
        {onOpenUserModal && (
          <button className="studio-user-button" onClick={onOpenUserModal} title={userId ? 'Signed in as ' + userId : 'Set user identity'}>
            <span className="studio-user-avatar">{(userId || 'AJ').slice(0, 2).toUpperCase()}</span>
            <span>{userId || 'User'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
