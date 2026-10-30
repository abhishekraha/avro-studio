# Task 3 Brief: Multi-Contract Tab Bar & Workspace Navigation

## Goal
Build the horizontal contract tab bar and connect multi-contract switching in `App.tsx`.

## Files
- Create: `src/client/components/ContractTabBar.tsx`
- Modify: `src/client/App.tsx`
- Test: `tests/client/contractTabs.test.ts`

## Requirements
1. `ContractTabBar.tsx`:
   - Props:
     - `contracts: ContractItem[]`
     - `activeContractId: string`
     - `onSelectContract: (id: string) => void`
     - `onAddContract: (name: string) => void`
     - `onRenameContract: (id: string, name: string) => void`
     - `onRemoveContract: (id: string) => void`
   - Horizontal tab list below Header.
   - Shows active tab with highlight styling.
   - Allows inline tab renaming (double-click or edit icon).
   - Shows close button (`×`) when more than 1 contract exists.
   - `+ New Contract` button with prompt or input for contract file name (e.g. `Payments.avdl`).
2. `App.tsx`:
   - Store `workspace: WorkspaceData`.
   - Switching active contract updates the displayed schemas in Left (original) and Right (edited) panes.
   - Edits made in the Right pane update the active contract in `workspace.contracts`.
3. Unit test in `tests/client/contractTabs.test.ts`.
4. Write report to `.superpowers/sdd/multi-contract/task-3-report.md`.
