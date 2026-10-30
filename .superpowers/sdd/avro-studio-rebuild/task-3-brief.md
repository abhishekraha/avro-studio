# Task 3 Brief: AVDL Tokenizer & Recursive-Descent Parser

## Goal
Implement a hand-written tokenizer and recursive-descent parser for Avro IDL (`.avdl`) files into the flat `AvroProtocol` domain model.

## Files
- Create: `src/core/parser/avdlTokenizer.ts`
- Create: `src/core/parser/avdlParser.ts`
- Create: `src/core/parser/index.ts`
- Test: `tests/core/parser/avdlParser.test.ts`

## Requirements & Constraints
- Must consume domain types from `src/core/types`.
- Tokenizer:
  - Tokens: IDENT, DOC, STRING, NUMBER, LBRACE/RBRACE, LANGLE/RANGLE, LPAREN/RPAREN, LBRACKET/RBRACKET, SEMICOLON, COMMA, EQUALS, AT, QUESTION, EOF.
  - Track line and col.
  - Handle `//` and `/* ... */` comments.
  - `/** ... */` becomes DOC tokens (strip leading `*` in lines).
  - String escapes: `\n`, `\t`, `\r`, `\\`, `\"`.
  - Handle backtick-escaped identifiers (e.g. `` `avro.java.string` ``).
  - Handle numbers (negative, float, scientific notation).
- Parser (recursive descent):
  - Field IDs must be deterministic: `p-0001`, `p-0002` (zero-padded counter).
  - Collect annotations: `@namespace`, `@aliases`, `@schemaVersion`, `@logicalType`, `@order`.
  - Handle `union { null, string }` as well as shorthand `string?` -> `['null', 'string']`.
  - Handle `array<T>`, `map<T>`.
  - Handle default values (null, booleans, numbers, strings, arrays, objects).
  - Handle enum definitions (symbols, default symbol).
  - Handle fixed definitions: `fixed MD5(16);`.
  - Flattens all named types (record, enum, fixed) into `protocol.types`. Declarations inherit protocol namespace unless explicitly overridden with `@namespace`.
  - Backticked type names like `` `avro.java.string` `` should be preserved.
- Write failing unit tests in `tests/core/parser/avdlParser.test.ts` covering:
  - Sample e-commerce protocol with imports, doc comments, enums, records, unions, default values, and arrays.
  - Syntax error handling with line/column pointers.
- Implement tokenizer and parser, verify all tests pass.
- Write full report to `.superpowers/sdd/avro-studio-rebuild/task-3-report.md`.
