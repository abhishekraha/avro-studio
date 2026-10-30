# Avro Studio

A modern, high-performance web studio for viewing, editing, diffing, and reconciling Apache Avro IDL (`.avdl`) schemas and Avro JSON schemas.

Designed for data platform engineers, analytics engineers, and backend developers who need visual schema authoring, migration tracking, BigQuery DDL/JSON generation, and automated data reconciliation.

---

## Key Features

- **Visual Schema Authoring & Split-Pane Editor**: Edit records, fields, types, documentation, and annotations side-by-side with instant live updates.
- **Bi-directional AVDL & Avro JSON Parsing/Serialization**: Full support for protocols, records, enums, fixed types, arrays, maps, and unions.
- **Intelligent Schema Diff Engine**: Identifies identical, added, deleted, renamed, moved, and modified fields between original and edited schemas.
- **Field & Record Linkages**: Automatically links identical/renamed fields, with support for custom drag-and-drop manual linkages and exportable migration JSON artifacts.
- **BigQuery Schema Generator**: Translates Avro primitive, logical, enum, fixed, array, and nested record types into production-grade BigQuery schema definitions.
- **Reconciliation Engine**: Automated data reconciliation running key-based comparisons between source and target datasets using schema linkages.
- **Schema Registry Proxy & SQLite Persistence**: Multi-workspace state persistence with WAL mode, revision snapshots, and CORS-bypassing Schema Registry proxy.
- **Unified Single-Port Production Server**: Hono server hosting REST APIs and serving client static assets from a single port (`3000`).

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │              Web Browser               │
                      │  (React 19 + Tailwind CSS + Lucide)    │
                      └──────────────────┬─────────────────────┘
                                         │ HTTP / REST
                                         ▼
                      ┌────────────────────────────────────────┐
                      │          Hono Server (:3000)           │
                      │                                        │
                      │  ┌──────────────┐    ┌──────────────┐  │
                      │  │ Static SPA   │    │ Workspace &  │  │
                      │  │ dist/client  │    │ Proxy APIs   │  │
                      │  └──────────────┘    └──────┬───────┘  │
                      └─────────────────────────────┼──────────┘
                                                    │
                               ┌────────────────────┴───────────────┐
                               │ SQLite Database (better-sqlite3)   │
                               │ /data/avro-editor.db (WAL mode)    │
                               └────────────────────────────────────┘
```

### Core Modules
- `src/core/parser`: AVDL and Avro JSON parsers converting schemas into normalized AST protocols.
- `src/core/serializer`: High-fidelity AVDL and Avro JSON serializers.
- `src/core/utils/schemaDiff`: Structural diff computation with renaming/move heuristics.
- `src/core/utils/bqSchemaGenerator`: Translation layer to BigQuery field schemas.
- `src/core/utils/reconEngine`: Data reconciliation report generator.
- `src/server`: Lightweight Hono backend, better-sqlite3 with Drizzle ORM, Schema Registry proxy routes, and static asset middleware.
- `src/client`: Modern React client with responsive layout, sidebars, diff visualization, and modals.

---

## Development Setup

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation
```bash
git clone https://github.com/example/avro-studio.git
cd avro-studio
npm install
```

### Running Locally
To run the Vite development server (hot-reloading):
```bash
npm run dev
```

### Running Tests
To run Vitest across all 13 test suites (unit, parser, serializer, server, e2e):
```bash
npm test
```

### Building for Production
Build both the frontend SPA (`dist/client`) and compile the TypeScript server (`dist/server`):
```bash
npm run build
```

### Starting the Production Server
```bash
npm start
```
By default, the server will listen on `http://localhost:3000`.

---

## Production Container (Docker)

Avro Studio includes an optimized multi-stage `Dockerfile` that packages both the frontend assets and backend server into a lean Alpine image running as a non-root `node` user.

### Build Image
```bash
docker build -t avro-studio:latest .
```

### Run Container
Mount a persistent directory to store the SQLite database:
```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/data \
  -e PORT=3000 \
  -e AVRO_DATA_DIR=/data \
  --name avro-studio \
  avro-studio:latest
```

### Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Application environment mode |
| `PORT` | `3000` | Port on which the unified server listens |
| `AVRO_DATA_DIR` | `/data` | Directory where `avro-editor.db` will be stored |
| `DATABASE_PATH` | `${AVRO_DATA_DIR}/avro-editor.db` | Explicit path override for the SQLite database file |

---

## Security Practices

- **Non-Root Execution**: Container runs strictly under the non-privileged `node` user (`UID 1000`).
- **Minimal Image Surface**: Multi-stage build with native build dependencies (`python3`, `make`, `g++`) stripped out of the final runtime stage.
- **Strict Network Isolation**: The Schema Registry proxy only forwards validated HTTP/HTTPS requests to prevent SSRF vulnerabilities.
- **Database Safety**: Prepared statements via Drizzle ORM and better-sqlite3 prevent SQL injection.
- **Data Integrity**: SQLite configured with `PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL`, and `PRAGMA foreign_keys = ON`.

---

## License

MIT
