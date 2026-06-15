// ======================================================================
//  MEE — Tokeniser
// ======================================================================

import { Token, TokenKind, KEYWORDS } from './types';

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  const peek = (offset = 0) => src[pos + offset] ?? '';
  const advance = () => {
    const ch = src[pos++];
    if (ch === '\n') { line++; col = 1; } else { col++; }
    return ch;
  };

  while (pos < src.length) {
    const startLine = line;
    const startCol = col;
    const ch = peek();

    // whitespace
    if (/\s/.test(ch)) { advance(); continue; }

    // line comment
    if (ch === '/' && peek(1) === '/') {
      while (pos < src.length && peek() !== '\n') advance();
      continue;
    }

    // two-char operators
    if (ch === '|' && peek(1) === '>') {
      advance(); advance();
      tokens.push({ kind: 'PIPE', value: '|>', line: startLine, col: startCol });
      continue;
    }
    if (ch === '>' && peek(1) === '=') {
      advance(); advance();
      tokens.push({ kind: 'GTE', value: '>=', line: startLine, col: startCol });
      continue;
    }
    if (ch === '<' && peek(1) === '=') {
      advance(); advance();
      tokens.push({ kind: 'LTE', value: '<=', line: startLine, col: startCol });
      continue;
    }

    // single-char operators
    const single: Record<string, TokenKind> = {
      '{': 'LBRACE', '}': 'RBRACE',
      '(': 'LPAREN', ')': 'RPAREN',
      ',': 'COMMA', ':': 'COLON',
      '=': 'EQUALS', '>': 'GT', '<': 'LT',
    };
    if (ch in single) {
      advance();
      tokens.push({ kind: single[ch], value: ch, line: startLine, col: startCol });
      continue;
    }

    // string literal
    if (ch === '"' || ch === "'") {
      const quote = advance();
      let value = '';
      while (pos < src.length && peek() !== quote) value += advance();
      advance(); // closing quote
      tokens.push({ kind: 'STRING', value, line: startLine, col: startCol });
      continue;
    }

    // number or time literal (e.g. 15s, 2.5s, 30)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(peek(1)))) {
      let value = '';
      while (pos < src.length && /[0-9.]/.test(peek())) value += advance();
      if (peek() === 's') { advance(); tokens.push({ kind: 'TIME', value, line: startLine, col: startCol }); }
      else tokens.push({ kind: 'NUMBER', value, line: startLine, col: startCol });
      continue;
    }

    // identifier or keyword
    if (/[a-zA-Z_]/.test(ch)) {
      let value = '';
      while (pos < src.length && /[a-zA-Z0-9_]/.test(peek())) value += advance();
      const kind: TokenKind = KEYWORDS.has(value) ? 'KEYWORD' : 'IDENT';
      tokens.push({ kind, value, line: startLine, col: startCol });
      continue;
    }

    // unknown char — skip with no token
    advance();
  }

  tokens.push({ kind: 'EOF', value: '', line, col });
  return tokens;
}
