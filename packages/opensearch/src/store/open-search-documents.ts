import { UnprovisionedIndexError } from '../errors/unprovisioned-index-error';
import type { OpenSearchRequest, OpenSearchResponse, OpenSearchTransport } from '../transport/open-search-transport';
import { errorTypeOf } from './error-type-of';
import { fieldOf } from './field-of';
import { isJsonObject } from './is-json-object';
import { refusalOf } from './refusal-of';

type Source = Readonly<Record<string, unknown>>;

/** A document of a tenant, by the alias it is reached through and its id. */
export interface DocumentAddress {
  readonly alias: string;
  readonly id: string;
}

/** A document as it was read, with what makes a later write conditional on it. */
export interface ReadDocument {
  readonly source: Source;
  readonly seqNo: number;
  readonly primaryTerm: number;
}

/** What a write requires of the document it replaces: none yet, or the one that was read. */
export type WriteCondition =
  | { readonly kind: 'absent' }
  | { readonly kind: 'read'; readonly seqNo: number; readonly primaryTerm: number };

export interface SearchedDocuments {
  readonly sources: readonly Source[];
  readonly total: number | undefined;
}

/**
 * The calls of the document API the store makes, each through an alias: get, conditional index,
 * search. A missing alias is `UnprovisionedIndexError`, any other unexpected answer
 * `OpenSearchRequestError`.
 */
export class OpenSearchDocuments {
  constructor(
    private readonly transport: OpenSearchTransport,
    private readonly refresh: 'wait_for' | undefined,
  ) {}

  async get({ alias, id }: DocumentAddress): Promise<ReadDocument | undefined> {
    const response = await this.send(alias, { method: 'GET', path: `/${alias}/_doc/${encodeURIComponent(id)}` });

    if (response.status === 404) {
      return undefined;
    }

    const source = fieldOf(response.body, '_source');

    return {
      source: isJsonObject(source) ? source : {},
      seqNo: Number(fieldOf(response.body, '_seq_no')),
      primaryTerm: Number(fieldOf(response.body, '_primary_term')),
    };
  }

  /** Writes the document if the condition still holds, and says whether it did. */
  async put({ alias, id }: DocumentAddress, document: Source, condition: WriteCondition): Promise<boolean> {
    const query: Record<string, string> = {
      require_alias: 'true',
      ...(this.refresh === undefined ? {} : { refresh: this.refresh }),
      ...(condition.kind === 'absent'
        ? { op_type: 'create' }
        : { if_seq_no: String(condition.seqNo), if_primary_term: String(condition.primaryTerm) }),
    };

    const response = await this.send(alias, {
      method: 'PUT',
      path: `/${alias}/_doc/${encodeURIComponent(id)}`,
      query,
      body: document,
    });

    return response.status !== 409;
  }

  /** `lenient` for a read across tenants: an alias not provisioned yet holds nothing. */
  async search(alias: string, body: Source, lenient: boolean): Promise<SearchedDocuments> {
    const response = await this.send(alias, {
      method: 'POST',
      path: `/${alias}/_search`,
      ...(lenient ? { query: { ignore_unavailable: 'true', allow_no_indices: 'true' } } : {}),
      body,
    });

    const hits = fieldOf(response.body, 'hits');
    const listed = fieldOf(hits, 'hits');
    const total = fieldOf(fieldOf(hits, 'total'), 'value');

    return {
      sources: (Array.isArray(listed) ? listed : []).map((hit: unknown) => {
        const source = fieldOf(hit, '_source');

        return isJsonObject(source) ? source : {};
      }),
      total: typeof total === 'number' ? total : undefined,
    };
  }

  /** Answers a 2xx, a 404 of a document and a 409 of a condition; refuses anything else. */
  private async send(alias: string, request: OpenSearchRequest): Promise<OpenSearchResponse> {
    const response = await this.transport.request(request);
    const type = errorTypeOf(response);

    if (type === 'index_not_found_exception') {
      throw new UnprovisionedIndexError(alias);
    }

    const expected =
      response.status < 300 ||
      (response.status === 404 && type === undefined) ||
      (response.status === 409 && type === 'version_conflict_engine_exception');

    if (!expected) {
      throw refusalOf(request, response);
    }

    return response;
  }
}
