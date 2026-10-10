import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { bodilessMembers, type BodilessMember } from '../ports/bodiless-members.js';
import type { ClassShape } from '../structure/class-shape.js';
import { isPortFile } from '../support/is-port-file.js';
import { perFile } from '../support/per-file.js';
import { braceDepthAt } from '../text/brace-depth-at.js';

const EXPORTED_INTERFACE = /(?<![\w$.])export\s+(?:declare\s+)?interface\s+([A-Za-z_$][\w$]*)/g;
const TOKEN_KEY = /^static readonly tokenKey ?(?:: ?string ?)?= ?(['"`]) ?\1$/;
const HIDDEN = /^(?:(?:static|readonly|abstract|override|declare)\s+)*(?:(private|protected)\s|#)/;
const NAME = /(#?[A-Za-z_$][\w$]*)\s*[?!]?\s*(?:[(:=<]|$)/;

const SHAPE_FIX =
  'Keep abstract members only (`abstract charge(..): Promise<void>;`, `abstract readonly apiKey: string;`): the behaviour belongs to the adapter that implements the port, and a fake or a plain object can then stand for it.';

export const portsAbstractClass: Rule = {
  id: 'ports/abstract-class',
  description:
    'A port is an abstract class with abstract members only: no constructor, no body, no initializer, no private or protected member; a port file declares no interface.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (!isPortFile(file.path, file.location)) {
        return [];
      }

      const classes = file.structure.classes.filter((shape) => shape.depth === 0);

      return [
        ...interfaces(file),
        ...classes.flatMap((shape) => [
          ...concrete(shape),
          ...bodies(shape),
          ...bodilessMembers(file, shape).flatMap((member) => notAbstract(member, shape)),
        ]),
      ];
    });
  },
};

function interfaces(file: SourceFile): Finding[] {
  const { code } = file.scan;

  return [...code.matchAll(EXPORTED_INTERFACE)]
    .filter((match) => braceDepthAt(code, match.index) === 0)
    .map((match) => ({
      line: file.scan.lineAt(match.index),
      message: `The port ${match[1] ?? ''} is declared as an interface.`,
      fix: `Declare the port as an abstract class: it is also its injection token. Write \`export abstract class ${match[1] ?? 'Port'}\` with abstract members, and name the class in dependency lists and bindings.`,
    }));
}

function concrete(shape: ClassShape): Finding[] {
  if (shape.isAbstract) {
    return [];
  }

  return [
    {
      line: shape.line,
      message: `The class ${shape.name} of a port file is not abstract.`,
      fix: `Write \`export abstract class ${shape.name}\` with abstract members only; an implementation is an adapter in infrastructure/, which implements the port.`,
    },
  ];
}

function bodies(shape: ClassShape): Finding[] {
  return shape.methods.map((method) => ({
    line: method.line,
    message: method.isConstructor
      ? `The port ${shape.name} has a constructor.`
      : `The member ${method.name} of the port ${shape.name} has a body.`,
    fix: SHAPE_FIX,
  }));
}

function notAbstract({ text, line }: BodilessMember, shape: ClassShape): Finding[] {
  if (TOKEN_KEY.test(text)) {
    return [];
  }

  const name =
    NAME.exec(
      text.replace(/^(?:(?:public|private|protected|static|readonly|abstract|override|declare|async|get|set)\s+)*/, ''),
    )?.[1] ?? text;

  const flaw =
    hiddenMember(text) ??
    (!/^(?:public\s+)?abstract\s/.test(text)
      ? 'is not abstract'
      : text.includes('=')
        ? 'has an initializer'
        : undefined);

  return flaw === undefined
    ? []
    : [{ line, message: `The member ${name} of the port ${shape.name} ${flaw}.`, fix: SHAPE_FIX }];
}

function hiddenMember(text: string): string | undefined {
  const hidden = HIDDEN.exec(text);

  if (hidden === null) {
    return undefined;
  }

  return `is ${hidden[1] ?? 'private (#)'}: a port has public abstract members only`;
}
