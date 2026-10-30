import { describe, it, expect } from 'vitest';
import { runRecon, ReconOptions } from '../../../src/core/utils/reconEngine';
import { LinkageExport } from '../../../src/core/types/linkage';

describe('reconEngine', () => {
  const baseLinkages: LinkageExport = {
    exportedAt: '2026-10-30T00:00:00Z',
    schemaName: 'UserRecon',
    linkages: [
      {
        linkType: 'identical',
        linkSource: 'auto',
        original: { recordName: 'User', fieldName: 'id', cleanType: 'long', id: '1' },
        edited: { recordName: 'User', fieldName: 'user_id', cleanType: 'long', id: '1' },
      },
      {
        linkType: 'identical',
        linkSource: 'auto',
        original: { recordName: 'User', fieldName: 'name', cleanType: 'string', id: '2' },
        edited: { recordName: 'User', fieldName: 'full_name', cleanType: 'string', id: '2' },
      },
      {
        linkType: 'identical',
        linkSource: 'auto',
        original: { recordName: 'User', fieldName: 'score', cleanType: 'double', id: '3' },
        edited: { recordName: 'User', fieldName: 'score', cleanType: 'double', id: '3' },
      },
    ],
  };

  it('reports perfect match when source and target match exactly', () => {
    const sourceRows = [
      { id: 1, name: 'Alice', score: 95.5 },
      { id: 2, name: 'Bob', score: 80.0 },
    ];
    const targetRows = [
      { user_id: 1, full_name: 'Alice', score: 95.5 },
      { user_id: 2, full_name: 'Bob', score: 80.0 },
    ];

    const report = runRecon({
      sourceRows,
      targetRows,
      keyFields: ['id'],
      linkages: baseLinkages,
    });

    expect(report.totalSourceRows).toBe(2);
    expect(report.totalTargetRows).toBe(2);
    expect(report.matchedRows).toBe(2);
    expect(report.mismatchedRows).toHaveLength(0);
    expect(report.missingInTarget).toHaveLength(0);
    expect(report.extraInTarget).toHaveLength(0);
  });

  it('detects missingInTarget and extraInTarget rows', () => {
    const sourceRows = [
      { id: 1, name: 'Alice', score: 95.5 },
      { id: 2, name: 'Bob', score: 80.0 },
    ];
    const targetRows = [
      { user_id: 2, full_name: 'Bob', score: 80.0 },
      { user_id: 3, full_name: 'Charlie', score: 70.0 },
    ];

    const report = runRecon({
      sourceRows,
      targetRows,
      keyFields: ['id'],
      linkages: baseLinkages,
    });

    expect(report.totalSourceRows).toBe(2);
    expect(report.totalTargetRows).toBe(2);
    expect(report.matchedRows).toBe(1);
    expect(report.mismatchedRows).toHaveLength(0);
    expect(report.missingInTarget).toEqual([
      { key: '1', sourceRow: sourceRows[0] },
    ]);
    expect(report.extraInTarget).toEqual([
      { key: '3', targetRow: targetRows[1] },
    ]);
  });

  it('detects value mismatches between mapped fields', () => {
    const sourceRows = [
      { id: 1, name: 'Alice', score: 95.5 },
    ];
    const targetRows = [
      { user_id: 1, full_name: 'Alicia', score: 95.5 },
    ];

    const report = runRecon({
      sourceRows,
      targetRows,
      keyFields: ['id'],
      linkages: baseLinkages,
    });

    expect(report.totalSourceRows).toBe(1);
    expect(report.totalTargetRows).toBe(1);
    expect(report.matchedRows).toBe(0);
    expect(report.mismatchedRows).toEqual([
      {
        key: '1',
        mismatches: [
          {
            field: 'name -> full_name',
            sourceValue: 'Alice',
            targetValue: 'Alicia',
          },
        ],
      },
    ]);
  });

  it('respects numericEpsilon tolerance', () => {
    const sourceRows = [
      { id: 1, name: 'Alice', score: 95.5000001 },
      { id: 2, name: 'Bob', score: 80.0 },
    ];
    const targetRows = [
      { user_id: 1, full_name: 'Alice', score: 95.5 },
      { user_id: 2, full_name: 'Bob', score: 80.1 },
    ];

    const report = runRecon({
      sourceRows,
      targetRows,
      keyFields: ['id'],
      linkages: baseLinkages,
      tolerance: { numericEpsilon: 0.0001 },
    });

    expect(report.matchedRows).toBe(1);
    expect(report.mismatchedRows).toHaveLength(1);
    expect(report.mismatchedRows[0].key).toBe('2');
  });

  it('respects ignoreWhitespace tolerance', () => {
    const sourceRows = [
      { id: 1, name: '  Alice  ', score: 95.5 },
    ];
    const targetRows = [
      { user_id: 1, full_name: 'Alice', score: 95.5 },
    ];

    const report = runRecon({
      sourceRows,
      targetRows,
      keyFields: ['id'],
      linkages: baseLinkages,
      tolerance: { ignoreWhitespace: true },
    });

    expect(report.matchedRows).toBe(1);
    expect(report.mismatchedRows).toHaveLength(0);
  });

  it('supports composite primary keys', () => {
    const compositeLinkages: LinkageExport = {
      exportedAt: '2026-10-30T00:00:00Z',
      schemaName: 'CompositeRecon',
      linkages: [
        {
          linkType: 'identical',
          linkSource: 'auto',
          original: { recordName: 'Event', fieldName: 'orgId', cleanType: 'string', id: '1' },
          edited: { recordName: 'Event', fieldName: 'org_id', cleanType: 'string', id: '1' },
        },
        {
          linkType: 'identical',
          linkSource: 'auto',
          original: { recordName: 'Event', fieldName: 'eventId', cleanType: 'int', id: '2' },
          edited: { recordName: 'Event', fieldName: 'event_id', cleanType: 'int', id: '2' },
        },
        {
          linkType: 'identical',
          linkSource: 'auto',
          original: { recordName: 'Event', fieldName: 'val', cleanType: 'string', id: '3' },
          edited: { recordName: 'Event', fieldName: 'val', cleanType: 'string', id: '3' },
        },
      ],
    };

    const sourceRows = [
      { orgId: 'orgA', eventId: 101, val: 'ok' },
      { orgId: 'orgA', eventId: 102, val: 'diff' },
    ];
    const targetRows = [
      { org_id: 'orgA', event_id: 101, val: 'ok' },
      { org_id: 'orgA', event_id: 102, val: 'mismatch' },
    ];

    const report = runRecon({
      sourceRows,
      targetRows,
      keyFields: ['orgId', 'eventId'],
      linkages: compositeLinkages,
    });

    expect(report.matchedRows).toBe(1);
    expect(report.mismatchedRows).toEqual([
      {
        key: 'orgA|102',
        mismatches: [
          {
            field: 'val',
            sourceValue: 'diff',
            targetValue: 'mismatch',
          },
        ],
      },
    ]);
  });
});
