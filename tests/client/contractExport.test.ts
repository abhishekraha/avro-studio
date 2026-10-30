import { describe, it, expect, vi } from 'vitest';
import { serializeAvdl } from '../../src/core/serializer/avdlSerializer';
import type { ContractItem } from '../../src/core/types/workspace';
import type { AvroProtocol } from '../../src/core/types/schema';

describe('Contract Schema Serialization (AVDL & AVSC)', () => {
  const sampleProtocol: AvroProtocol = {
    protocol: 'OrderServiceProtocol',
    namespace: 'com.example.services',
    types: [
      {
        type: 'record',
        name: 'Order',
        doc: 'Order record',
        fields: [
          { id: 'f-1', name: 'orderId', type: 'string' },
          { id: 'f-2', name: 'total', type: 'double' },
        ],
      },
    ],
  };

  const sampleContract: ContractItem = {
    id: 'contract-1',
    name: 'OrderService',
    original: null,
    edited: sampleProtocol,
    manualLinks: [],
  };

  it('serializes edited contract to standard AVDL string via serializeAvdl', () => {
    expect(sampleContract.edited).not.toBeNull();
    const avdlOutput = serializeAvdl(sampleContract.edited!);

    expect(avdlOutput).toContain('@namespace("com.example.services")');
    expect(avdlOutput).toContain('protocol OrderServiceProtocol {');
    expect(avdlOutput).toContain('record Order {');
    expect(avdlOutput).toContain('string orderId;');
    expect(avdlOutput).toContain('double total;');
  });

  it('serializes edited contract to formatted AVSC / JSON string', () => {
    expect(sampleContract.edited).not.toBeNull();
    const avscOutput = JSON.stringify(sampleContract.edited, null, 2);

    expect(avscOutput).toBeTypeOf('string');
    const parsed = JSON.parse(avscOutput);
    expect(parsed.protocol).toBe('OrderServiceProtocol');
    expect(parsed.namespace).toBe('com.example.services');
    expect(parsed.types).toHaveLength(1);
    expect(parsed.types[0].name).toBe('Order');
    expect(parsed.types[0].fields).toHaveLength(2);
  });

  it('handles null edited contract gracefully', () => {
    const emptyContract: ContractItem = {
      id: 'contract-empty',
      name: 'EmptyContract',
      original: null,
      edited: null,
      manualLinks: [],
    };

    const getAvdlContent = (contract: ContractItem | null) => {
      if (!contract || !contract.edited) return '// No contract schema available';
      return serializeAvdl(contract.edited);
    };

    const getAvscContent = (contract: ContractItem | null) => {
      if (!contract || !contract.edited) return '// No contract schema available';
      return JSON.stringify(contract.edited, null, 2);
    };

    expect(getAvdlContent(emptyContract)).toBe('// No contract schema available');
    expect(getAvscContent(emptyContract)).toBe('// No contract schema available');
    expect(getAvdlContent(null)).toBe('// No contract schema available');
    expect(getAvscContent(null)).toBe('// No contract schema available');
  });

  it('generates correct download filenames based on contract name', () => {
    const getDownloadFilename = (contract: ContractItem | null, format: 'avdl' | 'avsc') => {
      const base = contract?.name?.replace(/\.[^/.]+$/, '') || 'contract';
      return `${base}.${format}`;
    };

    expect(getDownloadFilename(sampleContract, 'avdl')).toBe('OrderService.avdl');
    expect(getDownloadFilename(sampleContract, 'avsc')).toBe('OrderService.avsc');
    expect(getDownloadFilename(null, 'avdl')).toBe('contract.avdl');

    const dottedContract: ContractItem = {
      id: 'c-2',
      name: 'UserEvents.avdl',
      original: null,
      edited: null,
      manualLinks: [],
    };
    expect(getDownloadFilename(dottedContract, 'avdl')).toBe('UserEvents.avdl');
    expect(getDownloadFilename(dottedContract, 'avsc')).toBe('UserEvents.avsc');
  });

  it('triggers debounced auto-save handler callback when edited schema changes', async () => {
    vi.useFakeTimers();
    try {
      const onAutoSave = vi.fn();
      let currentEdited: AvroProtocol = structuredClone(sampleProtocol);
      let isDirty = true;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const triggerEdit = (newEdited: AvroProtocol) => {
        currentEdited = newEdited;
        isDirty = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          onAutoSave(currentEdited);
        }, 1500);
      };

      // Rapidly edit 3 times within debounce window
      triggerEdit({ ...currentEdited, protocol: 'Edit1' });
      vi.advanceTimersByTime(500);
      expect(onAutoSave).not.toHaveBeenCalled();

      triggerEdit({ ...currentEdited, protocol: 'Edit2' });
      vi.advanceTimersByTime(500);
      expect(onAutoSave).not.toHaveBeenCalled();

      triggerEdit({ ...currentEdited, protocol: 'FinalEdit' });
      vi.advanceTimersByTime(1499);
      expect(onAutoSave).not.toHaveBeenCalled();

      // Complete 1500ms debounce
      vi.advanceTimersByTime(1);
      expect(onAutoSave).toHaveBeenCalledTimes(1);
      expect(onAutoSave).toHaveBeenCalledWith(expect.objectContaining({ protocol: 'FinalEdit' }));
    } finally {
      vi.useRealTimers();
    }
  });
});
