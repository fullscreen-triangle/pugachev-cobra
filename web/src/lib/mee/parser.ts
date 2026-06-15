// ======================================================================
//  MEE — Parser
//  Recursive descent. Produces a SceneNode AST.
//  Error recovery: on a parse error, records it and skips to next '}'
//  or keyword so one bad statement doesn't kill the whole compile.
// ======================================================================

import {
  Token, TokenKind,
  SceneNode, PipelineNode, PipelineStep,
  ClipNode, ActsLikeNode, ComposeNode, PrimArgNode,
  RenderNode, GoalNode, BrandNode, DispatchNode, WhenClauseNode,
  Diagnostic,
} from './types';

export interface ParseResult {
  scene: SceneNode | null;
  diagnostics: Diagnostic[];
}

export function parse(tokens: Token[]): ParseResult {
  const diagnostics: Diagnostic[] = [];
  let pos = 0;

  const peek = (): Token => tokens[pos] ?? { kind: 'EOF', value: '', line: 0, col: 0 };
  const advance = (): Token => tokens[pos++] ?? { kind: 'EOF', value: '', line: 0, col: 0 };
  const check = (kind: TokenKind, value?: string): boolean => {
    const t = peek();
    return t.kind === kind && (value === undefined || t.value === value);
  };
  const eat = (kind: TokenKind, value?: string): Token | null => {
    if (check(kind, value)) return advance();
    return null;
  };
  const expect = (kind: TokenKind, value?: string): Token => {
    const t = eat(kind, value);
    if (t) return t;
    const cur = peek();
    diagnostics.push({
      level: 'error', code: 'ParseError',
      message: `Expected ${kind}${value ? ` '${value}'` : ''}, got '${cur.value}'`,
      line: cur.line, col: cur.col,
    });
    return cur;
  };

  // skip to recovery point on error
  const skipTo = (kinds: TokenKind[]) => {
    while (peek().kind !== 'EOF' && !kinds.includes(peek().kind)) advance();
  };

  // ---- parsers ---------------------------------------------------------

  function parseScene(): SceneNode | null {
    if (!eat('KEYWORD', 'scene')) {
      diagnostics.push({ level: 'error', code: 'ParseError', message: "Expected 'scene'" });
      return null;
    }
    const nameToken = expect('IDENT');
    expect('LBRACE');

    let pipeline: PipelineNode = { kind: 'Pipeline', steps: [] };
    let goal: GoalNode | null = null;
    const brands: BrandNode[] = [];
    let dispatch: DispatchNode | null = null;

    while (peek().kind !== 'RBRACE' && peek().kind !== 'EOF') {
      const t = peek();

      if (t.kind === 'KEYWORD' && t.value === 'goal') {
        goal = parseGoal();
      } else if (t.kind === 'KEYWORD' && t.value === 'brand') {
        const b = parseBrand();
        if (b) brands.push(b);
      } else if (t.kind === 'KEYWORD' && t.value === 'dispatch') {
        dispatch = parseDispatch();
      } else if (t.kind === 'KEYWORD' && t.value === 'clip') {
        // inline pipeline at scene root
        pipeline = parsePipeline();
      } else {
        // unknown token at scene level — skip
        advance();
      }
    }
    eat('RBRACE');

    return {
      kind: 'Scene',
      name: nameToken.value,
      pipeline,
      goal,
      brands,
      dispatch,
    };
  }

  function parsePipeline(): PipelineNode {
    const steps: PipelineStep[] = [];

    // first step must be clip
    if (check('KEYWORD', 'clip')) {
      const clip = parseClip();
      if (clip) steps.push(clip);
    }

    // subsequent steps joined by |>
    while (eat('PIPE')) {
      const t = peek();
      if (t.kind === 'KEYWORD' && t.value === 'acts_like') {
        steps.push(parseActsLike());
      } else if (t.kind === 'KEYWORD' && t.value === 'compose') {
        steps.push(parseCompose());
      } else if (t.kind === 'KEYWORD' && t.value === 'render') {
        steps.push(parseRender());
      } else if (t.kind === 'KEYWORD' && t.value === 'brand') {
        // brand used inline as a catalyst — treat as compose step
        advance(); // eat 'brand'
        const nameT = peek();
        let name = '';
        if (nameT.kind === 'IDENT' || nameT.kind === 'KEYWORD') { name = nameT.value; advance(); }
        let confidence = 0.8;
        if (eat('LPAREN')) {
          // optional confidence= param
          while (peek().kind !== 'RPAREN' && peek().kind !== 'EOF') {
            const k = advance().value;
            eat('EQUALS');
            const v = advance().value;
            if (k === 'confidence') confidence = parseFloat(v);
          }
          eat('RPAREN');
        }
        steps.push({
          kind: 'Compose',
          effects: [{ kind: 'PrimArg', name: `brand:${name}`, params: { confidence } }],
        });
      } else {
        // unknown step — skip token
        diagnostics.push({
          level: 'warning', code: 'UnknownStep',
          message: `Unknown pipeline step '${t.value}', skipping`,
          line: t.line, col: t.col,
        });
        advance();
      }
    }

    return { kind: 'Pipeline', steps };
  }

  function parseClip(): ClipNode | null {
    expect('KEYWORD', 'clip');
    expect('LPAREN');
    const pathToken = peek();
    let path = '';
    if (pathToken.kind === 'STRING') { path = pathToken.value; advance(); }
    else { diagnostics.push({ level: 'error', code: 'ParseError', message: 'clip() expects a string path' }); }

    let at = 0;
    let forDuration = -1; // -1 = full clip

    while (peek().kind === 'COMMA') {
      advance(); // eat comma
      const key = peek();
      if ((key.kind === 'KEYWORD' || key.kind === 'IDENT') && key.value === 'at') {
        advance(); eat('EQUALS');
        const v = peek();
        if (v.kind === 'TIME' || v.kind === 'NUMBER') { at = parseFloat(v.value); advance(); }
      } else if ((key.kind === 'KEYWORD' || key.kind === 'IDENT') && key.value === 'for') {
        advance(); eat('EQUALS');
        const v = peek();
        if (v.kind === 'TIME' || v.kind === 'NUMBER') { forDuration = parseFloat(v.value); advance(); }
      } else {
        advance(); // skip unknown key
      }
    }
    eat('RPAREN');

    return { kind: 'Clip', path, at, for: forDuration };
  }

  function parseActsLike(): ActsLikeNode {
    expect('KEYWORD', 'acts_like');
    expect('LPAREN');
    const descToken = peek();
    let description = '';
    if (descToken.kind === 'STRING') { description = descToken.value; advance(); }
    else {
      diagnostics.push({
        level: 'error', code: 'ParseError',
        message: 'acts_like() expects a string description',
        line: descToken.line, col: descToken.col,
      });
    }
    eat('RPAREN');
    return { kind: 'ActsLike', description };
  }

  function parseCompose(): ComposeNode {
    expect('KEYWORD', 'compose');
    expect('LPAREN');
    const effects: PrimArgNode[] = [];

    while (peek().kind !== 'RPAREN' && peek().kind !== 'EOF') {
      const prim = parsePrimArg();
      if (prim) effects.push(prim);
      eat('COMMA');
    }
    eat('RPAREN');

    return { kind: 'Compose', effects };
  }

  function parsePrimArg(): PrimArgNode | null {
    const nameToken = peek();
    if (nameToken.kind !== 'IDENT' && nameToken.kind !== 'KEYWORD') return null;
    const name = nameToken.value;
    advance();

    const params: Record<string, string | number> = {};
    if (eat('LPAREN')) {
      while (peek().kind !== 'RPAREN' && peek().kind !== 'EOF') {
        const k = peek().value; advance();
        eat('EQUALS');
        const v = peek();
        if (v.kind === 'STRING') { params[k] = v.value; advance(); }
        else if (v.kind === 'NUMBER' || v.kind === 'TIME') { params[k] = parseFloat(v.value); advance(); }
        else { advance(); }
        eat('COMMA');
      }
      eat('RPAREN');
    }

    return { kind: 'PrimArg', name, params };
  }

  function parseRender(): RenderNode {
    expect('KEYWORD', 'render');
    expect('LPAREN');
    const fmtToken = peek();
    let format = 'motion';
    if (fmtToken.kind === 'IDENT' || fmtToken.kind === 'STRING') { format = fmtToken.value; advance(); }
    eat('RPAREN');
    return { kind: 'Render', format };
  }

  function parseGoal(): GoalNode {
    expect('KEYWORD', 'goal');
    expect('LBRACE');

    let behaviour: string | null = null;
    let coherenceThreshold = 0.5;
    let maxDuration: number | null = null;

    while (peek().kind !== 'RBRACE' && peek().kind !== 'EOF') {
      const key = peek().value; advance();
      eat('COLON');
      if (key === 'behaviour') {
        const v = peek();
        if (v.kind === 'STRING') { behaviour = v.value; advance(); }
      } else if (key === 'coherence') {
        eat('GTE'); eat('GT');
        const v = peek();
        if (v.kind === 'NUMBER') { coherenceThreshold = parseFloat(v.value); advance(); }
      } else if (key === 'duration') {
        eat('LTE'); eat('LT');
        const v = peek();
        if (v.kind === 'TIME' || v.kind === 'NUMBER') { maxDuration = parseFloat(v.value); advance(); }
      } else {
        // skip unknown
        advance();
      }
    }
    eat('RBRACE');

    return { kind: 'Goal', behaviour, coherenceThreshold, maxDuration };
  }

  function parseBrand(): BrandNode | null {
    expect('KEYWORD', 'brand');
    const nameToken = peek();
    if (nameToken.kind !== 'IDENT' && nameToken.kind !== 'KEYWORD') {
      diagnostics.push({ level: 'error', code: 'ParseError', message: 'brand expects a name identifier' });
      skipTo(['RBRACE', 'LBRACE']);
      return null;
    }
    const name = nameToken.value; advance();
    expect('LBRACE');

    let invariant = '';
    let confidence = 0.8;

    while (peek().kind !== 'RBRACE' && peek().kind !== 'EOF') {
      const key = peek().value; advance();
      eat('COLON');
      if (key === 'invariant') {
        const v = peek();
        if (v.kind === 'STRING') { invariant = v.value; advance(); }
      } else if (key === 'confidence') {
        const v = peek();
        if (v.kind === 'NUMBER') { confidence = parseFloat(v.value); advance(); }
      } else {
        advance();
      }
    }
    eat('RBRACE');

    return { kind: 'Brand', name, invariant, confidence };
  }

  function parseDispatch(): DispatchNode {
    expect('KEYWORD', 'dispatch');
    expect('LBRACE');
    const clauses: WhenClauseNode[] = [];

    while (peek().kind !== 'RBRACE' && peek().kind !== 'EOF') {
      if (eat('KEYWORD', 'when')) {
        const fmt = peek().value; advance();
        eat('KEYWORD', 'do');
        const action = peek().value; advance();
        // optional (target)
        let target = action;
        if (eat('LPAREN')) {
          target = peek().value; advance();
          eat('RPAREN');
        }
        clauses.push({ kind: 'WhenClause', format: fmt, target });
      } else {
        advance();
      }
    }
    eat('RBRACE');

    return { kind: 'Dispatch', clauses };
  }

  // ---- entry -----------------------------------------------------------

  // Skip leading whitespace / non-scene tokens
  while (peek().kind !== 'EOF' && !(peek().kind === 'KEYWORD' && peek().value === 'scene')) {
    advance();
  }

  const scene = parseScene();
  return { scene, diagnostics };
}
