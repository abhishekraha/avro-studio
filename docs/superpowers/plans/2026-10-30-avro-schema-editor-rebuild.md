# Avro Schema Restructurer & Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modern, secure Avro Schema Restructurer and Studio web application featuring dual-pane visual schema restructuring, synthetic ID diff and linkage tracking, BigQuery schema generation, client-side dataset reconciliation, and SQLite (WAL) multi-user persistence via Drizzle ORM served from a unified Node.js/Hono server.

**Architecture:** Single-process Node.js deployment running Hono to serve typed REST APIs (`/api/*`) and compiled static React 19 frontend assets. Persistence uses embedded SQLite in WAL mode via Drizzle ORM. Domain modules (AVDL tokenizer/parser, Avro JSON parser, serializer, diff engine, BigQuery generator, and dataset recon engine) are implemented as pure, dependency-isolated TypeScript modules with comprehensive Vitest coverage.

**Tech Stack:** Node.js (v20+ LTS), TypeScript, React 19, Vite 6, Tailwind CSS v4, Lucide React, `@dnd-kit/core`, `@dnd-kit/sortable`, Hono, Drizzle ORM, `better-sqlite3`, Vitest.

**Spec:** [docs/superpowers/specs/2026-10-30-avro-schema-editor-design.md](file:///C:/Workspace/git/avro-editor/docs/superpowers/specs/2026-10-30-avro-schema-editor-design.md)

## Global Constraints
- React 19 and Vite 6 for client build.
- Node.js LTS with ESM modules throughout (`"type": "module"`).
- Persistence must use SQLite in WAL mode with `busy_timeout = 5000` via Drizzle ORM; no external database process required.
- Single unified production server: Hono process serves both `/api/*` and `dist/client/`.
- Synthetic field `id` must be preserved across parsing, editing, diffing, and exports to maintain migration linkages.
- Schema Registry Proxy must filter against private/loopback/metadata IP ranges (SSRF mitigation).

## Review Focus
1. AVDL comment retention & doc escaping: parser and serializer must preserve multiline `/** doc */` comments and escaped identifiers (`avro.java.`string``).
2. Synthetic ID preservation: field edits and renames in the editor must retain original client `id` strings so diff calculations correctly identify renames rather than delete+add.
3. Complex Avro types: Unions (`['null', 'string']` / `T?`), nested records, maps, arrays, and enums must correctly round-trip between AVDL and internal `AvroProtocol`.
4. High-concurrency database writes: Drizzle SQLite instance must handle concurrent workspace saves without SQLITE_BUSY locking errors.
5. SSRF validation in proxy: URLs resolving to `127.0.0.1`, `localhost`, `169.254.169.254`, or RFC 1918 blocks must be rejected with 400 Bad Request.

---

### Task 1: Project Scaffolding & Build Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/client/index.html`
- Create: `src/client/main.tsx`
- Create: `src/client/index.css`
- Test: `tests/scaffold.test.ts`

**Interfaces:**
- Produces: Working dev and production build scripts (`npm run build`, `npm run dev`, `npm test`).

- [ ] **Step 1: Write scaffold test**
Create `tests/scaffold.test.ts` verifying Node environment and TypeScript compatibility.
- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/scaffold.test.ts` (Expected: failure due to missing packages/config).
- [ ] **Step 3: Setup configuration files**
Configure `package.json` with scripts (`build`, `dev`, `test`, `start`), TypeScript configurations, Tailwind v4 imports in `index.css`, and basic Vite config with proxying to port 3001 in development.
- [ ] **Step 4: Install dependencies and run build**
Run: `npm install` and `npx vitest run tests/scaffold.test.ts`
- [ ] **Step 5: Commit**
`git add . && git commit -m "chore: scaffold project structure with Vite, React 19, and Vitest"`

---

### Task 2: Core Domain Model & Types

**Files:**
- Create: `src/core/types/schema.ts`
- Create: `src/core/types/workspace.ts`
- Create: `src/core/types/linkage.ts`
- Test: `tests/core/types.test.ts`

**Interfaces:**
- Produces: `AvroProtocol`, `AvroRecordType`, `AvroEnumType`, `AvroField`, `WorkspaceData`, `LinkageExport`.

- [ ] **Step 1: Write type assertion test**
Create `tests/core/types.test.ts` validating structural properties of `AvroProtocol` and `AvroField` (synthetic IDs, order, docstrings, unions).
- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/core/types.test.ts` (Expected: FAIL missing module).
- [ ] **Step 3: Implement domain types**
Create `src/core/types/schema.ts`, `src/core/types/workspace.ts`, and `src/core/types/linkage.ts` adhering to the flat protocol type model.
- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/core/types.test.ts`
- [ ] **Step 5: Commit**
`git add src/core/types/ tests/core/types.test.ts && git commit -m "feat(core): define domain models for AvroProtocol and Workspaces"`

---

### Task 3: AVDL Tokenizer and Recursive-Descent Parser

**Files:**
- Create: `src/core/parser/avdlTokenizer.ts`
- Create: `src/core/parser/avdlParser.ts`
- Test: `tests/core/parser/avdlParser.test.ts`

**Interfaces:**
- Consumes: `AvroProtocol`, `AvroRecordType`, `AvroField` from Task 2.
- Produces: `parseAvdl(source: string): AvroProtocol`.

- [ ] **Step 1: Write failing AVDL parser tests**
Create `tests/core/parser/avdlParser.test.ts` testing parsing of namespaces, imports, records, enums, unions, default values, backticked identifiers, and doc comments.
- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/core/parser/avdlParser.test.ts` (Expected: FAIL missing `parseAvdl`).
- [ ] **Step 3: Implement `avdlTokenizer` and `avdlParser`**
Implement lexer and recursive-descent parser allocating deterministic synthetic `p-{counter}` field IDs.
- [ ] **Step 4: Run parser tests**
Run: `npx vitest run tests/core/parser/avdlParser.test.ts` (Expected: PASS).
- [ ] **Step 5: Commit**
`git add src/core/parser/ tests/core/parser/ && git commit -m "feat(core): implement AVDL tokenizer and recursive-descent parser"`

---

### Task 4: Avro JSON Schema Parser & AVDL Serializer

**Files:**
- Create: `src/core/parser/avroJsonParser.ts`
- Create: `src/core/serializer/avdlSerializer.ts`
- Test: `tests/core/serializer/avdlSerializer.test.ts`
- Test: `tests/core/parser/avroJsonParser.test.ts`

**Interfaces:**
- Consumes: `AvroProtocol` from Task 2.
- Produces: `parseAvroJson(json: string | object): AvroProtocol` and `serializeToAvdl(protocol: AvroProtocol): string`.

- [ ] **Step 1: Write failing serializer & JSON parser tests**
Create tests for parsing standard Avro JSON schemas (with nested records flattened into `protocol.types`) and round-tripping AVDL -> Protocol -> AVDL.
- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/core/serializer/ tests/core/parser/avroJsonParser.test.ts` (Expected: FAIL).
- [ ] **Step 3: Implement `avroJsonParser` and `avdlSerializer`**
Implement standard two-pass flattening for JSON schemas and indentation-clean AVDL code generator with docstrings and annotations.
- [ ] **Step 4: Verify round-trip parsing**
Run: `npx vitest run tests/core/serializer/ tests/core/parser/avroJsonParser.test.ts` (Expected: PASS).
- [ ] **Step 5: Commit**
`git add src/core/ tests/core/ && git commit -m "feat(core): implement Avro JSON parser and AVDL serializer"`

---

### Task 5: ID-based Diff Engine & Migration Linkage Generator

**Files:**
- Create: `src/core/utils/schemaDiff.ts`
- Create: `src/core/utils/exportLinkages.ts`
- Test: `tests/core/utils/schemaDiff.test.ts`

**Interfaces:**
- Consumes: `AvroProtocol` from Task 2.
- Produces: `computeDiff(original: AvroProtocol, edited: AvroProtocol, manualLinks: Map<string, string>): SchemaDiffResult` and `buildLinkageExport(...)`.

- [ ] **Step 1: Write failing diff engine tests**
Test detection of added fields, removed fields, renamed fields (via ID or manual link), moved fields between records, and type mutations.
- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/core/utils/schemaDiff.test.ts` (Expected: FAIL).
- [ ] **Step 3: Implement diff calculation and linkage generator**
Write algorithms to match fields by synthetic `id` and records by name/linkage, computing structural deltas.
- [ ] **Step 4: Verify diff tests**
Run: `npx vitest run tests/core/utils/schemaDiff.test.ts` (Expected: PASS).
- [ ] **Step 5: Commit**
`git add src/core/utils/ tests/core/utils/ && git commit -m "feat(core): implement synthetic ID schema diff and linkage generator"`

---

### Task 6: BigQuery Schema Generator & Data Reconciliation Engine

**Files:**
- Create: `src/core/utils/bqSchemaGenerator.ts`
- Create: `src/core/utils/reconEngine.ts`
- Test: `tests/core/utils/bqSchemaGenerator.test.ts`
- Test: `tests/core/utils/reconEngine.test.ts`

**Interfaces:**
- Produces: `generateBqSchema(protocol: AvroProtocol, mode: 'standard' | 'legacy')` and `runRecon(sourceRows, targetRows, linkages)`.

- [ ] **Step 1: Write failing tests for BigQuery and Recon**
Verify mapping of Avro primitives to BigQuery types (e.g. `timestamp-micros` -> `TIMESTAMP`) and reconciliation of mismatched row values.
- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/core/utils/bqSchemaGenerator.test.ts tests/core/utils/reconEngine.test.ts` (Expected: FAIL).
- [ ] **Step 3: Implement BigQuery converter and Recon engine**
Support nested vs legacy flattened records, `bqIngestionTime` generation, and tabular key-indexed reconciliation.
- [ ] **Step 4: Verify test suite**
Run: `npx vitest run tests/core/utils/bqSchemaGenerator.test.ts tests/core/utils/reconEngine.test.ts` (Expected: PASS).
- [ ] **Step 5: Commit**
`git add src/core/utils/ tests/core/utils/ && git commit -m "feat(core): implement BigQuery schema generator and data recon engine"`

---

### Task 7: SQLite Persistence & Database Schema (Drizzle ORM)

**Files:**
- Create: `src/server/db/schema.ts`
- Create: `src/server/db/client.ts`
- Create: `src/server/db/workspaceRepository.ts`
- Test: `tests/server/db.test.ts`

**Interfaces:**
- Produces: `initDb(filePath?: string)`, `getWorkspaces(userId?: string)`, `saveWorkspace(data: WorkspaceData)`.

- [ ] **Step 1: Write failing DB integration test**
Create test inserting, retrieving, updating, and querying workspaces using an in-memory or temp SQLite instance with WAL mode verification.
- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/server/db.test.ts` (Expected: FAIL).
- [ ] **Step 3: Implement Drizzle schema and client**
Define tables with Drizzle, configure SQLite connection with `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;`.
- [ ] **Step 4: Verify persistence tests**
Run: `npx vitest run tests/server/db.test.ts` (Expected: PASS).
- [ ] **Step 5: Commit**
`git add src/server/db/ tests/server/db.test.ts && git commit -m "feat(server): setup Drizzle ORM with SQLite in WAL mode"`

---

### Task 8: Backend REST API & Secure Schema Registry Proxy (Hono)

**Files:**
- Create: `src/server/routes/workspaces.ts`
- Create: `src/server/routes/proxy.ts`
- Create: `src/server/app.ts`
- Create: `src/server/index.ts`
- Test: `tests/server/api.test.ts`

**Interfaces:**
- Produces: REST API handling `/api/workspaces`, `/api/proxy` (with SSRF check), and serving frontend static assets.

- [ ] **Step 1: Write API contract and security tests**
Verify workspace CRUD and confirm that `/api/proxy` blocks requests to private/loopback IP addresses.
- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/server/api.test.ts` (Expected: FAIL).
- [ ] **Step 3: Implement Hono routes & server**
Assemble Hono app with error handlers, CORS, SSRF URL validator, and workspace endpoints.
- [ ] **Step 4: Run API tests**
Run: `npx vitest run tests/server/api.test.ts` (Expected: PASS).
- [ ] **Step 5: Commit**
`git add src/server/ tests/server/api.test.ts && git commit -m "feat(server): implement Hono API endpoints and SSRF-guarded proxy"`

---

### Task 9: Frontend State & UI Components (React 19 + @dnd-kit)

**Files:**
- Create: `src/client/hooks/useSchemaState.ts`
- Create: `src/client/components/SchemaViewer/index.tsx`
- Create: `src/client/components/SchemaEditor/index.tsx`
- Create: `src/client/components/SchemaEditor/SortableField.tsx`
- Create: `src/client/components/Modals/BigQueryExportModal.tsx`
- Create: `src/client/components/Modals/ReconciliationModal.tsx`
- Create: `src/client/App.tsx`
- Test: `tests/client/useSchemaState.test.ts`

**Interfaces:**
- Consumes: Core domain parsers/diff engines (Tasks 3-6) and server API (Task 8).
- Produces: Complete interactive single-page studio application.

- [ ] **Step 1: Write state management unit tests**
Test `useSchemaState` undo/redo stack, field moves, renames, and deletions.
- [ ] **Step 2: Run state test to verify failure**
Run: `npx vitest run tests/client/useSchemaState.test.ts` (Expected: FAIL).
- [ ] **Step 3: Implement UI and drag-and-drop components**
Assemble dual-pane UI using `@dnd-kit`, modern Tailwind v4 styling, diff annotations, and export modals.
- [ ] **Step 4: Verify state tests & build**
Run: `npx vitest run tests/client/useSchemaState.test.ts && npm run build` (Expected: PASS).
- [ ] **Step 5: Commit**
`git add src/client/ tests/client/ && git commit -m "feat(client): implement interactive schema studio UI with @dnd-kit"`

---

### Task 10: Unified Production Container & End-to-End Verification

**Files:**
- Create: `Dockerfile`
- Create: `README.md`
- Test: Full build and smoke run script.

- [ ] **Step 1: Create multi-stage production Dockerfile**
Build Vite static bundle in stage 1, install production Node runtime in stage 2, exposing port 3000.
- [ ] **Step 2: Run end-to-end verification test suite**
Run: `npm test` across all unit, integration, and parser test suites.
- [ ] **Step 3: Document usage and instructions**
Update `README.md` with development setup, container build commands, and architecture diagrams.
- [ ] **Step 4: Commit**
`git add Dockerfile README.md && git commit -m "chore: add production Dockerfile and documentation"`
