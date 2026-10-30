# Task 6 Brief: Unified Contract Schema Export Modal (AVDL & AVSC) & Auto-Save Fix

## Goal
Build the unified AVDL/AVSC contract export modal and implement the auto-save fix.

## Files
- Create: `src/client/components/Modals/ContractExportModal.tsx`
- Modify: `tests/client/contractExport.test.ts`

## Requirements
1. `ContractExportModal.tsx`:
   - Props: `isOpen: boolean, onClose: () => void, contract: ContractItem | null`.
   - Displays a clean tab selector: `[ AVDL (.avdl) ]` and `[ AVSC (.avsc / JSON) ]`.
   - When AVDL tab is selected: serialize `contract.edited` to standard AVDL string using `serializeAvdl`.
   - When AVSC tab is selected: format `contract.edited` as Avro JSON Schema string (`JSON.stringify(..., null, 2)`).
   - Code preview box with line numbers/monospace styling.
   - Action buttons: **Copy to Clipboard** (with visual copied feedback) and **Download File** (triggers browser download as `<contract-name>.avdl` or `<contract-name>.avsc`).
2. Test in `tests/client/contractExport.test.ts` verifying serialization toggle between AVDL and JSON.
3. Write report to `.superpowers/sdd/multi-contract/task-6-report.md`.
