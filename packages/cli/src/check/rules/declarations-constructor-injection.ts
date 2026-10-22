import { declaredRoleOf } from '../../declared/declared-role-of';
import type { ClassInjection } from '../../declared/injection/class-injection';
import { readInjections } from '../../declared/injection/read-injections';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import { sourceAt } from '../project/source-at';
import { inContext } from '../support/in-context';
import { isDeclaredStyle } from '../support/is-declared-style';
import { pathInContext } from '../support/path-in-context';
import { perFile } from '../support/per-file';
import { WITHOUT_MODULE } from '../../model-modules';

export const declarationsConstructorInjection: Rule = {
  id: 'declarations/constructor-injection',
  description:
    'In the declared style, a class whose decorator lists no dependency states them in its constructor: each parameter is typed by one class, with no `?`, default value, rest or destructuring, and an inherited constructor is one the project can read. Under "stack.dependencies": "signature" a decorator carries no list.',
  scope: 'file',
  run(project) {
    if (!isDeclaredStyle(project)) {
      return [];
    }

    return perFile(project, this.id, (file) => {
      if (
        !inContext(file.location) ||
        file.isTest ||
        declaredRoleOf(pathInContext(project, file) ?? '', WITHOUT_MODULE) === undefined
      ) {
        return [];
      }

      return readInjections((path) => sourceAt(project, path), file).flatMap((injection) =>
        injection.listed === undefined ? unstated(project, injection) : listed(project, injection),
      );
    });
  },
};

/**
 * What keeps a constructor from stating the dependencies. A project that lists them in its
 * decorators wrote its classes before the signature was read: there, a class that inherits a
 * constructor nothing can read and lists nothing takes nothing, as it always did.
 */
function unstated(project: Project, { problems, readable }: ClassInjection): readonly Finding[] {
  return readable || project.config.stack.dependencies === 'signature' ? problems : [];
}

/** A list in a decorator: the statement of a 0.1 project, a second statement where the constructor is the one. */
function listed(project: Project, injection: ClassInjection): Finding[] {
  const { className, line, listed: names = [], dependencies, readable } = injection;

  if (project.config.stack.dependencies !== 'signature' || !readable) {
    return [];
  }

  const typed = dependencies?.map(({ name }) => name);

  if (typed !== undefined && typed.join(',') === names.join(',')) {
    return [
      {
        line,
        message: `The decorator of ${className} lists [${names.join(', ')}], which its constructor already states.`,
        fix: 'Remove the list from the decorator (`eslint --fix` does it) and import the ports that are now only types with `import type`: the constructor signature is the one statement of what a class depends on.',
      },
    ];
  }

  return [
    {
      line,
      message: `The decorator of ${className} lists [${names.join(', ')}] and its constructor says something else: the list wins at run time, so the signature lies.`,
      fix: 'Type each constructor parameter by the class its list entry names (the token is the type), then remove the list from the decorator: the constructor signature is the one statement of what a class depends on.',
    },
  ];
}
