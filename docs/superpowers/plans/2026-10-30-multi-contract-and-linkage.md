# Multi-Contract Workspaces & Cross-Pane Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance Avro Studio with user identity scoping via browser storage & API headers, multi-contract workspace hierarchy, unified cross-pane `@dnd-kit` drag-and-drop with auto-linkage, interactive manual field link/unlink actions, a unified AVDL/AVSC contract preview modal, and reliable debounced autosave.

**Architecture:** Single-process Hono server with SQLite WAL mode; workspace persistence updated to support an array of `ContractItem` objects. Frontend updated with React 19 tab navigation, unified DndContext spanning Original Viewer and Schema Editor, and local storage user identification.

**Spec:** [docs/superpowers/specs/2026-10-30-multi-contract-and-linkage-design.md](file:///C:/Workspace/git/avro-editor/docs/superpowers/specs/2026-10-30-multi-contract-and-linkage-design.md)

---

### Task 1: Domain & Database Migration for Multi-Contract Workspaces

**Files:**
- Modify: `src/core/types/workspace.ts`
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/workspaceRepository.ts`
- Test: `tests/server/db.test.ts`
- Test: `tests/core/types.test.ts`

- [ ] Step 1: Update `WorkspaceData` definition to include `contracts: ContractItem[]` and `activeContractId: string` with backward-compatibility helper.
- [ ] Step 2: Update `workspaceRepository.ts` to store and load `contracts` and `activeContractId`.
- [ ] Step 3: Run `npx vitest run tests/server/db.test.ts tests/core/types.test.ts` and verify all tests pass.
- [ ] Step 4: Commit changes.

---

### Task 2: User Identity & Local Storage Tenant Scoping

**Files:**
- Create: `src/client/hooks/useUserIdentity.ts`
- Create: `src/client/components/Modals/UserModal.tsx`
- Modify: `src/client/hooks/useWorkspaces.ts`
- Modify: `src/client/components/Header.tsx`
- Test: `tests/client/useUserIdentity.test.ts`

- [ ] Step 1: Implement `useUserIdentity` hook managing `localStorage.getItem('avro_user_id')`.
- [ ] Step 2: Implement `UserModal` prompting the user for their name if unset, with a switch-user option in `Header`.
- [ ] Step 3: Ensure `useWorkspaces` automatically passes `X-User-Id` header on all fetch calls.
- [ ] Step 4: Verify test suite and commit.

---

### Task 3: Multi-Contract Tab Bar & Workspace Navigation

**Files:**
- Create: `src/client/components/ContractTabBar.tsx`
- Modify: `src/client/hooks/useSchemaState.ts`
- Modify: `src/client/App.tsx`
- Test: `tests/client/contractTabs.test.ts`

- [ ] Step 1: Build `ContractTabBar` rendering tabs for `contracts`, an active tab indicator, a `+ New Contract` button, and tab close/rename options.
- [ ] Step 2: Wire `App.tsx` state to switch active contract smoothly, preserving edits across contracts in the workspace.
- [ ] Step 3: Verify contract switching and commit.

---

### Task 4: Unified `@dnd-kit` Cross-Pane Drag-and-Drop & Auto-Linkage

**Files:**
- Modify: `src/client/components/SchemaViewer/index.tsx`
- Modify: `src/client/components/SchemaEditor/index.tsx`
- Modify: `src/client/components/SchemaEditor/SortableField.tsx`
- Modify: `src/client/App.tsx`
- Test: `tests/client/dndCrossPane.test.ts`

- [ ] Step 1: Wrap dual panes in a single top-level `DndContext` in `App.tsx`.
- [ ] Step 2: Make fields in `SchemaViewer` draggable with `data: { source: 'original', field, recordName }`.
- [ ] Step 3: Update `onDragEnd` to detect drops from `source: 'original'` into target records:
  - Generate a new field in the target record with a fresh synthetic ID.
  - Automatically append `[newFieldId, originalField.id]` to `activeContract.manualLinks`.
- [ ] Step 4: Verify cross-pane dragging and auto-linkage in tests and commit.

---

### Task 5: Interactive Field Linking and Unlinking Controls

**Files:**
- Modify: `src/client/components/SchemaViewer/index.tsx`
- Modify: `src/client/components/SchemaEditor/SortableField.tsx`
- Modify: `src/client/App.tsx`
- Test: `tests/client/fieldLinking.test.ts`

- [ ] Step 1: Add a link status pill on fields in both Original and Edited panes:
  - If field is linked: show a green link icon with the name of the paired field and a clickable `×` (Unlink) button.
  - Clicking `×` removes `[editedFieldId, originalFieldId]` from `manualLinks`.
- [ ] Step 2: Add a "Link to..." mode: clicking "Link" on an unlinked Original field allows clicking an Edited field to bind them.
- [ ] Step 3: Verify manual linking and unlinking tests and commit.

---

### Task 6: Unified Contract Schema Export Modal (AVDL & AVSC) & Auto-Save Fix

**Files:**
- Create: `src/client/components/Modals/ContractExportModal.tsx`
- Modify: `src/client/components/Header.tsx`
- Modify: `src/client/hooks/useSchemaState.ts`
- Modify: `src/client/App.tsx`
- Test: `tests/client/contractExport.test.ts`

- [ ] Step 1: Implement `ContractExportModal` with tab toggle: `[ AVDL (.avdl) ] | [ AVSC (.avsc / JSON) ]`, syntax highlighted preview, Copy, and Download.
- [ ] Step 2: Replace separate export buttons in `Header` with a single prominent **Contract Schema** button.
- [ ] Step 3: Fix auto-save: ensure edits trigger debounced 1.5s background saves via `useWorkspaces.saveWorkspace` with proper dirty-state tracking and indicator.
- [ ] Step 4: Verify test suite and commit.

---

### Task 7: End-to-End Verification & Container Rebuild

**Files:**
- Test: Run full Vitest suite (`npm test`).
- Rebuild: `docker build -t avro-studio .` and restart container.
- Verify: Confirm multi-contract navigation, cross-pane drag auto-linking, manual linking/unlinking, and autosave in browser.
