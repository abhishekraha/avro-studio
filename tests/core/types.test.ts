import { describe, it, expect } from 'vitest';
import {
  // Types & guards from core/types
  isPrimitiveType,
  isRecordType,
  isEnumType,
  isArrayType,
  isMapType,
  isFixedType,
  isUnionType,
  isNamedType,
  createDefaultAvroProtocol,
  createDefaultWorkspace,
  type PrimitiveType,
  type AvroRecordType,
  type AvroEnumType,
  type AvroArrayType,
  type AvroMapType,
  type AvroFixedType,
  type AvroUnionType,
  type LinkageExport,
  type LinkType,
  type LinkSource,
  type LinkageEntry,
} from '@/core/types';

describe('Avro Type Guards and Constructors', () => {
  it('correctly identifies PrimitiveType values', () => {
    const primitives: PrimitiveType[] = [
      'null',
      'boolean',
      'int',
      'long',
      'float',
      'double',
      'bytes',
      'string',
    ];
    for (const p of primitives) {
      expect(isPrimitiveType(p)).toBe(true);
    }
    expect(isPrimitiveType('decimal')).toBe(false);
    expect(isPrimitiveType({})).toBe(false);
    expect(isPrimitiveType(null)).toBe(false);
    expect(isPrimitiveType(123)).toBe(false);
  });

  it('correctly identifies AvroRecordType and AvroNamedType', () => {
    const record: AvroRecordType = {
      type: 'record',
      name: 'User',
      namespace: 'com.example',
      doc: 'A user record',
      aliases: ['UserProfile'],
      fields: [
        {
          id: 'p-001',
          name: 'id',
          type: 'long',
          doc: 'user id',
          order: 'ascending',
        },
        {
          id: 'p-002',
          name: 'email',
          type: 'string',
        },
      ],
    };

    expect(isRecordType(record)).toBe(true);
    expect(isNamedType(record)).toBe(true);
    expect(isRecordType({ type: 'record' })).toBe(false); // missing name or fields
    expect(isRecordType({ type: 'array', items: 'string' })).toBe(false);
  });

  it('correctly identifies AvroEnumType and AvroNamedType', () => {
    const enumType: AvroEnumType = {
      type: 'enum',
      name: 'Status',
      symbols: ['ACTIVE', 'INACTIVE', 'PENDING'],
      default: 'PENDING',
    };

    expect(isEnumType(enumType)).toBe(true);
    expect(isNamedType(enumType)).toBe(true);
    expect(isEnumType({ type: 'enum', name: 'Status' })).toBe(false); // missing symbols
  });

  it('correctly identifies AvroFixedType and AvroNamedType', () => {
    const fixedType: AvroFixedType = {
      type: 'fixed',
      name: 'Md5',
      size: 16,
    };

    expect(isFixedType(fixedType)).toBe(true);
    expect(isNamedType(fixedType)).toBe(true);
    expect(isFixedType({ type: 'fixed', name: 'Md5' })).toBe(false); // missing size
  });

  it('correctly identifies AvroArrayType and AvroMapType', () => {
    const arrayType: AvroArrayType = {
      type: 'array',
      items: 'string',
    };
    const mapType: AvroMapType = {
      type: 'map',
      values: 'int',
    };

    expect(isArrayType(arrayType)).toBe(true);
    expect(isNamedType(arrayType)).toBe(false);
    expect(isArrayType({ type: 'array' })).toBe(false);

    expect(isMapType(mapType)).toBe(true);
    expect(isNamedType(mapType)).toBe(false);
    expect(isMapType({ type: 'map' })).toBe(false);
  });

  it('correctly identifies AvroUnionType', () => {
    const unionType: AvroUnionType = ['null', 'string'];
    expect(isUnionType(unionType)).toBe(true);
    expect(isUnionType([])).toBe(true);
    expect(isUnionType('string')).toBe(false);
    expect(isUnionType({ type: 'record', name: 'Foo', fields: [] })).toBe(false);
  });

  it('creates default AvroProtocol with valid structure', () => {
    const protocol = createDefaultAvroProtocol('MyProtocol', 'com.example');
    expect(protocol.protocol).toBe('MyProtocol');
    expect(protocol.namespace).toBe('com.example');
    expect(Array.isArray(protocol.types)).toBe(true);
    expect(protocol.types).toHaveLength(0);
  });

  it('creates default WorkspaceData with valid structure', () => {
    const ws = createDefaultWorkspace('test-ws', 'Test Workspace');
    expect(ws.id).toBe('test-ws');
    expect(ws.name).toBe('Test Workspace');
    expect(ws.isNew).toBe(true);
    expect(ws.original).toBeNull();
    expect(ws.edited).toBeNull();
    expect(ws.manualLinks).toEqual([]);
    expect(ws.recordLinks).toEqual([]);
    expect(ws.originalFieldNotes).toEqual([]);
    expect(ws.editedFieldNotes).toEqual([]);
    expect(typeof ws.savedAt).toBe('string');
  });

  it('supports LinkageExport structure correctly', () => {
    const linkType: LinkType = 'renamed';
    const linkSource: LinkSource = 'manual';
    const entry: LinkageEntry = {
      linkType,
      linkSource,
      original: {
        recordName: 'User',
        fieldName: 'userName',
        cleanType: 'string',
        id: 'p-001',
      },
      edited: {
        recordName: 'User',
        fieldName: 'username',
        cleanType: 'string',
        id: 'g-001',
      },
    };

    const linkageExport: LinkageExport = {
      exportedAt: new Date().toISOString(),
      schemaName: 'UserProtocol',
      linkages: [entry],
    };

    expect(linkageExport.schemaName).toBe('UserProtocol');
    expect(linkageExport.linkages).toHaveLength(1);
    expect(linkageExport.linkages[0].linkType).toBe('renamed');
  });
});
