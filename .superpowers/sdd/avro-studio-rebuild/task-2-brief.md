# Task 2 Brief: Core Domain Model & Types

## Goal
Implement the core domain model types for Avro schemas, workspaces, and migration linkages.

## Files
- Create: `src/core/types/schema.ts`
- Create: `src/core/types/workspace.ts`
- Create: `src/core/types/linkage.ts`
- Create: `src/core/types/index.ts`
- Test: `tests/core/types.test.ts`

## Requirements & Constraints
- Must follow the flat protocol model defined in the design spec:
  - `PrimitiveType`: `'null' | 'boolean' | 'int' | 'long' | 'float' | 'double' | 'bytes' | 'string'`
  - `AvroField`:
    - `id`: string (synthetic stable client ID, e.g. `'p-001'` or `'g-xxx'`)
    - `name`: string
    - `type`: `AvroSchemaType`
    - `doc?`: string
    - `default?`: unknown
    - `aliases?`: string[]
    - `order?`: `'ascending' | 'descending' | 'ignore'`
    - `logicalType?`: string
  - `AvroRecordType`: `{ type: 'record', name: string, namespace?: string, doc?: string, aliases?: string[], fields: AvroField[] }`
  - `AvroEnumType`: `{ type: 'enum', name: string, namespace?: string, doc?: string, aliases?: string[], symbols: string[], default?: string }`
  - `AvroArrayType`: `{ type: 'array', items: AvroSchemaType }`
  - `AvroMapType`: `{ type: 'map', values: AvroSchemaType }`
  - `AvroFixedType`: `{ type: 'fixed', name: string, namespace?: string, size: number }`
  - `AvroUnionType`: `AvroSchemaType[]`
  - `AvroSchemaType`: `PrimitiveType | AvroRecordType | AvroEnumType | AvroArrayType | AvroMapType | AvroFixedType | AvroUnionType | string` (where string is a named type reference)
  - `AvroNamedType`: `AvroRecordType | AvroEnumType | AvroFixedType`
  - `AvroProtocol`:
    - `protocol`: string
    - `namespace?`: string
    - `doc?`: string
    - `schemaVersion?`: string
    - `types`: `AvroNamedType[]` (flat, de-duplicated named types)
  - `WorkspaceData`:
    - `id`: string
    - `name`: string
    - `userId?`: string
    - `savedAt`: string
    - `isNew`: boolean
    - `original`: `AvroProtocol | null`
    - `edited`: `AvroProtocol | null`
    - `manualLinks`: Array<[string, string]> // [editedFieldId, originalFieldId]
    - `recordLinks?`: Array<[string, string]>
    - `originalFieldNotes?`: Array<[string, string]>
    - `editedFieldNotes?`: Array<[string, string]>
  - `LinkageExport`:
    - `exportedAt`: string
    - `schemaName`: string
    - `linkages`: Array<{
        linkType: 'identical' | 'moved' | 'renamed' | 'moved-renamed' | 'type-changed' | 'added' | 'deleted';
        linkSource: 'auto' | 'manual';
        original?: { recordName: string; fieldName: string; cleanType: string; id: string };
        edited?: { recordName: string; fieldName: string; cleanType: string; id: string };
      }>
- Export all types via `src/core/types/index.ts`.
- Write failing test in `tests/core/types.test.ts` exercising type guards, constructors, and structural checks.
- Implement types and make tests pass.
- Write report to `.superpowers/sdd/avro-studio-rebuild/task-2-report.md`.
