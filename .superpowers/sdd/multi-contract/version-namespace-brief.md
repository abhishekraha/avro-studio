# Parallel Enhancement 2: Schema Version, Record Namespaces & Global Escape-Key Modal Closer

## Goal
1. Allow editing and bumping schema version from UI (`@schemaVersion`).
2. Support record-level namespaces (`record.namespace`), allowing two records with identical names in different namespaces.
3. Add global Escape key listener so pressing `Escape` closes any open modal/popup.

## Files
- Modify: `src/client/hooks/useSchemaState.ts`
- Modify: `src/client/components/SchemaEditor/index.tsx`
- Modify: `src/client/components/Header.tsx`
- Modify: `src/client/App.tsx`
- Test: `tests/client/versionNamespaceAndEscape.test.ts`

## Requirements
1. `useSchemaState.ts`:
   - Add `setSchemaVersion(version: string)`.
   - Add `updateRecordNamespace(recordName: string, namespace: string)`.
   - Ensure record lookups identify records uniquely by full qualified name (`namespace ? `${namespace}.${name}` : name`) or unique record index/id.
2. `Header.tsx` & `SchemaEditor/index.tsx`:
   - In Header / Protocol header: editable Schema Version badge (e.g. `v1.0.0` with quick bump patch/minor/major buttons).
   - In each Record card header: editable `namespace` input (e.g. `com.example.orders`) displayed alongside record name.
3. Global Escape Listener in `App.tsx`:
   - When any modal is open (`isBqModalOpen`, `isReconModalOpen`, `isLinkagesModalOpen`, `isImportModalOpen`, `isAvdlPreviewOpen`, `isContractSchemaOpen`, `isUserModalOpen`), pressing `Escape` closes them immediately.
4. Test in `tests/client/versionNamespaceAndEscape.test.ts`.
5. Write report to `.superpowers/sdd/multi-contract/version-namespace-report.md`.
