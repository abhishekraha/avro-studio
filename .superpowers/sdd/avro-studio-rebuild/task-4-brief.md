# Task 4 Brief: Avro JSON Schema Parser & AVDL Serializer

## Goal
Implement:
1. `avroJsonParser.ts`: Parses standard Avro JSON schemas (or Schema Registry envelopes) and flattens nested records/types into `AvroProtocol`.
2. `avdlSerializer.ts`: Serializes an `AvroProtocol` back to standard `.avdl` string format (inverse of AVDL parser).

## Files
- Create: `src/core/parser/avroJsonParser.ts`
- Create: `src/core/serializer/avdlSerializer.ts`
- Create: `src/core/serializer/index.ts`
- Test: `tests/core/parser/avroJsonParser.test.ts`
- Test: `tests/core/serializer/avdlSerializer.test.ts`

## Requirements & Constraints
- Consume `AvroProtocol`, `AvroField`, `AvroNamedType` from `src/core/types`.
- `avroJsonParser.ts`:
  - `parseAvroJson(input: string | object, subject?: string): AvroProtocol`
  - Support standard Schema Registry payload wrappers: `{ schema: string | object }` or `{ definition: string }`.
  - Two-pass flattening:
    1. Pass 1: Walk schema tree to collect all named types (`record`, `enum`, `fixed`), map namespaces and fully-qualified names.
    2. Pass 2: Replace inline nested record/enum definitions with string type references, hoisting named definitions into `protocol.types`.
  - Synthetic field IDs: generate via `g-XXXX` (deterministic or timestamp+counter generator).
  - Extract logicalType wrappers (e.g. `{"type": "long", "logicalType": "timestamp-micros"}`).
  - Extract aliases, docstrings, default values, and field orders.
- `avdlSerializer.ts`:
  - `serializeToAvdl(protocol: AvroProtocol): string`
  - Output header: `@namespace("...")`, `@schemaVersion("...")`, `protocol ProtocolName { ... }`.
  - Types formatted with 2 or 4 space indentation.
  - Formats docstrings as `/** doc */`.
  - Formats `@logicalType("...")` annotations on fields.
  - Formats nullable unions: `['null', 'string']` as `string?` (or shorthand union).
  - Round-trip guarantee: `parseAvdl(serializeToAvdl(protocol))` matches structure of `protocol`.
- Write failing tests in both test files.
- Implement both modules and verify tests pass.
- Write report to `.superpowers/sdd/avro-studio-rebuild/task-4-report.md`.
