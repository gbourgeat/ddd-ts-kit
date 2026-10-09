import type { ClassShape, MethodShape, TopLevelFunction } from '../structure.js';
import type { Rule, SourceFile, Violation } from '../types.js';
import { reporter, type Report } from './helpers.js';

export const cleanStepdown: Rule = {
  id: 'clean/stepdown',
  description: 'A file reads top to bottom: public members before private ones, a function above the functions it calls.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.flatMap((file) => {
      const { classes, functions } = file.structure;
      const helpers = functions.filter((helper) => !helper.exported);
      return [...classes.flatMap((shape) => misplacedMembers({ file, shape, report })), ...helpers.flatMap((helper) => helperAboveCaller(file, helper, report))];
    });
  },
};

interface Judged {
  readonly file: SourceFile;
  readonly shape: ClassShape;
  readonly report: Report;
}

function misplacedMembers(judged: Judged): Violation[] {
  const beforePublic = privateBeforePublic(judged);
  // One finding per method: a private method above the public ones is not reported again for its caller.
  const reported = new Set(beforePublic.map((violation) => violation.line));
  const others = judged.shape.methods.filter((method) => method.visibility === 'private' && !method.isConstructor && !reported.has(method.line));
  return [...beforePublic, ...others.flatMap((method) => privateAboveCaller(judged, method))];
}

function privateBeforePublic({ file, shape, report }: Judged): Violation[] {
  const ordinary = shape.methods.filter((method) => !method.isConstructor);
  const lastPublic = ordinary.filter((method) => method.visibility === 'public').at(-1);
  if (lastPublic === undefined) return [];
  return ordinary
    .filter((method) => method.visibility === 'private' && method.start < lastPublic.start)
    .map((method) =>
      report(
        { file: file.path, line: method.line },
        `The private method ${method.name} of ${shape.name} is declared before the public method ${lastPublic.name}.`,
        `Move ${method.name} below the public methods of ${shape.name}, after its first caller: a reader meets what the class does before how.`,
      ),
    );
}

/** Not part of a longer name, and not a property access; a spread (`...helper()`) is a plain use. */
const NOT_A_MEMBER = '(?<![\\w$])(?<!(?:^|[^.])\\.)';

function privateAboveCaller({ file, shape, report }: Judged, method: MethodShape): Violation[] {
  const name = method.name.startsWith('#') ? `#${escape(method.name.slice(1))}` : escape(method.name);
  const receiver = method.isStatic ? `(?:this|${escape(shape.name)})` : 'this';
  const use = firstUse(file.scan.code.slice(0, shape.end), new RegExp(`(?<![\\w$])${receiver}\\s*\\??\\.\\s*${name}(?![\\w$])`, 'g'), method);
  if (use === undefined || use < method.start || use < shape.start) return [];
  return [
    report(
      { file: file.path, line: method.line },
      `The private method ${method.name} of ${shape.name} is declared above its first caller (line ${file.scan.lineAt(use)}).`,
      `Move ${method.name} just below the method that first calls it.`,
    ),
  ];
}

function helperAboveCaller(file: SourceFile, helper: TopLevelFunction, report: Report): Violation[] {
  const use = firstUse(file.scan.code, new RegExp(`${NOT_A_MEMBER}${escape(helper.name)}(?![\\w$])`, 'g'), helper);
  if (use === undefined || use < helper.start) return [];
  return [
    report(
      { file: file.path, line: helper.line },
      `The function ${helper.name} is declared above its first caller (line ${file.scan.lineAt(use)}).`,
      `Move ${helper.name} below the function that first calls it: function declarations are hoisted, so the file can read from intention to detail.`,
    ),
  ];
}

/** Offset of the first use of a name outside of its own declaration, or undefined. */
function firstUse(code: string, pattern: RegExp, own: { start: number; end: number }): number | undefined {
  for (const match of code.matchAll(pattern)) {
    if (match.index < own.start || match.index > own.end) return match.index;
  }
  return undefined;
}

function escape(name: string): string {
  return name.replace(/[$]/g, '\\$');
}
