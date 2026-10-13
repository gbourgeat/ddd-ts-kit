import { ForbiddenError } from '../error/forbidden-error.js';
import { isRecord } from '../support/is-record.js';
import type { FieldJudge } from './field-judge.js';
import type { FieldTree } from './field-tree.js';

/** A value of the body, with the path that names it in a refusal. */
interface Located {
  readonly value: unknown;
  readonly path: string;
}

/**
 * Refuses a body that sets a field the actor may not set, with 403 and the path of the field:
 * what a form shows read-only is held by the server too. A field left out is not judged.
 */
export async function assertWritable(body: unknown, tree: FieldTree, judge: FieldJudge): Promise<void> {
  await writable({ value: body, path: 'body' }, tree, judge);
}

async function writable({ value, path }: Located, tree: FieldTree, judge: FieldJudge): Promise<void> {
  if (tree.isEmpty()) {
    return;
  }

  if (Array.isArray(value)) {
    const items = tree.below('*');

    await Promise.all(
      value.map((item: unknown, index) => writable({ value: item, path: `${path}.${String(index)}` }, items, judge)),
    );

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [name, rule] of tree.own()) {
    if (value[name] !== undefined && !(await judge.writes(rule, value))) {
      throw new ForbiddenError(`The field ${path}.${name} may not be set by this caller.`);
    }
  }

  await Promise.all(
    tree.branches().map((name) => writable({ value: value[name], path: `${path}.${name}` }, tree.below(name), judge)),
  );
}
