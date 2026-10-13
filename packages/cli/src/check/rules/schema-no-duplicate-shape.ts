import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { Violation } from '../model/violation.js';
import { classShapes } from '../schemas/class-shapes.js';
import type { DeclaredShape } from '../schemas/declared-shape.js';
import { holdsSchemas } from '../schemas/holds-schemas.js';
import { objectShapes } from '../schemas/object-shapes.js';
import { restoredCode } from '../schemas/restored-code.js';
import { sharesSchemas } from '../schemas/shares-schemas.js';
import { reporter } from '../support/reporter.js';

/** What a route reads from its path, its query string or its headers is documented per operation, never as a component. */
const PARAMETER_FILE = /\.(?:params|query|headers)\.ts$/;

/** Where a context keeps the shapes its routes share: the declaration there is the original, a copy elsewhere is reported. */
const SHARED_OF_A_CONTEXT = '/presentation/http/shared/';

/** The home of the shapes of the shared kernel: every context compares its shapes with them. */
const KERNEL = '';

const FIX =
  'Declare the shape once, under presentation/http/shared/ of its context (`ddd-ts-kit generate schema <context> <Name>`) or under presentation/ of the shared kernel when several contexts use it (`generate schema shared-kernel <Name>`), share it (`.meta({ id })` with zod, `classSchema(Dto, { shared: true })` with class-validator, `sharedSchema(name, schema)` otherwise) and use it in both places, whole or in part. An identifier answer is `acceptedSchema` of @ddd-ts-kit/http.';

interface Placed extends DeclaredShape {
  readonly file: string;
  /** The context the shape belongs to, or the shared kernel. */
  readonly home: string;
}

export const schemaNoDuplicateShape: Rule = {
  id: 'schema/no-duplicate-shape',
  description:
    'Under "stack.schemas": "shared", one shape of the HTTP contract is declared once in its context: no two DTO classes, and no two object schemas (zod, valibot, TypeBox), of the presentation layer of one context, or of a context and presentation/ of the shared kernel, declare the same properties with the same constraints. Two contexts may declare the same shape; request parameters and shapes the generator left to fill are not judged.',
  scope: 'project',
  run(project) {
    if (!sharesSchemas(project)) {
      return [];
    }

    const report = reporter(project, this.id);
    const first = new Map<string, Placed>();

    return shapesOf(project).flatMap((shape): Violation[] => {
      const earlier = first.get(`${KERNEL}|${shape.key}`) ?? first.get(`${shape.home}|${shape.key}`);

      if (earlier === undefined) {
        first.set(`${shape.home}|${shape.key}`, shape);

        return [];
      }

      const message = `${shape.what} declares the shape ${earlier.what.charAt(0).toLowerCase()}${earlier.what.slice(1)} already declares (${earlier.file}:${String(earlier.line)}).`;

      return [report({ file: shape.file, line: shape.line }, message, FIX)];
    });
  },
};

function shapesOf(project: Project): Placed[] {
  return project.files
    .filter((file) => holdsSchemas(project, file) && !PARAMETER_FILE.test(file.path))
    .map((file) => ({ file, home: file.location.area === 'context' ? file.location.context : KERNEL }))
    .sort((a, b) => rank(a.file.path, a.home) - rank(b.file.path, b.home) || compare(a.file.path, b.file.path))
    .flatMap(({ file, home }) => {
      const code = restoredCode(file);

      return [...classShapes(file, code), ...objectShapes(file, code)]
        .sort((a, b) => a.line - b.line)
        .map((shape) => ({ ...shape, file: file.path, home }));
    });
}

/** The shared kernel first, then the shared shapes of each context, then the routes: a copy is reported, never its original. */
function rank(path: string, home: string): number {
  if (home === KERNEL) {
    return 0;
  }

  return path.includes(SHARED_OF_A_CONTEXT) ? 1 : 2;
}

function compare(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}
