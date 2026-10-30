/**
 * Avro primitive types as defined in Apache Avro specification.
 */
export type PrimitiveType =
  | 'null'
  | 'boolean'
  | 'int'
  | 'long'
  | 'float'
  | 'double'
  | 'bytes'
  | 'string';

export const PRIMITIVE_TYPES: readonly PrimitiveType[] = [
  'null',
  'boolean',
  'int',
  'long',
  'float',
  'double',
  'bytes',
  'string',
] as const;

/**
 * Avro record field sort order.
 */
export type FieldOrder = 'ascending' | 'descending' | 'ignore';

/**
 * Avro record field definition with synthetic stable ID for studio tracking.
 */
export interface AvroField {
  /** Synthetic stable client ID (e.g., 'p-001', 'g-xxx') */
  id: string;
  name: string;
  type: AvroSchemaType;
  doc?: string;
  default?: unknown;
  aliases?: string[];
  order?: FieldOrder;
  logicalType?: string;
}

/**
 * Avro Record type definition.
 */
export interface AvroRecordType {
  type: 'record';
  name: string;
  namespace?: string;
  doc?: string;
  aliases?: string[];
  fields: AvroField[];
}

/**
 * Avro Enum type definition.
 */
export interface AvroEnumType {
  type: 'enum';
  name: string;
  namespace?: string;
  doc?: string;
  aliases?: string[];
  symbols: string[];
  default?: string;
}

/**
 * Avro Array type definition.
 */
export interface AvroArrayType {
  type: 'array';
  items: AvroSchemaType;
}

/**
 * Avro Map type definition.
 */
export interface AvroMapType {
  type: 'map';
  values: AvroSchemaType;
}

/**
 * Avro Fixed type definition.
 */
export interface AvroFixedType {
  type: 'fixed';
  name: string;
  namespace?: string;
  size: number;
}

/**
 * Avro Union type definition (represented as array of schema types).
 */
export type AvroUnionType = AvroSchemaType[];

/**
 * Union of all Avro schema types, including named type reference strings.
 */
export type AvroSchemaType =
  | PrimitiveType
  | AvroRecordType
  | AvroEnumType
  | AvroArrayType
  | AvroMapType
  | AvroFixedType
  | AvroUnionType
  | string;

/**
 * Types that can be declared with a name at the top level or within a protocol.
 */
export type AvroNamedType = AvroRecordType | AvroEnumType | AvroFixedType;

/**
 * Flat Avro Protocol container storing de-duplicated named types.
 */
export interface AvroProtocol {
  protocol: string;
  namespace?: string;
  doc?: string;
  schemaVersion?: string;
  types: AvroNamedType[];
}

// Type Guards

export function isPrimitiveType(value: unknown): value is PrimitiveType {
  return typeof value === 'string' && (PRIMITIVE_TYPES as readonly string[]).includes(value);
}

export function isRecordType(value: unknown): value is AvroRecordType {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AvroRecordType>;
  return candidate.type === 'record' && typeof candidate.name === 'string' && Array.isArray(candidate.fields);
}

export function isEnumType(value: unknown): value is AvroEnumType {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AvroEnumType>;
  return candidate.type === 'enum' && typeof candidate.name === 'string' && Array.isArray(candidate.symbols);
}

export function isArrayType(value: unknown): value is AvroArrayType {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AvroArrayType>;
  return candidate.type === 'array' && candidate.items !== undefined;
}

export function isMapType(value: unknown): value is AvroMapType {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AvroMapType>;
  return candidate.type === 'map' && candidate.values !== undefined;
}

export function isFixedType(value: unknown): value is AvroFixedType {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AvroFixedType>;
  return candidate.type === 'fixed' && typeof candidate.name === 'string' && typeof candidate.size === 'number';
}

export function isUnionType(value: unknown): value is AvroUnionType {
  return Array.isArray(value);
}

export function isNamedType(value: unknown): value is AvroNamedType {
  return isRecordType(value) || isEnumType(value) || isFixedType(value);
}

/**
 * Factory to create an empty AvroProtocol.
 */
export function createDefaultAvroProtocol(name = 'RootProtocol', namespace?: string): AvroProtocol {
  return {
    protocol: name,
    ...(namespace ? { namespace } : {}),
    types: [],
  };
}
