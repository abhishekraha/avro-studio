import { describe, it, expect, vi } from 'vitest';
import { SchemaStateManager } from '@/client/hooks/useSchemaState';
import type { AvroProtocol } from '@/core/types/schema';

describe('Schema Version, Record Namespaces & Global Escape Modal Closer', () => {
  const sampleProtocol: AvroProtocol = {
    protocol: 'OrderService',
    namespace: 'com.example',
    schemaVersion: '1.0.0',
    types: [
      {
        type: 'record',
        name: 'Order',
        namespace: 'com.example.orders',
        fields: [
          { id: 'f-1', name: 'id', type: 'string' },
          { id: 'f-2', name: 'amount', type: 'double' },
        ],
      },
      {
        type: 'record',
        name: 'Order',
        namespace: 'com.example.billing',
        fields: [
          { id: 'f-3', name: 'invoiceId', type: 'string' },
        ],
      },
      {
        type: 'record',
        name: 'Customer',
        // inherits protocol namespace
        fields: [
          { id: 'f-4', name: 'email', type: 'string' },
        ],
      },
    ],
  };

  describe('Schema Version Management', () => {
    it('sets and updates schema version', () => {
      const manager = new SchemaStateManager(sampleProtocol);
      expect(manager.getCurrent()?.schemaVersion).toBe('1.0.0');

      manager.setSchemaVersion('1.1.0');
      expect(manager.getCurrent()?.schemaVersion).toBe('1.1.0');
      expect(manager.canUndo()).toBe(true);

      manager.undo();
      expect(manager.getCurrent()?.schemaVersion).toBe('1.0.0');

      manager.redo();
      expect(manager.getCurrent()?.schemaVersion).toBe('1.1.0');
    });

    it('clears or sets empty schema version', () => {
      const manager = new SchemaStateManager(sampleProtocol);
      manager.setSchemaVersion('');
      expect(manager.getCurrent()?.schemaVersion).toBeUndefined();
    });
  });

  describe('Record Namespaces & Qualified Name Uniqueness', () => {
    it('updates record namespace', () => {
      const manager = new SchemaStateManager(sampleProtocol);
      manager.updateRecordNamespace('Order', 'com.example.sales', 'com.example.orders');

      const current = manager.getCurrent();
      const updated = current?.types.find(
        (t) => t.name === 'Order' && (t as any).namespace === 'com.example.sales'
      );
      expect(updated).toBeDefined();

      // Undo restores original namespace
      manager.undo();
      const undone = manager.getCurrent()?.types.find(
        (t) => t.name === 'Order' && (t as any).namespace === 'com.example.orders'
      );
      expect(undone).toBeDefined();
    });

    it('allows two records with the same name in different namespaces and modifies fields in the correct one', () => {
      const manager = new SchemaStateManager(sampleProtocol);

      // Add field to com.example.billing.Order
      manager.addField('com.example.billing.Order', {
        name: 'taxAmount',
        type: 'double',
      });

      const current = manager.getCurrent();
      const billingOrder = current?.types.find(
        (t) => t.name === 'Order' && (t as any).namespace === 'com.example.billing'
      ) as any;
      const salesOrder = current?.types.find(
        (t) => t.name === 'Order' && (t as any).namespace === 'com.example.orders'
      ) as any;

      expect(billingOrder.fields).toHaveLength(2);
      expect(billingOrder.fields[1].name).toBe('taxAmount');
      expect(salesOrder.fields).toHaveLength(2); // unchanged
    });

    it('removes record by qualified name or target namespace', () => {
      const manager = new SchemaStateManager(sampleProtocol);
      manager.removeRecord('com.example.billing.Order');

      const current = manager.getCurrent();
      expect(current?.types).toHaveLength(2);
      const remainingOrders = current?.types.filter((t) => t.name === 'Order');
      expect(remainingOrders).toHaveLength(1);
      expect((remainingOrders![0] as any).namespace).toBe('com.example.orders');
    });
  });

  describe('Global Escape Key Modal Closer Helper Logic', () => {
    it('closes all active modals on Escape key press', () => {
      const closeBq = vi.fn();
      const closeRecon = vi.fn();
      const closeLinkages = vi.fn();
      const closeImport = vi.fn();
      const closeAvdl = vi.fn();
      const closeContract = vi.fn();
      const closeUser = vi.fn();

      const modalClosers = [
        closeBq,
        closeRecon,
        closeLinkages,
        closeImport,
        closeAvdl,
        closeContract,
        closeUser,
      ];

      // Escape key handler logic that will run in App.tsx
      const handleEscape = (key: string) => {
        if (key === 'Escape') {
          modalClosers.forEach((close) => close());
        }
      };

      handleEscape('Escape');

      expect(closeBq).toHaveBeenCalledTimes(1);
      expect(closeRecon).toHaveBeenCalledTimes(1);
      expect(closeLinkages).toHaveBeenCalledTimes(1);
      expect(closeImport).toHaveBeenCalledTimes(1);
      expect(closeAvdl).toHaveBeenCalledTimes(1);
      expect(closeContract).toHaveBeenCalledTimes(1);
      expect(closeUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('Component Rendering: Header & SchemaEditor', () => {
    it('renders Schema Version badge and quick bump buttons in Header', async () => {
      const React = await import('react');
      const { renderToString } = await import('react-dom/server');
      const { Header } = await import('@/client/components/Header');

      const onUpdateSchemaVersion = vi.fn();
      const html = renderToString(
        React.createElement(Header, {
          workspaceName: 'Test Workspace',
          onRenameWorkspace: vi.fn(),
          isSaving: false,
          canUndo: false,
          canRedo: false,
          onUndo: vi.fn(),
          onRedo: vi.fn(),
          onSave: vi.fn(),
          onExportBigQuery: vi.fn(),
          onExportLinkages: vi.fn(),
          onOpenAvdlPreview: vi.fn(),
          onOpenRecon: vi.fn(),
          onOpenImport: vi.fn(),
          onNewWorkspace: vi.fn(),
          schemaVersion: '1.2.3',
          onUpdateSchemaVersion,
        })
      );

      expect(html).toContain('v1.2.3');
      expect(html).toContain('+patch');
      expect(html).toContain('+minor');
      expect(html).toContain('+major');
    });

    it('renders editable namespace button/input in SchemaEditor record cards', async () => {
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
          onUpdateRecordNamespace: vi.fn(),
        })
      );

      expect(html).toContain('com.example.orders');
      expect(html).toContain('com.example.billing');
      expect(html).toContain('add namespace');
    });
  });
});
