import { describe, it, expect } from 'vitest';
import { buildLinkageExport } from '@/core/utils/exportLinkages';
import { type AvroProtocol, type AvroRecordType } from '@/core/types';

describe('exportLinkages (buildLinkageExport)', () => {
  const makeProtocol = (records: AvroRecordType[], name = 'ShopProtocol'): AvroProtocol => ({
    protocol: name,
    types: records,
  });

  it('generates LinkageExport artifact conforming to schema', () => {
    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'Customer',
        fields: [
          { id: 'p-1', name: 'id', type: 'string' },
          { id: 'p-2', name: 'old_email', type: 'string' },
          { id: 'p-3', name: 'removed_field', type: 'int' },
        ],
      },
    ]);

    const edited: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'Customer',
        fields: [
          { id: 'p-1', name: 'id', type: 'string' },
          { id: 'p-2', name: 'email', type: 'string' }, // renamed
          { id: 'g-99', name: 'created_at', type: 'long' }, // added
        ],
      },
    ]);

    const exportData = buildLinkageExport(orig, edited);

    expect(exportData.schemaName).toBe('ShopProtocol');
    expect(exportData.exportedAt).toBeDefined();
    expect(new Date(exportData.exportedAt).toString()).not.toBe('Invalid Date');
    expect(exportData.linkages).toBeDefined();

    // Check id field (identical)
    const idLink = exportData.linkages.find(
      (l) => l.original?.id === 'p-1' && l.edited?.id === 'p-1'
    );
    expect(idLink).toBeDefined();
    expect(idLink?.linkType).toBe('identical');
    expect(idLink?.linkSource).toBe('auto');
    expect(idLink?.original?.recordName).toBe('Customer');
    expect(idLink?.original?.fieldName).toBe('id');
    expect(idLink?.original?.cleanType).toBe('string');
    expect(idLink?.edited?.recordName).toBe('Customer');
    expect(idLink?.edited?.fieldName).toBe('id');

    // Check email field (renamed)
    const emailLink = exportData.linkages.find(
      (l) => l.original?.id === 'p-2' && l.edited?.id === 'p-2'
    );
    expect(emailLink).toBeDefined();
    expect(emailLink?.linkType).toBe('renamed');
    expect(emailLink?.linkSource).toBe('auto');
    expect(emailLink?.original?.fieldName).toBe('old_email');
    expect(emailLink?.edited?.fieldName).toBe('email');

    // Check removed_field (deleted)
    const delLink = exportData.linkages.find((l) => l.original?.id === 'p-3');
    expect(delLink).toBeDefined();
    expect(delLink?.linkType).toBe('deleted');
    expect(delLink?.linkSource).toBe('auto');
    expect(delLink?.edited).toBeUndefined();

    // Check created_at (added)
    const addLink = exportData.linkages.find((l) => l.edited?.id === 'g-99');
    expect(addLink).toBeDefined();
    expect(addLink?.linkType).toBe('added');
    expect(addLink?.linkSource).toBe('auto');
    expect(addLink?.original).toBeUndefined();
  });

  it('marks linkSource as manual when a manual override is used', () => {
    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'Order',
        fields: [{ id: 'orig-1', name: 'price', type: 'double' }],
      },
    ]);

    const edited: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'Order',
        fields: [{ id: 'new-1', name: 'total_amount', type: 'double' }],
      },
    ]);

    const manualLinks: Array<[string, string]> = [['new-1', 'orig-1']];

    const exportData = buildLinkageExport(orig, edited, manualLinks);
    expect(exportData.linkages).toHaveLength(1);

    const link = exportData.linkages[0];
    expect(link.linkSource).toBe('manual');
    expect(link.linkType).toBe('renamed');
    expect(link.original?.id).toBe('orig-1');
    expect(link.original?.fieldName).toBe('price');
    expect(link.edited?.id).toBe('new-1');
    expect(link.edited?.fieldName).toBe('total_amount');
  });

  it('formats cleanType properly for complex types (unions, arrays, maps)', () => {
    const orig: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'Doc',
        fields: [
          { id: '1', name: 'opt', type: ['null', 'string'] },
          { id: '2', name: 'items', type: { type: 'array', items: 'long' } },
          { id: '3', name: 'mapping', type: { type: 'map', values: 'int' } },
        ],
      },
    ]);

    const edited: AvroProtocol = makeProtocol([
      {
        type: 'record',
        name: 'Doc',
        fields: [
          { id: '1', name: 'opt', type: ['null', 'string'] },
          { id: '2', name: 'items', type: { type: 'array', items: 'long' } },
          { id: '3', name: 'mapping', type: { type: 'map', values: 'int' } },
        ],
      },
    ]);

    const exportData = buildLinkageExport(orig, edited);
    const optLink = exportData.linkages.find((l) => l.original?.fieldName === 'opt');
    const itemsLink = exportData.linkages.find((l) => l.original?.fieldName === 'items');
    const mappingLink = exportData.linkages.find((l) => l.original?.fieldName === 'mapping');

    expect(optLink?.original?.cleanType).toBe('string?');
    expect(itemsLink?.original?.cleanType).toBe('array<long>');
    expect(mappingLink?.original?.cleanType).toBe('map<int>');
  });
});
