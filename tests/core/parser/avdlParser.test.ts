import { describe, it, expect } from 'vitest';
import { parseAvdl } from '@/core/parser/avdlParser';
import {
  isRecordType,
  isEnumType,
  isFixedType,
  isUnionType,
  type AvroRecordType,
  type AvroEnumType,
  type AvroFixedType,
} from '@/core/types';

describe('AVDL Parser', () => {
  it('parses an empty protocol with namespace and doc comments', () => {
    const avdl = `
      /**
       * Protocol documentation
       * multi-line
       */
      @namespace("com.example.ecommerce")
      protocol EcommerceProtocol {
      }
    `;

    const protocol = parseAvdl(avdl);
    expect(protocol.protocol).toBe('EcommerceProtocol');
    expect(protocol.namespace).toBe('com.example.ecommerce');
    expect(protocol.doc).toBe('Protocol documentation\nmulti-line');
    expect(protocol.types).toEqual([]);
  });

  it('parses protocol annotations including @schemaVersion', () => {
    const avdl = `
      @namespace("com.example")
      @schemaVersion("1.4.0")
      protocol VersionedProtocol {
      }
    `;

    const protocol = parseAvdl(avdl);
    expect(protocol.protocol).toBe('VersionedProtocol');
    expect(protocol.namespace).toBe('com.example');
    expect(protocol.schemaVersion).toBe('1.4.0');
  });

  it('handles single-line and multi-line comments correctly', () => {
    const avdl = `
      // Single line comment
      /* Block comment */
      protocol SimpleProtocol {
        // Comment inside
        /* Another block comment */
        record EmptyRecord {}
      }
    `;

    const protocol = parseAvdl(avdl);
    expect(protocol.protocol).toBe('SimpleProtocol');
    expect(protocol.types).toHaveLength(1);
    expect(protocol.types[0].name).toBe('EmptyRecord');
  });

  it('parses fixed declarations and assigns protocol namespace', () => {
    const avdl = `
      @namespace("com.example")
      protocol CryptoProtocol {
        /** 16-byte MD5 hash */
        fixed MD5(16);
      }
    `;

    const protocol = parseAvdl(avdl);
    expect(protocol.types).toHaveLength(1);
    const fixedType = protocol.types[0] as AvroFixedType;
    expect(isFixedType(fixedType)).toBe(true);
    expect(fixedType.name).toBe('MD5');
    expect(fixedType.namespace).toBe('com.example');
    expect(fixedType.size).toBe(16);
  });

  it('parses enum definitions with doc comments, aliases, and default symbol', () => {
    const avdl = `
      @namespace("com.example")
      protocol OrderProtocol {
        /** Status of the customer order */
        @aliases(["OrderStatusEnum", "OrderState"])
        enum OrderStatus {
          PENDING,
          PROCESSING,
          SHIPPED,
          CANCELLED
        } = PENDING;
      }
    `;

    const protocol = parseAvdl(avdl);
    expect(protocol.types).toHaveLength(1);
    const enumType = protocol.types[0] as AvroEnumType;
    expect(isEnumType(enumType)).toBe(true);
    expect(enumType.name).toBe('OrderStatus');
    expect(enumType.namespace).toBe('com.example');
    expect(enumType.doc).toBe('Status of the customer order');
    expect(enumType.aliases).toEqual(['OrderStatusEnum', 'OrderState']);
    expect(enumType.symbols).toEqual(['PENDING', 'PROCESSING', 'SHIPPED', 'CANCELLED']);
    expect(enumType.default).toBe('PENDING');
  });

  it('parses record with primitive fields, deterministic synthetic IDs (p-0001, etc.), and default values', () => {
    const avdl = `
      @namespace("com.example")
      protocol UserProtocol {
        record User {
          string id;
          string username;
          int age = 0;
          boolean active = true;
          double score = 99.5;
          long negativeVal = -42;
          float expVal = 1.5e-3;
        }
      }
    `;

    const protocol = parseAvdl(avdl);
    expect(protocol.types).toHaveLength(1);
    const record = protocol.types[0] as AvroRecordType;
    expect(isRecordType(record)).toBe(true);
    expect(record.name).toBe('User');
    expect(record.namespace).toBe('com.example');
    expect(record.fields).toHaveLength(7);

    expect(record.fields[0]).toMatchObject({
      id: 'p-0001',
      name: 'id',
      type: 'string',
    });
    expect(record.fields[1]).toMatchObject({
      id: 'p-0002',
      name: 'username',
      type: 'string',
    });
    expect(record.fields[2]).toMatchObject({
      id: 'p-0003',
      name: 'age',
      type: 'int',
      default: 0,
    });
    expect(record.fields[3]).toMatchObject({
      id: 'p-0004',
      name: 'active',
      type: 'boolean',
      default: true,
    });
    expect(record.fields[4]).toMatchObject({
      id: 'p-0005',
      name: 'score',
      type: 'double',
      default: 99.5,
    });
    expect(record.fields[5]).toMatchObject({
      id: 'p-0006',
      name: 'negativeVal',
      type: 'long',
      default: -42,
    });
    expect(record.fields[6]).toMatchObject({
      id: 'p-0007',
      name: 'expVal',
      type: 'float',
      default: 0.0015,
    });
  });

  it('parses shorthand nullable types (string?) as union ["null", "string"]', () => {
    const avdl = `
      protocol NullableProtocol {
        record Profile {
          string? bio = null;
          int? loyaltyPoints;
        }
      }
    `;

    const protocol = parseAvdl(avdl);
    const record = protocol.types[0] as AvroRecordType;
    expect(record.fields[0].name).toBe('bio');
    expect(record.fields[0].type).toEqual(['null', 'string']);
    expect(record.fields[0].default).toBeNull();

    expect(record.fields[1].name).toBe('loyaltyPoints');
    expect(record.fields[1].type).toEqual(['null', 'int']);
  });

  it('parses full union syntax union { null, string } and default values', () => {
    const avdl = `
      protocol UnionProtocol {
        record Item {
          union { null, string } description = null;
          union { int, string } code = 100;
        }
      }
    `;

    const protocol = parseAvdl(avdl);
    const record = protocol.types[0] as AvroRecordType;
    expect(record.fields[0].name).toBe('description');
    expect(record.fields[0].type).toEqual(['null', 'string']);
    expect(record.fields[0].default).toBeNull();

    expect(record.fields[1].name).toBe('code');
    expect(record.fields[1].type).toEqual(['int', 'string']);
    expect(record.fields[1].default).toBe(100);
  });

  it('parses complex array and map types with default array and object literals', () => {
    const avdl = `
      protocol ComplexTypesProtocol {
        record Container {
          array<string> tags = [];
          map<int> counters = {};
          array<array<string>> matrix = [["a", "b"]];
        }
      }
    `;

    const protocol = parseAvdl(avdl);
    const record = protocol.types[0] as AvroRecordType;
    expect(record.fields[0].type).toEqual({ type: 'array', items: 'string' });
    expect(record.fields[0].default).toEqual([]);

    expect(record.fields[1].type).toEqual({ type: 'map', values: 'int' });
    expect(record.fields[1].default).toEqual({});

    expect(record.fields[2].type).toEqual({
      type: 'array',
      items: { type: 'array', items: 'string' },
    });
    expect(record.fields[2].default).toEqual([['a', 'b']]);
  });

  it('handles field annotations: @logicalType, @order, @aliases', () => {
    const avdl = `
      protocol AnnotationProtocol {
        record Event {
          @logicalType("timestamp-millis")
          long timestamp;

          @order("descending")
          string priority;

          @aliases(["eventId", "uuid"])
          string id;
        }
      }
    `;

    const protocol = parseAvdl(avdl);
    const record = protocol.types[0] as AvroRecordType;
    expect(record.fields[0].logicalType).toBe('timestamp-millis');
    expect(record.fields[1].order).toBe('descending');
    expect(record.fields[2].aliases).toEqual(['eventId', 'uuid']);
  });

  it('handles record-level namespace override via @namespace', () => {
    const avdl = `
      @namespace("com.example.common")
      protocol OverrideProtocol {
        @namespace("com.example.custom")
        record CustomRecord {
          string data;
        }

        record DefaultRecord {
          int count;
        }
      }
    `;

    const protocol = parseAvdl(avdl);
    expect(protocol.namespace).toBe('com.example.common');
    expect(protocol.types[0].namespace).toBe('com.example.custom');
    expect(protocol.types[1].namespace).toBe('com.example.common');
  });

  it('preserves backticked identifiers for types and field names', () => {
    const avdl = `
      protocol BacktickProtocol {
        record RecordWithBackticks {
          \`avro.java.string\` name;
          string \`order\`;
        }
      }
    `;

    const protocol = parseAvdl(avdl);
    const record = protocol.types[0] as AvroRecordType;
    expect(record.fields[0].type).toBe('avro.java.string');
    expect(record.fields[0].name).toBe('name');
    expect(record.fields[1].name).toBe('order');
  });

  it('parses import statements and ignores/skips them gracefully', () => {
    const avdl = `
      protocol ImportProtocol {
        import idl "CommonTypes.avdl";
        import protocol "OtherProtocol.avpr";
        import schema "Schema.avsc";

        record ImportedItem {
          string id;
        }
      }
    `;

    const protocol = parseAvdl(avdl);
    expect(protocol.protocol).toBe('ImportProtocol');
    expect(protocol.types).toHaveLength(1);
    expect(protocol.types[0].name).toBe('ImportedItem');
  });

  it('parses a comprehensive e-commerce protocol with all features', () => {
    const ecommerceAvdl = `
      /**
       * Core E-Commerce Domain Protocol
       * Defines orders, products, and customer entities.
       */
      @namespace("com.acme.shop")
      @schemaVersion("2.1.0")
      protocol EcommerceProtocol {
        import idl "Primitives.avdl";

        /** 128-bit UUID */
        fixed UUID(16);

        /** Status of an order lifecycle */
        @aliases(["OrderState"])
        enum OrderStatus {
          DRAFT,
          CONFIRMED,
          PAID,
          SHIPPED,
          DELIVERED,
          CANCELLED
        } = DRAFT;

        /** Customer profile */
        record Customer {
          p-0001: UUID id;
          string name;
          string email;
          string? phone = null;
        }

        /** Line item in an order */
        record OrderLineItem {
          string sku;
          int quantity = 1;
          double unitPrice;
          array<string> tags = [];
        }

        /** Customer order */
        record Order {
          UUID orderId;
          Customer customer;
          OrderStatus status = "DRAFT";
          array<OrderLineItem> items;
          @logicalType("timestamp-millis")
          long createdAt;
          map<string> metadata = {};
          union { null, string } notes = null;
        }
      }
    `;

    // Note: in standard AVDL field IDs like "p-0001: UUID id;" might not be standard AVDL syntax,
    // so we test normal standard AVDL where our parser generates p-0001 deterministic synthetic IDs!
    const standardEcommerceAvdl = `
      /**
       * Core E-Commerce Domain Protocol
       * Defines orders, products, and customer entities.
       */
      @namespace("com.acme.shop")
      @schemaVersion("2.1.0")
      protocol EcommerceProtocol {
        import idl "Primitives.avdl";

        /** 128-bit UUID */
        fixed UUID(16);

        /** Status of an order lifecycle */
        @aliases(["OrderState"])
        enum OrderStatus {
          DRAFT,
          CONFIRMED,
          PAID,
          SHIPPED,
          DELIVERED,
          CANCELLED
        } = DRAFT;

        /** Customer profile */
        record Customer {
          UUID id;
          string name;
          string email;
          string? phone = null;
        }

        /** Line item in an order */
        record OrderLineItem {
          string sku;
          int quantity = 1;
          double unitPrice;
          array<string> tags = [];
        }

        /** Customer order */
        record Order {
          UUID orderId;
          Customer customer;
          OrderStatus status = "DRAFT";
          array<OrderLineItem> items;
          @logicalType("timestamp-millis")
          long createdAt;
          map<string> metadata = {};
          union { null, string } notes = null;
        }
      }
    `;

    const protocol = parseAvdl(standardEcommerceAvdl);
    expect(protocol.protocol).toBe('EcommerceProtocol');
    expect(protocol.namespace).toBe('com.acme.shop');
    expect(protocol.schemaVersion).toBe('2.1.0');
    expect(protocol.doc).toBe('Core E-Commerce Domain Protocol\nDefines orders, products, and customer entities.');

    expect(protocol.types).toHaveLength(5);

    const [uuidType, orderStatusType, customerType, lineItemType, orderType] = protocol.types;

    expect(uuidType.name).toBe('UUID');
    expect(isFixedType(uuidType)).toBe(true);

    expect(orderStatusType.name).toBe('OrderStatus');
    expect(isEnumType(orderStatusType)).toBe(true);

    expect(customerType.name).toBe('Customer');
    expect(isRecordType(customerType)).toBe(true);
    if (isRecordType(customerType)) {
      expect(customerType.fields[0].id).toBe('p-0001');
      expect(customerType.fields[1].id).toBe('p-0002');
      expect(customerType.fields[2].id).toBe('p-0003');
      expect(customerType.fields[3].id).toBe('p-0004');
      expect(customerType.fields[3].type).toEqual(['null', 'string']);
    }

    expect(lineItemType.name).toBe('OrderLineItem');
    expect(isRecordType(lineItemType)).toBe(true);
    if (isRecordType(lineItemType)) {
      expect(lineItemType.fields[0].id).toBe('p-0005');
      expect(lineItemType.fields[1].id).toBe('p-0006');
      expect(lineItemType.fields[2].id).toBe('p-0007');
      expect(lineItemType.fields[3].id).toBe('p-0008');
    }

    expect(orderType.name).toBe('Order');
    expect(isRecordType(orderType)).toBe(true);
    if (isRecordType(orderType)) {
      expect(orderType.fields[0].id).toBe('p-0009');
      expect(orderType.fields[0].name).toBe('orderId');
      expect(orderType.fields[4].logicalType).toBe('timestamp-millis');
      expect(orderType.fields[6].type).toEqual(['null', 'string']);
    }
  });

  describe('Syntax error handling with line/column pointers', () => {
    it('throws error with line and column for unexpected tokens', () => {
      const invalidAvdl = `protocol Broken {
        record Foo {
          string @
        }
      }`;

      expect(() => parseAvdl(invalidAvdl)).toThrow(/line 3, col/i);
    });

    it('throws error with line and column when protocol keyword is missing', () => {
      const invalidAvdl = `
        @namespace("com.example")
        invalidSyntax Foo {}
      `;

      expect(() => parseAvdl(invalidAvdl)).toThrow(/line 3/i);
    });

    it('throws error when braces are unclosed', () => {
      const invalidAvdl = `
        protocol Unclosed {
          record Foo {
            string a;
      `;

      expect(() => parseAvdl(invalidAvdl)).toThrow(/unexpected end of input|unclosed|expected/i);
    });
  });
});
