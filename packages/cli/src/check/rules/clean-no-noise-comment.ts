import { commentLines, type CommentLine } from '../comments/comment-lines.js';
import { isDirective } from '../comments/is-directive.js';
import { restatesName } from '../comments/restates-name.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { perFile } from '../support/per-file.js';

const BANNER = /^(?:[-=*#~_+/\\]\s?){4,}|^[-=*#~]{2,}.*[-=*#~]{3,}$/;

const CLOSING =
  /^(?:end\b|close\b|\/\s*\w+|(?:if|for|while|function|class|switch|try|catch|else|namespace|module|describe|it)\b)/i;

const JOURNAL =
  /@(?:author|created|modified|date|changelog)\b|^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b|\b(?:added|changed|modified|fixed|created|updated|written)\s+by\s+[A-Z@]/;

const EMPTY_TAG =
  /^@(?:param|arg|argument)\s+(?:\{[^}]*\}\s*)?[[\]\w$.=]+\s*-?\s*$|^@(?:returns?|throws)\s*(?:\{[^}]*\})?\s*$/;

const OWNERLESS_TODO = /\b(?:TODO|FIXME)\b(?!\s*\()/;
const REFERENCE = /#\d+|\b[A-Z][A-Z0-9]+-\d+\b|https?:\/\//;

const DECLARED_NAME =
  /^\s*(?:export\s+)?(?:default\s+)?(?:(?:public|private|protected|static|readonly|abstract|async|override|declare|get|set|const|let|function|class|interface|type|enum)\s+)*\*?\s*(#?[A-Za-z_$][\w$]*)/;

const RESTATES_FIX = 'Delete it, or replace it by what the name cannot say: why, a constraint, a consequence.';

interface Detector {
  readonly kind: string;
  readonly fix: string;
  applies(comment: CommentLine): boolean;
}

const DETECTORS: readonly Detector[] = [
  {
    kind: 'is a banner',
    fix: 'Delete the banner; if the file needs sections, it holds several concepts that deserve their own files.',
    applies: ({ text }) => BANNER.test(text),
  },
  {
    kind: 'labels a closing brace',
    fix: 'Delete it and shorten the block: a brace that needs a label closes a function that is too long.',
    applies: ({ text, trailing }) => trailing && CLOSING.test(text) && text.split(' ').length <= 3,
  },
  {
    kind: 'keeps a journal or an author',
    fix: 'Delete it: version control records who changed what and when.',
    applies: ({ text }) => JOURNAL.test(text),
  },
  {
    kind: 'is a tag without a description',
    fix: 'Describe what the type cannot say (unit, range, meaning of an absent value) or delete the tag.',
    applies: ({ text, block }) => block && EMPTY_TAG.test(text),
  },
  {
    kind: 'is a TODO without an owner or a reference',
    fix: 'Write it as TODO(<owner or ticket>): ..., or do it now, or delete it.',
    applies: ({ text }) => OWNERLESS_TODO.test(text) && !REFERENCE.test(text),
  },
];

export const cleanNoNoiseComment: Rule = {
  id: 'clean/no-noise-comment',
  description:
    'No comment that restates the code, no banner, no journal, no closing-brace comment, no @param without description.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => [...noise(file), ...restatements(file)]);
  },
};

function noise(file: SourceFile): Finding[] {
  return commentLines(file).flatMap((comment) => {
    const judged =
      comment.sample || comment.text === '' || isDirective(comment.text)
        ? undefined
        : DETECTORS.find((detector) => detector.applies(comment));

    return judged === undefined
      ? []
      : [
          {
            line: comment.line,
            message: `The comment ${judged.kind}: "${comment.text.slice(0, 60)}".`,
            fix: judged.fix,
          },
        ];
  });
}

function restatements(file: SourceFile): Finding[] {
  const documented = file.scan.blockComments
    .filter((block) => block.jsdoc)
    .map((block) => ({ line: block.line, text: descriptionOf(block.text), name: declaredAfter(file, block.endLine) }));

  const annotated = file.scan.comments
    .filter((comment) => comment.ownLine && !isDirective(comment.text))
    .map((comment) => ({ line: comment.line, text: comment.text, name: declaredAfter(file, comment.line) }));

  return [...documented, ...annotated].flatMap(({ line, text, name }) => {
    if (name === undefined || !restatesName(text, name)) {
      return [];
    }

    return [{ line, message: `The comment only repeats the name ${name}: "${text.slice(0, 60)}".`, fix: RESTATES_FIX }];
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
  const next = file.scan.code
    .split('\n')
    .slice(line)
    .find((candidate) => candidate.trim() !== '');

  return next === undefined ? undefined : DECLARED_NAME.exec(next)?.[1];
}
