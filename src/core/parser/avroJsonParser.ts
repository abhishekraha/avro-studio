import {
  type AvroProtocol,
  type AvroNamedType,
  type AvroRecordType,
  type AvroEnumType,
  type AvroFixedType,
  type AvroField,
  type AvroSchemaType,
  type FieldOrder,
  isPrimitiveType,
} from '../types';

let syntheticIdCounter = 1;

/**
 * Reset synthetic counter (mainly for testing or isolation).
 */
export function resetSyntheticIdCounter(val = 1): void {
  syntheticIdCounter = val;
}

function nextSyntheticId(): string {
  const num = syntheticIdCounter++;
  return `g-${num.toString().padStart(4, '0')}`;
}

interface UnwrappedResult {
  schema: unknown;
  subject?: string;
}

/**
 * Unwrap Schema Registry envelopes if present:
 * - { schema: string | object }
 * - { definition: string | object }
 */
function unwrapEnvelope(input: unknown, currentSubject?: string): UnwrappedResult {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return unwrapEnvelope(parsed, currentSubject);
      } catch {
        return { schema: input, subject: currentSubject };
      }
    }
    return { schema: input, subject: currentSubject };
  }

  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    const extractedSubject = typeof obj.subject === 'string' ? obj.subject : currentSubject;
    if ('schema' in obj && obj.schema !== undefined) {
      return unwrapEnvelope(obj.schema, extractedSubject);
    }
    if ('definition' in obj && obj.definition !== undefined) {
      return unwrapEnvelope(obj.definition, extractedSubject);
    }
    return { schema: obj, subject: extractedSubject };
  }

  return { schema: input, subject: currentSubject };
}

/**
 * Helper to determine protocol name from subject or top-level type name.
 */
function sanitizeIdentifier(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');
  return sanitized.length > 0 ? sanitized : 'Root';
}

/**
 * Parses standard Avro JSON schemas (or Schema Registry envelopes)
 * and flattens nested records/types into an AvroProtocol.
 */
export function parseAvroJson(input: string | object, subject?: string): AvroProtocol {
  const unwrappedRes = unwrapEnvelope(input, subject);
  const unwrapped = unwrappedRes.schema;
  const effectiveSubject = subject || unwrappedRes.subject;

  if (!unwrapped || typeof unwrapped !== 'object') {
    throw new Error('Invalid Avro JSON schema input: expected JSON object or array');
  }

  // We will collect hoisted named types in order of definition/traversal.
  // Using a map keyed by full name (or local name) to avoid duplicate definitions.
  const collectedTypes: AvroNamedType[] = [];
  const typeMap = new Map<string, AvroNamedType>();

  let defaultNamespace: string | undefined = undefined;
  if ('namespace' in unwrapped && typeof (unwrapped as Record<string, unknown>).namespace === 'string') {
    defaultNamespace = (unwrapped as Record<string, unknown>).namespace as string;
  }

  // Pass 1 & Pass 2: We can do a depth-first traversal that traverses children,
  // transforms nested named types into their string references, and registers the
  // fully flattened named definitions into `collectedTypes`.
  function processSchemaNode(node: unknown, currentNamespace?: string): AvroSchemaType {
    if (node === null || node === undefined) {
      return 'null';
    }

    if (typeof node === 'string') {
      return node;
    }

    if (Array.isArray(node)) {
      return node.map((subType) => processSchemaNode(subType, currentNamespace));
    }

    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;

      // Logical type wrapper over primitive or complex: e.g. { "type": "long", "logicalType": "timestamp-micros" }
      // If it's a logicalType wrapper on a primitive or named reference, but NOT a record/enum/fixed definition:
      const rawType = obj.type;

      if (rawType === 'array') {
        return {
          type: 'array',
          items: processSchemaNode(obj.items, currentNamespace),
        };
      }

      if (rawType === 'map') {
        return {
          type: 'map',
          values: processSchemaNode(obj.values, currentNamespace),
        };
      }

      if (rawType === 'fixed') {
        const fixedNamespace = (typeof obj.namespace === 'string' ? obj.namespace : currentNamespace);
        const name = String(obj.name);
        const fullName = fixedNamespace ? `${fixedNamespace}.${name}` : name;

        if (!typeMap.has(fullName)) {
          const fixedType: AvroFixedType = {
            type: 'fixed',
            name,
            ...(fixedNamespace ? { namespace: fixedNamespace } : {}),
            size: Number(obj.size) || 0,
          };
          typeMap.set(fullName, fixedType);
          collectedTypes.push(fixedType);
        }
        return name;
      }

      if (rawType === 'enum') {
        const enumNamespace = (typeof obj.namespace === 'string' ? obj.namespace : currentNamespace);
        const name = String(obj.name);
        const fullName = enumNamespace ? `${enumNamespace}.${name}` : name;

        if (!typeMap.has(fullName)) {
          const enumType: AvroEnumType = {
            type: 'enum',
            name,
            ...(enumNamespace ? { namespace: enumNamespace } : {}),
            ...(typeof obj.doc === 'string' ? { doc: obj.doc } : {}),
            ...(Array.isArray(obj.aliases) ? { aliases: obj.aliases.map(String) } : {}),
            symbols: Array.isArray(obj.symbols) ? obj.symbols.map(String) : [],
            ...(obj.default !== undefined ? { default: String(obj.default) } : {}),
          };
          typeMap.set(fullName, enumType);
          collectedTypes.push(enumType);
        }
        return name;
      }

      if (rawType === 'record') {
        const recordNamespace = (typeof obj.namespace === 'string' ? obj.namespace : currentNamespace);
        const name = String(obj.name);
        const fullName = recordNamespace ? `${recordNamespace}.${name}` : name;

        // Process fields
        const rawFields = Array.isArray(obj.fields) ? obj.fields : [];
        const processedFields: AvroField[] = rawFields.map((fld: unknown) => {
          const fieldObj = (fld && typeof fld === 'object' ? fld : {}) as Record<string, unknown>;
          const fieldName = String(fieldObj.name || '');
          let fieldTypeNode = fieldObj.type;
          let logicalType: string | undefined = undefined;

          // Check if field type is an object with logicalType
          if (fieldTypeNode && typeof fieldTypeNode === 'object' && !Array.isArray(fieldTypeNode)) {
            const ftypeObj = fieldTypeNode as Record<string, unknown>;
            if (typeof ftypeObj.logicalType === 'string') {
              logicalType = ftypeObj.logicalType;
              fieldTypeNode = ftypeObj.type;
            }
          }

          if (typeof fieldObj.logicalType === 'string') {
            logicalType = fieldObj.logicalType;
          }

          const processedType = processSchemaNode(fieldTypeNode, recordNamespace);

          const field: AvroField = {
            id: nextSyntheticId(),
            name: fieldName,
            type: processedType,
            ...(typeof fieldObj.doc === 'string' ? { doc: fieldObj.doc } : {}),
            ...(fieldObj.default !== undefined ? { default: fieldObj.default } : {}),
            ...(Array.isArray(fieldObj.aliases) ? { aliases: fieldObj.aliases.map(String) } : {}),
            ...(typeof fieldObj.order === 'string' ? { order: fieldObj.order as FieldOrder } : {}),
            ...(logicalType ? { logicalType } : {}),
          };

          return field;
        });

        if (!typeMap.has(fullName)) {
          const recordType: AvroRecordType = {
            type: 'record',
            name,
            ...(recordNamespace ? { namespace: recordNamespace } : {}),
            ...(typeof obj.doc === 'string' ? { doc: obj.doc } : {}),
            ...(Array.isArray(obj.aliases) ? { aliases: obj.aliases.map(String) } : {}),
            fields: processedFields,
          };
          typeMap.set(fullName, recordType);
          collectedTypes.push(recordType);
        }

        return name;
      }

      // If object has { type: ..., logicalType: ... } where type is primitive
      if (typeof rawType === 'string' && typeof obj.logicalType === 'string') {
        return rawType;
      }

      if (typeof rawType === 'string') {
        return rawType;
      }
    }

    return 'string';
  }

  const rootSchemaType = processSchemaNode(unwrapped, defaultNamespace);

  // Determine top-level protocol name
  let protocolName = 'RootProtocol';
  if (effectiveSubject) {
    protocolName = `${sanitizeIdentifier(effectiveSubject)}Protocol`;
  } else if (typeof unwrapped === 'object' && unwrapped !== null && 'name' in unwrapped && typeof (unwrapped as Record<string, unknown>).name === 'string') {
    protocolName = `${sanitizeIdentifier((unwrapped as Record<string, unknown>).name as string)}Protocol`;
  }

  // Top-level doc
  let protocolDoc: string | undefined = undefined;
  if (typeof unwrapped === 'object' && unwrapped !== null && 'doc' in unwrapped && typeof (unwrapped as Record<string, unknown>).doc === 'string') {
    // If the top-level entity is not a record/enum/fixed (e.g. wrapper), doc might be protocol doc
  }

  return {
    protocol: protocolName,
    ...(defaultNamespace ? { namespace: defaultNamespace } : {}),
    ...(protocolDoc ? { doc: protocolDoc } : {}),
    types: collectedTypes,
  };
}
