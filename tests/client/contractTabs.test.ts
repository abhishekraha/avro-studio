import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ContractTabBar } from '../../src/client/components/ContractTabBar';
import type { ContractItem, WorkspaceData } from '../../src/core/types/workspace';
import type { AvroProtocol } from '../../src/core/types/schema';

describe('ContractTabBar component and Contract switching logic', () => {
  const dummyProtocol1: AvroProtocol = {
    protocol: 'OrderProtocol',
    namespace: 'com.example.order',
    types: [
      {
        type: 'record',
        name: 'Order',
        fields: [{ id: 'f-1', name: 'orderId', type: 'string' }],
      },
    ],
  };

  const dummyProtocol2: AvroProtocol = {
    protocol: 'PaymentProtocol',
    namespace: 'com.example.payment',
    types: [
      {
        type: 'record',
        name: 'Payment',
        fields: [{ id: 'f-2', name: 'paymentId', type: 'string' }],
      },
    ],
  };

  const sampleContracts: ContractItem[] = [
    {
      id: 'c-1',
      name: 'OrderContract.avdl',
      original: null,
      edited: dummyProtocol1,
      manualLinks: [],
    },
    {
      id: 'c-2',
      name: 'PaymentContract.avdl',
      original: null,
      edited: dummyProtocol2,
      manualLinks: [],
    },
  ];

  it('renders contract tabs and highlights the active contract', () => {
    const html = renderToString(
      React.createElement(ContractTabBar, {
        contracts: sampleContracts,
        activeContractId: 'c-1',
        onSelectContract: vi.fn(),
        onAddContract: vi.fn(),
        onRenameContract: vi.fn(),
        onRemoveContract: vi.fn(),
      })
    );

    expect(html).toContain('OrderContract.avdl');
    expect(html).toContain('PaymentContract.avdl');
    expect(html).toContain('New Contract');
    // Active tab has highlight class (e.g., bg-gray-800 or text-indigo-400 / border-indigo)
    expect(html).toMatch(/data-active="true"/);
  });

  it('shows close button when more than 1 contract exists', () => {
    const htmlMultiple = renderToString(
      React.createElement(ContractTabBar, {
        contracts: sampleContracts,
        activeContractId: 'c-1',
        onSelectContract: vi.fn(),
        onAddContract: vi.fn(),
        onRenameContract: vi.fn(),
        onRemoveContract: vi.fn(),
      })
    );

    // Close button should be rendered
    expect(htmlMultiple).toContain('aria-label="Close tab"');

    const htmlSingle = renderToString(
      React.createElement(ContractTabBar, {
        contracts: [sampleContracts[0]],
        activeContractId: 'c-1',
        onSelectContract: vi.fn(),
        onAddContract: vi.fn(),
        onRenameContract: vi.fn(),
        onRemoveContract: vi.fn(),
      })
    );

    // Close button should NOT be rendered when only 1 contract exists
    expect(htmlSingle).not.toContain('aria-label="Close tab"');
  });

  it('workspace state updates active contract correctly when switching and editing', () => {
    // Model unit test for workspace contract navigation logic
    let workspace: WorkspaceData = {
      id: 'ws-test',
      name: 'Test Workspace',
      savedAt: new Date().toISOString(),
      isNew: false,
      activeContractId: 'c-1',
      contracts: [
        {
          id: 'c-1',
          name: 'OrderContract.avdl',
          original: dummyProtocol1,
          edited: dummyProtocol1,
          manualLinks: [],
        },
        {
          id: 'c-2',
          name: 'PaymentContract.avdl',
          original: dummyProtocol2,
          edited: dummyProtocol2,
          manualLinks: [],
        },
      ],
    };

    // Switching active contract updates activeContractId
    const switchContract = (newId: string) => {
      workspace = {
        ...workspace,
        activeContractId: newId,
      };
    };

    switchContract('c-2');
    expect(workspace.activeContractId).toBe('c-2');

    const activeContract = workspace.contracts.find((c) => c.id === workspace.activeContractId);
    expect(activeContract?.name).toBe('PaymentContract.avdl');
    expect(activeContract?.edited?.protocol).toBe('PaymentProtocol');

    // Editing in active contract updates workspace.contracts
    const updateActiveEdited = (newEdited: AvroProtocol) => {
      workspace = {
        ...workspace,
        contracts: workspace.contracts.map((c) =>
          c.id === workspace.activeContractId ? { ...c, edited: newEdited } : c
        ),
      };
    };

    const updatedPaymentProtocol: AvroProtocol = {
      ...dummyProtocol2,
      protocol: 'UpdatedPaymentProtocol',
    };
    updateActiveEdited(updatedPaymentProtocol);

    const updated = workspace.contracts.find((c) => c.id === 'c-2');
    expect(updated?.edited?.protocol).toBe('UpdatedPaymentProtocol');

    // Contract 1 remains untouched
    const contract1 = workspace.contracts.find((c) => c.id === 'c-1');
    expect(contract1?.edited?.protocol).toBe('OrderProtocol');
  });

  it('adds and removes contracts maintaining valid active contract', () => {
    let contracts: ContractItem[] = [...sampleContracts];
    let activeId = 'c-1';

    const addContract = (name: string) => {
      const newContract: ContractItem = {
        id: `c-${Date.now()}`,
        name,
        original: null,
        edited: null,
        manualLinks: [],
      };
      contracts = [...contracts, newContract];
      activeId = newContract.id;
    };

    const removeContract = (idToRemove: string) => {
      if (contracts.length <= 1) return;
      const idx = contracts.findIndex((c) => c.id === idToRemove);
      contracts = contracts.filter((c) => c.id !== idToRemove);
      if (activeId === idToRemove) {
        const nextActive = contracts[Math.max(0, idx - 1)];
        activeId = nextActive.id;
      }
    };

    addContract('InvoiceContract.avdl');
    expect(contracts).toHaveLength(3);
    expect(contracts[2].name).toBe('InvoiceContract.avdl');
    expect(activeId).toBe(contracts[2].id);

    removeContract(activeId);
    expect(contracts).toHaveLength(2);
    expect(activeId).toBe('c-2');
  });
});
