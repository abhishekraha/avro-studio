import {
  type AvroProtocol,
  type AvroNamedType,
  type AvroRecordType,
  type AvroEnumType,
  type AvroFixedType,
  type AvroField,
  type AvroSchemaType,
  isRecordType,
  isEnumType,
  isFixedType,
} from '../types';

/**
 * Checks if an identifier needs backticks (e.g. contains dots or reserved words).
 */
function formatIdentifier(name: string): string {
  if (name.includes('.')) {
    return `\`${name}\``;
  }
  return name;
}

/**
 * Formats docstrings as Javadoc-style `/** doc *\/`.
 */
function formatDoc(doc?: string, indent = ''): string {
  if (!doc) return '';
  const lines = doc.split('\n');
  if (lines.length === 1) {
    return `${indent}/** ${lines[0]} */\n`;
  }
  const body = lines.map((line) => `${indent} * ${line}`).join('\n');
  return `${indent}/**\n${body}\n${indent} */\n`;
}

/**
 * Serializes default values to AVDL literal representation.
 */
function formatDefaultValue(val: unknown): string {
  if (val === null) return 'null';
  if (typeof val === 'string') return JSON.stringify(val);
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
    return JSON.stringify(val);
  }
  return String(val);
}

/**
 * Serializes an AvroSchemaType into AVDL syntax.
 * Nullable unions like ['null', 'string'] or ['string', 'null'] -> 'string?'
 * Full unions -> union { type1, type2 }
 * Arrays -> array<type>
 * Maps -> map<type>
 */
export function formatAvdlType(type: AvroSchemaType): string {
  if (typeof type === 'string') {
    return formatIdentifier(type);
  }

  if (Array.isArray(type)) {
    // Check if it's a 2-element union with 'null'
    if (type.length === 2) {
      if (type[0] === 'null') {
        return `${formatAvdlType(type[1])}?`;
      }
      if (type[1] === 'null') {
        return `${formatAvdlType(type[0])}?`;
      }
    }
    const inner = type.map((t) => formatAvdlType(t)).join(', ');
    return `union { ${inner} }`;
  }

  if (typeof type === 'object' && type !== null) {
    if (type.type === 'array') {
      return `array<${formatAvdlType(type.items)}>`;
    }
    if (type.type === 'map') {
      return `map<${formatAvdlType(type.values)}>`;
    }
    if ('name' in type && typeof type.name === 'string') {
      return formatIdentifier(type.name);
    }
  }

  return 'string';
}

function formatStringArray(arr: string[]): string {
  return `[${arr.map((s) => JSON.stringify(s)).join(', ')}]`;
}

/**
 * Serializes a single AvroField.
 */
function serializeField(field: AvroField, indent = '  '): string {
  const parts: string[] = [];

  if (field.doc) {
    parts.push(formatDoc(field.doc, indent));
  }

  const annotations: string[] = [];
  if (field.logicalType) {
    annotations.push(`@logicalType("${field.logicalType}")`);
  }
  if (field.order) {
    annotations.push(`@order("${field.order}")`);
  }
  if (field.aliases && field.aliases.length > 0) {
    annotations.push(`@aliases(${formatStringArray(field.aliases)})`);
  }

  if (annotations.length > 0) {
    for (const ann of annotations) {
      parts.push(`${indent}${ann}\n`);
    }
  }

  const typeStr = formatAvdlType(field.type);
  const nameStr = formatIdentifier(field.name);
  let line = `${indent}${typeStr} ${nameStr}`;

  if (field.default !== undefined) {
    line += ` = ${formatDefaultValue(field.default)}`;
  }
  line += ';';
  parts.push(`${line}\n`);

  return parts.join('');
}

/**
 * Serializes an AvroFixedType.
 */
function serializeFixed(fixed: AvroFixedType, protocolNamespace?: string, indent = '  '): string {
  const parts: string[] = [];

  if (fixed.doc) {
    parts.push(formatDoc(fixed.doc, indent));
  }

  if (fixed.namespace && fixed.namespace !== protocolNamespace) {
    parts.push(`${indent}@namespace("${fixed.namespace}")\n`);
  }

  parts.push(`${indent}fixed ${formatIdentifier(fixed.name)}(${fixed.size});\n`);
  return parts.join('');
}

/**
 * Serializes an AvroEnumType.
 */
function serializeEnum(enumType: AvroEnumType, protocolNamespace?: string, indent = '  '): string {
  const parts: string[] = [];

  if (enumType.doc) {
    parts.push(formatDoc(enumType.doc, indent));
  }

  if (enumType.namespace && enumType.namespace !== protocolNamespace) {
    parts.push(`${indent}@namespace("${enumType.namespace}")\n`);
  }

  if (enumType.aliases && enumType.aliases.length > 0) {
    parts.push(`${indent}@aliases(${formatStringArray(enumType.aliases)})\n`);
  }

  parts.push(`${indent}enum ${formatIdentifier(enumType.name)} {\n`);
  const symbolLines = enumType.symbols.map((sym) => `${indent}  ${sym}`).join(',\n');
  parts.push(`${symbolLines}\n`);

  if (enumType.default) {
    parts.push(`${indent}} = ${enumType.default};\n`);
  } else {
    parts.push(`${indent}};\n`);
  }

  return parts.join('');
}

/**
 * Serializes an AvroRecordType.
 */
function serializeRecord(record: AvroRecordType, protocolNamespace?: string, indent = '  '): string {
  const parts: string[] = [];

  if (record.doc) {
    parts.push(formatDoc(record.doc, indent));
  }

  if (record.namespace && record.namespace !== protocolNamespace) {
    parts.push(`${indent}@namespace("${record.namespace}")\n`);
  }

  if (record.aliases && record.aliases.length > 0) {
    parts.push(`${indent}@aliases(${formatStringArray(record.aliases)})\n`);
  }

  parts.push(`${indent}record ${formatIdentifier(record.name)} {\n`);

  for (const field of record.fields) {
    parts.push(serializeField(field, `${indent}  `));
  }

  parts.push(`${indent}}\n`);
  return parts.join('');
}

/**
 * Serializes an AvroNamedType (record, enum, or fixed).
 */
function serializeNamedType(type: AvroNamedType, protocolNamespace?: string): string {
  if (isRecordType(type)) {
    return serializeRecord(type, protocolNamespace);
  }
  if (isEnumType(type)) {
    return serializeEnum(type, protocolNamespace);
  }
  if (isFixedType(type)) {
    return serializeFixed(type, protocolNamespace);
  }
  return '';
}

/**
 * Serializes an AvroProtocol back to standard .avdl string format.
 */
export function serializeToAvdl(protocol: AvroProtocol): string {
  const sections: string[] = [];

  // Doc
  if (protocol.doc) {
    sections.push(formatDoc(protocol.doc));
  }

  // Annotations
  if (protocol.namespace) {
    sections.push(`@namespace("${protocol.namespace}")\n`);
  }
  if (protocol.schemaVersion) {
    sections.push(`@schemaVersion("${protocol.schemaVersion}")\n`);
  }

  // Protocol declaration
  sections.push(`protocol ${formatIdentifier(protocol.protocol)} {\n`);

  // Type definitions
  for (let i = 0; i < protocol.types.length; i++) {
    const typeDef = protocol.types[i];
    if (i > 0) {
      sections.push('\n');
    }
    sections.push(serializeNamedType(typeDef, protocol.namespace));
  }

  sections.push('}\n');

  return sections.join('');
}
