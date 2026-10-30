import type { Config } from '../config';
import {
  datasourceSchemas,
  previewFeaturesOf,
  PRISMA_MAIN_SCHEMA,
  withDatasourceSchema,
  withPreviewFeature,
} from '../prisma-schema';
import { regionsOf } from '../markers';
import { keepRegions, type OrphanedRegion } from './keep-regions';
import { keptComposeServices } from './kept-compose-services';
import { keptRoleVocabulary } from './kept-role-vocabulary';
import { keptRoles } from './kept-roles';
import { withNamedImports } from './with-named-imports';
import { withSystemGrants } from './with-system-grants';

const ROLES = 'auth/roles/roles.ts';
const ROLE_VOCABULARY = 'auth/authorization/role.ts';
const COMPOSE = 'docker-compose.yml';

const UNREAD_ROLES =
  'it holds no object of roles the kit reads to its end, so its grants were left out, not half of them kept';

const NO_SYSTEM_GRANTS =
  'its roles have no list of [Role.System] to hold the region system-grants, so `generate job` leaves the grant of a system actor to a TODO';

/** What decides how the contexts are assembled: a line wired under one of them means nothing under another. */
const WIRING_CHOICES = ['di', 'style', 'assembly', 'http', 'routes'] as const;

/** What the contexts are wired into again from the tree: a line of another stack left out there is not a line lost. */
const WIRED_AGAIN = ['imports', 'contexts', 'routes', 'copies', 'exports'];

/** A file `init` rewrites: where its template puts it, what the template writes, what the file holds. */
export interface RewrittenFile {
  readonly target: string;
  readonly written: string;
  readonly existing: string;
}

/** The text to write in place of a file, and what it could not take from it. */
export interface KeptWiring {
  readonly text: string;
  readonly orphaned: readonly OrphanedRegion[];
}

/**
 * What `--force` writes in place of a file: the template of this version, with what the generators
 * and the team wrote in the regions of the file before, and in the few places of a file a generator
 * writes outside any region. The template changes around it from one version to the next: what
 * was wired stays. A flag that changes the ORM or the wiring leaves the lines written for the
 * other one out: they are wired again from the tree.
 */
export function keptWiring(config: Config, earlier: Config['stack'] | undefined, file: RewrittenFile): KeptWiring {
  const existing = file.existing.replaceAll('\r\n', '\n');

  if (earlier !== undefined && isWrittenForAnotherStack(config, earlier, file.target)) {
    return { text: file.written, orphaned: forAnotherStack(existing) };
  }

  const outside = keptOutsideRegions(config, { ...file, existing });
  const regions = keepRegions(outside.text, existing);

  return {
    text: withNamedImports(regions.text, existing, [...regions.kept, ...outside.kept]),
    orphaned: [...outside.orphaned, ...regions.orphaned],
  };
}

/** What a file held for the stack this run leaves, and that wiring the contexts again does not give back. */
function forAnotherStack(existing: string): OrphanedRegion[] {
  const lines = existing.split('\n');

  return regionsOf(lines)
    .filter(({ name }) => !WIRED_AGAIN.includes(name))
    .map(({ name, open, close }) => ({
      region: name,
      lines: lines.slice(open + 1, close).filter((line) => line.trim() !== ''),
      why: 'they were written for the stack this run leaves',
    }))
    .filter(({ lines: held }) => held.length > 0);
}

function isWrittenForAnotherStack(config: Config, earlier: Config['stack'], target: string): boolean {
  const { platformDir, stack } = config;
  const underAny = (folders: readonly string[]): boolean => folders.some((folder) => target.startsWith(folder));

  return (
    (earlier.orm !== stack.orm && underAny([`${platformDir}/database/`])) ||
    (WIRING_CHOICES.some((choice) => earlier[choice] !== stack[choice]) &&
      underAny([`${platformDir}/composition/`, `${platformDir}/privacy/`, 'test/architecture/', 'test/e2e/support/']))
  );
}

interface OutsideRegions {
  readonly text: string;
  /** What the text keeps of the file before: the imports it names go with it. */
  readonly kept: readonly string[];
  readonly orphaned: readonly OrphanedRegion[];
}

function keptOutsideRegions(config: Config, { target, written, existing }: RewrittenFile): OutsideRegions {
  const text = (kept: string): OutsideRegions => ({ text: kept, kept: [], orphaned: [] });

  switch (target) {
    case `${config.platformDir}/${ROLES}`:
      return roles(written, existing);
    case `${config.platformDir}/${ROLE_VOCABULARY}`:
      return text(keptRoleVocabulary(written, existing));
    case COMPOSE:
      return text(keptComposeServices(written, existing));
    case PRISMA_MAIN_SCHEMA:
      return text(keptDatasource(written, existing));
    default:
      return text(written);
  }
}

/** A `roles` the kit cannot read to its end leaves its grants to the team: nothing else says who held what. */
function roles(written: string, existing: string): OutsideRegions {
  const kept = keptRoles(written, existing);

  if (kept === undefined) {
    return { text: written, kept: [], orphaned: [{ region: 'roles', lines: [], why: UNREAD_ROLES }] };
  }

  const object = withSystemGrants(kept.grants);

  return object === undefined
    ? {
        text: kept.text,
        kept: [kept.grants],
        orphaned: [{ region: 'system-grants', lines: [], why: NO_SYSTEM_GRANTS }],
      }
    : { text: kept.text.replace(kept.grants, () => object), kept: [object], orphaned: [] };
}

/** The datasource of the main Prisma file keeps the database schema of each context, the generator its preview features. */
function keptDatasource(written: string, existing: string): string {
  const withSchemas = datasourceSchemas(existing).reduce(withDatasourceSchema, written);

  return previewFeaturesOf(existing).reduce(withPreviewFeature, withSchemas);
}
