# Design Specification: Multi-Contract Workspaces & Cross-Pane Linking

## 1. Intent & Scope
Enhance Avro Studio with:
1. **User Identity & Multi-Tenant Scoping**: Browser-based identity modal (`localStorage`) injecting `X-User-Id` on all API calls, guaranteeing strict per-user workspace isolation in SQLite.
2. **Multi-Contract Workspace Hierarchy**: A workspace now holds multiple independent schema contracts (like files in a project), each with its own original baseline, restructured working copy, diff summary, and linkages.
3. **Interactive Cross-Pane Drag-and-Drop & Auto-Linkage**: Single unified `@dnd-kit` context enabling dragging fields from the read-only Original schema into Restructured records, automatically establishing migration linkages (`manualLinks`).
4. **Direct Field Link/Unlink UI**: Visual link pins and buttons allowing users to pair or sever linkages between original and edited fields directly.
5. **Unified Contract Preview Modal (AVDL & AVSC)**: Single header button opening a modal with a format toggle between `.avdl` (IDL) and `.avsc` (Avro JSON), supporting live preview, copy to clipboard, and file download.
6. **Reliable Debounced Auto-Save**: Seamless persistence of active contract changes and workspace structure to SQLite without requiring manual saves.

---

## 2. Data Model Updates (`src/core/types/workspace.ts`)

```typescript
export interface ContractItem {
  id: string; // e.g. "c-1", uuid
  name: string; // e.g. "Orders.avdl"
  original: AvroProtocol | null;
  edited: AvroProtocol | null;
  manualLinks: Array<[string, string]>; // [editedFieldId, originalFieldId]
  recordLinks?: Array<[string, string]>;
}

export interface WorkspaceData {
  id: string;
  name: string;
  userId?: string;
  savedAt: string;
  isNew: boolean;
  activeContractId: string;
  contracts: ContractItem[];
}
```

---

## 3. UI/UX Workflow & Components

### 3.1 User Identity Prompt (`UserModal.tsx`)
- On first visit, if `localStorage.getItem('avro_user_id')` is missing, display a clean modal: "Welcome to Avro Studio. Enter your name or handle to manage your workspaces."
- Stored in browser storage and displayed in header (with option to switch user).
- Automatically appended as header: `X-User-Id: <username>`.

### 3.2 Contract Tabs (`ContractTabBar.tsx`)
- Located below the header: horizontal tabs for each contract in the current workspace.
- Supports switching active contract, creating a new contract (`+`), and renaming/deleting contract tabs.

### 3.3 Unified `@dnd-kit` Cross-Pane Dragging
- Original pane fields become draggable items with `type: 'original-field'`.
- Right pane records become droppable targets (`DroppableRecord`).
- On drop:
  1. Clones source field into target record with a fresh synthetic ID (`g-XXXX`).
  2. Immediately registers `[newFieldId, originalField.id]` in `activeContract.manualLinks`.
  3. Updates diff annotations immediately.

### 3.4 Direct Link / Unlink Pins
- Each field card has a small link indicator:
  - If linked: green badge displaying linked field name with an "Unlink" (`x`) button.
  - If unlinked: "Link to..." mode button to click source then target.

### 3.5 Unified Contract Export Modal (`ContractExportModal.tsx`)
- Single button in Header: **Contract Schema**.
- Toggle: `[ AVDL (.avdl) ] | [ AVSC (.avsc / JSON) ]`.
- Actions: **Copy to Clipboard** and **Download File**.

### 3.6 Auto-Save Engine
- Synchronous state dirty tracking in `useSchemaState` triggering a debounced 1.5s PUT request to `/api/workspaces/:id` using `navigator.sendBeacon` or standard `fetch` with `AbortController`.

---

## 4. Implementation Steps
1. Update `WorkspaceData` schema and repository to support `contracts: ContractItem[]`.
2. Implement User Identity prompt and API header injection.
3. Build Contract Tab Bar for multi-contract switching.
4. Implement unified `@dnd-kit` cross-pane dragging and auto-linkage.
5. Implement manual Link/Unlink field actions.
6. Implement `ContractExportModal` (AVDL/AVSC toggle).
7. Rebuild and verify test suite + Docker container.
