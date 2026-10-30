# Parallel Enhancement 1: Record Linking, Copy Deleted Record & Duplicate Field Guard

## Goal
1. Allow linking/unlinking records between left and right panes (`recordLinks` in workspace/active contract).
2. Allow copying an entire deleted or un-migrated record from the left pane to the right pane with a "Copy Record to Editor" button.
3. Validate and enforce that no two fields in the same record can share the same name (show validation error / reject duplicate renames and additions).

## Files
- Modify: `src/client/hooks/useSchemaState.ts`
- Modify: `src/client/components/SchemaViewer/index.tsx`
- Modify: `src/client/components/SchemaEditor/index.tsx`
- Modify: `src/client/components/SchemaEditor/SortableField.tsx`
- Test: `tests/client/recordLinkingAndFieldGuard.test.ts`

## Requirements
1. `useSchemaState.ts`:
   - Enforce duplicate field name guard: `addField` and `renameField` throw or return false if a field with the target name (case-sensitive or lowercase) already exists in that record.
   - Add `copyRecordFromOriginal(record: AvroRecordType)`: creates deep clone with fresh synthetic field IDs (`g-XXXX`) and automatically adds manual linkages to `manualLinks`.
2. `SchemaViewer/index.tsx`:
   - On each record card header in the Original pane, add:
     - "Copy Record to Editor" button (copies all fields, mints IDs, binds linkages).
     - Record linking status pill (linked to `<recordName>` on right, with Unlink `×` button and Link button).
3. `SchemaEditor/index.tsx`:
   - Duplicate field name error banner or tooltip when entering an existing field name.
4. Test in `tests/client/recordLinkingAndFieldGuard.test.ts`.
5. Write report to `.superpowers/sdd/multi-contract/record-linking-report.md`.
