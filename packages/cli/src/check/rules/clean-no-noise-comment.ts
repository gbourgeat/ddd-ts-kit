import { splitWords } from '../../naming.js';
import { sameWord } from '../inflection.js';
import type { Rule, SourceFile } from '../types.js';
import { commentLines, isDirective, type CommentLine } from '../comments.js';
import { reporter } from './helpers.js';

const BANNER = /^(?:[-=*#~_+/\\]\s?){4,}|^[-=*#~]{2,}.*[-=*#~]{3,}$/;
const CLOSING = /^(?:end\b|close\b|\/\s*\w+|(?:if|for|while|function|class|switch|try|catch|else|namespace|module|describe|it)\b)/i;
const JOURNAL = /@(?:author|created|modified|date|changelog)\b|^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b|\b(?:added|changed|modified|fixed|created|updated|written)\s+by\s+[A-Z@]/;
const EMPTY_TAG = /^@(?:param|arg|argument)\s+(?:\{[^}]*\}\s*)?[[\]\w$.=]+\s*-?\s*$|^@(?:returns?|throws)\s*(?:\{[^}]*\})?\s*$/;
const OWNERLESS_TODO = /\b(?:TODO|FIXME)\b(?!\s*\()/;
const REFERENCE = /#\d+|\b[A-Z][A-Z0-9]+-\d+\b|https?:\/\//;

/** Words that add nothing to the name they sit next to. */
const FILLER = new Set(['the', 'a', 'an', 'of', 'this', 'that', 'for', 'to', 'is', 'it', 'its', 'new', 'given', 'current', 'class', 'function', 'method', 'property', 'field', 'constructor', 'instance', 'object', 'value', 'get', 'set', 'return', 'create', 'represent', 'define', 'implementation', 'interface', 'type']);

const DECLARED_NAME = /^\s*(?:export\s+)?(?:default\s+)?(?:(?:public|private|protected|static|readonly|abstract|async|override|declare|get|set|const|let|function|class|interface|type|enum)\s+)*\*?\s*(#?[A-Za-z_$][\w$]*)/;

/** True when the description says nothing the name does not already say. */
export function restatesName(description: string, name: string): boolean {
  const said = splitWords(description.replace(/[.`'"]/g, ' '));
  if (said.length === 0 || said.length > 8) return false;
  const named = splitWords(name);
  return said.every((word) => FILLER.has(word) || [...FILLER].some((filler) => sameWord(filler, word)) || named.some((part) => sameWord(part, word)));
}

const FIXES: Readonly<Record<string, string>> = {
  'is a banner': 'Delete the banner; if the file needs sections, it holds several concepts that deserve their own files.',
  'labels a closing brace': 'Delete it and shorten the block: a brace that needs a label closes a function that is too long.',
  'keeps a journal or an author': 'Delete it: version control records who changed what and when.',
  'is a tag without a description': 'Describe what the type cannot say (unit, range, meaning of an absent value) or delete the tag.',
  'is a TODO without an owner or a reference': 'Write it as TODO(<owner or ticket>): ..., or do it now, or delete it.',
};

export const cleanNoNoiseComment: Rule = {
  id: 'clean/no-noise-comment',
  description: 'No comment that restates the code, no banner, no journal, no closing-brace comment, no @param without description.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.flatMap((file) => [...noise(file), ...restatements(file)].map(({ line, message, fix }) => report({ file: file.path, line }, message, fix)));
  },
};

interface Noise {
  readonly line: number;
  readonly message: string;
  readonly fix: string;
}

function noise(file: SourceFile): Noise[] {
  return commentLines(file).flatMap((comment) => {
    const kind = comment.sample ? undefined : noiseOf(comment);
    return kind === undefined ? [] : [{ line: comment.line, message: `The comment ${kind}: "${comment.text.slice(0, 60)}".`, fix: FIXES[kind] ?? 'Delete it.' }];
  });
}

function restatements(file: SourceFile): Noise[] {
  const documented = file.scan.blockComments.filter((block) => block.jsdoc).map((block) => ({ line: block.line, text: descriptionOf(block.text), name: declaredAfter(file, block.endLine) }));
  const annotated = file.scan.comments.filter((comment) => comment.ownLine && !isDirective(comment.text)).map((comment) => ({ line: comment.line, text: comment.text, name: declaredAfter(file, comment.line) }));
  return [...documented, ...annotated].flatMap(({ line, text, name }) => {
    if (name === undefined || !restatesName(text, name)) return [];
    return [{ line, message: `The comment only repeats the name ${name}: "${text.slice(0, 60)}".`, fix: 'Delete it, or replace it by what the name cannot say: why, a constraint, a consequence.' }];
  });
}

function descriptionOf(jsdoc: string): string {
  return jsdoc
    .split('\n')
    .map((raw) => raw.replace(/^\s*\*+ ?/, '').trim())
    .filter((text) => text !== '' && !text.startsWith('@'))
    .join(' ');
}

function declaredAfter(file: SourceFile, line: number): string | undefined {
  const next = file.scan.code.split('\n').slice(line).find((candidate) => candidate.trim() !== '');
  return next === undefined ? undefined : DECLARED_NAME.exec(next)?.[1];
}

type Detector = readonly [kind: string, applies: (comment: CommentLine) => boolean];

const DETECTORS: readonly Detector[] = [
  ['is a banner', ({ text }) => BANNER.test(text)],
  ['labels a closing brace', ({ text, trailing }) => trailing && CLOSING.test(text) && text.split(' ').length <= 3],
  ['keeps a journal or an author', ({ text }) => JOURNAL.test(text)],
  ['is a tag without a description', ({ text, block }) => block && EMPTY_TAG.test(text)],
  ['is a TODO without an owner or a reference', ({ text }) => OWNERLESS_TODO.test(text) && !REFERENCE.test(text)],
];

function noiseOf(comment: CommentLine): string | undefined {
  if (comment.text === '' || isDirective(comment.text)) return undefined;
  return DETECTORS.find(([, applies]) => applies(comment))?.[0];
}
