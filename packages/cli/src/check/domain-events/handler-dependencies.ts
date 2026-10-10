import { classesOf } from '../declarations/classes-of.js';
import { dependencyLists } from '../declarations/dependency-lists.js';
import type { SourceFile } from '../model/source-file.js';
import { importedFrom } from '../support/imported-from.js';
import { callArguments } from '../text/call-arguments.js';
import type { HandlerDependency } from './handler-dependency.js';

const TO_CLASS = /\.\s*toClass\s*\(/g;
const TYPE = /:\s*((?:[A-Za-z_$][\w$]*\s*\.\s*)*[A-Za-z_$][\w$]*)/;

interface Named {
  readonly name: string;
  readonly line: number;
}

/**
 * What `file` says the class `className` is given: the names of the dependency list of its
 * declaration, of `.toClass(className, [..])`, and the types of its constructor parameters. Each
 * is resolved through the imports of the file; a name the file does not import is left out.
 */
export function handlerDependencies(file: SourceFile, className: string): HandlerDependency[] {
  const named = [...listed(file, className), ...received(file, className)];
  const resolved = named.flatMap((dependency) => resolve(file, dependency));

  return resolved.filter((dependency, index) => resolved.findIndex((other) => other.name === dependency.name) === index);
}

function listed(file: SourceFile, className: string): Named[] {
  const lines = new Set([...declarationLines(file, className), ...bindingLines(file, className)]);

  return dependencyLists(file).flatMap((list) => (lines.has(list.line) ? list.names : []));
}

/** The lines the decorators of the class span: a dependency list written there is its own. */
function declarationLines(file: SourceFile, className: string): number[] {
  const declared = classesOf(file.scan).find(({ name }) => name === className);
  const first = declared?.decorations[0]?.line;

  if (declared === undefined || first === undefined) return [];

  return Array.from({ length: declared.line - first + 1 }, (_, index) => first + index);
}

function bindingLines(file: SourceFile, className: string): number[] {
  const { code } = file.scan;

  return [...code.matchAll(TO_CLASS)].flatMap((match) => {
    const [bound, list] = callArguments(code, match.index + match[0].length - 1);

    return bound?.code === className && list !== undefined ? [file.scan.lineAt(list.start)] : [];
  });
}

function received(file: SourceFile, className: string): Named[] {
  const shape = file.structure.classes.find((candidate) => candidate.name === className && candidate.depth === 0);
  const constructors = (shape?.methods ?? []).filter((method) => method.isConstructor);

  return constructors.flatMap(({ line, parameters }) => parameters.flatMap((parameter) => TYPE.exec(parameter)?.[1] ?? []).map((name) => ({ name: name.replace(/\s+/g, ''), line })));
}

/** `kernel.Cache` is bound by the import of `kernel` and named `Cache`. */
function resolve(file: SourceFile, { name, line }: Named): HandlerDependency[] {
  const [binding = '', ...path] = name.split('.');
  const target = importedFrom(file, binding)?.target;

  return target === undefined ? [] : [{ name: path.at(-1) ?? binding, line, target }];
}
