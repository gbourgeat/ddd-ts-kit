import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import type { ClassShape } from '../structure/class-shape.js';
import type { MethodShape } from '../structure/method-shape.js';
import type { TopLevelFunction } from '../structure/top-level-function.js';
import { perFile } from '../support/per-file.js';

/** Not part of a longer name, and not a property access; a spread (`...helper()`) is a plain use. */
const NOT_A_MEMBER = '(?<![\\w$])(?<!(?:^|[^.])\\.)';

export const cleanStepdown: Rule = {
  id: 'clean/stepdown',
  description:
    'A file reads top to bottom: public members before private ones, a function above the functions it calls.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const { classes, functions } = file.structure;
      const helpers = functions.filter((helper) => !helper.exported);

      return [
        ...classes.flatMap((shape) => misplacedMembers(file, shape)),
        ...helpers.flatMap((helper) => helperAboveCaller(file, helper)),
      ];
    });
  },
};

function misplacedMembers(file: SourceFile, shape: ClassShape): Finding[] {
  const beforePublic = privateBeforePublic(shape);
  // One finding per method: a private method above the public ones is not reported again for its caller.
  const reported = new Set(beforePublic.map((finding) => finding.line));

  const others = shape.methods.filter(
    (method) => method.visibility === 'private' && !method.isConstructor && !reported.has(method.line),
  );

  return [...beforePublic, ...others.flatMap((method) => privateAboveCaller(file, shape, method))];
}

function privateBeforePublic(shape: ClassShape): Finding[] {
  const ordinary = shape.methods.filter((method) => !method.isConstructor);
  const lastPublic = ordinary.filter((method) => method.visibility === 'public').at(-1);

  if (lastPublic === undefined) {
    return [];
  }

  return ordinary
    .filter((method) => method.visibility === 'private' && method.start < lastPublic.start)
    .map((method) => ({
      line: method.line,
      message: `The private method ${method.name} of ${shape.name} is declared before the public method ${lastPublic.name}.`,
      fix: `Move ${method.name} below the public methods of ${shape.name}, after its first caller: a reader meets what the class does before how.`,
    }));
}

function privateAboveCaller(file: SourceFile, shape: ClassShape, method: MethodShape): Finding[] {
  const receiver = method.isStatic ? `(?:this|${escape(shape.name)})` : 'this';
  const pattern = new RegExp(`(?<![\\w$])${receiver}\\s*\\??\\.\\s*${escape(method.name)}(?![\\w$])`, 'g');
  const use = firstUse(file.scan.code.slice(0, shape.end), pattern, method);

  if (use === undefined || use < method.start || use < shape.start) {
    return [];
  }

  return [
    {
      line: method.line,
      message: `The private method ${method.name} of ${shape.name} is declared above its first caller (line ${file.scan.lineAt(use)}).`,
      fix: `Move ${method.name} just below the method that first calls it.`,
    },
  ];
}

function helperAboveCaller(file: SourceFile, helper: TopLevelFunction): Finding[] {
  const use = firstUse(file.scan.code, new RegExp(`${NOT_A_MEMBER}${escape(helper.name)}(?![\\w$])`, 'g'), helper);

  if (use === undefined || use < helper.start) {
    return [];
  }

  return [
    {
      line: helper.line,
      message: `The function ${helper.name} is declared above its first caller (line ${file.scan.lineAt(use)}).`,
      fix: `Move ${helper.name} below the function that first calls it: function declarations are hoisted, so the file can read from intention to detail.`,
    },
  ];
}

/** Offset of the first use of a name outside of its own declaration, or undefined. */
function firstUse(code: string, pattern: RegExp, own: { start: number; end: number }): number | undefined {
  for (const match of code.matchAll(pattern)) {
    if (match.index < own.start || match.index > own.end) {
      return match.index;
    }
  }

  return undefined;
}

function escape(name: string): string {
  return name.replace(/[$]/g, '\\$');
}
