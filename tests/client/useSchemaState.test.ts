import { describe, it, expect } from 'vitest';
import { SchemaStateManager } from '@/client/hooks/useSchemaState';
import type { AvroProtocol } from '@/core/types/schema';

describe('SchemaStateManager & useSchemaState core logic', () => {
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

  it('initializes with original and edited copies', () => {
    const manager = new SchemaStateManager(sampleProtocol);
    expect(manager.getOriginal()).toEqual(sampleProtocol);
    expect(manager.getCurrent()).toEqual(sampleProtocol);
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);
    expect(manager.isDirty()).toBe(false);
  });

  it('adds a field to a record', () => {
    const manager = new SchemaStateManager(sampleProtocol);

    manager.addField('Order', {
      name: 'status',
      type: 'string',
      default: 'PENDING',
    });

    const current = manager.getCurrent();
    const orderRecord = current?.types.find((t) => t.name === 'Order') as any;
    expect(orderRecord.fields).toHaveLength(3);
    expect(orderRecord.fields[2].name).toBe('status');
    expect(orderRecord.fields[2].id).toBeDefined();
    expect(manager.canUndo()).toBe(true);
    expect(manager.isDirty()).toBe(true);
  });

  it('removes a field from a record', () => {
    const manager = new SchemaStateManager(sampleProtocol);

    manager.removeField('Order', 'f-1');

    const current = manager.getCurrent();
    const orderRecord = current?.types.find((t) => t.name === 'Order') as any;
    expect(orderRecord.fields).toHaveLength(1);
    expect(orderRecord.fields[0].id).toBe('f-2');
    expect(manager.canUndo()).toBe(true);
  });

  it('renames a field while preserving synthetic ID', () => {
    const manager = new SchemaStateManager(sampleProtocol);

    manager.renameField('Order', 'f-1', 'orderId');

    const current = manager.getCurrent();
    const orderRecord = current?.types.find((t) => t.name === 'Order') as any;
    const field = orderRecord.fields.find((f: any) => f.id === 'f-1');
    expect(field?.name).toBe('orderId');
    expect(field?.id).toBe('f-1');
    expect(manager.canUndo()).toBe(true);
  });

  it('moves a field between records and within record', () => {
    const manager = new SchemaStateManager(sampleProtocol);

    // Move f-2 from Order to Customer at index 0
    manager.moveField({
      sourceRecordName: 'Order',
      targetRecordName: 'Customer',
      fieldId: 'f-2',
      targetIndex: 0,
    });

    let current = manager.getCurrent();
    let orderRecord = current?.types.find((t) => t.name === 'Order') as any;
    let customerRecord = current?.types.find((t) => t.name === 'Customer') as any;

    expect(orderRecord.fields).toHaveLength(1);
    expect(orderRecord.fields[0].id).toBe('f-1');

    expect(customerRecord.fields).toHaveLength(3);
    expect(customerRecord.fields[0].id).toBe('f-2');
    expect(customerRecord.fields[1].id).toBe('f-3');
    expect(customerRecord.fields[2].id).toBe('f-4');

    // Move within Customer: move index 2 to index 0
    manager.reorderField('Customer', 2, 0);

    current = manager.getCurrent();
    customerRecord = current?.types.find((t) => t.name === 'Customer') as any;
    expect(customerRecord.fields[0].id).toBe('f-4');
    expect(customerRecord.fields[1].id).toBe('f-2');
    expect(customerRecord.fields[2].id).toBe('f-3');
  });

  it('supports undo and redo transitions', () => {
    const manager = new SchemaStateManager(sampleProtocol);

    manager.renameField('Order', 'f-1', 'orderId');

    let current = manager.getCurrent();
    let order = current?.types.find((t) => t.name === 'Order') as any;
    expect(order.fields[0].name).toBe('orderId');

    manager.undo();

    current = manager.getCurrent();
    order = current?.types.find((t) => t.name === 'Order') as any;
    expect(order.fields[0].name).toBe('id');
    expect(manager.canRedo()).toBe(true);

    manager.redo();

    current = manager.getCurrent();
    order = current?.types.find((t) => t.name === 'Order') as any;
    expect(order.fields[0].name).toBe('orderId');
  });

  it('updates field type', () => {
    const manager = new SchemaStateManager(sampleProtocol);

    manager.updateFieldType('Order', 'f-1', 'long');

    const current = manager.getCurrent();
    const order = current?.types.find((t) => t.name === 'Order') as any;
    expect(order.fields[0].type).toBe('long');
  });

  it('adds and removes records', () => {
    const manager = new SchemaStateManager(sampleProtocol);

    manager.addRecord('LineItem', 'com.example', 'Item doc');
    let current = manager.getCurrent();
    expect(current?.types).toHaveLength(3);
    expect(current?.types[2].name).toBe('LineItem');

    manager.removeRecord('Order');
    current = manager.getCurrent();
    expect(current?.types).toHaveLength(2);
    expect(current?.types[0].name).toBe('Customer');
  });

  it('tracks isDirty correctly on modification and undo/redo', () => {
    const manager = new SchemaStateManager(sampleProtocol);
    expect(manager.isDirty()).toBe(false);

    manager.addField('Order', { name: 'newField', type: 'string' });
    expect(manager.isDirty()).toBe(true);

    manager.undo();
    expect(manager.isDirty()).toBe(false);

    manager.redo();
    expect(manager.isDirty()).toBe(true);
  });
});
