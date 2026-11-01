import type { OpenSearchRequest, OpenSearchResponse, OpenSearchTransport } from '../transport/open-search-transport';
import { bodiesOf } from './bodies-of';
import { bodyOf, type Body } from './body-of';
import { FakeIndex } from './fake-index';
import { FakeRefusal } from './fake-refusal';
import { propertiesOf } from './properties-of';
import { searched } from './searched';
import { textAt } from './text-at';
import { UnknownQueryError } from './unknown-query-error';

/** An alias on one index: its filter and routing, as `POST /_aliases` gave them. */
interface FakeAlias {
  readonly filter?: Body;
  readonly routing?: string;
}

const INVALID_INDEX_NAME = /[A-Z\\/*?"<>| ,#:]|^[-_+]|^\.{1,2}$/;

/**
 * OpenSearch in memory, for the subset of the REST API the store calls: indices with a strict
 * mapping, aliases with a filter and a routing, documents with their sequence numbers and the
 * conditional writes on them, and the search of the query DSL the store writes. One shard per
 * index, refreshed at every write: a search sees every write at once. The answers, statuses and
 * error types are the ones of OpenSearch 3; the specs run on both, with the same expectations.
 */
export class InMemoryOpenSearch implements OpenSearchTransport {
  /** Every request received, in order. */
  readonly requests: OpenSearchRequest[] = [];

  private readonly indices = new Map<string, FakeIndex>();

  private readonly aliases = new Map<string, Map<string, FakeAlias>>();

  async request(request: OpenSearchRequest): Promise<OpenSearchResponse> {
    this.requests.push(request);

    try {
      return this.routed(
        request,
        request.path
          .split('/')
          .filter((segment) => segment !== '')
          .map(decodeURIComponent),
      );
    } catch (error) {
      if (error instanceof FakeRefusal) {
        return refusal(error.status, error.type, error.message);
      }

      if (error instanceof UnknownQueryError) {
        return refusal(400, 'parsing_exception', error.message);
      }

      throw error;
    }
  }

  private routed(request: OpenSearchRequest, [target = '', action, id]: readonly string[]): OpenSearchResponse {
    const body = bodyOf(request.body);
    const query = request.query ?? {};

    if (target === '_aliases' && request.method === 'POST') {
      return this.changeAliases(body);
    }

    if (action === undefined) {
      return this.ofIndex(request.method, target, body);
    }

    if (action === '_mapping') {
      this.index(target).extend(propertiesOf(body['properties']));

      return { status: 200, body: { acknowledged: true } };
    }

    if (action === '_search') {
      const lenient = query['ignore_unavailable'] === 'true';

      return { status: 200, body: searched(this.resolved(target, lenient), body) };
    }

    if (action === '_refresh') {
      return { status: 200, body: { _shards: { failed: 0 } } };
    }

    return request.method === 'GET' ? this.get(target, String(id)) : this.put(target, String(id), body, query);
  }

  private ofIndex(method: OpenSearchRequest['method'], target: string, body: Body): OpenSearchResponse {
    if (method === 'PUT') {
      return this.create(target, body);
    }

    if (method === 'DELETE') {
      return this.drop(target);
    }

    return { status: 200, body: { [target]: { mappings: { properties: this.index(target).properties } } } };
  }

  private create(name: string, body: Body): OpenSearchResponse {
    if (INVALID_INDEX_NAME.test(name) || name.length > 255) {
      throw new FakeRefusal(400, 'invalid_index_name_exception', `Invalid index name [${name}]`);
    }

    if (this.indices.has(name) || this.aliases.has(name)) {
      throw new FakeRefusal(400, 'resource_already_exists_exception', `index [${name}] already exists`);
    }

    this.indices.set(name, new FakeIndex(propertiesOf(bodyOf(body['mappings'])['properties'])));

    return { status: 200, body: { acknowledged: true, index: name } };
  }

  private drop(target: string): OpenSearchResponse {
    for (const name of target.split(',')) {
      this.indices.delete(name);

      for (const indices of this.aliases.values()) {
        indices.delete(name);
      }
    }

    return { status: 200, body: { acknowledged: true } };
  }

  private changeAliases(body: Body): OpenSearchResponse {
    for (const action of bodiesOf(body['actions'])) {
      const add = bodyOf(action['add']);
      const [index, alias] = [textAt(add, 'index'), textAt(add, 'alias')];
      const { filter, routing } = add;

      this.index(index);

      if (this.indices.has(alias)) {
        throw new FakeRefusal(
          400,
          'invalid_alias_name_exception',
          `Invalid alias name [${alias}]: an index exists with the same name`,
        );
      }

      const indices = this.aliases.get(alias) ?? new Map<string, FakeAlias>();

      indices.set(index, {
        ...(filter === undefined ? {} : { filter: bodyOf(filter) }),
        ...(typeof routing === 'string' ? { routing } : {}),
      });

      this.aliases.set(alias, indices);
    }

    return { status: 200, body: { acknowledged: true } };
  }

  private get(target: string, id: string): OpenSearchResponse {
    const name = this.writeIndexOf(target, false);
    const document = this.index(name).documents.get(id);

    if (document === undefined) {
      return { status: 404, body: { _index: name, _id: id, found: false } };
    }

    return {
      status: 200,
      body: {
        _index: name,
        _id: id,
        _seq_no: document.seqNo,
        _primary_term: document.primaryTerm,
        found: true,
        _source: structuredClone(document.source),
      },
    };
  }

  private put(target: string, id: string, body: Body, query: Readonly<Record<string, string>>): OpenSearchResponse {
    const name = this.writeIndexOf(target, query['require_alias'] === 'true');
    const index = this.index(name);
    const held = index.documents.get(id);
    const create = query['op_type'] === 'create';
    const conditional = query['if_seq_no'] !== undefined;

    const conflict =
      (create && held !== undefined) ||
      (conditional &&
        (held === undefined ||
          String(held.seqNo) !== query['if_seq_no'] ||
          String(held.primaryTerm) !== query['if_primary_term']));

    if (conflict) {
      throw new FakeRefusal(409, 'version_conflict_engine_exception', `[${id}]: version conflict`);
    }

    const written = index.write(id, body);

    return {
      status: held === undefined ? 201 : 200,
      body: {
        _index: name,
        _id: id,
        result: held === undefined ? 'created' : 'updated',
        _seq_no: written.seqNo,
        _primary_term: written.primaryTerm,
      },
    };
  }

  /** The one index a document call through `target` reaches. */
  private writeIndexOf(target: string, requireAlias: boolean): string {
    const alias = this.aliases.get(target);

    if (alias === undefined) {
      if (requireAlias || !this.indices.has(target)) {
        throw notFound(target);
      }

      return target;
    }

    const [only, ...others] = [...alias.keys()];

    if (only === undefined || others.length > 0) {
      throw new FakeRefusal(400, 'illegal_argument_exception', `no write index is defined for alias [${target}]`);
    }

    return only;
  }

  /** The indices a search of `target` reaches, each with the filters of the aliases it was reached through. */
  private resolved(
    target: string,
    lenient: boolean,
  ): { index: FakeIndex; name: string; filters: (Body | undefined)[] }[] {
    const reached = new Map<string, (Body | undefined)[]>();

    for (const name of target.split(',')) {
      const alias = this.aliases.get(name);

      if (alias !== undefined) {
        for (const [index, { filter }] of alias) {
          reached.set(index, [...(reached.get(index) ?? []), filter]);
        }
      } else if (this.indices.has(name)) {
        reached.set(name, [undefined]);
      } else if (!lenient) {
        throw notFound(name);
      }
    }

    return [...reached].map(([name, filters]) => ({ index: this.index(name), name, filters }));
  }

  private index(name: string): FakeIndex {
    const index = this.indices.get(name);

    if (index === undefined) {
      throw notFound(name);
    }

    return index;
  }
}

function notFound(name: string): FakeRefusal {
  return new FakeRefusal(404, 'index_not_found_exception', `no such index [${name}]`);
}

function refusal(status: number, type: string, reason: string): OpenSearchResponse {
  return { status, body: { error: { type, reason }, status } };
}
