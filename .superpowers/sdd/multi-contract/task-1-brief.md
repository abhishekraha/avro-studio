# Task 1 Brief: Domain & Database Migration for Multi-Contract Workspaces

## Goal
Update domain types and SQLite schema/repository to support `contracts: ContractItem[]` and `activeContractId: string` with full backward compatibility.

## Files
- Modify: `src/core/types/workspace.ts`
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/workspaceRepository.ts`
- Modify: `src/server/routes/workspaces.ts`
- Test: `tests/server/db.test.ts`
- Test: `tests/core/types.test.ts`

## Requirements
1. Update `src/core/types/workspace.ts`:
   - `ContractItem`: `{ id: string; name: string; original: AvroProtocol | null; edited: AvroProtocol | null; manualLinks: Array<[string, string]>; recordLinks?: Array<[string, string]>; originalFieldNotes?: Array<[string, string]>; editedFieldNotes?: Array<[string, string]>; }`
   - `WorkspaceData`: `{ id: string; name: string; userId?: string; savedAt: string; isNew: boolean; activeContractId: string; contracts: ContractItem[]; }`
   - Provide helper `ensureMultiContractWorkspace(data: any): WorkspaceData` converting legacy flat workspaces into `contracts: [{ id: 'contract-1', name: data.name || 'Main Contract', original: data.original, edited: data.edited, manualLinks: data.manualLinks || [] }]`.
2. Update `src/server/db/schema.ts`:
   - Add `contracts: text('contracts', { mode: 'json' })` and `activeContractId: text('active_contract_id')` to `workspaces`.
3. Update `src/server/db/workspaceRepository.ts`:
   - Store and map `contracts` and `activeContractId`. If `contracts` is null/empty on a legacy row, fallback to legacy columns via `ensureMultiContractWorkspace`.
4. Update `src/server/routes/workspaces.ts`:
   - Add `PUT /api/workspaces/:id` endpoint handling workspace updates.
5. Update tests:
   - Verify `tests/core/types.test.ts` and `tests/server/db.test.ts` pass cleanly with multi-contract workspaces.
6. Write report to `.superpowers/sdd/multi-contract/task-1-report.md`.
