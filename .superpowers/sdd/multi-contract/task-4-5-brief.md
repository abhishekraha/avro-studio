# Task 4 & 5 Combined Brief: Unified @dnd-kit Cross-Pane Drag-and-Drop, Auto-Linkage & Interactive Linking Controls

## Goal
Implement:
1. Unified top-level `@dnd-kit` context across both Left (SchemaViewer) and Right (SchemaEditor) panes.
2. Dragging a field from the original schema into a target record in the edited schema creates a new field and automatically registers `[newFieldId, originalFieldId]` in `manualLinks`.
3. Interactive link/unlink controls on field rows in both panes (green link pill showing linked partner with unlink `×` button, plus click-to-link pairing mode).

## Files
- Modify: `src/client/components/SchemaViewer/index.tsx`
- Modify: `src/client/components/SchemaEditor/index.tsx`
- Modify: `src/client/components/SchemaEditor/SortableField.tsx`
- Modify: `src/client/App.tsx`
- Test: `tests/client/dndAndLinking.test.ts`

## Requirements
1. Draggable Original Fields:
   - In `SchemaViewer`, wrap field rows with `useDraggable({ id: 'orig-' + field.id, data: { source: 'original', field, recordName } })`.
   - Add drag handle icon.
2. Droppable Records:
   - In `SchemaEditor`, each record card uses `useDroppable({ id: 'drop-rec-' + record.name })`.
3. Auto-Link on Drop:
   - In `App.tsx` top-level `DndContext` `onDragEnd`:
     - If active item is from `source: 'original'` and over target is an edited record:
       - Allocate new synthetic ID `g-XXXX`.
       - Add field to target record with matching name and type.
       - Immediately append `[newFieldId, originalField.id]` to `activeContract.manualLinks`.
4. Link & Unlink Controls:
   - On each field in both Original and Edited panes, display linkage status:
     - If linked: show a badge with linked partner's field name and a clickable `×` (Unlink) button.
     - Clicking `×` removes the entry from `manualLinks`.
     - If unlinked: provide a "Link" button. When clicked, enters linking mode; clicking any unlinked field on the opposing pane creates the link pair in `manualLinks`.
5. Unit test in `tests/client/dndAndLinking.test.ts`.
6. Write report to `.superpowers/sdd/multi-contract/task-4-5-report.md`.
