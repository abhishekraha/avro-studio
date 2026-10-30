# Task 9 Brief: Frontend State & UI Components (React 19 + @dnd-kit)

## Goal
Build the modern, interactive Avro Schema Studio UI in React 19 + Tailwind v4 + @dnd-kit with:
1. `useSchemaState.ts`: History stack (undo/redo), immutable working copy, field edits, moves, renames, and auto-save (debounced).
2. Dual-Pane Layout:
   - Left Panel: Read-only Original Schema Viewer with diff annotations (unchanged, deleted, moved-out, type-changed).
   - Right Panel: Editable Working Copy with `@dnd-kit` sortable fields, drag-and-drop between records, in-place type selector, and diff badges (added, moved-in, renamed, type-changed).
3. Modals:
   - BigQuery Export Modal (toggle standard vs legacy flattened, copy/download JSON).
   - Migration Linkage Export Modal (inspect and export `LinkageExport`).
   - Data Reconciliation Modal (load source/target CSV/JSON, configure key fields, run reconciliation engine, display diffs).
   - Remote URL / Schema Registry Import Modal.
4. Header:
   - Workspace title, autosave indicator, Undo/Redo controls, Export AVDL, BigQuery, Linkages, and Recon buttons.

## Files
- Create: `src/client/hooks/useSchemaState.ts`
- Create: `src/client/hooks/useWorkspaces.ts`
- Create: `src/client/components/Header.tsx`
- Create: `src/client/components/SchemaViewer/index.tsx`
- Create: `src/client/components/SchemaEditor/index.tsx`
- Create: `src/client/components/SchemaEditor/SortableField.tsx`
- Create: `src/client/components/Modals/BigQueryExportModal.tsx`
- Create: `src/client/components/Modals/ReconciliationModal.tsx`
- Create: `src/client/components/Modals/ImportModal.tsx`
- Create: `src/client/App.tsx`
- Test: `tests/client/useSchemaState.test.ts`

## Requirements & Constraints
- React 19 compatible (`createRoot`, React 19 hooks).
- Connects to core domain parsers, serializers, diff engines, and BigQuery/Recon generators.
- Connects to `/api/workspaces` for workspace persistence.
- Drag and drop:
  - Uses `@dnd-kit/core` and `@dnd-kit/sortable`.
  - Fields can be dragged within a record to reorder or across records to move.
- Write tests in `tests/client/useSchemaState.test.ts` verifying state transitions:
  - Add field
  - Remove field
  - Rename field (preserves synthetic ID)
  - Move field between records
  - Undo and redo
- Ensure production build (`npm run build`) succeeds cleanly without TypeScript errors or Vite bundler warnings.
- Write full report to `.superpowers/sdd/avro-studio-rebuild/task-9-report.md`.
