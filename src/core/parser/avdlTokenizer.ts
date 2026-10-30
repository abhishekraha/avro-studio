export enum TokenType {
  IDENT = 'IDENT',
  DOC = 'DOC',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  LBRACE = 'LBRACE',       // {
  RBRACE = 'RBRACE',       // }
  LANGLE = 'LANGLE',       // <
  RANGLE = 'RANGLE',       // >
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  LBRACKET = 'LBRACKET',   // [
  RBRACKET = 'RBRACKET',   // ]
  SEMICOLON = 'SEMICOLON', // ;
  COMMA = 'COMMA',         // ,
  EQUALS = 'EQUALS',       // =
  COLON = 'COLON',         // :
  AT = 'AT',               // @
  QUESTION = 'QUESTION',   // ?
  EOF = 'EOF',
}

export interface Position {
  line: number;
  col: number;
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export class AvdlTokenizer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private col: number = 1;

  constructor(source: string) {
    this.source = source;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token = this.nextToken();
    while (token.type !== TokenType.EOF) {
      tokens.push(token);
      token = this.nextToken();
    }
    tokens.push(token); // EOF
    return tokens;
  }

  private peek(): string {
    return this.pos < this.source.length ? this.source[this.pos] : '';
  }

  private peekNext(): string {
    return this.pos + 1 < this.source.length ? this.source[this.pos + 1] : '';
  }

  private advance(): string {
    const ch = this.peek();
    this.pos++;
    if (ch === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  private skipWhitespaceAndComments(): Token | null {
    while (this.pos < this.source.length) {
      const ch = this.peek();

      // Whitespace
      if (/\s/.test(ch)) {
        this.advance();
        continue;
      }

      // Comments: // or /* ... */
      if (ch === '/' && this.peekNext() === '/') {
        // Line comment
        this.advance();
        this.advance();
        while (this.pos < this.source.length && this.peek() !== '\n') {
          this.advance();
        }
        continue;
      }

      if (ch === '/' && this.peekNext() === '*') {
        const startLine = this.line;
        const startCol = this.col;
        this.advance(); // /
        this.advance(); // *

        // Check if doc comment: /** ... */ (and not /*** or /**/)
        const isDoc = this.peek() === '*' && this.peekNext() !== '/';
        if (isDoc) {
          this.advance(); // consume 2nd *
        }

        let commentContent = '';
        let closed = false;

        while (this.pos < this.source.length) {
          if (this.peek() === '*' && this.peekNext() === '/') {
            this.advance(); // *
            this.advance(); // /
            closed = true;
            break;
          }
          commentContent += this.advance();
        }

        if (!closed) {
          throw new Error(`Unterminated comment starting at line ${startLine}, col ${startCol}`);
        }

        if (isDoc) {
          // Clean up doc comment: strip leading '*' on each line and trim
          const cleaned = this.cleanDocComment(commentContent);
          return {
            type: TokenType.DOC,
            value: cleaned,
            line: startLine,
            col: startCol,
          };
        }
        // Normal block comment, skip and continue
        continue;
      }

      break;
    }

    return null;
  }

  private cleanDocComment(raw: string): string {
    const lines = raw.split(/\r?\n/);
    const cleanedLines = lines.map((line) => {
      let trimmed = line.trim();
      if (trimmed.startsWith('*')) {
        trimmed = trimmed.substring(1).trim();
      }
      return trimmed;
    });

    // Remove leading and trailing empty lines
    while (cleanedLines.length > 0 && cleanedLines[0] === '') {
      cleanedLines.shift();
    }
    while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] === '') {
      cleanedLines.pop();
    }

    return cleanedLines.join('\n');
  }

  public nextToken(): Token {
    const docToken = this.skipWhitespaceAndComments();
    if (docToken) {
      return docToken;
    }

    if (this.pos >= this.source.length) {
      return {
        type: TokenType.EOF,
        value: '',
        line: this.line,
        col: this.col,
      };
    }

    const startLine = this.line;
    const startCol = this.col;
    const ch = this.peek();

    // Single character tokens
    switch (ch) {
      case '{':
        this.advance();
        return { type: TokenType.LBRACE, value: '{', line: startLine, col: startCol };
      case '}':
        this.advance();
        return { type: TokenType.RBRACE, value: '}', line: startLine, col: startCol };
      case '<':
        this.advance();
        return { type: TokenType.LANGLE, value: '<', line: startLine, col: startCol };
      case '>':
        this.advance();
        return { type: TokenType.RANGLE, value: '>', line: startLine, col: startCol };
      case '(':
        this.advance();
        return { type: TokenType.LPAREN, value: '(', line: startLine, col: startCol };
      case ')':
        this.advance();
        return { type: TokenType.RPAREN, value: ')', line: startLine, col: startCol };
      case '[':
        this.advance();
        return { type: TokenType.LBRACKET, value: '[', line: startLine, col: startCol };
      case ']':
        this.advance();
        return { type: TokenType.RBRACKET, value: ']', line: startLine, col: startCol };
      case ';':
        this.advance();
        return { type: TokenType.SEMICOLON, value: ';', line: startLine, col: startCol };
      case ',':
        this.advance();
        return { type: TokenType.COMMA, value: ',', line: startLine, col: startCol };
      case '=':
        this.advance();
        return { type: TokenType.EQUALS, value: '=', line: startLine, col: startCol };
      case ':':
        this.advance();
        return { type: TokenType.COLON, value: ':', line: startLine, col: startCol };
      case '@':
        this.advance();
        return { type: TokenType.AT, value: '@', line: startLine, col: startCol };
      case '?':
        this.advance();
        return { type: TokenType.QUESTION, value: '?', line: startLine, col: startCol };
    }

    // Backtick escaped identifiers: `avro.java.string`
    if (ch === '`') {
      this.advance(); // consume `
      let ident = '';
      while (this.pos < this.source.length && this.peek() !== '`') {
        ident += this.advance();
      }
      if (this.peek() !== '`') {
        throw new Error(`Unterminated backtick identifier at line ${startLine}, col ${startCol}`);
      }
      this.advance(); // consume closing `
      return {
        type: TokenType.IDENT,
        value: ident,
        line: startLine,
        col: startCol,
      };
    }

    // String literals: "..."
    if (ch === '"') {
      this.advance(); // consume "
      let str = '';
      while (this.pos < this.source.length && this.peek() !== '"') {
        const curr = this.advance();
        if (curr === '\\') {
          if (this.pos >= this.source.length) {
            throw new Error(`Unterminated escape sequence at line ${this.line}, col ${this.col}`);
          }
          const esc = this.advance();
          switch (esc) {
            case 'n':
              str += '\n';
              break;
            case 't':
              str += '\t';
              break;
            case 'r':
              str += '\r';
              break;
            case '\\':
              str += '\\';
              break;
            case '"':
              str += '"';
              break;
            default:
              str += esc;
              break;
          }
        } else {
          str += curr;
        }
      }
      if (this.peek() !== '"') {
        throw new Error(`Unterminated string literal at line ${startLine}, col ${startCol}`);
      }
      this.advance(); // consume closing "
      return {
        type: TokenType.STRING,
        value: str,
        line: startLine,
        col: startCol,
      };
    }

    // Numbers: negative, float, scientific notation (e.g., -42, 99.5, 1.5e-3)
    // Check if '-' followed by digit, or digit
    if (/\d/.test(ch) || (ch === '-' && /\d/.test(this.peekNext()))) {
      let numStr = this.advance(); // - or first digit
      while (this.pos < this.source.length && /\d/.test(this.peek())) {
        numStr += this.advance();
      }
      if (this.peek() === '.' && /\d/.test(this.peekNext())) {
        numStr += this.advance(); // '.'
        while (this.pos < this.source.length && /\d/.test(this.peek())) {
          numStr += this.advance();
        }
      }
      if (this.peek() === 'e' || this.peek() === 'E') {
        numStr += this.advance();
        if (this.peek() === '+' || this.peek() === '-') {
          numStr += this.advance();
        }
        while (this.pos < this.source.length && /\d/.test(this.peek())) {
          numStr += this.advance();
        }
      }
      return {
        type: TokenType.NUMBER,
        value: numStr,
        line: startLine,
        col: startCol,
      };
    }

    // Identifiers & Keywords: letters, digits, underscores, dots (for dotted namespaces/names e.g. com.example)
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (this.pos < this.source.length && /[a-zA-Z0-9_.]/.test(this.peek())) {
        ident += this.advance();
      }
      return {
        type: TokenType.IDENT,
        value: ident,
        line: startLine,
        col: startCol,
      };
    }

    throw new Error(`Unexpected character '${ch}' at line ${startLine}, col ${startCol}`);
  }
}
