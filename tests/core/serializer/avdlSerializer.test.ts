import { describe, it, expect } from 'vitest';
import { serializeToAvdl } from '@/core/serializer/avdlSerializer';
import { parseAvdl } from '@/core/parser/avdlParser';
import {
  type AvroProtocol,
  type AvroRecordType,
  type AvroEnumType,
  type AvroFixedType,
} from '@/core/types';

describe('AVDL Serializer (serializeToAvdl)', () => {
  it('serializes a minimal protocol header with namespace and schemaVersion', () => {
    const protocol: AvroProtocol = {
      protocol: 'SimpleProtocol',
      namespace: 'com.example',
      schemaVersion: '1.0.0',
      doc: 'Simple doc',
      types: [],
    };

    const avdl = serializeToAvdl(protocol);
    expect(avdl).toContain('/** Simple doc */');
    expect(avdl).toContain('@namespace("com.example")');
    expect(avdl).toContain('@schemaVersion("1.0.0")');
    expect(avdl).toContain('protocol SimpleProtocol {');
    expect(avdl.trim().endsWith('}')).toBe(true);
  });

  it('serializes fixed and enum types with doc, aliases, default symbol', () => {
    const fixedType: AvroFixedType = {
      type: 'fixed',
      name: 'UUID',
      namespace: 'com.example',
      size: 16,
      doc: '16-byte UUID',
    };

    const enumType: AvroEnumType = {
      type: 'enum',
      name: 'Status',
      namespace: 'com.example',
      doc: 'Status enum',
      aliases: ['OldStatus'],
      symbols: ['PENDING', 'ACTIVE', 'INACTIVE'],
      default: 'PENDING',
    };

    const protocol: AvroProtocol = {
      protocol: 'CommonProtocol',
      namespace: 'com.example',
      types: [fixedType, enumType],
    };

    const avdl = serializeToAvdl(protocol);
    expect(avdl).toContain('fixed UUID(16);');
    expect(avdl).toContain('@aliases(["OldStatus"])');
    expect(avdl).toContain('enum Status {');
    expect(avdl).toContain('PENDING,');
    expect(avdl).toContain('} = PENDING;');
  });

  it('serializes records with primitive, shorthand nullable (string?), array, and map fields', () => {
    const record: AvroRecordType = {
      type: 'record',
      name: 'Customer',
      namespace: 'com.example',
      doc: 'Customer entity',
      fields: [
        {
          id: 'g-0001',
          name: 'id',
          type: 'string',
        },
        {
          id: 'g-0002',
          name: 'email',
          type: ['null', 'string'],
          default: null,
        },
        {
          id: 'g-0003',
          name: 'tags',
          type: { type: 'array', items: 'string' },
          default: [],
        },
        {
          id: 'g-0004',
          name: 'attributes',
          type: { type: 'map', values: 'int' },
          default: {},
        },
      ],
    };

    const protocol: AvroProtocol = {
      protocol: 'ShopProtocol',
      namespace: 'com.example',
      types: [record],
    };

    const avdl = serializeToAvdl(protocol);
    expect(avdl).toContain('string id;');
    expect(avdl).toContain('string? email = null;');
    expect(avdl).toContain('array<string> tags = [];');
    expect(avdl).toContain('map<int> attributes = {};');
  });

  it('serializes field annotations: @logicalType, @order, @aliases', () => {
    const record: AvroRecordType = {
      type: 'record',
      name: 'LogEvent',
      namespace: 'com.example',
      fields: [
        {
          id: 'g-0001',
          name: 'timestamp',
          type: 'long',
          logicalType: 'timestamp-micros',
          order: 'descending',
          aliases: ['ts', 'time'],
        },
      ],
    };

    const protocol: AvroProtocol = {
      protocol: 'LogProtocol',
      namespace: 'com.example',
      types: [record],
    };

    const avdl = serializeToAvdl(protocol);
    expect(avdl).toContain('@logicalType("timestamp-micros")');
    expect(avdl).toContain('@order("descending")');
    expect(avdl).toContain('@aliases(["ts", "time"])');
    expect(avdl).toContain('long timestamp;');
  });

  it('guarantees round-trip fidelity: parseAvdl(serializeToAvdl(protocol)) matches protocol structure', () => {
    const initialAvdl = `
      /**
       * Core E-Commerce Domain Protocol
       */
      @namespace("com.acme.shop")
      @schemaVersion("2.1.0")
      protocol EcommerceProtocol {
        /** 128-bit UUID */
        fixed UUID(16);

        /** Status of an order lifecycle */
        @aliases(["OrderState"])
        enum OrderStatus {
          DRAFT,
          CONFIRMED,
          PAID,
          CANCELLED
        } = DRAFT;

        /** Customer profile */
        record Customer {
          UUID id;
          string name;
          string email;
          string? phone = null;
        }

        /** Customer order */
        record Order {
          UUID orderId;
          Customer customer;
          OrderStatus status = "DRAFT";
          array<string> tags = [];
          @logicalType("timestamp-millis")
          long createdAt;
          map<string> metadata = {};
          union { null, string } notes = null;
        }
      }
    `;

    const parsedProto = parseAvdl(initialAvdl);
    const serializedAvdl = serializeToAvdl(parsedProto);
    const roundTrippedProto = parseAvdl(serializedAvdl);

    expect(roundTrippedProto.protocol).toBe(parsedProto.protocol);
    expect(roundTrippedProto.namespace).toBe(parsedProto.namespace);
    expect(roundTrippedProto.schemaVersion).toBe(parsedProto.schemaVersion);
    expect(roundTrippedProto.doc).toBe(parsedProto.doc);
    expect(roundTrippedProto.types.length).toBe(parsedProto.types.length);

    // Verify each type matches structurally
    for (let i = 0; i < parsedProto.types.length; i++) {
      const orig = parsedProto.types[i];
      const rt = roundTrippedProto.types[i];
      expect(rt.name).toBe(orig.name);
      expect(rt.type).toBe(orig.type);
      expect(rt.namespace).toBe(orig.namespace);
      expect(rt.doc).toBe(orig.doc);
    }
  });
});
