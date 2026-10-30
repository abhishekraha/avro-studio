# Task 2 Brief: User Identity & Local Storage Tenant Scoping

## Goal
Implement client-side user identity persistence (`localStorage`) and inject `X-User-Id` into all workspace API requests.

## Files
- Create: `src/client/hooks/useUserIdentity.ts`
- Create: `src/client/components/Modals/UserModal.tsx`
- Modify: `src/client/hooks/useWorkspaces.ts`
- Test: `tests/client/useUserIdentity.test.ts`

## Requirements
1. `useUserIdentity.ts`:
   - Checks `localStorage.getItem('avro_user_id')`.
   - Exposes: `{ userId: string | null, setUserId: (id: string) => void, clearUserId: () => void, isInitialized: boolean }`.
2. `UserModal.tsx`:
   - If `!userId`, presents a modal: "Welcome to Avro Studio. Enter your name or handle to access your personal workspace."
   - Input field with Submit button. On submit, saves to storage via `setUserId`.
3. `useWorkspaces.ts`:
   - Reads `userId` and passes `headers: { 'X-User-Id': userId || '' }` on all fetch calls (`listWorkspaces`, `getWorkspace`, `saveWorkspace`, `deleteWorkspace`, `renameWorkspace`).
4. Unit tests in `tests/client/useUserIdentity.test.ts` checking storage persistence.
5. Write report to `.superpowers/sdd/multi-contract/task-2-report.md`.
