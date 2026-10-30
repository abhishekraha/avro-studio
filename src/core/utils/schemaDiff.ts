import {
  type AvroProtocol,
  type AvroRecordType,
  type AvroField,
  type AvroSchemaType,
  type LinkType,
  isRecordType,
} from '../types';

/**
 * Aggregated statistics of schema diff changes.
 */
export interface DiffStats {
  addedCount: number;
  deletedCount: number;
  modifiedCount: number; // type-changed
  renamedCount: number;  // renamed or moved-renamed
  movedCount: number;    // moved or moved-renamed
  identicalCount: number; // unchanged
}

/**
 * Result structure returned by computeDiff.
 */
export interface SchemaDiffResult {
  stats: DiffStats;
  originalAnnotations: Map<string, LinkType | 'unchanged'>;
  editedAnnotations: Map<string, LinkType | 'unchanged'>;
}

/**
 * Helper to normalize map or array pairs into a standard Map.
 */
function normalizePairMap(
  input?: Map<string, string> | Array<[string, string]>
): Map<string, string> {
  if (!input) return new Map();
  if (input instanceof Map) return input;
  return new Map(input);
}

/**
 * Deep structural comparison of two Avro schema types.
 */
export function areTypesEqual(a: AvroSchemaType, b: AvroSchemaType): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!areTypesEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;

    // Check array type
    if (objA.type === 'array' || objB.type === 'array') {
      if (objA.type !== objB.type) return false;
      return areTypesEqual(objA.items as AvroSchemaType, objB.items as AvroSchemaType);
    }

    // Check map type
    if (objA.type === 'map' || objB.type === 'map') {
      if (objA.type !== objB.type) return false;
      return areTypesEqual(objA.values as AvroSchemaType, objB.values as AvroSchemaType);
    }

    // Compare keys
    const keysA = Object.keys(objA).filter((k) => k !== 'fields' && k !== 'doc');
    const keysB = Object.keys(objB).filter((k) => k !== 'fields' && k !== 'doc');
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (typeof objA[key] === 'object' && objA[key] !== null) {
        if (!areTypesEqual(objA[key] as AvroSchemaType, objB[key] as AvroSchemaType)) {
          return false;
        }
      } else if (objA[key] !== objB[key]) {
        return false;
      }
    }
    return true;
  }

  return false;
}

interface FieldLocation {
  recordName: string;
  field: AvroField;
}

/**
 * Computes structural differences between original and edited schemas using
 * synthetic field IDs ('id') and manual link overrides.
 */
export function computeDiff(
  original: AvroProtocol | null,
  edited: AvroProtocol | null,
  manualLinks?: Map<string, string> | Array<[string, string]>,
  recordLinks?: Map<string, string> | Array<[string, string]>
): SchemaDiffResult {
  const manualMap = normalizePairMap(manualLinks); // editedFieldId -> originalFieldId
  const recMap = normalizePairMap(recordLinks);     // editedRecordName -> originalRecordName

  const origFields = new Map<string, FieldLocation>();
  if (original?.types) {
    for (const type of original.types) {
      if (isRecordType(type)) {
        for (const field of type.fields) {
          origFields.set(field.id, {
            recordName: type.name,
            field,
          });
        }
      }
    }
  }

  const editedFields = new Map<string, FieldLocation>();
  if (edited?.types) {
    for (const type of edited.types) {
      if (isRecordType(type)) {
        for (const field of type.fields) {
          editedFields.set(field.id, {
            recordName: type.name,
            field,
          });
        }
      }
    }
  }

  const origAnnotations = new Map<string, LinkType | 'unchanged'>();
  const editedAnnotations = new Map<string, LinkType | 'unchanged'>();

  let addedCount = 0;
  let deletedCount = 0;
  let modifiedCount = 0;
  let renamedCount = 0;
  let movedCount = 0;
  let identicalCount = 0;

  // Track which original fields have been matched/consumed
  const matchedOrigIds = new Set<string>();

  // Process edited fields
  for (const [editedId, editedLoc] of editedFields.entries()) {
    // Determine corresponding original ID: manual link takes precedence
    let targetOrigId: string | undefined;
    if (manualMap.has(editedId)) {
      targetOrigId = manualMap.get(editedId);
    } else if (origFields.has(editedId)) {
      targetOrigId = editedId;
    }

    if (!targetOrigId || !origFields.has(targetOrigId)) {
      // Field is added
      editedAnnotations.set(editedId, 'added');
      addedCount++;
      continue;
    }

    const origLoc = origFields.get(targetOrigId)!;
    matchedOrigIds.add(targetOrigId);

    // Check if record matches (either same name or mapped via recordLinks)
    const effectiveOrigRecordName = recMap.get(editedLoc.recordName) || editedLoc.recordName;
    const sameRecord = origLoc.recordName === effectiveOrigRecordName;
    const sameName = origLoc.field.name === editedLoc.field.name;
    const sameType = areTypesEqual(origLoc.field.type, editedLoc.field.type);

    let status: LinkType | 'unchanged';

    if (sameRecord && sameName && sameType) {
      status = 'unchanged';
      identicalCount++;
    } else if (sameRecord && !sameName && sameType) {
      status = 'renamed';
      renamedCount++;
    } else if (!sameRecord && sameName && sameType) {
      status = 'moved';
      movedCount++;
    } else if (!sameRecord && !sameName && sameType) {
      status = 'moved-renamed';
      movedCount++;
      renamedCount++;
    } else {
      // Type changed (may also have moved/renamed, but primary categorization per brief is type-changed)
      status = 'type-changed';
      modifiedCount++;
      if (!sameName) renamedCount++;
      if (!sameRecord) movedCount++;
    }

    editedAnnotations.set(editedId, status);
    origAnnotations.set(targetOrigId, status);
  }

  // Any original fields not matched are deleted
  for (const [origId] of origFields.entries()) {
    if (!matchedOrigIds.has(origId)) {
      origAnnotations.set(origId, 'deleted');
      deletedCount++;
    }
  }

  return {
    stats: {
      addedCount,
      deletedCount,
      modifiedCount,
      renamedCount,
      movedCount,
      identicalCount,
    },
    originalAnnotations: origAnnotations,
    editedAnnotations,
  };
}
