# Task 1 Brief: Project Scaffolding & Build Configuration

## Goal
Scaffold the full TypeScript project with Vite, React 19, Tailwind CSS v4, and Vitest for testing.

## Files
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/client/index.html`
- Create: `src/client/main.tsx`
- Create: `src/client/index.css`
- Test: `tests/scaffold.test.ts`

## Requirements & Constraints
- Must be pure ESM (`"type": "module"`).
- Include scripts in `package.json`:
  - `"dev"`: starts Vite dev server
  - `"build"`: compiles client with Vite (`vite build`) and server with tsc
  - `"test"`: runs Vitest (`vitest run`)
- Dependencies to install:
  - React 19 (`react@^19.0.0`, `react-dom@^19.0.0`, `@types/react`, `@types/react-dom`)
  - Vite (`vite@^6.0.0`, `@vitejs/plugin-react@^4.3.0`)
  - Tailwind CSS v4 (`@tailwindcss/vite` or `@tailwindcss/postcss` with `tailwindcss@^4.0.0`)
  - Lucide icons (`lucide-react`)
  - Drag and drop (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)
  - Server & DB (`hono@^4.6.0`, `@hono/node-server@^1.13.0`, `better-sqlite3@^11.0.0`, `@types/better-sqlite3`, `drizzle-orm@^0.38.0`, `drizzle-kit@^0.30.0`, `zod@^3.24.0`)
  - Testing (`vitest@^3.0.0`)
- Write failing test `tests/scaffold.test.ts` checking environment and basic imports.
- Make tests pass and verify `npm test` runs cleanly.
- Write your full report to `.superpowers/sdd/avro-studio-rebuild/task-1-report.md`.
