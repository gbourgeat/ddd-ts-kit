import { DECLARED_ROLES, declaredRoleOf } from '../../declared/index.js';
import { classesOf } from '../declarations/classes-of.js';
import { DECLARATIONS_ENTRY } from '../declarations/declarations-entry.js';
import type { Finding } from '../model/finding.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import type { ClassShape } from '../structure/class-shape.js';
import { importedFrom } from '../support/imported-from.js';
import { inLayer } from '../support/in-layer.js';
import { isDeclaredStyle } from '../support/is-declared-style.js';
import { isPortFile } from '../support/is-port-file.js';
import { pathInContext } from '../support/path-in-context.js';
import { perFile } from '../support/per-file.js';
import { WITHOUT_MODULE } from '../../model-modules/index.js';

/** The decorators that declare a class of infrastructure/: `@Repository`, `@Gateway`, `@Adapter`. */
const ADAPTER_DECORATORS = [
  ...new Set(
    DECLARED_ROLES.filter((role) => role.folders.some((folder) => folder.startsWith('infrastructure'))).flatMap(
      (role) => role.decorators,
    ),
  ),
];

const RULE_ID = 'declarations/port-adapter-wired';

/** A marker the generator leaves in an adapter it writes before the outside system is ready, which `ddd-ts-kit todo` lists. */
const LEFT_TO_DO = /\bTODO\((?:domain|platform)\)/;

interface Implementation {
  readonly shape: ClassShape;
  readonly port: string;
  readonly repository: boolean;
}

export const declarationsPortAdapterWired: Rule = {
  id: RULE_ID,
  description:
    'A class of infrastructure/ that implements a port is wired: declared with @Repository, @Gateway or @Adapter in the declared style, or imported by the composition root (<context>.module.ts, main.ts, apps/, the platform directory). One kept unwired on purpose says so with a suppression that points to a decision record. A file that still carries a TODO(domain) or TODO(platform) of the generator is not judged yet.',
  scope: 'project',
  run(project) {
    const composed = composedClasses(project);

    return perFile(project, this.id, (file) => {
      const place = inLayer(file, 'infrastructure');

      if (place === undefined || isLeftToDo(file)) {
        return [];
      }

      return implementations(file)
        .filter(({ shape }) => !composed.has(`${file.path}#${shape.name}`) && !isDeclared(file, project, shape))
        .map((implementation) => unwired(implementation, project, place.context));
    });
  },
};

/**
 * An adapter the generator wrote is wired once the outside system is ready, a step its markers
 * name: until they are done, the file is listed by `ddd-ts-kit todo`, not reported here.
 */
function isLeftToDo({ scan }: SourceFile): boolean {
  return scan.comments.some(({ text }) => LEFT_TO_DO.test(text));
}

/** `<file>#<class>` for each class a file of the composition root imports as a value. */
function composedClasses(project: Project): ReadonlySet<string> {
  const composing = project.files.filter((file) => isCompositionRoot(file, project));

  return new Set(
    composing.flatMap(({ imports }) =>
      imports.flatMap(({ target, names, typeNames }) =>
        target.kind === 'file'
          ? names.filter((name) => !typeNames.includes(name)).map((name) => `${target.path}#${name}`)
          : [],
      ),
    ),
  );
}

function isCompositionRoot({ isTest, location, path }: SourceFile, project: Project): boolean {
  if (isTest) {
    return false;
  }

  if (location.area === 'main' || location.area === 'platform') {
    return true;
  }

  return (
    (location.area === 'context' && location.layer === 'module') ||
    new RegExp(`^${project.config.sourceRoot}/apps/[^/]+/main\\.ts$`).test(path)
  );
}

/** The concrete classes of the module that implement a class imported from a port file, each with its first port. */
function implementations(file: SourceFile): Implementation[] {
  return file.structure.classes.flatMap((shape) => {
    const ports = shape.depth === 0 && !shape.isAbstract ? shape.implemented.flatMap((name) => portOf(file, name)) : [];
    const [port] = ports;

    return port === undefined ? [] : [{ shape, ...port }];
  });
}

function portOf(file: SourceFile, name: string): { port: string; repository: boolean }[] {
  const target = importedFrom(file, name)?.target;

  if (target?.kind !== 'file' || !isPortFile(target.path, target.location)) {
    return [];
  }

  return [{ port: name, repository: target.location.area === 'context' && target.location.layer === 'domain' }];
}

/**
 * In the declared style a class is wired by its decorator. The exported class of a role file is
 * judged by `declarations/role-declared`, which already reports it when it declares nothing.
 */
function isDeclared(file: SourceFile, project: Project, shape: ClassShape): boolean {
  if (!isDeclaredStyle(project)) {
    return false;
  }

  const declared = classesOf(file.scan).find((candidate) => candidate.name === shape.name);

  if (declared?.decorations.some(({ name }) => ADAPTER_DECORATORS.includes(name)) === true) {
    return true;
  }

  return shape.isExported && declaredRoleOf(pathInContext(project, file) ?? '', WITHOUT_MODULE) !== undefined;
}

function unwired({ shape, port, repository }: Implementation, project: Project, context: string): Finding {
  const marker = `if it is kept unwired on purpose, write docs/adr/NNNN-<slug>.md and put \`// ddd-ts-kit-disable-next-line ${RULE_ID} -- ADR-NNNN: <why>\` above the class`;

  if (isDeclaredStyle(project)) {
    const decorator = repository ? `@Repository(${port})` : `@Gateway(${port}) or @Adapter(${port}, { kind })`;
    const files = repository ? 'infrastructure/persistence/*.repository.ts' : '*.gateway.ts or *.adapter.ts';

    return {
      line: shape.line,
      message: `${shape.name} implements the port ${port}, but carries no declaration and no file of the composition root imports it: nothing binds it, and the port is missing at run time.`,
      fix: `Put ${decorator} from ${DECLARATIONS_ENTRY} above the class, in a role file (${files}), or bind it in the platform; ${marker}.`,
    };
  }

  return {
    line: shape.line,
    message: `${shape.name} implements the port ${port}, but no file of the composition root imports it: nothing binds it, and the port is missing at run time.`,
    fix: `Bind it in ${context}.module.ts, \`builder.bind(${port}).toClass(${shape.name}, [..])\`, or in src/main.ts; ${marker}.`,
  };
}
