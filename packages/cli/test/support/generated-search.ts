import fs from 'node:fs';
import path from 'node:path';
import {
  AsyncLocalStorageExecutionScope,
  InMemoryLogger,
  defineCriteria,
  executionContext,
  type CriteriaDefinition,
  type ExecutionScope,
  type Logger,
  type TenantDirectory,
} from '@ddd-ts-kit/kernel';
import { REPO_ROOT } from '../helpers';
import { initProject } from './init-project';

/** A row of the read model the specs build a store of. */
export interface InvoiceRow {
  readonly id: string;
  readonly status: string;
}

/** What `src/platform/search/` of a generated project answers, as the specs call it. */
interface SearchIndexes {
  options(name: string, definition: CriteriaDefinition<InvoiceRow>, settings?: object): object;
  provision(): Promise<void>;
}

interface Grounds {
  readonly logger: Logger;
  readonly scope?: ExecutionScope;
  readonly directory?: TenantDirectory;
}

type OpenSearch = (
  config: { readonly node: string; readonly username?: string; readonly password?: string } | undefined,
  grounds: Grounds,
) => SearchIndexes;

/** The platform module of a project generated with the flags, loaded as it runs: its imports of the platform made relative. */
export async function generatedSearch(...flags: readonly string[]): Promise<OpenSearch> {
  const root = initProject('--search', 'opensearch', ...flags);
  const loaded = path.join(root, 'loaded-search');

  fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'));
  fs.mkdirSync(loaded);

  for (const file of fs.readdirSync(path.join(root, 'src/platform/search'))) {
    const source = fs.readFileSync(path.join(root, 'src/platform/search', file), 'utf8');

    fs.writeFileSync(path.join(loaded, file), source.replaceAll("'@/platform/search/", "'./"));
  }

  const module = (await import(path.join(loaded, 'open-search.ts'))) as { readonly openSearch: OpenSearch };

  return module.openSearch;
}

export const invoiceCriteria = defineCriteria<InvoiceRow>({
  fields: { id: { type: 'string', filter: ['eq'] }, status: { type: 'string', filter: ['eq'], sortable: true } },
  defaultSort: [{ field: 'status', direction: 'asc' }],
  tieBreaker: 'id',
});

/** The tenants a directory lists, changed by the spec as the tenants of the project would. */
export class ListedTenants {
  readonly ids: string[];

  constructor(...ids: readonly string[]) {
    this.ids = [...ids];
  }

  tenants(): Promise<readonly string[]> {
    return Promise.resolve([...this.ids]);
  }
}

export const scope = new AsyncLocalStorageExecutionScope();

export const logger = (): InMemoryLogger => new InMemoryLogger({ level: 'debug' });

/** Runs work as a member of the tenant, or, with `elevated`, as platform staff reading every tenant. */
export function asTenant<T>(tenantId: string, work: () => Promise<T>, elevated = false): Promise<T> {
  const actor = { id: `member-of-${tenantId}`, type: 'user' as const, tenantId, roles: [], attributes: {} };
  const context = executionContext({ correlationId: 'search-spec', actor, origin: 'test' });

  return scope.run(elevated ? { ...context, elevation: { tenants: 'all', reason: 'support' } } : context, work);
}
