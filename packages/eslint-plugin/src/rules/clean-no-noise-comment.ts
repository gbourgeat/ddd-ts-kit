import { AST_TOKEN_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { commentLines, type CommentLine } from '../support/comments/comment-lines';
import { isDirective } from '../support/comments/is-directive';
import { isJsdoc } from '../support/comments/is-jsdoc';
import { defineRule } from '../support/rule/define-rule';
import { sameWord } from '../support/words/same-word';
import { splitWords } from '../support/words/split-words';

type Noise = 'banner' | 'closingBrace' | 'journal' | 'emptyTag' | 'ownerlessTodo';

const BANNER = /^(?:[-=*#~_+/\\]\s?){4,}|^[-=*#~]{2,}.*[-=*#~]{3,}$/;

const CLOSING =
  /^(?:end\b|close\b|\/\s*\w+|(?:if|for|while|function|class|switch|try|catch|else|namespace|module|describe|it)\b)/i;

const JOURNAL =
  /@(?:author|created|modified|date|changelog)\b|^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b|\b(?:added|changed|modified|fixed|created|updated|written)\s+by\s+[A-Z@]/;

const EMPTY_TAG =
  /^@(?:param|arg|argument)\s+(?:\{[^}]*\}\s*)?[[\]\w$.=]+\s*-?\s*$|^@(?:returns?|throws)\s*(?:\{[^}]*\})?\s*$/;

const OWNERLESS_TODO = /\b(?:TODO|FIXME)\b(?!\s*\()/;
const REFERENCE = /#\d+|\b[A-Z][A-Z0-9]+-\d+\b|https?:\/\//;

/** Words that add nothing to the name they sit next to. */
const FILLER = [
  'the',
  'a',
  'an',
  'of',
  'this',
  'that',
  'for',
  'to',
  'is',
  'it',
  'its',
  'new',
  'given',
  'current',
  'class',
  'function',
  'method',
  'property',
  'field',
  'constructor',
  'instance',
  'object',
  'value',
  'get',
  'set',
  'return',
  'create',
  'represent',
  'define',
  'implementation',
  'interface',
  'type',
];

const MODIFIERS = new Set([
  'export',
  'default',
  'public',
  'private',
  'protected',
  'static',
  'readonly',
  'abstract',
  'async',
  'override',
  'declare',
  'get',
  'set',
  'const',
  'let',
  'var',
  'function',
  'class',
  'interface',
  'type',
  'enum',
  '*',
]);

const NAME_TOKENS = new Set<string>([AST_TOKEN_TYPES.Identifier, AST_TOKEN_TYPES.PrivateIdentifier]);

const INSTEAD = 'Delete it, or replace it by what the name cannot say: why, a constraint, a consequence.';

export const cleanNoNoiseComment = defineRule<Noise | 'restatesName'>({
  id: 'clean/no-noise-comment',
  type: 'suggestion',
  recommended: 'warn',
  description:
    'No comment that restates the code, no banner, no journal, no closing-brace comment, no @param without description.',
  messages: {
    banner:
      'The comment is a banner: "{{excerpt}}". Delete it; if the file needs sections, it holds several concepts that deserve their own files.',
    closingBrace:
      'The comment labels a closing brace: "{{excerpt}}". Delete it and shorten the block: a brace that needs a label closes a function that is too long.',
    journal:
      'The comment keeps a journal or an author: "{{excerpt}}". Delete it: version control records who changed what and when.',
    emptyTag:
      'The comment is a tag without a description: "{{excerpt}}". Describe what the type cannot say (unit, range, meaning of an absent value) or delete the tag.',
    ownerlessTodo:
      'The comment is a TODO without an owner or a reference: "{{excerpt}}". Write it as TODO(<owner or ticket>): ..., or do it now, or delete it.',
    restatesName: `The comment only repeats the name {{name}}: "{{excerpt}}". ${INSTEAD}`,
  },
  create({ sourceCode, report }) {
    return {
      Program() {
        const lines = commentLines(sourceCode).filter(
          (line) => !line.sample && line.text !== '' && !isDirective(line.text),
        );

        for (const line of lines) {
          const noise = noiseOf(line, sourceCode);

          if (noise !== undefined) {
            report({ loc: line.loc, messageId: noise, data: { excerpt: line.text.slice(0, 60) } });
          }
        }

        for (const description of descriptions(lines)) {
          const name = declaredAfter(sourceCode, description.last);

          if (name === undefined || !restatesName(description.text, name)) {
            continue;
          }

          report({
            loc: description.first.loc,
            messageId: 'restatesName',
            data: { name, excerpt: description.text.slice(0, 60) },
          });
        }
      },
    };
  },
});

function noiseOf(line: CommentLine, sourceCode: Readonly<TSESLint.SourceCode>): Noise | undefined {
  const { text } = line;

  if (BANNER.test(text)) {
    return 'banner';
  }

  if (labelsClosingBrace(line, sourceCode)) {
    return 'closingBrace';
  }

  if (JOURNAL.test(text)) {
    return 'journal';
  }

  if (line.block && EMPTY_TAG.test(text)) {
    return 'emptyTag';
  }

  return OWNERLESS_TODO.test(text) && !REFERENCE.test(text) ? 'ownerlessTodo' : undefined;
}

function labelsClosingBrace(line: CommentLine, sourceCode: Readonly<TSESLint.SourceCode>): boolean {
  if (!line.trailing || !CLOSING.test(line.text) || line.text.split(' ').length > 3) {
    return false;
  }

  return sourceCode.getTokenBefore(line.comment)?.value === '}';
}

interface Description {
  readonly text: string;
  readonly first: CommentLine;
  readonly last: TSESTree.Comment;
}

/** What is said just above a declaration: a JSDoc block without its tags, or a run of `//` lines. */
function descriptions(lines: readonly CommentLine[]): Description[] {
  const found: Description[] = [];
  let run: CommentLine[] = [];

  const close = (): void => {
    const [first] = run;
    const last = run.at(-1);

    if (first !== undefined && last !== undefined) {
      found.push({ text: run.map((line) => line.text).join(' '), first, last: last.comment });
    }

    run = [];
  };

  for (const line of lines.filter(
    (candidate) =>
      !candidate.trailing && (!candidate.block || (isJsdoc(candidate.comment) && !candidate.text.startsWith('@'))),
  )) {
    const previous = run.at(-1);

    if (previous !== undefined && !belongsTogether(previous, line)) {
      close();
    }

    run.push(line);
  }

  close();

  return found;
}

function belongsTogether(previous: CommentLine, line: CommentLine): boolean {
  if (previous.block || line.block) {
    return previous.comment === line.comment;
  }

  return line.loc.start.line === previous.loc.start.line + 1;
}

/** The name declared on the line that follows the comment, read from its tokens. */
function declaredAfter(sourceCode: Readonly<TSESLint.SourceCode>, comment: TSESTree.Comment): string | undefined {
  const tokens = sourceCode.getTokensAfter(comment, { count: 8 });
  const [first] = tokens;

  if (first === undefined || first.loc.start.line > comment.loc.end.line + 1) {
    return undefined;
  }

  const named = tokens.findIndex((token) => !MODIFIERS.has(token.value));
  // `get()` and `static()` are methods named like a modifier: the name is the word before the parenthesis.
  const name = tokens[named]?.value === '(' ? tokens[named - 1] : tokens[named];

  if (name === undefined || (!NAME_TOKENS.has(name.type) && !MODIFIERS.has(name.value))) {
    return undefined;
  }

  return name.type === AST_TOKEN_TYPES.PrivateIdentifier ? `#${name.value}` : name.value;
}

/** True when the description says nothing the name does not already say. */
function restatesName(description: string, name: string): boolean {
  const said = splitWords(description.replace(/[.`'"]/g, ' '));

  if (said.length === 0 || said.length > 8) {
    return false;
  }

  const named = splitWords(name);

  return said.every((word) => [...FILLER, ...named].some((known) => sameWord(known, word)));
}
