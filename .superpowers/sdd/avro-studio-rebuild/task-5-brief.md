# Task 5 Brief: ID-based Diff Engine & Migration Linkage Generator

## Goal
Implement:
1. `src/core/utils/schemaDiff.ts`: Calculates structural differences between original and edited schemas using stable synthetic field IDs (`id`) and manual link overrides.
2. `src/core/utils/exportLinkages.ts`: Generates migration linkage artifacts (`LinkageExport`) for downstream database migrations.

## Files
- Create: `src/core/utils/schemaDiff.ts`
- Create: `src/core/utils/exportLinkages.ts`
- Create: `src/core/utils/index.ts`
- Test: `tests/core/utils/schemaDiff.test.ts`
- Test: `tests/core/utils/exportLinkages.test.ts`

## Requirements & Constraints
- Consume `AvroProtocol`, `AvroField`, `AvroRecordType`, `LinkageExport` from `src/core/types`.
- `schemaDiff.ts`:
  - `computeDiff(original: AvroProtocol | null, edited: AvroProtocol | null, manualLinks?: Map<string, string> | Array<[string, string]>, recordLinks?: Map<string, string> | Array<[string, string]>): SchemaDiffResult`
  - Field status categorization:
    - `unchanged`: Same ID, same record name, same field name, same type structure.
    - `renamed`: Same ID, same record, different field name.
    - `moved`: Same ID, different record, same field name.
    - `moved-renamed`: Same ID, different record, different field name.
    - `type-changed`: Same ID, same record/name, different type definition.
    - `added`: In edited schema, no matching ID or manual link in original.
    - `deleted`: In original schema, no matching ID in edited schema.
  - Manual links: `[editedFieldId, originalFieldId]` explicitly binds two fields, overriding synthetic ID matching.
  - Return aggregated stats: `{ addedCount, deletedCount, modifiedCount, renamedCount, movedCount, identicalCount }` plus per-field annotations for both original and edited schemas.
- `exportLinkages.ts`:
  - `buildLinkageExport(original: AvroProtocol, edited: AvroProtocol, manualLinks?: Array<[string, string]>, recordLinks?: Array<[string, string]>): LinkageExport`
  - Formats output conforming to `LinkageExport` interface:
    - `linkType`: `'identical' | 'moved' | 'renamed' | 'moved-renamed' | 'type-changed' | 'added' | 'deleted'`
    - `linkSource`: `'auto' | 'manual'`
    - `original`: `{ recordName, fieldName, cleanType, id }`
    - `edited`: `{ recordName, fieldName, cleanType, id }`
- Write failing unit tests testing:
  - Identification of added, removed, renamed, moved, and type-modified fields.
  - Manual link overrides when synthetic IDs differ.
  - Linkage export JSON generation.
- Implement both modules, make tests pass.
- Write report to `.superpowers/sdd/avro-studio-rebuild/task-5-report.md`.
