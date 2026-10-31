import {
  type AvroProtocol,
  type AvroField,
  type AvroSchemaType,
  type LinkageExport,
  type LinkageEntry,
  type LinkageEndpoint,
  type LinkType,
  type LinkSource,
  isRecordType,
} from '../types';
import { formatAvdlType } from '../serializer/avdlSerializer';
import { areTypesEqual } from './schemaDiff';

/**
 * Normalizes an array or map into a Map.
 */
function normalizePairMap(
  input?: Map<string, string> | Array<[string, string]>
): Map<string, string> {
  if (!input) return new Map();
  if (input instanceof Map) return input;
  return new Map(input);
}

interface FieldMeta {
  recordName: string;
  namespace?: string;
  field: AvroField;
}

function endpoint(recordName: string, namespace: string | undefined, field: AvroField): LinkageEndpoint {
  const effectiveNamespace = namespace || '';
  return {
    namespace: effectiveNamespace || undefined,
    recordName,
    fieldName: field.name,
    identityKey: `${effectiveNamespace}.${recordName}.${field.name}`.toLowerCase(),
    cleanType: formatAvdlType(field.type),
    id: field.id,
  };
}

/**
 * Builds a LinkageExport JSON artifact for downstream database migrations.
 */
export function buildLinkageExport(
  original: AvroProtocol,
  edited: AvroProtocol,
  manualLinks?: Array<[string, string]>,
  recordLinks?: Array<[string, string]>
): LinkageExport {
  const manualMap = normalizePairMap(manualLinks); // editedFieldId -> origFieldId
  const recMap = normalizePairMap(recordLinks);     // editedRecordName -> origRecordName

  const origFields = new Map<string, FieldMeta>();
  if (original.types) {
    for (const t of original.types) {
      if (isRecordType(t)) {
        for (const f of t.fields) {
          origFields.set(f.id, { recordName: t.name, namespace: t.namespace || original.namespace, field: f });
        }
      }
    }
  }

  const editedFields = new Map<string, FieldMeta>();
  if (edited.types) {
    for (const t of edited.types) {
      if (isRecordType(t)) {
        for (const f of t.fields) {
          editedFields.set(f.id, { recordName: t.name, namespace: t.namespace || edited.namespace, field: f });
        }
      }
    }
  }

  const linkages: LinkageEntry[] = [];
  const matchedOrigIds = new Set<string>();

  for (const [editedId, editedLoc] of editedFields.entries()) {
    const isManual = manualMap.has(editedId);
    let targetOrigId: string | undefined;

    if (isManual) {
      targetOrigId = manualMap.get(editedId);
    } else if (origFields.has(editedId)) {
      targetOrigId = editedId;
    }

    const editedEndpoint = endpoint(editedLoc.recordName, editedLoc.namespace, editedLoc.field);

    if (!targetOrigId || !origFields.has(targetOrigId)) {
      // Added field
      linkages.push({
        linkType: 'added',
        linkSource: isManual ? 'manual' : 'auto',
        edited: editedEndpoint,
      });
      continue;
    }

    const origLoc = origFields.get(targetOrigId)!;
    matchedOrigIds.add(targetOrigId);

    const origEndpoint = endpoint(origLoc.recordName, origLoc.namespace, origLoc.field);

    const effectiveOrigRecordName = recMap.get(editedLoc.recordName) || editedLoc.recordName;
    const sameRecord = origLoc.recordName === effectiveOrigRecordName && (origLoc.namespace || '') === (editedLoc.namespace || '');
    const sameName = origLoc.field.name === editedLoc.field.name;
    const sameType = areTypesEqual(origLoc.field.type, editedLoc.field.type);

    let linkType: LinkType;
    if (sameRecord && sameName && sameType) {
      linkType = 'identical';
    } else if (sameRecord && !sameName && sameType) {
      linkType = 'renamed';
    } else if (!sameRecord && sameName && sameType) {
      linkType = 'moved';
    } else if (!sameRecord) {
      linkType = 'moved';
    } else {
      linkType = 'type-changed';
    }

    linkages.push({
      linkType,
      linkSource: isManual ? 'manual' : 'auto',
      original: origEndpoint,
      edited: editedEndpoint,
    });
  }

  // Deleted fields in original that were not matched
  for (const [origId, origLoc] of origFields.entries()) {
    if (!matchedOrigIds.has(origId)) {
      linkages.push({
        linkType: 'deleted',
        linkSource: 'auto',
        original: endpoint(origLoc.recordName, origLoc.namespace, origLoc.field),
      });
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    schemaName: edited.protocol || original.protocol || 'AvroProtocol',
    linkages,
  };
}
