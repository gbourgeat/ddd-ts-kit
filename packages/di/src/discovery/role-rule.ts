import type { Declaration } from '@ddd-ts-kit/kernel/declarations';

/** What a file name says of the classes it holds: `*.handler.ts` holds handlers, in their folders. */
export interface RoleRule {
  readonly suffix: string;
  /** Folders of the context, relative to it, the files of this suffix belong in. */
  readonly folders: readonly string[];
  readonly roles: readonly Declaration['role'][];
}

export const ROLE_RULES: readonly RoleRule[] = [
  { suffix: 'command', folders: ['application/commands'], roles: ['message'] },
  { suffix: 'query', folders: ['application/queries'], roles: ['message'] },
  { suffix: 'handler', folders: ['application/commands', 'application/queries'], roles: ['command-handler', 'query-handler'] },
  { suffix: 'integration-handler', folders: ['application/integration/handlers'], roles: ['integration-event-handler'] },
  { suffix: 'publisher', folders: ['application/integration/publishers'], roles: ['domain-event-handler'] },
  { suffix: 'event-handler', folders: ['application/event-handlers'], roles: ['domain-event-handler'] },
  { suffix: 'policy', folders: ['application/authorization'], roles: ['policy'] },
  { suffix: 'job', folders: ['application/scheduling'], roles: ['job'] },
  { suffix: 'projection', folders: ['application/projections'], roles: ['projection'] },
  { suffix: 'repository', folders: ['infrastructure/persistence'], roles: ['repository'] },
  { suffix: 'gateway', folders: ['infrastructure'], roles: ['gateway'] },
  { suffix: 'adapter', folders: ['infrastructure'], roles: ['adapter'] },
];
