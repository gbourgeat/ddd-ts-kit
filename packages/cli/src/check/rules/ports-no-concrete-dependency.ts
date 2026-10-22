import { declaredRoleOf } from '../../declared/declared-role-of';
import { readInjections } from '../../declared/injection/read-injections';
import { dependencyLists } from '../declarations/dependency-lists';
import type { Finding } from '../model/finding';
import type { Location } from '../model/location';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { sourceAt } from '../project/source-at';
import { importedFrom } from '../support/imported-from';
import { isDeclaredStyle } from '../support/is-declared-style';
import { pathInContext } from '../support/path-in-context';
import { perFile } from '../support/per-file';
import { WITHOUT_MODULE } from '../../model-modules';

const NAME_THE_PORT =
  'an abstract class of application/ports or domain/repositories, or a port of the kernel: the adapter, or the fake in a test, is bound to that port at the composition root.';

export const portsNoConcreteDependency: Rule = {
  id: 'ports/no-concrete-dependency',
  description:
    'A dependency is named by its port: no class imported from infrastructure/ or from test/fakes/ of a context in a dependency list, nor as the type of a constructor parameter of a declared class.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => [...listed(file), ...typed(project, file)]);
  },
};

function listed(file: SourceFile): Finding[] {
  return dependencyLists(file).flatMap(({ owner, names }) =>
    names.flatMap(({ name, line }) => {
      const target = importedFrom(file, name)?.target;
      const place = target?.kind === 'file' ? concretePlace(target.location) : undefined;

      if (place === undefined) {
        return [];
      }

      return [
        {
          line,
          message: `The dependency list of ${owner} names ${name}, a class of ${place}: a list names ports, never what implements them.`,
          fix: `Name the port ${name} implements and type the constructor parameter with it, ${NAME_THE_PORT}`,
        },
      ];
    }),
  );
}

/** A declared class that lists nothing states its dependencies in its constructor: its parameter types are the list. */
function typed(project: Project, file: SourceFile): Finding[] {
  if (
    !isDeclaredStyle(project) ||
    file.isTest ||
    declaredRoleOf(pathInContext(project, file) ?? '', WITHOUT_MODULE) === undefined
  ) {
    return [];
  }

  return readInjections((path) => sourceAt(project, path), file).flatMap(
    ({ className, line, listed: list, dependencies = [] }) =>
      (list === undefined ? dependencies : []).flatMap(({ name, from }) => {
        const place = from.kind === 'file' ? concretePlace(project.locate(from.path)) : undefined;

        if (place === undefined) {
          return [];
        }

        return [
          {
            line,
            message: `The constructor of ${className} takes ${name}, a class of ${place}: a parameter is typed by a port, never by what implements it.`,
            fix: `Type the parameter by the port ${name} implements, ${NAME_THE_PORT}`,
          },
        ];
      }),
  );
}

function concretePlace(location: Location): string | undefined {
  if (location.area !== 'context') {
    return undefined;
  }

  if (location.layer === 'infrastructure') {
    return 'infrastructure/';
  }

  return location.layer === 'test' && location.inside[0] === 'fakes' ? 'test/fakes/' : undefined;
}
