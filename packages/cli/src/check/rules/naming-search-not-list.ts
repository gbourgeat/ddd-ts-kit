import type { ContextLocation } from '../model/context-location.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { bodilessMembers } from '../ports/bodiless-members.js';
import type { ClassShape } from '../structure/class-shape.js';
import { inContext } from '../support/in-context.js';
import { isPortFile } from '../support/is-port-file.js';
import { perFile } from '../support/per-file.js';

const LIST_METHOD = /^list(?=[A-Z]|$)/;
const LIST_CLASS = /^List(?=[A-Z]|$)/;
const LIST_SEGMENT = /^list(?=[-.]|$)/;
const MODIFIERS = /^(?:(?:public|private|protected|static|abstract|override|declare|async)\s+)*/;
const SIGNATURE = /^([A-Za-z_$][\w$]*)\s*\??\s*[(<]/;

/** The one method of the kit a context may have to implement under that name: `Authorizer.listAccessible` answers an access scope, not elements. */
const KIT_METHODS: readonly string[] = ['listAccessible'];

const WHY = 'A read that takes criteria, a scope or a page is a search';

export const namingSearchNotList: Rule = {
  id: 'naming/search-not-list',
  description:
    'A method of a port or of an adapter and a query are named `search...`, never `list...`: a read that takes criteria, a scope or a page is a search.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (!inContext(file.location) || /\.(?:spec|test)\.ts$/.test(file.path)) {
        return [];
      }

      return [...listMethods(file, file.location), ...listQuery(file, file.location)];
    });
  },
};

function listMethods(file: SourceFile, location: ContextLocation): Finding[] {
  if (!isPortFile(file.path, location) && !holdsAdapters(location)) {
    return [];
  }

  return file.structure.classes.flatMap((shape) =>
    membersOf(file, shape)
      .filter(({ name }) => LIST_METHOD.test(name) && !KIT_METHODS.includes(name))
      .map(({ name, line }) => ({
        line,
        message: `The method ${name} of ${shape.name} is named after a list.`,
        fix: `Rename it ${name.replace(LIST_METHOD, 'search')}, in the port, its adapters, its fakes and its callers. ${WHY}; a read of one element or none stays findById or findBy...`,
      })),
  );
}

/** Where the adapters of a context live: `infrastructure/`, and the fakes of its ports in `test/fakes/`. */
function holdsAdapters({ layer, inside }: ContextLocation): boolean {
  return layer === 'infrastructure' || (layer === 'test' && inside[0] === 'fakes');
}

/** The methods of a class, with or without a body: a property is not judged. */
function membersOf(file: SourceFile, shape: ClassShape): { name: string; line: number }[] {
  const signatures = bodilessMembers(file, shape).flatMap(({ text, line }) => {
    const name = SIGNATURE.exec(text.replace(MODIFIERS, ''))?.[1];

    return name === undefined ? [] : [{ name, line }];
  });

  return [...shape.methods.map(({ name, line }) => ({ name, line })), ...signatures];
}

function listQuery(file: SourceFile, { layer, inside }: ContextLocation): Finding[] {
  if (layer !== 'application' || inside[0] !== 'queries') {
    return [];
  }

  const segment = inside.slice(1).find((part) => LIST_SEGMENT.test(part));
  const placed = segment === undefined ? [] : [{ line: 1, ...namedAfterAList(`"${segment}"`, toSearch(segment)) }];

  const classes = file.structure.classes
    .filter((shape) => shape.depth === 0 && LIST_CLASS.test(shape.name))
    .map((shape) => ({ line: shape.line, ...namedAfterAList(`The class ${shape.name}`, toSearch(shape.name)) }));

  return [...placed, ...classes];
}

function toSearch(name: string): string {
  return name.replace(LIST_SEGMENT, 'search').replace(LIST_CLASS, 'Search');
}

function namedAfterAList(what: string, renamed: string): { message: string; fix: string } {
  return {
    message: `${what} under application/queries is named after a list.`,
    fix: `Rename it ${renamed}, with the folder, the files and the classes of the query (search-invoices/, search-invoices.query.ts, SearchInvoicesQuery). ${WHY}; \`ddd-ts-kit generate query <context> Search<Things> --search\` writes one.`,
  };
}
