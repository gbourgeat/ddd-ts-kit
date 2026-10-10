import { dependencyLists } from '../declarations/dependency-lists.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { perFile } from '../support/per-file.js';

const DISPATCHER = 'DomainEventDispatcher';
const PULL = /\.\s*pullEvents\s*\(/g;
const IMPORTED = /(?<![\w$.])import\b[\w\s{},*$]*?(?<![\w$])DomainEventDispatcher(?![\w$])/g;
const TYPED = /:\s*(?:[\w$]+\s*\.\s*)*DomainEventDispatcher(?![\w$])/;
const FIX = 'Events leave with the save: `await repository.save(aggregate)` and nothing else; a removal that announces an event takes the aggregate.';

/** What a file of a context is held to: every judged file calls no `pullEvents()`, some also know no dispatcher. */
interface Judged {
  readonly place: string;
  readonly refusesDispatcher: boolean;
}

export const domainEventsDispatchedOnSave: Rule = {
  id: 'domain-events/dispatched-on-save',
  description: 'Domain events leave with the save: no `pullEvents()` in application/ or infrastructure/, no DomainEventDispatcher in a command, a query or a repository adapter.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const judged = judgedAs(file);

      if (judged === undefined) return [];

      const lines = [...pulled(file), ...(judged.refusesDispatcher ? dispatcherIn(file) : [])];

      return lines.map(({ line, what }) => ({ line, message: `${what} in ${judged.place}: the events an aggregate recorded are dispatched when its repository saves it.`, fix: FIX }));
    });
  },
};

interface Named {
  readonly line: number;
  readonly what: string;
}

/** Production files of application/ and infrastructure/; the module file, the tests and everything outside a context are not judged. */
function judgedAs(file: SourceFile): Judged | undefined {
  const { location } = file;

  if (location.area !== 'context' || file.isTest) return undefined;

  const [folder = ''] = location.inside;

  if (location.layer === 'application') return { place: `application/${folder}`, refusesDispatcher: folder === 'commands' || folder === 'queries' };
  if (location.layer !== 'infrastructure') return undefined;

  return { place: `infrastructure/${folder}`, refusesDispatcher: folder === 'persistence' && file.path.endsWith('.repository.ts') };
}

function pulled({ scan }: SourceFile): Named[] {
  return [...scan.code.matchAll(PULL)].map((match) => ({ line: scan.lineAt(match.index), what: '`pullEvents()` is called' }));
}

/** Where the file names the dispatcher: in an import, in a dependency list, as the type of a constructor parameter. */
function dispatcherIn(file: SourceFile): Named[] {
  const { scan } = file;
  const imported = [...scan.code.matchAll(IMPORTED)].map((match) => ({ line: scan.lineAt(match.index + match[0].length - 1), what: `${DISPATCHER} is imported` }));

  const listed = dependencyLists(file).flatMap(({ owner, names }) =>
    names.filter(({ name }) => name === DISPATCHER).map(({ line }) => ({ line, what: `${DISPATCHER} is named in the dependency list of ${owner}` })),
  );

  return [...imported, ...listed, ...received(file)];
}

function received(file: SourceFile): Named[] {
  return file.structure.classes.flatMap((shape) =>
    shape.methods
      .filter((method) => method.isConstructor && method.parameters.some((parameter) => TYPED.test(parameter)))
      .map((method) => ({ line: method.line, what: `The constructor of ${shape.name} receives a ${DISPATCHER}` })),
  );
}
