import type { AccessScope } from '@ddd-ts-kit/auth';
import { InvalidPageRequestError, decodeCursor, encodeCursor, pageOf, type PageRequest } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { {{name.pascal}}Reader } from '{{alias.context}}/application/ports/{{name.kebab}}-reader.port{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { {{name.pascal}}Reader } from '{{alias.context}}/application/ports/{{name.kebab}}-reader.port{{alias.ext}}';
{{/unless}}
import type {
  {{name.pascal}}Item,
  {{name.pascal}}Result,
  {{name.pascal}}Sort,
} from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';

{{#if style.declared}}
@Repository({{name.pascal}}Reader)
{{/if}}
export class InMemory{{name.pascal}}Reader implements {{name.pascal}}Reader {
  protected readonly {{search.elements}}: readonly {{name.pascal}}Item[] = [];

  async search(scope: AccessScope, page: PageRequest<{{name.pascal}}Sort>): Promise<{{name.pascal}}Result> {
    // TODO(domain): replace these canned lines by a real read of the projection; a production adapter (SQL view, search index) implements the same port next to this file, turns the scope into a condition of its statement, and orders by the sort field then by `id` in the same direction, so that a cursor resumes on a total order.
    const visible = this.{{search.elements}}.filter(isVisibleTo(scope)).sort(inOrder(page));
    const start = page.kind === 'offset' ? page.offset : positionAfter(visible, page.cursor);
    const {{search.elements}} = visible.slice(start, start + page.limit);

    if (page.kind === 'offset') {
      return pageOf({{search.elements}}, { total: visible.length });
    }

    const last = {{search.elements}}.at(-1);

    return pageOf(
      {{search.elements}},
      last !== undefined && start + page.limit < visible.length ? { nextCursor: encodeCursor({ id: last.id }) } : {},
    );
  }
}

function isVisibleTo(scope: AccessScope): ({{search.element}}: {{name.pascal}}Item) => boolean {
  return ({{search.element}}) => {
    switch (scope.kind) {
      case 'all':
        return true;
      case 'none':
        return false;
      case 'ids':
        return scope.ids.includes({{search.element}}.id);
      case 'filter':
        return Object.entries(scope.filter).every(([field, value]) => Reflect.get({{search.element}}, field) === value);
    }
  };
}

function inOrder(page: PageRequest<{{name.pascal}}Sort>): (left: {{name.pascal}}Item, right: {{name.pascal}}Item) => number {
  const toward = page.sort[0]?.direction === 'desc' ? -1 : 1;

  return (left, right) => toward * left.id.localeCompare(right.id);
}

function positionAfter(visible: readonly {{name.pascal}}Item[], cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0;
  }

  const { id } = decodeCursor(cursor);

  if (typeof id !== 'string') {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }

  return visible.findIndex(({{search.element}}) => {{search.element}}.id === id) + 1;
}
