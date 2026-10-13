import { isAsyncIterable } from '../support/is-async-iterable.js';
import { isRecord } from '../support/is-record.js';
import type { FieldJudge } from './field-judge.js';
import type { FieldTree } from './field-tree.js';

const EVERY_ITEM = '*';

/**
 * The body as the actor may see it: every restricted field the actor may not read is left out,
 * in a copy, whatever the representation it is written in next. A streamed list is filtered
 * item by item as it is read.
 */
export async function visibleBody(body: unknown, tree: FieldTree, judge: FieldJudge): Promise<unknown> {
  return isAsyncIterable(body) ? visibleItems(body, tree.below(EVERY_ITEM), judge) : visible(body, tree, judge);
}

async function* visibleItems(
  items: AsyncIterable<unknown>,
  tree: FieldTree,
  judge: FieldJudge,
): AsyncIterable<unknown> {
  for await (const item of items) {
    yield await visible(item, tree, judge);
  }
}

async function visible(value: unknown, tree: FieldTree, judge: FieldJudge): Promise<unknown> {
  if (Array.isArray(value)) {
    const items = tree.below(EVERY_ITEM);

    return Promise.all(value.map((item: unknown) => visible(item, items, judge)));
  }

  if (!isRecord(value) || value instanceof Date) {
    return value;
  }

  const hidden = new Set<string>();

  for (const [name, rule] of tree.own()) {
    if (name in value && !(await judge.reads(rule, value))) {
      hidden.add(name);
    }
  }

  const entries = Object.entries(value).filter(([name]) => !hidden.has(name));

  return Object.fromEntries(
    await Promise.all(entries.map(async ([name, field]) => [name, await visible(field, tree.below(name), judge)])),
  );
}
