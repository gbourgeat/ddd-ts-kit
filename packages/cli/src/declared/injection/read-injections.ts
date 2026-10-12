import { argumentsOf } from '../../check/declarations/arguments-of.js';
import { declaredAs } from '../../check/declarations/declared-as.js';
import type { Decoration } from '../../check/declarations/decoration.js';
import type { Finding } from '../../check/model/finding.js';
import type { SourceFile } from '../../check/model/source-file.js';
import { splitTopLevel } from '../../check/text/split-top-level.js';
import { DECLARATION_DECORATORS } from '../declared-role.js';
import type { ClassInjection } from './class-injection.js';
import { constructorOf } from './constructor-of.js';
import { parameterShape } from './parameter-shape.js';
import { rawClassName } from './raw-class-name.js';
import type { ReadConstructor } from './read-constructor.js';
import { resolveToken } from './resolve-token.js';
import type { ResolvedToken } from './resolved-token.js';
import type { Sources } from './sources.js';

/** The decorators of a message say who may send it: a message is built by its sender and is injected nothing. */
const MESSAGE_DECORATORS = ['Requires', 'Public'];
const INJECTED = DECLARATION_DECORATORS.filter((name) => !MESSAGE_DECORATORS.includes(name));

const TYPE_BY_A_CLASS =
  'Type the parameter by one class and nothing else: a port (an abstract class of application/ports or domain/repositories), a port of the kernel, another declared class, or an abstract class with readonly members that the platform binds to a value. The composition root injects each constructor parameter by the class that types it.';

const WRITE_THE_CONSTRUCTOR =
  'Write the constructor in the class, typing each parameter by its port and passing them to `super(...)`; or list the dependencies in the decorator, which is then the only statement of them.';

/** What each declared class of a role file is given: the list of its decorator, and what its constructor says. */
export function readInjections(sources: Sources, file: SourceFile): ClassInjection[] {
  return declaredAs(file.scan, INJECTED).map(({ declared, decoration }) => {
    const written = constructorOf({ sources, file, className: declared.name });
    const identity = { className: declared.name, file: file.path, line: decoration.line };
    const listed = listOf(file, decoration);

    if (written === undefined) {
      return { ...identity, listed, dependencies: undefined, readable: false, problems: [inherited(identity)] };
    }

    const read = written.parameters.map((parameter) => tokenOf(sources, written, parameter));
    const line = written.file === file ? written.line : decoration.line;
    const problems = read.flatMap((parameter) => problemOf(identity.className, line, parameter));
    const tokens = read.flatMap(({ resolved }) => resolved.token ?? []);

    return { ...identity, listed, readable: true, problems, dependencies: problems.length === 0 ? tokens : undefined };
  });
}

/** The identifiers of the list a decorator carries as its last argument, or undefined when it carries none. */
function listOf(file: SourceFile, decoration: Decoration): string[] | undefined {
  const last = argumentsOf(file.scan, decoration).at(-1)?.code;

  if (last?.startsWith('[') !== true) {
    return undefined;
  }

  return splitTopLevel(last.slice(1, last.lastIndexOf(']')))
    .map((part) => part.code)
    .filter((code) => code !== '');
}

function inherited({ className, line }: Pick<ClassInjection, 'className' | 'line'>): Finding {
  return {
    line,
    message: `${className} inherits its constructor from a class this project cannot read: nothing states what it is given.`,
    fix: WRITE_THE_CONSTRUCTOR,
  };
}

interface ReadParameter {
  readonly name: string;
  readonly resolved: ResolvedToken;
}

function tokenOf(sources: Sources, written: ReadConstructor, parameter: string): ReadParameter {
  const { name, type, oddity } = parameterShape(parameter);

  if (oddity !== undefined) {
    return { name, resolved: { flaw: `${oddity}: the composition root gives every parameter a value, always` } };
  }

  if (type === undefined) {
    return { name, resolved: { flaw: 'has no type' } };
  }

  const className = rawClassName(type);

  return {
    name,
    resolved:
      className === undefined
        ? { flaw: `is typed \`${type.replace(/\s+/g, ' ')}\`, which names no single class` }
        : resolveToken({ sources, file: written.file, name: className }),
  };
}

function problemOf(className: string, line: number, { name, resolved }: ReadParameter): Finding[] {
  if (resolved.flaw === undefined) {
    return [];
  }

  return [
    {
      line,
      message: `Parameter "${name}" of the constructor of ${className} ${resolved.flaw}.`,
      fix: TYPE_BY_A_CLASS,
    },
  ];
}
