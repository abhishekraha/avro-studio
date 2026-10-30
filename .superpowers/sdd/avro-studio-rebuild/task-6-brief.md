# Task 6 Brief: BigQuery Schema Generator & Data Reconciliation Engine

## Goal
Implement:
1. `src/core/utils/bqSchemaGenerator.ts`: Translates AvroProtocol definitions into BigQuery Table Schema JSON (supporting standard nested mode and legacy one-level flattened mode).
2. `src/core/utils/reconEngine.ts`: Compares migrated tabular dataset rows against original source rows guided by `LinkageExport` to report data parity and value mismatches.

## Files
- Create: `src/core/utils/bqSchemaGenerator.ts`
- Create: `src/core/utils/reconEngine.ts`
- Modify: `src/core/utils/index.ts`
- Test: `tests/core/utils/bqSchemaGenerator.test.ts`
- Test: `tests/core/utils/reconEngine.test.ts`

## Requirements & Constraints
- `bqSchemaGenerator.ts`:
  - `generateBqSchema(protocol: AvroProtocol, rootRecordName?: string, options?: { mode?: 'standard' | 'legacy'; includeIngestionTime?: boolean }): BqField[]`
  - Field type mappings:
    - `boolean` -> `BOOLEAN`
    - `int`, `long` -> `INTEGER`
    - `float`, `double` -> `FLOAT64`
    - `string` -> `STRING`
    - `bytes`, `fixed` -> `BYTES`
    - `logicalType: 'timestamp-micros' | 'timestamp-millis'` -> `TIMESTAMP`
    - `logicalType: 'date'` -> `DATE`
    - `logicalType: 'time-micros' | 'time-millis'` -> `TIME`
    - `enum` -> `STRING`
    - `array<T>` -> `mode: 'REPEATED'` with type of T
    - Nullable types (`string?` / `union { null, T }`) -> `mode: 'NULLABLE'`
    - Non-null types -> `mode: 'REQUIRED'`
    - `record` (nested):
      - Standard mode: `type: 'RECORD'`, `fields: BqField[]`
      - Legacy mode: Flattens top-level nested records into `parent_child` columns
    - If `includeIngestionTime` is true: append `bqIngestionTime` with `type: 'TIMESTAMP', mode: 'NULLABLE', defaultValueExpression: 'CURRENT_TIMESTAMP()'`.
- `reconEngine.ts`:
  - `runRecon(options: ReconOptions): ReconReport`
  - Options:
    - `sourceRows: Array<Record<string, unknown>>`
    - `targetRows: Array<Record<string, unknown>>`
    - `keyFields: string[]` (unique primary composite key)
    - `linkages: LinkageExport` (provides source -> target column mappings)
    - `tolerance?: { numericEpsilon?: number; ignoreWhitespace?: boolean }`
  - Output report:
    - `totalSourceRows`: number
    - `totalTargetRows`: number
    - `matchedRows`: number
    - `mismatchedRows`: Array<{ key: string; mismatches: Array<{ field: string; sourceValue: unknown; targetValue: unknown }> }>
    - `missingInTarget`: Array<{ key: string; sourceRow: Record<string, unknown> }>
    - `extraInTarget`: Array<{ key: string; targetRow: Record<string, unknown> }>
- Write comprehensive tests in both test files.
- Implement both modules, make tests pass.
- Write report to `.superpowers/sdd/avro-studio-rebuild/task-6-report.md`.
