import {
  AvroProtocol,
  AvroRecordType,
  AvroSchemaType,
  AvroField,
  isRecordType,
  isEnumType,
  isArrayType,
  isUnionType,
  isFixedType,
} from '../types/schema';

export type BqType =
  | 'STRING'
  | 'BYTES'
  | 'INTEGER'
  | 'FLOAT64'
  | 'BOOLEAN'
  | 'TIMESTAMP'
  | 'DATE'
  | 'TIME'
  | 'RECORD';

export type BqMode = 'REQUIRED' | 'NULLABLE' | 'REPEATED';

export interface BqField {
  name: string;
  type: BqType;
  mode: BqMode;
  description?: string;
  fields?: BqField[];
  defaultValueExpression?: string;
}

export interface BqSchemaOptions {
  mode?: 'standard' | 'legacy';
  includeIngestionTime?: boolean;
}

interface ResolvedTypeInfo {
  type: BqType;
  isRecord: boolean;
  nestedRecord?: AvroRecordType;
}

export function generateBqSchema(
  protocol: AvroProtocol,
  rootRecordName?: string,
  options?: BqSchemaOptions
): BqField[] {
  const mode = options?.mode ?? 'standard';
  const includeIngestionTime = options?.includeIngestionTime ?? false;

  // Build type dictionary for fast lookup of named types
  const typeMap = new Map<string, AvroSchemaType>();
  for (const t of protocol.types) {
    typeMap.set(t.name, t);
    if (protocol.namespace && !t.name.includes('.')) {
      typeMap.set(`${protocol.namespace}.${t.name}`, t);
    }
  }

  // Find root record
  let rootRecord: AvroRecordType | undefined;
  if (rootRecordName) {
    const candidate = typeMap.get(rootRecordName);
    if (candidate && isRecordType(candidate)) {
      rootRecord = candidate;
    } else {
      // Look through types array
      for (const t of protocol.types) {
        if (isRecordType(t) && t.name === rootRecordName) {
          rootRecord = t;
          break;
        }
      }
    }
  } else {
    // Pick the first record found
    for (const t of protocol.types) {
      if (isRecordType(t)) {
        rootRecord = t;
        break;
      }
    }
  }

  if (!rootRecord) {
    return [];
  }

  const result: BqField[] = [];

  function resolveType(
    rawType: AvroSchemaType,
    fieldLogicalType?: string
  ): { resolvedType: BqType; mode: BqMode; nestedRecord?: AvroRecordType } {
    let currentType = rawType;
    let isNullable = false;
    let isRepeated = false;

    // Check union for nullable
    if (isUnionType(currentType)) {
      const nonNullTypes = currentType.filter((t) => t !== 'null');
      if (nonNullTypes.length < currentType.length) {
        isNullable = true;
      }
      if (nonNullTypes.length === 1) {
        currentType = nonNullTypes[0];
      } else {
        // Multi-type union fallback to STRING or first type
        currentType = nonNullTypes[0] || 'string';
      }
    }

    // Check array
    if (isArrayType(currentType)) {
      isRepeated = true;
      currentType = currentType.items;
      // In case items are union
      if (isUnionType(currentType)) {
        const nonNulls = currentType.filter((t) => t !== 'null');
        currentType = nonNulls[0] || 'string';
      }
    }

    // Check named type reference string
    if (typeof currentType === 'string' && typeMap.has(currentType)) {
      currentType = typeMap.get(currentType)!;
    }

    // Check logical types
    if (fieldLogicalType) {
      if (fieldLogicalType === 'timestamp-micros' || fieldLogicalType === 'timestamp-millis') {
        return {
          resolvedType: 'TIMESTAMP',
          mode: isRepeated ? 'REPEATED' : isNullable ? 'NULLABLE' : 'REQUIRED',
        };
      }
      if (fieldLogicalType === 'date') {
        return {
          resolvedType: 'DATE',
          mode: isRepeated ? 'REPEATED' : isNullable ? 'NULLABLE' : 'REQUIRED',
        };
      }
      if (fieldLogicalType === 'time-micros' || fieldLogicalType === 'time-millis') {
        return {
          resolvedType: 'TIME',
          mode: isRepeated ? 'REPEATED' : isNullable ? 'NULLABLE' : 'REQUIRED',
        };
      }
    }

    // Check inline/resolved record
    if (isRecordType(currentType)) {
      return {
        resolvedType: 'RECORD',
        mode: isRepeated ? 'REPEATED' : isNullable ? 'NULLABLE' : 'REQUIRED',
        nestedRecord: currentType,
      };
    }

    // Check enum
    if (isEnumType(currentType)) {
      return {
        resolvedType: 'STRING',
        mode: isRepeated ? 'REPEATED' : isNullable ? 'NULLABLE' : 'REQUIRED',
      };
    }

    // Check fixed
    if (isFixedType(currentType)) {
      return {
        resolvedType: 'BYTES',
        mode: isRepeated ? 'REPEATED' : isNullable ? 'NULLABLE' : 'REQUIRED',
      };
    }

    // Primitive types
    let bqType: BqType = 'STRING';
    switch (currentType) {
      case 'boolean':
        bqType = 'BOOLEAN';
        break;
      case 'int':
      case 'long':
        bqType = 'INTEGER';
        break;
      case 'float':
      case 'double':
        bqType = 'FLOAT64';
        break;
      case 'bytes':
        bqType = 'BYTES';
        break;
      case 'string':
      default:
        bqType = 'STRING';
        break;
    }

    return {
      resolvedType: bqType,
      mode: isRepeated ? 'REPEATED' : isNullable ? 'NULLABLE' : 'REQUIRED',
    };
  }

  function processRecordFields(record: AvroRecordType, prefix = ''): BqField[] {
    const fields: BqField[] = [];

    for (const field of record.fields) {
      const { resolvedType, mode: fieldMode, nestedRecord } = resolveType(field.type, field.logicalType);

      if (nestedRecord) {
        if (mode === 'legacy') {
          // Flatten top-level into prefix_child
          const childPrefix = prefix ? `${prefix}_${field.name}` : field.name;
          const flattened = processRecordFields(nestedRecord, childPrefix);
          fields.push(...flattened);
        } else {
          // Standard nested RECORD
          const nestedFields = processRecordFields(nestedRecord);
          const bqField: BqField = {
            name: prefix ? `${prefix}_${field.name}` : field.name,
            type: 'RECORD',
            mode: fieldMode,
            fields: nestedFields,
            ...(field.doc ? { description: field.doc } : {}),
          };
          fields.push(bqField);
        }
      } else {
        const bqField: BqField = {
          name: prefix ? `${prefix}_${field.name}` : field.name,
          type: resolvedType,
          mode: fieldMode,
          ...(field.doc ? { description: field.doc } : {}),
        };
        fields.push(bqField);
      }
    }

    return fields;
  }

  result.push(...processRecordFields(rootRecord));

  if (includeIngestionTime) {
    result.push({
      name: 'bqIngestionTime',
      type: 'TIMESTAMP',
      mode: 'NULLABLE',
      defaultValueExpression: 'CURRENT_TIMESTAMP()',
    });
  }

  return result;
}
