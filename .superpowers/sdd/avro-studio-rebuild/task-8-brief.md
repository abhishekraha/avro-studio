# Task 8 Brief: Backend REST API & Secure Schema Registry Proxy (Hono)

## Goal
Implement the backend REST API using Hono with:
1. Workspace management endpoints (`/api/workspaces`).
2. Schema Registry fetch proxy (`/api/proxy`) with SSRF protection against internal loopback and private networks.
3. User tenancy extraction via `X-User-Id` header (with mock fallback).
4. Static file serving in production mode.

## Files
- Create: `src/server/routes/workspaces.ts`
- Create: `src/server/routes/proxy.ts`
- Create: `src/server/app.ts`
- Create: `src/server/index.ts`
- Test: `tests/server/api.test.ts`

## Requirements & Constraints
- Consume `WorkspaceRepository` and domain types from previous tasks.
- API Endpoints:
  - `GET /api/workspaces` -> `{ success: true, workspaces: WorkspaceMeta[] }`
  - `GET /api/workspaces/:id` -> `{ success: true, workspace: WorkspaceData }` (404 if not found)
  - `POST /api/workspaces` -> Body: `WorkspaceData` -> `{ success: true, id: string }`
  - `DELETE /api/workspaces/:id` -> `{ success: true }`
  - `PATCH /api/workspaces/:id/rename` -> Body: `{ name: string }` -> `{ success: true }`
  - `POST /api/workspaces/:id/revisions` -> Body: `{ snapshot: WorkspaceData, diffSummary?: any }` -> `{ success: true, revisionId: string }`
  - `GET /api/workspaces/:id/revisions` -> `{ success: true, revisions: [...] }`
  - `POST /api/proxy`:
    - Body: `{ url: string, headers?: Record<string, string> }`
    - SSRF Protection: MUST validate URL hostname against loopback (`127.0.0.1`, `localhost`, `::1`), private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`). Return 400 `{ error: "Target URL not permitted" }` if blocked.
    - Forward request to remote Schema Registry / schema URL, forward custom Authorization headers if provided, return response payload.
- Tenancy / User Context:
  - Middleware extracts `c.req.header('X-User-Id')` as optional `userId`. If omitted, default to `'default-user'` or undefined.
- Static Assets:
  - In production (`NODE_ENV === 'production'`), serve static files from `dist/client` and fallback unhandled non-API routes to `dist/client/index.html`.
- Error Handling:
  - Global error handler returning `{ success: false, error: string }` with appropriate HTTP status codes (400, 404, 500).
- Write comprehensive tests in `tests/server/api.test.ts` using Hono's `app.request()` testing helper:
  - Test workspace CRUD flow.
  - Test SSRF protection blocking `http://localhost/`, `http://127.0.0.1/`, `http://169.254.169.254/latest/meta-data`, and private subnets.
  - Test multi-user header isolation.
- Implement server modules, make tests pass.
- Write report to `.superpowers/sdd/avro-studio-rebuild/task-8-report.md`.
