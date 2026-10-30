import { LinkageExport } from '../types/linkage';

export interface ReconOptions {
  sourceRows: Array<Record<string, unknown>>;
  targetRows: Array<Record<string, unknown>>;
  keyFields: string[];
  linkages: LinkageExport;
  tolerance?: {
    numericEpsilon?: number;
    ignoreWhitespace?: boolean;
  };
}

export interface ReconMismatch {
  field: string;
  sourceValue: unknown;
  targetValue: unknown;
}

export interface ReconMismatchedRow {
  key: string;
  mismatches: ReconMismatch[];
}

export interface ReconMissingRow {
  key: string;
  sourceRow: Record<string, unknown>;
}

export interface ReconExtraRow {
  key: string;
  targetRow: Record<string, unknown>;
}

export interface ReconReport {
  totalSourceRows: number;
  totalTargetRows: number;
  matchedRows: number;
  mismatchedRows: ReconMismatchedRow[];
  missingInTarget: ReconMissingRow[];
  extraInTarget: ReconExtraRow[];
}

function buildKey(row: Record<string, unknown>, keyFields: string[]): string {
  return keyFields.map((f) => String(row[f] ?? '')).join('|');
}

function areValuesEqual(
  valA: unknown,
  valB: unknown,
  numericEpsilon?: number,
  ignoreWhitespace?: boolean
): boolean {
  if (valA === valB) {
    return true;
  }

  if (valA === null || valA === undefined || valB === null || valB === undefined) {
    return valA === valB;
  }

  // Check numeric with epsilon
  if (typeof valA === 'number' && typeof valB === 'number') {
    if (numericEpsilon !== undefined && numericEpsilon >= 0) {
      return Math.abs(valA - valB) <= numericEpsilon;
    }
    return valA === valB;
  }

  // If one or both are numbers / numeric strings
  if (numericEpsilon !== undefined && numericEpsilon >= 0) {
    const numA = Number(valA);
    const numB = Number(valB);
    if (!isNaN(numA) && !isNaN(numB) && typeof valA !== 'boolean' && typeof valB !== 'boolean') {
      return Math.abs(numA - numB) <= numericEpsilon;
    }
  }

  // Check strings with whitespace tolerance
  if (ignoreWhitespace) {
    const strA = typeof valA === 'string' ? valA.trim() : String(valA);
    const strB = typeof valB === 'string' ? valB.trim() : String(valB);
    return strA === strB;
  }

  return false;
}

export function runRecon(options: ReconOptions): ReconReport {
  const { sourceRows, targetRows, keyFields, linkages, tolerance } = options;
  const numericEpsilon = tolerance?.numericEpsilon;
  const ignoreWhitespace = tolerance?.ignoreWhitespace;

  // Build field mappings from linkages
  // original.fieldName -> edited.fieldName
  const sourceToTargetFieldMap = new Map<string, string>();
  for (const link of linkages.linkages) {
    if (link.original && link.edited) {
      sourceToTargetFieldMap.set(link.original.fieldName, link.edited.fieldName);
    }
  }

  // Map target rows by their corresponding target key fields
  // For each source keyField, find its target equivalent if mapped
  const targetKeyFields = keyFields.map((kf) => sourceToTargetFieldMap.get(kf) ?? kf);

  const targetMap = new Map<string, Record<string, unknown>>();
  const targetKeysEncountered = new Set<string>();

  for (const tRow of targetRows) {
    const tKey = buildKey(tRow, targetKeyFields);
    targetMap.set(tKey, tRow);
  }

  let matchedRows = 0;
  const mismatchedRows: ReconMismatchedRow[] = [];
  const missingInTarget: ReconMissingRow[] = [];

  for (const sRow of sourceRows) {
    const sKey = buildKey(sRow, keyFields);
    const tRow = targetMap.get(sKey);

    if (!tRow) {
      missingInTarget.push({
        key: sKey,
        sourceRow: sRow,
      });
      continue;
    }

    targetKeysEncountered.add(sKey);

    // Compare fields defined in linkages
    const rowMismatches: ReconMismatch[] = [];

    for (const [srcField, tgtField] of sourceToTargetFieldMap.entries()) {
      const srcVal = sRow[srcField];
      const tgtVal = tRow[tgtField];

      const match = areValuesEqual(srcVal, tgtVal, numericEpsilon, ignoreWhitespace);
      if (!match) {
        rowMismatches.push({
          field: srcField === tgtField ? srcField : `${srcField} -> ${tgtField}`,
          sourceValue: srcVal,
          targetValue: tgtVal,
        });
      }
    }

    if (rowMismatches.length > 0) {
      mismatchedRows.push({
        key: sKey,
        mismatches: rowMismatches,
      });
    } else {
      matchedRows++;
    }
  }

  // Find extra in target
  const extraInTarget: ReconExtraRow[] = [];
  for (const tRow of targetRows) {
    const tKey = buildKey(tRow, targetKeyFields);
    if (!targetKeysEncountered.has(tKey)) {
      extraInTarget.push({
        key: tKey,
        targetRow: tRow,
      });
    }
  }

  return {
    totalSourceRows: sourceRows.length,
    totalTargetRows: targetRows.length,
    matchedRows,
    mismatchedRows,
    missingInTarget,
    extraInTarget,
  };
}
