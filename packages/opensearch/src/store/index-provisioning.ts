import type { OpenSearchRequest, OpenSearchTransport } from '../transport/open-search-transport';
import { errorTypeOf } from './error-type-of';
import { refusalOf } from './refusal-of';

type Body = Readonly<Record<string, unknown>>;

/** An alias to put on an index: a filter and a routing for a tenant of a shared index. */
export interface AliasOfIndex {
  readonly alias: string;
  readonly filter?: Body;
  readonly routing?: string;
}

/**
 * Creates an index with its mapping and its aliases, again and again without harm: an index that
 * exists gets the fields its mapping lacks (a field mapped otherwise is refused by the node), and
 * an alias put again is the same alias.
 */
export class IndexProvisioning {
  constructor(
    private readonly transport: OpenSearchTransport,
    private readonly mapping: Body,
    private readonly settings: Body | undefined,
  ) {}

  async provide(index: string, aliases: readonly AliasOfIndex[]): Promise<void> {
    await this.created(index);

    await this.sent({ method: 'PUT', path: `/${index}/_mapping`, body: this.mapping });

    await this.sent({
      method: 'POST',
      path: '/_aliases',
      body: {
        actions: aliases.map(({ alias, filter, routing }) => ({
          add: {
            index,
            alias,
            ...(filter === undefined ? {} : { filter }),
            ...(routing === undefined ? {} : { routing }),
          },
        })),
      },
    });
  }

  private async created(index: string): Promise<void> {
    const request: OpenSearchRequest = {
      method: 'PUT',
      path: `/${index}`,
      body: { mappings: this.mapping, ...(this.settings === undefined ? {} : { settings: this.settings }) },
    };

    const response = await this.transport.request(request);

    if (response.status >= 300 && errorTypeOf(response) !== 'resource_already_exists_exception') {
      throw refusalOf(request, response);
    }
  }

  private async sent(request: OpenSearchRequest): Promise<void> {
    const response = await this.transport.request(request);

    if (response.status >= 300) {
      throw refusalOf(request, response);
    }
  }
}
