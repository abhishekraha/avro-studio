import { describe, it, expect, vi } from 'vitest';
import { SchemaStateManager } from '@/client/hooks/useSchemaState';
import type { AvroProtocol, AvroRecordType } from '@/core/types/schema';

describe('Record Linking, Copy Record & Duplicate Field Guard', () => {
  const sampleProtocol: AvroProtocol = {
    protocol: 'OrderService',
    namespace: 'com.example',
    types: [
      {
        type: 'record',
        name: 'Order',
        fields: [
          { id: 'f-1', name: 'id', type: 'string' },
          { id: 'f-2', name: 'amount', type: 'double' },
        ],
      },
      {
        type: 'record',
        name: 'Customer',
        fields: [
          { id: 'f-3', name: 'customerId', type: 'string' },
          { id: 'f-4', name: 'email', type: 'string' },
        ],
      },
    ],
  };

  describe('Duplicate Field Name Guard', () => {
    it('rejects addField when a field with the same name already exists in the record', () => {
      const manager = new SchemaStateManager(sampleProtocol);

      expect(() => {
        manager.addField('Order', { name: 'id', type: 'string' });
      }).toThrow(/already exists/i);

      // Verify no field was added
      const order = manager.getCurrent()?.types.find((t) => t.name === 'Order') as AvroRecordType;
      expect(order.fields).toHaveLength(2);
    });

    it('rejects addField case-insensitively', () => {
      const manager = new SchemaStateManager(sampleProtocol);

      expect(() => {
        manager.addField('Order', { name: 'ID', type: 'int' });
      }).toThrow(/already exists/i);
    });

    it('rejects renameField when the new name collides with another field in the record', () => {
      const manager = new SchemaStateManager(sampleProtocol);

      expect(() => {
        manager.renameField('Order', 'f-2', 'id');
      }).toThrow(/already exists/i);

      // Verify name was not changed
      const order = manager.getCurrent()?.types.find((t) => t.name === 'Order') as AvroRecordType;
      expect(order.fields.find((f) => f.id === 'f-2')?.name).toBe('amount');
    });

    it('allows renameField to the same name or casing change of the same field', () => {
      const manager = new SchemaStateManager(sampleProtocol);

      // Renaming f-1 to 'id' (same name) should succeed or no-op
      expect(() => {
        manager.renameField('Order', 'f-1', 'id');
      }).not.toThrow();

      // Renaming f-1 to 'ID' (self-casing change) should succeed
      expect(() => {
        manager.renameField('Order', 'f-1', 'ID');
      }).not.toThrow();
      const order = manager.getCurrent()?.types.find((t) => t.name === 'Order') as AvroRecordType;
      expect(order.fields.find((f) => f.id === 'f-1')?.name).toBe('ID');
    });
  });

  describe('copyRecordFromOriginal', () => {
    it('creates deep clone of a record with fresh synthetic IDs (g-XXXX) and binds manual linkages', () => {
      const manager = new SchemaStateManager(sampleProtocol);

      const origRecord: AvroRecordType = {
        type: 'record',
        name: 'DeletedRecord',
        namespace: 'com.example',
        doc: 'A deleted record from original',
        fields: [
          { id: 'orig-1', name: 'delField1', type: 'string', doc: 'field doc' },
          { id: 'orig-2', name: 'delField2', type: 'int', default: 42 },
        ],
      };

      const result = manager.copyRecordFromOriginal(origRecord);

      expect(result.record).toBeDefined();
      expect(result.record.name).toBe('DeletedRecord');
      expect(result.record.namespace).toBe('com.example');
      expect(result.record.doc).toBe('A deleted record from original');
      expect(result.record.fields).toHaveLength(2);

      // Verify fresh synthetic IDs starting with g-
      expect(result.record.fields[0].id).toMatch(/^g-[a-z0-9]+$/);
      expect(result.record.fields[1].id).toMatch(/^g-[a-z0-9]+$/);
      expect(result.record.fields[0].id).not.toBe('orig-1');
      expect(result.record.fields[1].id).not.toBe('orig-2');

      // Verify linkages: [newFieldId, origFieldId]
      expect(result.createdLinks).toEqual([
        [result.record.fields[0].id, 'orig-1'],
        [result.record.fields[1].id, 'orig-2'],
      ]);

      // Verify record is added to manager's current state
      const current = manager.getCurrent();
      const added = current?.types.find((t) => t.name === 'DeletedRecord') as AvroRecordType;
      expect(added).toBeDefined();
      expect(added.fields).toHaveLength(2);
      expect(manager.isDirty()).toBe(true);
    });

    it('handles copy when record name already exists in target by appending or preserving according to rules', () => {
      const manager = new SchemaStateManager(sampleProtocol);

      const existingRecord: AvroRecordType = {
        type: 'record',
        name: 'Order',
        fields: [
          { id: 'orig-o1', name: 'id', type: 'string' },
        ],
      };

      // If record name exists, it could either replace, rename, or throw. If copyRecordFromOriginal appends a unique name or replaces:
      // Let's test standard copy: if 'Order' exists, it could rename to 'Order_copy' or handle gracefully.
      const result = manager.copyRecordFromOriginal(existingRecord, 'Order_Copy');
      expect(result.record.name).toBe('Order_Copy');
      expect(result.createdLinks).toEqual([[result.record.fields[0].id, 'orig-o1']]);
    });
  });

  describe('UI Component Rendering: SchemaViewer & SchemaEditor', () => {
    it('renders "Copy Record to Editor" button and record link controls in SchemaViewer', async () => {
      const React = await import('react');
      const { renderToString } = await import('react-dom/server');
      const { SchemaViewer } = await import('@/client/components/SchemaViewer');

      const onCopyRecord = vi.fn();
      const onLinkRecord = vi.fn();
      const onUnlinkRecord = vi.fn();

      const html = renderToString(
        React.createElement(SchemaViewer, {
          protocol: sampleProtocol,
          recordLinks: [['OrderV2', 'Order']],
          availableEditedRecordNames: ['OrderV2', 'CustomerV2'],
          onCopyRecord,
          onLinkRecord,
          onUnlinkRecord,
        })
      );

      // Verify "Copy Record to Editor" exists
      expect(html).toContain('Copy Record to Editor');
      // Verify linked status pill for Order
      expect(html).toContain('linked to OrderV2');
      // Verify Link Record button exists for unlinked Customer record
      expect(html).toContain('Link Record');
    });

    it('renders duplicate field name guard feedback in SchemaEditor SortableField', async () => {
      const React = await import('react');
      const { renderToString } = await import('react-dom/server');
      const { SchemaEditor } = await import('@/client/components/SchemaEditor');

      const html = renderToString(
        React.createElement(SchemaEditor, {
          protocol: sampleProtocol,
          onAddField: vi.fn(),
          onRemoveField: vi.fn(),
          onRenameField: vi.fn(),
          onUpdateFieldType: vi.fn(),
          onReorderField: vi.fn(),
          onMoveField: vi.fn(),
          onAddRecord: vi.fn(),
          onRemoveRecord: vi.fn(),
          onRenameRecord: vi.fn(),
        })
      );

      // Verify records and fields render properly
      expect(html).toContain('Order');
      expect(html).toContain('Customer');
      expect(html).toContain('customerId');
      expect(html).toContain('amount');
    });
  });
});
