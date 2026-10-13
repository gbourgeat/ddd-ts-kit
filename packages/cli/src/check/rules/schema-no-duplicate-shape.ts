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

const FIX =
  'Declare the shape once, under presentation/http/shared/ of its context (`ddd-ts-kit generate schema <context> <Name>`) or under presentation/ of the shared kernel when several contexts use it (`generate schema shared-kernel <Name>`), share it (`.meta({ id })` with zod, `classSchema(Dto, { shared: true })` with class-validator, `sharedSchema(name, schema)` otherwise) and use it in both places, whole or in part. An identifier answer is `acceptedSchema` of @ddd-ts-kit/http.';

interface Placed extends DeclaredShape {
  readonly file: string;
}

export const schemaNoDuplicateShape: Rule = {
  id: 'schema/no-duplicate-shape',
  description:
    'Under "stack.schemas": "shared", one shape of the HTTP contract is declared once: no two DTO classes, and no two object schemas (zod, valibot, TypeBox), of the presentation layers and of presentation/ of the shared kernel declare the same properties with the same constraints. Request parameters are not judged.',
  scope: 'project',
  run(project) {
    if (!sharesSchemas(project)) {
      return [];
    }

    const report = reporter(project, this.id);
    const first = new Map<string, Placed>();

    return shapesOf(project).flatMap((shape): Violation[] => {
      const earlier = first.get(shape.key);

      if (earlier === undefined) {
        first.set(shape.key, shape);

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
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .flatMap((file) => {
      const code = restoredCode(file);

      return [...classShapes(file, code), ...objectShapes(file, code)]
        .sort((a, b) => a.line - b.line)
        .map((shape) => ({ ...shape, file: file.path }));
    });
}
