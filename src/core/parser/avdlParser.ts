import {
  type AvroProtocol,
  type AvroNamedType,
  type AvroRecordType,
  type AvroEnumType,
  type AvroFixedType,
  type AvroField,
  type AvroSchemaType,
  type FieldOrder,
} from '../types';
import { AvdlTokenizer, type Token, TokenType } from './avdlTokenizer';

interface Annotations {
  namespace?: string;
  aliases?: string[];
  schemaVersion?: string;
  logicalType?: string;
  order?: FieldOrder;
  doc?: string;
}

export class AvdlParser {
  private tokens: Token[];
  private current: number = 0;
  private fieldCounter: number = 0;
  private protocolNamespace?: string;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): AvroProtocol {
    // Collect annotations before 'protocol'
    const protoAnnotations = this.parseAnnotationsAndDoc();

    this.consume(TokenType.IDENT, 'protocol', "Expected 'protocol' keyword");
    const protocolNameToken = this.consume(TokenType.IDENT, undefined, "Expected protocol identifier");
    const protocolName = protocolNameToken.value;

    this.protocolNamespace = protoAnnotations.namespace;

    const protocol: AvroProtocol = {
      protocol: protocolName,
      ...(this.protocolNamespace ? { namespace: this.protocolNamespace } : {}),
      ...(protoAnnotations.doc ? { doc: protoAnnotations.doc } : {}),
      ...(protoAnnotations.schemaVersion ? { schemaVersion: protoAnnotations.schemaVersion } : {}),
      types: [],
    };

    this.consume(TokenType.LBRACE, undefined, "Expected '{' after protocol name");

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const typeDef = this.parseDeclaration();
      if (typeDef) {
        protocol.types.push(typeDef);
      }
    }

    this.consume(TokenType.RBRACE, undefined, "Expected '}' at end of protocol declaration");

    return protocol;
  }

  private parseDeclaration(): AvroNamedType | null {
    // Could be import, or named type declaration (record, enum, fixed) with preceding doc / annotations
    const annotations = this.parseAnnotationsAndDoc();

    // Check for 'import'
    if (this.check(TokenType.IDENT) && this.peek().value === 'import') {
      this.parseImport();
      return null;
    }

    if (!this.check(TokenType.IDENT)) {
      const token = this.peek();
      throw new Error(`Unexpected token '${token.value}' at line ${token.line}, col ${token.col}`);
    }

    const keyword = this.peek().value;

    if (keyword === 'record') {
      return this.parseRecord(annotations);
    } else if (keyword === 'enum') {
      return this.parseEnum(annotations);
    } else if (keyword === 'fixed') {
      return this.parseFixed(annotations);
    } else {
      const token = this.peek();
      throw new Error(`Unexpected declaration keyword '${keyword}' at line ${token.line}, col ${token.col}`);
    }
  }

  private parseImport(): void {
    this.consume(TokenType.IDENT, 'import', "Expected 'import'");
    // import idl "path"; or import protocol "path"; or import schema "path";
    const kind = this.consume(TokenType.IDENT, undefined, "Expected import kind (idl, protocol, schema)").value;
    const pathToken = this.consume(TokenType.STRING, undefined, "Expected string path in import statement");
    this.consume(TokenType.SEMICOLON, undefined, "Expected ';' after import statement");
  }

  private parseFixed(annotations: Annotations): AvroFixedType {
    this.consume(TokenType.IDENT, 'fixed', "Expected 'fixed'");
    const nameToken = this.consume(TokenType.IDENT, undefined, "Expected fixed type name");
    this.consume(TokenType.LPAREN, undefined, "Expected '(' after fixed name");
    const sizeToken = this.consume(TokenType.NUMBER, undefined, "Expected size number for fixed type");
    this.consume(TokenType.RPAREN, undefined, "Expected ')' after fixed size");
    this.consume(TokenType.SEMICOLON, undefined, "Expected ';' after fixed definition");

    const namespace = annotations.namespace || this.protocolNamespace;

    return {
      type: 'fixed',
      name: nameToken.value,
      ...(namespace ? { namespace } : {}),
      size: parseInt(sizeToken.value, 10),
    };
  }

  private parseEnum(annotations: Annotations): AvroEnumType {
    this.consume(TokenType.IDENT, 'enum', "Expected 'enum'");
    const nameToken = this.consume(TokenType.IDENT, undefined, "Expected enum name");
    this.consume(TokenType.LBRACE, undefined, "Expected '{' before enum symbols");

    const symbols: string[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const symToken = this.consume(TokenType.IDENT, undefined, "Expected enum symbol identifier");
      symbols.push(symToken.value);
      if (this.check(TokenType.COMMA)) {
        this.advance();
      }
    }

    this.consume(TokenType.RBRACE, undefined, "Expected '}' after enum symbols");

    let defaultSymbol: string | undefined;
    if (this.check(TokenType.EQUALS)) {
      this.advance(); // consume =
      const defToken = this.consume(TokenType.IDENT, undefined, "Expected default enum symbol identifier");
      defaultSymbol = defToken.value;
    }

    this.consume(TokenType.SEMICOLON, undefined, "Expected ';' after enum definition");

    const namespace = annotations.namespace || this.protocolNamespace;

    return {
      type: 'enum',
      name: nameToken.value,
      ...(namespace ? { namespace } : {}),
      ...(annotations.doc ? { doc: annotations.doc } : {}),
      ...(annotations.aliases ? { aliases: annotations.aliases } : {}),
      symbols,
      ...(defaultSymbol !== undefined ? { default: defaultSymbol } : {}),
    };
  }

  private parseRecord(annotations: Annotations): AvroRecordType {
    this.consume(TokenType.IDENT, 'record', "Expected 'record'");
    const nameToken = this.consume(TokenType.IDENT, undefined, "Expected record name");
    this.consume(TokenType.LBRACE, undefined, "Expected '{' before record fields");

    const fields: AvroField[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const field = this.parseField();
      fields.push(field);
    }

    this.consume(TokenType.RBRACE, undefined, "Expected '}' after record fields");

    const namespace = annotations.namespace || this.protocolNamespace;

    return {
      type: 'record',
      name: nameToken.value,
      ...(namespace ? { namespace } : {}),
      ...(annotations.doc ? { doc: annotations.doc } : {}),
      ...(annotations.aliases ? { aliases: annotations.aliases } : {}),
      fields,
    };
  }

  private parseField(): AvroField {
    const annotations = this.parseAnnotationsAndDoc();

    // Parse type
    const fieldType = this.parseType();

    // Parse field name
    const nameToken = this.consume(TokenType.IDENT, undefined, "Expected field name identifier");

    let defaultValue: unknown = undefined;
    let hasDefault = false;

    if (this.check(TokenType.EQUALS)) {
      this.advance(); // consume =
      defaultValue = this.parseLiteral();
      hasDefault = true;
    }

    this.consume(TokenType.SEMICOLON, undefined, "Expected ';' after field definition");

    this.fieldCounter++;
    const id = `p-${String(this.fieldCounter).padStart(4, '0')}`;

    const field: AvroField = {
      id,
      name: nameToken.value,
      type: fieldType,
      ...(annotations.doc ? { doc: annotations.doc } : {}),
      ...(annotations.aliases ? { aliases: annotations.aliases } : {}),
      ...(annotations.logicalType ? { logicalType: annotations.logicalType } : {}),
      ...(annotations.order ? { order: annotations.order } : {}),
      ...(hasDefault ? { default: defaultValue } : {}),
    };

    return field;
  }

  private parseType(): AvroSchemaType {
    // union { null, string }
    if (this.check(TokenType.IDENT) && this.peek().value === 'union') {
      this.advance(); // consume 'union'
      this.consume(TokenType.LBRACE, undefined, "Expected '{' after union keyword");
      const unionTypes: AvroSchemaType[] = [];
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        unionTypes.push(this.parseType());
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      }
      this.consume(TokenType.RBRACE, undefined, "Expected '}' after union types");
      return unionTypes;
    }

    // array<T>
    if (this.check(TokenType.IDENT) && this.peek().value === 'array') {
      this.advance(); // consume 'array'
      this.consume(TokenType.LANGLE, undefined, "Expected '<' after array");
      const items = this.parseType();
      this.consume(TokenType.RANGLE, undefined, "Expected '>' after array item type");
      return {
        type: 'array',
        items,
      };
    }

    // map<T>
    if (this.check(TokenType.IDENT) && this.peek().value === 'map') {
      this.advance(); // consume 'map'
      this.consume(TokenType.LANGLE, undefined, "Expected '<' after map");
      const values = this.parseType();
      this.consume(TokenType.RANGLE, undefined, "Expected '>' after map value type");
      return {
        type: 'map',
        values,
      };
    }

    // Single identifier type (primitive, named type reference, or backticked)
    const typeToken = this.consume(TokenType.IDENT, undefined, "Expected type name identifier");
    let baseType: AvroSchemaType = typeToken.value;

    // Check for shorthand nullable: T? -> ['null', T]
    if (this.check(TokenType.QUESTION)) {
      this.advance(); // consume ?
      return ['null', baseType];
    }

    return baseType;
  }

  private parseLiteral(): unknown {
    const token = this.peek();

    if (token.type === TokenType.STRING) {
      this.advance();
      return token.value;
    }

    if (token.type === TokenType.NUMBER) {
      this.advance();
      const num = Number(token.value);
      return num;
    }

    if (token.type === TokenType.IDENT) {
      if (token.value === 'null') {
        this.advance();
        return null;
      }
      if (token.value === 'true') {
        this.advance();
        return true;
      }
      if (token.value === 'false') {
        this.advance();
        return false;
      }
      // Could be enum symbol identifier or other constant
      this.advance();
      return token.value;
    }

    // Array literal: [ ... ]
    if (token.type === TokenType.LBRACKET) {
      this.advance(); // consume [
      const arr: unknown[] = [];
      while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
        arr.push(this.parseLiteral());
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      }
      this.consume(TokenType.RBRACKET, undefined, "Expected ']' at end of array literal");
      return arr;
    }

    // Object literal: { ... }
    if (token.type === TokenType.LBRACE) {
      this.advance(); // consume {
      const obj: Record<string, unknown> = {};
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        let key = '';
        if (this.check(TokenType.STRING) || this.check(TokenType.IDENT)) {
          key = this.advance().value;
        } else {
          throw new Error(`Expected object key at line ${this.peek().line}, col ${this.peek().col}`);
        }
        // In json / avdl, key might be followed by ':' or '='
        if (this.check(TokenType.EQUALS) || this.check(TokenType.COLON)) {
          this.advance();
        }
        const val = this.parseLiteral();
        obj[key] = val;
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      }
      this.consume(TokenType.RBRACE, undefined, "Expected '}' at end of object literal");
      return obj;
    }

    throw new Error(`Unexpected token '${token.value}' in default literal at line ${token.line}, col ${token.col}`);
  }

  private parseAnnotationsAndDoc(): Annotations {
    const annotations: Annotations = {};
    let latestDoc: string | undefined;

    while (!this.isAtEnd()) {
      if (this.check(TokenType.DOC)) {
        latestDoc = this.advance().value;
        continue;
      }

      if (this.check(TokenType.AT)) {
        this.advance(); // consume @
        const annNameToken = this.consume(TokenType.IDENT, undefined, "Expected annotation name after '@'");
        const annName = annNameToken.value;

        // Annotations take (value)
        this.consume(TokenType.LPAREN, undefined, `Expected '(' after annotation @${annName}`);
        const val = this.parseAnnotationValue();
        this.consume(TokenType.RPAREN, undefined, `Expected ')' after annotation @${annName} value`);

        switch (annName) {
          case 'namespace':
            annotations.namespace = typeof val === 'string' ? val : String(val);
            break;
          case 'aliases':
            annotations.aliases = Array.isArray(val) ? (val as string[]) : [String(val)];
            break;
          case 'schemaVersion':
            annotations.schemaVersion = typeof val === 'string' ? val : String(val);
            break;
          case 'logicalType':
            annotations.logicalType = typeof val === 'string' ? val : String(val);
            break;
          case 'order':
            annotations.order = val as FieldOrder;
            break;
          default:
            // Custom or unhandled annotation, ignore or store if needed
            break;
        }
        continue;
      }

      break;
    }

    if (latestDoc !== undefined) {
      annotations.doc = latestDoc;
    }

    return annotations;
  }

  private parseAnnotationValue(): unknown {
    const token = this.peek();
    if (token.type === TokenType.STRING) {
      return this.advance().value;
    }
    if (token.type === TokenType.NUMBER) {
      return Number(this.advance().value);
    }
    if (token.type === TokenType.IDENT) {
      return this.advance().value;
    }
    if (token.type === TokenType.LBRACKET) {
      this.advance(); // consume [
      const items: unknown[] = [];
      while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
        items.push(this.parseAnnotationValue());
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      }
      this.consume(TokenType.RBRACKET, undefined, "Expected ']' at end of annotation array");
      return items;
    }

    throw new Error(`Unexpected token '${token.value}' in annotation at line ${token.line}, col ${token.col}`);
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return type === TokenType.EOF;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, expectedValue?: string, message?: string): Token {
    const token = this.peek();
    if (token.type !== type || (expectedValue !== undefined && token.value !== expectedValue)) {
      const errDetail = message || `Expected ${type}${expectedValue ? ` '${expectedValue}'` : ''}, got '${token.value}'`;
      throw new Error(`${errDetail} at line ${token.line}, col ${token.col}`);
    }
    return this.advance();
  }
}

/**
 * Public parser function to parse an AVDL source string into an AvroProtocol.
 */
export function parseAvdl(source: string): AvroProtocol {
  const tokenizer = new AvdlTokenizer(source);
  const tokens = tokenizer.tokenize();
  const parser = new AvdlParser(tokens);
  return parser.parse();
}
