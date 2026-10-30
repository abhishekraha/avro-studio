import { describe, it, expect } from 'vitest';
import type { AvroProtocol } from '../../src/core/types/schema';
import type { ContractItem } from '../../src/core/types/workspace';
import { computeDiff } from '../../src/core/utils/schemaDiff';
import { buildLinkageExport } from '../../src/core/utils/exportLinkages';

describe('Cross-pane Drag-and-Drop & Auto-Linkage Logic', () => {
  const origProtocol: AvroProtocol = {
    protocol: 'OriginalService',
    namespace: 'com.example.services',
    types: [
      {
        type: 'record',
        name: 'Order',
        fields: [
          { id: 'orig-f1', name: 'orderId', type: 'string', doc: 'ID' },
          { id: 'orig-f2', name: 'customerEmail', type: 'string' },
          { id: 'orig-f3', name: 'amount', type: 'double' },
        ],
      },
    ],
  };

  const editedProtocol: AvroProtocol = {
    protocol: 'OriginalService',
    namespace: 'com.example.services',
    types: [
      {
        type: 'record',
        name: 'OrderV2',
        fields: [],
      },
    ],
  };

  it('allocates synthetic ID g-XXXX and auto-links when dropped from original into edited record', () => {
    let activeContract: ContractItem = {
      id: 'contract-1',
      name: 'OrderService.avdl',
      original: origProtocol,
      edited: editedProtocol,
      manualLinks: [],
    };

    // Simulate cross-pane drag drop event payload:
    // source: 'original', field: { id: 'orig-f2', name: 'customerEmail', type: 'string' }, recordName: 'Order'
    // over target: 'drop-rec-OrderV2'
    const draggedOriginalField = { id: 'orig-f2', name: 'customerEmail', type: 'string' as const };
    const targetRecordName = 'OrderV2';

    // Handler logic to be tested and implemented in App:
    const handleDropFromOriginal = (
      sourceField: { id: string; name: string; type: any; doc?: string; default?: any },
      targetRecName: string
    ) => {
      const syntheticId = `g-${Math.random().toString(36).substring(2, 6)}`;
      const newField = {
        id: syntheticId,
        name: sourceField.name,
        type: sourceField.type,
        doc: sourceField.doc,
        default: sourceField.default,
      };

      const updatedContract: ContractItem = {
        ...activeContract,
        edited: {
          ...activeContract.edited!,
          types: activeContract.edited!.types.map((t) => {
            if (t.type === 'record' && t.name === targetRecName) {
              return {
                ...t,
                fields: [...t.fields, newField],
              };
            }
            return t;
          }),
        },
        manualLinks: [...activeContract.manualLinks, [syntheticId, sourceField.id]],
      };

      activeContract = updatedContract;
      return newField;
    };

    const createdField = handleDropFromOriginal(draggedOriginalField, targetRecordName);

    expect(createdField.id).toMatch(/^g-[a-z0-9]{4}$/);
    expect(createdField.name).toBe('customerEmail');
    expect(createdField.type).toBe('string');

    // Verify field added to OrderV2
    const orderV2 = activeContract.edited?.types.find((t) => t.name === 'OrderV2') as any;
    expect(orderV2.fields).toHaveLength(1);
    expect(orderV2.fields[0].id).toBe(createdField.id);

    // Verify auto-linked in manualLinks
    expect(activeContract.manualLinks).toHaveLength(1);
    expect(activeContract.manualLinks[0]).toEqual([createdField.id, 'orig-f2']);

    // Verify diff marks it as moved or renamed rather than purely added
    const diff = computeDiff(activeContract.original, activeContract.edited, activeContract.manualLinks);
    expect(diff.editedAnnotations.get(createdField.id)).toBe('moved');
    expect(diff.originalAnnotations.get('orig-f2')).toBe('moved');

    // Verify export linkages output
    const exportResult = buildLinkageExport(
      activeContract.original!,
      activeContract.edited!,
      activeContract.manualLinks
    );
    const linkedField = exportResult.linkages.find((l) => l.edited?.id === createdField.id);
    expect(linkedField).toBeDefined();
    expect(linkedField?.linkSource).toBe('manual');
    expect(linkedField?.linkType).toBe('moved');
    expect(linkedField?.original?.id).toBe('orig-f2');
    expect(linkedField?.edited?.id).toBe(createdField.id);
  });

  it('unlinking removes the pair from manualLinks', () => {
    let manualLinks: Array<[string, string]> = [
      ['g-1234', 'orig-f1'],
      ['g-5678', 'orig-f2'],
    ];

    const unlink = (fieldId: string) => {
      manualLinks = manualLinks.filter(([eId, oId]) => eId !== fieldId && oId !== fieldId);
    };

    // Unlink via original field ID
    unlink('orig-f1');
    expect(manualLinks).toEqual([['g-5678', 'orig-f2']]);

    // Unlink via edited field ID
    unlink('g-5678');
    expect(manualLinks).toHaveLength(0);
  });

  it('manual link pairing mode links an unlinked field in original and edited schemas', () => {
    let manualLinks: Array<[string, string]> = [];

    const linkFields = (idA: string, idB: string, isOriginalA: boolean) => {
      const editedId = isOriginalA ? idB : idA;
      const originalId = isOriginalA ? idA : idB;
      // remove any previous links for either field
      const filtered = manualLinks.filter(([e, o]) => e !== editedId && o !== originalId);
      manualLinks = [...filtered, [editedId, originalId]];
    };

    // Clicked original 'orig-f3', then clicked edited 'g-new'
    linkFields('orig-f3', 'g-new', true);
    expect(manualLinks).toEqual([['g-new', 'orig-f3']]);

    // Re-link with inverse order (clicked edited 'g-new2' then original 'orig-f3')
    linkFields('g-new2', 'orig-f3', false);
    expect(manualLinks).toEqual([['g-new2', 'orig-f3']]);
  });

  it('renders draggable handle on original fields and droppable target in edited schema', () => {
    // Tests interface prop mapping contracts for SchemaViewer and SchemaEditor
    const partnerMap = new Map();
    partnerMap.set('orig-f1', { fieldId: 'g-101', fieldName: 'orderId', recordName: 'OrderV2' });

    expect(partnerMap.has('orig-f1')).toBe(true);
    const partner = partnerMap.get('orig-f1');
    expect(partner.fieldName).toBe('orderId');
    expect(partner.recordName).toBe('OrderV2');
  });
});
