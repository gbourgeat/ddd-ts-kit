import type { Rule, SourceFile, Violation } from '../types.js';
import { commentLines } from '../comments.js';
import { reporter } from './helpers.js';

const ANY = /:\s*any(?![\w$])|(?<![\w$.])as\s+any(?![\w$])|<\s*any\s*[>,]|,\s*any\s*>|(?<![\w$.])any\s*\[\]/g;
const NON_NULL = /(?<=[\w$)\]])!(?=\s*(?:[.;,)\]}:]|\[|$))(?!\s*==?)/gm;
const SILENCER = /^@ts-(ignore|nocheck|expect-error)\b(.*)$|^(eslint-disable(?:-next-line|-line)?)\b(.*)$/;

export const cleanNoEscapeHatch: Rule = {
  id: 'clean/no-escape-hatch',
  description: 'No any, no non-null assertion, no @ts-ignore, no @ts-expect-error without a reason, no eslint-disable without a reason.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const violations: Violation[] = [];
    for (const file of project.files) {
      for (const { line, found } of anyViolations(file)) {
        const violation = report({ file: file.path, line }, `The type any is used (${found}).`, 'Give the real type, or `unknown` narrowed by a check: any switches the compiler off for everything that touches the value.');
        // In a test, an untyped value cannot reach production: it advises instead of blocking.
        violations.push(file.isTest ? { ...violation, severity: 'warn' } : violation);
      }
      for (const match of file.scan.code.matchAll(NON_NULL)) {
        violations.push(
          report({ file: file.path, line: file.scan.lineAt(match.index) }, 'A non-null assertion (!) silences the compiler.', 'Handle the absent case: narrow with a check, give a default, or throw an error that says what was expected.'),
        );
      }
      for (const comment of commentLines(file)) {
        const problem = silencerProblem(comment.text);
        if (problem === undefined) continue;
        violations.push(
          report(
            { file: file.path, line: comment.line },
            `${problem}.`,
            'Fix the diagnostic; if it cannot be fixed, use @ts-expect-error or eslint-disable-next-line <rule> followed by the reason (`-- why`).',
          ),
        );
      }
    }
    return violations;
  },
};

function silencerProblem(text: string): string | undefined {
  const match = SILENCER.exec(text);
  if (match === null) return undefined;
  if (match[1] === 'ignore' || match[1] === 'nocheck') return `@ts-${match[1]} hides every diagnostic`;
  const reason = (match[1] === 'expect-error' ? match[2] : match[4]) ?? '';
  const explained = match[1] === 'expect-error' ? reason.replace(/^[\s:-]+/, '').length > 0 : /--\s*\S/.test(reason);
  return explained ? undefined : `${match[1] === 'expect-error' ? '@ts-expect-error' : match[3]} gives no reason`;
}

function anyViolations(file: SourceFile): { line: number; found: string }[] {
  return [...file.scan.code.matchAll(ANY)].map((match) => ({ line: file.scan.lineAt(match.index), found: match[0].trim() }));
}
