import { describe, it, expect } from 'vitest';
import { computeDiff, type SchemaDiffResult } from '@/core/utils/schemaDiff';
import { type AvroProtocol, type AvroRecordType } from '@/core/types';

describe('schemaDiff (computeDiff)', () => {
  const makeProtocol = (records: AvroRecordType[], name = 'TestProtocol'): AvroProtocol => ({
    protocol: name,
    types: records,
  });

  it('handles null protocols gracefully', () => {
    const diffBothNull = computeDiff(null, null);
    expect(diffBothNull.stats).toEqual({
      addedCount: 0,
      deletedCount: 0,
      modifiedCount: 0,
      renamedCount: 0,
      movedCount: 0,
      identicalCount: 0,
    });
    expect(diffBothNull.originalAnnotations.size).toBe(0);
    expect(diffBothNull.editedAnnotations.size).toBe(0);

    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'User',
        fields: [{ id: 'p-1', name: 'id', type: 'string' }],
      },
    ]);

    const diffEditedNull = computeDiff(orig, null);
    expect(diffEditedNull.stats.deletedCount).toBe(1);
    expect(diffEditedNull.originalAnnotations.get('p-1')).toBe('deleted');

    const diffOrigNull = computeDiff(null, orig);
    expect(diffOrigNull.stats.addedCount).toBe(1);
    expect(diffOrigNull.editedAnnotations.get('p-1')).toBe('added');
  });

  it('detects unchanged fields with same id, record, name, and type', () => {
    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'User',
        fields: [
          { id: 'p-1', name: 'id', type: 'string' },
          { id: 'p-2', name: 'age', type: 'int' },
        ],
      },
    ]);

    const edited: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'User',
        fields: [
          { id: 'p-1', name: 'id', type: 'string' },
          { id: 'p-2', name: 'age', type: 'int' },
        ],
      },
    ]);

    const result = computeDiff(orig, edited);
    expect(result.stats).toEqual({
      addedCount: 0,
      deletedCount: 0,
      modifiedCount: 0,
      renamedCount: 0,
      movedCount: 0,
      identicalCount: 2,
    });
    expect(result.originalAnnotations.get('p-1')).toBe('unchanged');
    expect(result.originalAnnotations.get('p-2')).toBe('unchanged');
    expect(result.editedAnnotations.get('p-1')).toBe('unchanged');
    expect(result.editedAnnotations.get('p-2')).toBe('unchanged');
  });

  it('detects renamed fields (same id, same record, different field name)', () => {
    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'User',
        fields: [{ id: 'p-1', name: 'oldName', type: 'string' }],
      },
    ]);

    const edited: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'User',
        fields: [{ id: 'p-1', name: 'newName', type: 'string' }],
      },
    ]);

    const result = computeDiff(orig, edited);
    expect(result.stats.renamedCount).toBe(1);
    expect(result.originalAnnotations.get('p-1')).toBe('renamed');
    expect(result.editedAnnotations.get('p-1')).toBe('renamed');
  });

  it('detects moved fields (same id, different record, same field name)', () => {
    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'SourceRecord',
        fields: [{ id: 'p-1', name: 'targetField', type: 'string' }],
      },
      {
        type: 'record',
        name: 'DestRecord',
        fields: [],
      },
    ]);

    const edited: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'SourceRecord',
        fields: [],
      },
      {
        type: 'record',
        name: 'DestRecord',
        fields: [{ id: 'p-1', name: 'targetField', type: 'string' }],
      },
    ]);

    const result = computeDiff(orig, edited);
    expect(result.stats.movedCount).toBe(1);
    expect(result.originalAnnotations.get('p-1')).toBe('moved');
    expect(result.editedAnnotations.get('p-1')).toBe('moved');
  });

  it('detects moved-renamed fields (same id, different record, different field name)', () => {
    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'SourceRecord',
        fields: [{ id: 'p-1', name: 'oldField', type: 'string' }],
      },
      {
        type: 'record',
        name: 'DestRecord',
        fields: [],
      },
    ]);

    const edited: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'SourceRecord',
        fields: [],
      },
      {
        type: 'record',
        name: 'DestRecord',
        fields: [{ id: 'p-1', name: 'newField', type: 'string' }],
      },
    ]);

    const result = computeDiff(orig, edited);
    expect(result.stats.renamedCount).toBe(1);
    expect(result.stats.movedCount).toBe(1);
    expect(result.originalAnnotations.get('p-1')).toBe('moved-renamed');
    expect(result.editedAnnotations.get('p-1')).toBe('moved-renamed');
  });

  it('detects type-changed fields (same id, same record, same name, different type)', () => {
    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'User',
        fields: [{ id: 'p-1', name: 'score', type: 'int' }],
      },
    ]);

    const edited: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'User',
        fields: [{ id: 'p-1', name: 'score', type: 'double' }],
      },
    ]);

    const result = computeDiff(orig, edited);
    expect(result.stats.modifiedCount).toBe(1);
    expect(result.originalAnnotations.get('p-1')).toBe('type-changed');
    expect(result.editedAnnotations.get('p-1')).toBe('type-changed');
  });

  it('detects added and deleted fields when IDs do not match', () => {
    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'User',
        fields: [{ id: 'p-1', name: 'deletedField', type: 'string' }],
      },
    ]);

    const edited: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'User',
        fields: [{ id: 'p-2', name: 'addedField', type: 'string' }],
      },
    ]);

    const result = computeDiff(orig, edited);
    expect(result.stats.deletedCount).toBe(1);
    expect(result.stats.addedCount).toBe(1);
    expect(result.originalAnnotations.get('p-1')).toBe('deleted');
    expect(result.editedAnnotations.get('p-2')).toBe('added');
  });

  it('honors manual links overriding synthetic ID matching', () => {
    // orig has p-1 (name: email)
    // edited has g-99 (name: primary_email)
    // manual link binds [editedFieldId: 'g-99', originalFieldId: 'p-1']
    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'User',
        fields: [{ id: 'p-1', name: 'email', type: 'string' }],
      },
    ]);

    const edited: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'User',
        fields: [{ id: 'g-99', name: 'primary_email', type: 'string' }],
      },
    ]);

    const manualLinks: Array<[string, string]> = [['g-99', 'p-1']];

    const result = computeDiff(orig, edited, manualLinks);
    expect(result.stats.renamedCount).toBe(1);
    expect(result.stats.addedCount).toBe(0);
    expect(result.stats.deletedCount).toBe(0);
    expect(result.originalAnnotations.get('p-1')).toBe('renamed');
    expect(result.editedAnnotations.get('g-99')).toBe('renamed');
  });

  it('handles recordLinks to match renamed records', () => {
    // orig record 'OldRecord', field 'f1'
    // edited record 'NewRecord', field 'f1'
    // with recordLinks: [['NewRecord', 'OldRecord']]
    // field f1 in NewRecord should be unchanged (or identical) instead of moved!
    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'OldRecord',
        fields: [{ id: 'p-1', name: 'f1', type: 'string' }],
      },
    ]);

    const edited: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'NewRecord',
        fields: [{ id: 'p-1', name: 'f1', type: 'string' }],
      },
    ]);

    const recordLinks: Array<[string, string]> = [['NewRecord', 'OldRecord']];

    const result = computeDiff(orig, edited, undefined, recordLinks);
    expect(result.stats.identicalCount).toBe(1);
    expect(result.stats.movedCount).toBe(0);
    expect(result.originalAnnotations.get('p-1')).toBe('unchanged');
    expect(result.editedAnnotations.get('p-1')).toBe('unchanged');
  });

  it('compares complex nested types (arrays, maps, unions) accurately', () => {
    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'Product',
        fields: [
          { id: 'p-1', name: 'tags', type: { type: 'array', items: 'string' } },
          { id: 'p-2', name: 'meta', type: ['null', 'string'] },
        ],
      },
    ]);

    const edited: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'Product',
        fields: [
          { id: 'p-1', name: 'tags', type: { type: 'array', items: 'int' } }, // modified
          { id: 'p-2', name: 'meta', type: ['null', 'string'] }, // unchanged
        ],
      },
    ]);

    const result = computeDiff(orig, edited);
    expect(result.stats.modifiedCount).toBe(1);
    expect(result.stats.identicalCount).toBe(1);
    expect(result.originalAnnotations.get('p-1')).toBe('type-changed');
    expect(result.editedAnnotations.get('p-1')).toBe('type-changed');
    expect(result.originalAnnotations.get('p-2')).toBe('unchanged');
    expect(result.editedAnnotations.get('p-2')).toBe('unchanged');
  });
});
