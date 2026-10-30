# Design Specification: Avro Schema Restructurer & Studio

## 1. Intent & Problem Statement
Data engineers frequently need to refactor Avro schemas (split records, rename fields, merge schemas, adjust logical types) while maintaining traceability for downstream database migrations (e.g. BigQuery) and data reconciliation pipelines.
The legacy architecture relied on an embedded dev-server hack (`vite.config.ts`), plain JSON files on disk, and entangled LDAP authentication. 

This rebuild delivers a modern, standalone, secure Avro Schema Studio with zero-overhead disk persistence and a clean separation of concerns.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Core Editor Focus**: The core app is strictly an interactive Avro schema restructurer, diff engine, and migration artifact generator.
- **Robust Multi-User Persistence**: SQLite in Write-Ahead Logging (WAL) mode with Drizzle ORM, safely supporting 100+ concurrent users with sub-millisecond ACID transactions and zero external database daemons.
- **Single-Process Production Deployment**: A production-ready Node.js server (Hono) serving the typed REST API (`/api/*`) and the compiled static frontend from a single port/container.
- **Modern Developer UI**: Built on React 19, TypeScript, Vite, Tailwind CSS v4, and Radix/shadcn-style UI components with `@dnd-kit` drag-and-drop.
- **Full Functional Parity**:
  - Full recursive-descent Avro IDL (`.avdl`) parser & serializer.
  - Avro JSON schema parser and Schema Registry URL importer.
  - Synthetic client ID (`id`) diff and migration linkage tracking (`buildLinkageExport`).
  - BigQuery schema generation with legacy flattened vs. nested modes.
  - Data Reconciliation Engine (`reconEngine`) to validate migrated CSV/JSON datasets against schema linkages.

### Non-Goals
- Active directory / LDAP binding inside the core application server (deferred to external proxy or future auth module).
- Distributed multi-node database clustering (out of scope; SQLite handles single-instance multi-user cleanly).

### Anti-Goals
- Embedding backend business logic inside frontend build toolchain files (no `vite.config.ts` backend middlewares in production).
- Writing unindexed, unstructured flat JSON files directly to the filesystem.

---

## 3. Architecture & Approaches Considered

### Approaches Evaluated

| Approach | Architecture | Concurrency & Ops | Portability / Migration | Status |
|---|---|---|---|---|
| **Option 1: Flat JSON Files + Dev Middleware** (Legacy) | Express middlewares inside `vite.config.ts`, raw `.json` files in `/data` | File locks fail under concurrency; requires `vite dev` in prod container | Brittle, zero schema safety | Rejected |
| **Option 2: Standalone Postgres + Express** | Separate PostgreSQL daemon container + Node API backend | Excellent concurrency; high operational overhead for single-container setups | Requires running 2 separate containers/services | Rejected |
| **Option 3: Single-Process Hono/Node + SQLite (WAL) + Drizzle ORM** (Selected) | 1 Node process serving API & static Vite build; SQLite WAL mode via Drizzle | Handles 100+ users (2,000-5,000 writes/sec); zero external dependencies; sub-ms latency | Trivial migration to Postgres via Drizzle schema definition | **Selected** |

---

## 4. System Components & Module Design

### 4.1 Persistence Layer (`src/server/db/`)
- **Engine**: SQLite running with `PRAGMA journal_mode = WAL;`, `PRAGMA synchronous = NORMAL;`, `PRAGMA busy_timeout = 5000;`.
- **ORM**: Drizzle ORM (`drizzle-orm/better-sqlite3`).
- **Schema**:
  - `workspaces`: `id (uuid)`, `userId (text/nullable)`, `name (text)`, `originalSchema (json/text)`, `editedSchema (json/text)`, `manualLinks (json)`, `recordLinks (json)`, `updatedAt (integer/timestamp)`.
  - `revisions`: `id`, `workspaceId`, `diffSummary`, `snapshot`, `createdAt`.
  - `stats`: Aggregate counters for usage metrics.

### 4.2 Backend API (`src/server/`)
- Implemented with **Hono** on Node.js adapter.
- Endpoints:
  - `GET /api/workspaces` — list user workspaces
  - `GET /api/workspaces/:id` — load workspace data
  - `POST /api/workspaces` — create/save workspace
  - `DELETE /api/workspaces/:id` — remove workspace
  - `POST /api/proxy` — fetch external schema registry definitions (with SSRF protection checking against internal loopbacks)
- Static File Serving: Serves `dist/client` in production mode.

### 4.3 Domain Core (`src/core/`)
- `parser/avdlParser.ts`: Custom recursive-descent parser producing flat `AvroProtocol` model.
- `parser/avroJsonParser.ts`: Converts Avro JSON Schema / Schema Registry responses into flat `AvroProtocol`.
- `serializer/avdlSerializer.ts`: Serializes `AvroProtocol` back to clean `.avdl` format.
- `utils/schemaDiff.ts`: ID-based diff engine computing field/record moves, additions, deletions, renames, and type mutations.
- `utils/bqSchemaGenerator.ts`: Generates standard or legacy BigQuery table schemas.
- `utils/reconEngine.ts`: Compares old dataset rows against migrated dataset rows based on field linkage artifacts.

### 4.4 Frontend Studio (`src/client/`)
- **React 19 + TypeScript + Vite + Tailwind CSS v4**.
- State: `useSchemaState` (undo/redo stack, immutable working copies), `useWorkspace`.
- Interaction: `@dnd-kit` single context spanning the read-only Schema Viewer and the interactive Schema Editor.
- UI Layout: Dual-panel studio with collapsible cards, type badges, drag handles, and export drawers.

---

## 5. Security Architecture
- **SSRF Protection**: Remote Schema Registry proxy validates URLs against private/reserved IP blocks (127.0.0.1, 169.254.*, 10.*, RFC 1918) before issuing requests.
- **Input Validation**: API inputs validated via Zod schemas.
- **SQL Injection Prevention**: Parameterized queries enforced via Drizzle ORM.
- **Clean Auth Boundary**: Tenancy keyed to an injectable user identifier header (`X-User-Id` or JWT context placeholder) with a clean mock fallback.

---

## 6. Implementation Stages (For writing-plans)
1. **Repository Scaffolding**: Setup Vite, React 19, Tailwind v4, Hono server, and Drizzle/better-sqlite3 database scaffolding.
2. **Persistence & API**: Implement SQLite schema, Drizzle repository, and Hono REST endpoints.
3. **Core Domain Parsers & Diff Engine**: Implement AVDL tokenizer, recursive-descent parser, serializer, and ID-based diff engine.
4. **Interactive Editor UI**: Implement dual-pane `@dnd-kit` editor, record cards, field rows, and type selectors.
5. **Generators & Reconciliation**: Implement BigQuery schema generator and data recon engine.
6. **Production Build & Verification**: Single-command container build and end-to-end parser round-trip tests.
