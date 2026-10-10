import { dependencyLists } from '../declarations/dependency-lists.js';
import type { Location } from '../model/location.js';
import type { Rule } from '../model/rule.js';
import { importedFrom } from '../support/imported-from.js';
import { perFile } from '../support/per-file.js';

export const portsNoConcreteDependency: Rule = {
  id: 'ports/no-concrete-dependency',
  description:
    'A dependency list names ports: no class imported from infrastructure/ or from test/fakes/ of a context.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) =>
      dependencyLists(file).flatMap(({ owner, names }) =>
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
              fix: `Name the port ${name} implements (an abstract class of application/ports or domain/repositories, or a port of the kernel) and type the constructor parameter with it: the adapter, or the fake in a test, is bound to that port at the composition root.`,
            },
          ];
        }),
      ),
    );
  },
};

function concretePlace(location: Location): string | undefined {
  if (location.area !== 'context') {
    return undefined;
  }

  if (location.layer === 'infrastructure') {
    return 'infrastructure/';
  }

  return location.layer === 'test' && location.inside[0] === 'fakes' ? 'test/fakes/' : undefined;
}
