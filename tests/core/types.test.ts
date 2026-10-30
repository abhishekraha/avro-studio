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
  ensureMultiContractWorkspace,
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
    expect(ws.activeContractId).toBe('contract-1');
    expect(ws.contracts).toHaveLength(1);
    expect(ws.contracts[0].id).toBe('contract-1');
    expect(ws.contracts[0].name).toBe('Test Workspace');
    expect(ws.contracts[0].original).toBeNull();
    expect(ws.contracts[0].edited).toBeNull();
    expect(ws.contracts[0].manualLinks).toEqual([]);
    expect(typeof ws.savedAt).toBe('string');
  });

  it('ensureMultiContractWorkspace converts legacy flat workspace into multi-contract format', () => {
    const legacy = {
      id: 'legacy-1',
      name: 'Legacy Project',
      savedAt: '2026-10-30T12:00:00Z',
      isNew: false,
      original: { protocol: 'P1', namespace: 'ns', types: [] },
      edited: { protocol: 'P2', namespace: 'ns', types: [] },
      manualLinks: [['f1', 'f2']],
      recordLinks: [['r1', 'r2']],
      originalFieldNotes: [['f1', 'note1']],
      editedFieldNotes: [['f2', 'note2']],
    };

    const multi = ensureMultiContractWorkspace(legacy);
    expect(multi.id).toBe('legacy-1');
    expect(multi.name).toBe('Legacy Project');
    expect(multi.activeContractId).toBe('contract-1');
    expect(multi.contracts).toHaveLength(1);
    expect(multi.contracts[0]).toEqual({
      id: 'contract-1',
      name: 'Legacy Project',
      original: legacy.original,
      edited: legacy.edited,
      manualLinks: [['f1', 'f2']],
      recordLinks: [['r1', 'r2']],
      originalFieldNotes: [['f1', 'note1']],
      editedFieldNotes: [['f2', 'note2']],
    });
    // Backward compatibility getters or properties:
    expect(multi.original).toEqual(legacy.original);
    expect(multi.edited).toEqual(legacy.edited);
    expect(multi.manualLinks).toEqual([['f1', 'f2']]);
  });

  it('ensureMultiContractWorkspace preserves already modern multi-contract workspace', () => {
    const modern = {
      id: 'modern-1',
      name: 'Modern Project',
      savedAt: '2026-10-30T12:00:00Z',
      isNew: false,
      activeContractId: 'c-2',
      contracts: [
        {
          id: 'c-1',
          name: 'First',
          original: null,
          edited: null,
          manualLinks: [],
        },
        {
          id: 'c-2',
          name: 'Second',
          original: null,
          edited: null,
          manualLinks: [['x', 'y']],
        },
      ],
    };

    const result = ensureMultiContractWorkspace(modern);
    expect(result.id).toBe('modern-1');
    expect(result.activeContractId).toBe('c-2');
    expect(result.contracts).toHaveLength(2);
    expect(result.contracts[1].id).toBe('c-2');
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
