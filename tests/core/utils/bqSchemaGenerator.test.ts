import { describe, it, expect } from 'vitest';
import { generateBqSchema, BqField } from '../../../src/core/utils/bqSchemaGenerator';
import { AvroProtocol } from '../../../src/core/types/schema';

describe('bqSchemaGenerator', () => {
  it('translates primitive Avro types to BigQuery types', () => {
    const protocol: AvroProtocol = {
      protocol: 'TestProto',
      types: [
        {
          type: 'record',
          name: 'PrimitiveRecord',
          fields: [
            { id: '1', name: 'boolCol', type: 'boolean' },
            { id: '2', name: 'intCol', type: 'int' },
            { id: '3', name: 'longCol', type: 'long' },
            { id: '4', name: 'floatCol', type: 'float' },
            { id: '5', name: 'doubleCol', type: 'double' },
            { id: '6', name: 'stringCol', type: 'string' },
            { id: '7', name: 'bytesCol', type: 'bytes' },
          ],
        },
      ],
    };

    const schema = generateBqSchema(protocol, 'PrimitiveRecord');
    expect(schema).toEqual([
      { name: 'boolCol', type: 'BOOLEAN', mode: 'REQUIRED' },
      { name: 'intCol', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'longCol', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'floatCol', type: 'FLOAT64', mode: 'REQUIRED' },
      { name: 'doubleCol', type: 'FLOAT64', mode: 'REQUIRED' },
      { name: 'stringCol', type: 'STRING', mode: 'REQUIRED' },
      { name: 'bytesCol', type: 'BYTES', mode: 'REQUIRED' },
    ]);
  });

  it('translates logical types and enums/fixed', () => {
    const protocol: AvroProtocol = {
      protocol: 'TestProto',
      types: [
        {
          type: 'enum',
          name: 'StatusEnum',
          symbols: ['ACTIVE', 'INACTIVE'],
        },
        {
          type: 'fixed',
          name: 'Md5',
          size: 16,
        },
        {
          type: 'record',
          name: 'AdvancedRecord',
          fields: [
            { id: '1', name: 'tsMicros', type: 'long', logicalType: 'timestamp-micros' },
            { id: '2', name: 'tsMillis', type: 'long', logicalType: 'timestamp-millis' },
            { id: '3', name: 'dateCol', type: 'int', logicalType: 'date' },
            { id: '4', name: 'timeMicros', type: 'long', logicalType: 'time-micros' },
            { id: '5', name: 'timeMillis', type: 'int', logicalType: 'time-millis' },
            { id: '6', name: 'status', type: 'StatusEnum' },
            { id: '7', name: 'hash', type: 'Md5' },
          ],
        },
      ],
    };

    const schema = generateBqSchema(protocol, 'AdvancedRecord');
    expect(schema).toEqual([
      { name: 'tsMicros', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'tsMillis', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'dateCol', type: 'DATE', mode: 'REQUIRED' },
      { name: 'timeMicros', type: 'TIME', mode: 'REQUIRED' },
      { name: 'timeMillis', type: 'TIME', mode: 'REQUIRED' },
      { name: 'status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'hash', type: 'BYTES', mode: 'REQUIRED' },
    ]);
  });

  it('translates nullable union types and arrays', () => {
    const protocol: AvroProtocol = {
      protocol: 'TestProto',
      types: [
        {
          type: 'record',
          name: 'ComplexTypes',
          fields: [
            { id: '1', name: 'optString', type: ['null', 'string'] },
            { id: '2', name: 'tags', type: { type: 'array', items: 'string' } },
            {
              id: '3',
              name: 'optInt',
              type: ['int', 'null'],
              doc: 'An optional integer',
            },
          ],
        },
      ],
    };

    const schema = generateBqSchema(protocol, 'ComplexTypes');
    expect(schema).toEqual([
      { name: 'optString', type: 'STRING', mode: 'NULLABLE' },
      { name: 'tags', type: 'STRING', mode: 'REPEATED' },
      { name: 'optInt', type: 'INTEGER', mode: 'NULLABLE', description: 'An optional integer' },
    ]);
  });

  it('handles standard nested record mode (type: RECORD, fields)', () => {
    const protocol: AvroProtocol = {
      protocol: 'TestProto',
      types: [
        {
          type: 'record',
          name: 'Address',
          fields: [
            { id: 'a1', name: 'street', type: 'string' },
            { id: 'a2', name: 'city', type: 'string' },
          ],
        },
        {
          type: 'record',
          name: 'User',
          fields: [
            { id: 'u1', name: 'id', type: 'long' },
            { id: 'u2', name: 'address', type: 'Address' },
            {
              id: 'u3',
              name: 'billingAddress',
              type: {
                type: 'record',
                name: 'BillingAddress',
                fields: [
                  { id: 'b1', name: 'zip', type: 'string' },
                ],
              },
            },
          ],
        },
      ],
    };

    const schema = generateBqSchema(protocol, 'User', { mode: 'standard' });
    expect(schema).toEqual([
      { name: 'id', type: 'INTEGER', mode: 'REQUIRED' },
      {
        name: 'address',
        type: 'RECORD',
        mode: 'REQUIRED',
        fields: [
          { name: 'street', type: 'STRING', mode: 'REQUIRED' },
          { name: 'city', type: 'STRING', mode: 'REQUIRED' },
        ],
      },
      {
        name: 'billingAddress',
        type: 'RECORD',
        mode: 'REQUIRED',
        fields: [
          { name: 'zip', type: 'STRING', mode: 'REQUIRED' },
        ],
      },
    ]);
  });

  it('handles legacy mode flattening nested records into parent_child columns', () => {
    const protocol: AvroProtocol = {
      protocol: 'TestProto',
      types: [
        {
          type: 'record',
          name: 'Location',
          fields: [
            { id: 'l1', name: 'lat', type: 'double' },
            { id: 'l2', name: 'lon', type: 'double' },
          ],
        },
        {
          type: 'record',
          name: 'Store',
          fields: [
            { id: 's1', name: 'storeId', type: 'string' },
            { id: 's2', name: 'location', type: 'Location' },
          ],
        },
      ],
    };

    const schema = generateBqSchema(protocol, 'Store', { mode: 'legacy' });
    expect(schema).toEqual([
      { name: 'storeId', type: 'STRING', mode: 'REQUIRED' },
      { name: 'location_lat', type: 'FLOAT64', mode: 'REQUIRED' },
      { name: 'location_lon', type: 'FLOAT64', mode: 'REQUIRED' },
    ]);
  });

  it('handles includeIngestionTime option', () => {
    const protocol: AvroProtocol = {
      protocol: 'TestProto',
      types: [
        {
          type: 'record',
          name: 'Event',
          fields: [{ id: 'e1', name: 'id', type: 'string' }],
        },
      ],
    };

    const schema = generateBqSchema(protocol, 'Event', { includeIngestionTime: true });
    expect(schema).toEqual([
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      {
        name: 'bqIngestionTime',
        type: 'TIMESTAMP',
        mode: 'NULLABLE',
        defaultValueExpression: 'CURRENT_TIMESTAMP()',
      },
    ]);
  });

  it('uses first record if rootRecordName is omitted', () => {
    const protocol: AvroProtocol = {
      protocol: 'TestProto',
      types: [
        {
          type: 'record',
          name: 'FirstRecord',
          fields: [{ id: 'f1', name: 'data', type: 'string' }],
        },
        {
          type: 'record',
          name: 'SecondRecord',
          fields: [{ id: 's1', name: 'other', type: 'int' }],
        },
      ],
    };

    const schema = generateBqSchema(protocol);
    expect(schema).toEqual([
      { name: 'data', type: 'STRING', mode: 'REQUIRED' },
    ]);
  });
});
