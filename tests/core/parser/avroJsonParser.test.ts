import { describe, it, expect } from 'vitest';
import { parseAvroJson } from '@/core/parser/avroJsonParser';
import {
  isRecordType,
  isEnumType,
  isFixedType,
  type AvroRecordType,
  type AvroEnumType,
  type AvroFixedType,
} from '@/core/types';

describe('Avro JSON Parser (parseAvroJson)', () => {
  it('parses a simple record schema with primitive fields and assigns g-XXXX IDs', () => {
    const json = {
      type: 'record',
      name: 'User',
      namespace: 'com.example',
      doc: 'User record doc',
      fields: [
        { name: 'id', type: 'string', doc: 'user id' },
        { name: 'age', type: 'int', default: 30 },
      ],
    };

    const protocol = parseAvroJson(json);
    expect(protocol.protocol).toBe('UserProtocol');
    expect(protocol.namespace).toBe('com.example');
    expect(protocol.types).toHaveLength(1);

    const record = protocol.types[0] as AvroRecordType;
    expect(isRecordType(record)).toBe(true);
    expect(record.name).toBe('User');
    expect(record.namespace).toBe('com.example');
    expect(record.doc).toBe('User record doc');
    expect(record.fields).toHaveLength(2);
    expect(record.fields[0].id).toMatch(/^g-\d{4,}$/);
    expect(record.fields[0].name).toBe('id');
    expect(record.fields[0].type).toBe('string');
    expect(record.fields[0].doc).toBe('user id');
    expect(record.fields[1].id).toMatch(/^g-\d{4,}$/);
    expect(record.fields[1].name).toBe('age');
    expect(record.fields[1].default).toBe(30);
  });

  it('unwraps Schema Registry envelope with { schema: string } or { schema: object }', () => {
    const envelope = {
      subject: 'orders-value',
      version: 1,
      id: 101,
      schema: JSON.stringify({
        type: 'record',
        name: 'Order',
        namespace: 'com.example.orders',
        fields: [{ name: 'orderId', type: 'string' }],
      }),
    };

    const protocol = parseAvroJson(envelope);
    expect(protocol.protocol).toBe('orders_valueProtocol');
    expect(protocol.namespace).toBe('com.example.orders');
    expect(protocol.types).toHaveLength(1);
    expect(protocol.types[0].name).toBe('Order');
  });

  it('unwraps Schema Registry envelope with { definition: string }', () => {
    const envelope = {
      subject: 'payments',
      definition: JSON.stringify({
        type: 'record',
        name: 'Payment',
        fields: [{ name: 'amount', type: 'double' }],
      }),
    };

    const protocol = parseAvroJson(envelope, 'custom_subject');
    expect(protocol.protocol).toBe('custom_subjectProtocol');
    expect(protocol.types).toHaveLength(1);
    expect(protocol.types[0].name).toBe('Payment');
  });

  it('handles two-pass flattening: hoists nested records and enums, replacing with references', () => {
    const nestedJson = {
      type: 'record',
      name: 'Order',
      namespace: 'com.example',
      fields: [
        {
          name: 'status',
          type: {
            type: 'enum',
            name: 'OrderStatus',
            symbols: ['PENDING', 'COMPLETED', 'FAILED'],
            default: 'PENDING',
          },
        },
        {
          name: 'item',
          type: {
            type: 'record',
            name: 'OrderItem',
            fields: [
              { name: 'sku', type: 'string' },
              {
                name: 'dimensions',
                type: {
                  type: 'fixed',
                  name: 'Dimensions',
                  size: 12,
                },
              },
            ],
          },
        },
      ],
    };

    const protocol = parseAvroJson(nestedJson);
    // Should flatten OrderStatus, Dimensions, OrderItem, Order into types array
    expect(protocol.types).toHaveLength(4);

    const typeNames = protocol.types.map((t) => t.name);
    expect(typeNames).toContain('OrderStatus');
    expect(typeNames).toContain('Dimensions');
    expect(typeNames).toContain('OrderItem');
    expect(typeNames).toContain('Order');

    // Order record should reference OrderStatus and OrderItem by string name
    const orderRecord = protocol.types.find((t) => t.name === 'Order') as AvroRecordType;
    expect(orderRecord).toBeDefined();
    expect(orderRecord.fields[0].type).toBe('OrderStatus');
    expect(orderRecord.fields[1].type).toBe('OrderItem');

    // OrderItem record should reference Dimensions by string name
    const itemRecord = protocol.types.find((t) => t.name === 'OrderItem') as AvroRecordType;
    expect(itemRecord).toBeDefined();
    expect(itemRecord.fields[1].type).toBe('Dimensions');
  });

  it('handles nested records inside arrays and union types with flattening', () => {
    const json = {
      type: 'record',
      name: 'Batch',
      namespace: 'com.example',
      fields: [
        {
          name: 'items',
          type: {
            type: 'array',
            items: {
              type: 'record',
              name: 'BatchItem',
              fields: [{ name: 'id', type: 'string' }],
            },
          },
        },
        {
          name: 'optionalDetail',
          type: [
            'null',
            {
              type: 'record',
              name: 'Detail',
              fields: [{ name: 'note', type: 'string' }],
            },
          ],
        },
      ],
    };

    const protocol = parseAvroJson(json);
    expect(protocol.types).toHaveLength(3);

    const batch = protocol.types.find((t) => t.name === 'Batch') as AvroRecordType;
    expect(batch.fields[0].type).toEqual({ type: 'array', items: 'BatchItem' });
    expect(batch.fields[1].type).toEqual(['null', 'Detail']);
  });

  it('extracts logicalType wrappers and field metadata (order, aliases, defaults)', () => {
    const json = {
      type: 'record',
      name: 'Event',
      namespace: 'com.example.events',
      fields: [
        {
          name: 'timestamp',
          type: {
            type: 'long',
            logicalType: 'timestamp-micros',
          },
        },
        {
          name: 'priority',
          type: 'string',
          order: 'descending',
          aliases: ['prio', 'lvl'],
          default: 'normal',
        },
      ],
    };

    const protocol = parseAvroJson(json);
    const eventRecord = protocol.types[0] as AvroRecordType;
    expect(eventRecord.fields[0].name).toBe('timestamp');
    expect(eventRecord.fields[0].type).toBe('long');
    expect(eventRecord.fields[0].logicalType).toBe('timestamp-micros');

    expect(eventRecord.fields[1].order).toBe('descending');
    expect(eventRecord.fields[1].aliases).toEqual(['prio', 'lvl']);
    expect(eventRecord.fields[1].default).toBe('normal');
  });

  it('handles top-level enum and fixed schemas', () => {
    const enumJson = {
      type: 'enum',
      name: 'Color',
      symbols: ['RED', 'GREEN', 'BLUE'],
    };

    const proto = parseAvroJson(enumJson);
    expect(proto.types).toHaveLength(1);
    expect(isEnumType(proto.types[0])).toBe(true);

    const fixedJson = {
      type: 'fixed',
      name: 'MD5',
      size: 16,
    };
    const protoFixed = parseAvroJson(fixedJson);
    expect(protoFixed.types).toHaveLength(1);
    expect(isFixedType(protoFixed.types[0])).toBe(true);
  });
});
