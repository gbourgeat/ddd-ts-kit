import { argumentsOf } from '../declarations/arguments-of.js';
import { bindingCalls } from '../declarations/binding-calls.js';
import { classesOf } from '../declarations/classes-of.js';
import type { Finding } from '../model/finding.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { classDeclaring } from '../ports/class-declaring.js';
import { portMisuse } from '../ports/port-misuse.js';
import { importedFrom } from '../support/imported-from.js';
import { inLayer } from '../support/in-layer.js';
import { isPortFile } from '../support/is-port-file.js';
import { perFile } from '../support/per-file.js';

const ADAPTER_DECORATORS = ['Repository', 'Gateway', 'Adapter'];
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const TO_CLASS = /^\s*\.\s*toClass\s*\(\s*([A-Za-z_$][\w$]*)/;

export const portsImplementsNeverExtends: Rule = {
  id: 'ports/implements-never-extends',
  description:
    'An adapter implements its port and never extends it: a class declared with @Repository, @Gateway or @Adapter, a class bound with toClass, and any class of infrastructure/.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (file.isTest) {
        return [];
      }

      const declared = declaredAdapters(file);
      const reported = new Set(declared.map((finding) => finding.line));

      return [
        ...declared,
        ...boundClasses(file, project),
        ...extendedPorts(file).filter((finding) => !reported.has(finding.line)),
      ];
    });
  },
};

/** A class carrying `@Repository(P, ..)`, `@Gateway(P, ..)` or `@Adapter(P, ..)`. */
function declaredAdapters(file: SourceFile): Finding[] {
  return classesOf(file.scan).flatMap((declared) => {
    const decoration = declared.decorations.find(({ name }) => ADAPTER_DECORATORS.includes(name));
    const port = decoration === undefined ? undefined : argumentsOf(file.scan, decoration)[0]?.code;
    const shape = file.structure.classes.find((candidate) => candidate.name === declared.name && candidate.depth === 0);

    if (port === undefined || shape === undefined || !IDENTIFIER.test(port)) {
      return [];
    }

    const misuse = portMisuse(shape, port);

    return misuse === undefined ? [] : [{ line: declared.line, ...misuse }];
  });
}

/** `bind(P).toClass(C, ..)` and `rebind(P).toClass(C, ..)`; a class bound to itself is no port and is left alone. */
function boundClasses(file: SourceFile, project: Project): Finding[] {
  const { code } = file.scan;

  const bindings = bindingCalls(file).filter(({ method }) => method === 'bind' || method === 'rebind');

  return bindings.flatMap(({ close, token, line }) => {
    const port = token?.code ?? '';
    const bound = TO_CLASS.exec(code.slice(close + 1, close + 200))?.[1];

    const shape =
      bound === undefined || bound === port || !IDENTIFIER.test(port)
        ? undefined
        : classDeclaring(project, file, bound);

    const misuse = shape === undefined ? undefined : portMisuse(shape, port);

    return misuse === undefined ? [] : [{ line, ...misuse }];
  });
}

/** Under infrastructure/, no class extends a class imported from a port file. */
function extendedPorts(file: SourceFile): Finding[] {
  if (inLayer(file, 'infrastructure') === undefined) {
    return [];
  }

  return file.structure.classes.flatMap((shape) => {
    const target = shape.superclass === undefined ? undefined : importedFrom(file, shape.superclass)?.target;

    if (shape.superclass === undefined || target?.kind !== 'file' || !isPortFile(target.path, target.location)) {
      return [];
    }

    return [
      {
        line: shape.line,
        message: `${shape.name} extends the port ${shape.superclass}: an adapter implements its port, it never extends it.`,
        fix: `Write \`class ${shape.name} implements ${shape.superclass}\`: the port holds a contract and no behaviour to inherit.`,
      },
    ];
  });
}
