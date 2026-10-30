# Task 10 Brief: Unified Production Container & End-to-End Verification

## Goal
Finalize the project with:
1. Multi-stage `Dockerfile` creating a lean, secure production image running Node.js and serving both static client assets and REST APIs from a single port (3000).
2. `.dockerignore` ignoring node_modules, build artifacts, git, and local temp files.
3. Clean `start` script in `package.json` (`node dist/server/index.js`).
4. End-to-end integration and smoke verification test (`tests/e2e/smoke.test.ts`) validating end-to-end flow:
   - Parse AVDL schema -> save to SQLite workspace -> load workspace from API -> compute diff -> export BigQuery schema -> run reconciliation -> serialize back to AVDL.
5. Complete documentation in `README.md` covering architecture, development commands, production container usage, and security practices.

## Files
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `README.md`
- Create: `tests/e2e/smoke.test.ts`
- Modify: `package.json` (add `"start": "node dist/server/index.js"`)

## Requirements & Constraints
- Dockerfile:
  - Multi-stage build (Builder stage: node:20-alpine or node:22-alpine builds Vite frontend and compiles TypeScript server).
  - Production stage: installs production dependencies only (`npm ci --omit=dev`), copies `dist/client` to `dist/client`, exposes port 3000, runs as non-root user (`USER node`).
  - Environment defaults: `NODE_ENV=production`, `PORT=3000`, `AVRO_DATA_DIR=/data`.
- Run full test suite: `npm test` verifying 100% test pass across all 13 test suites.
- Run full build: `npm run build` cleanly creating `dist/client` and `dist/server`.
- Write report to `.superpowers/sdd/avro-studio-rebuild/task-10-report.md`.
