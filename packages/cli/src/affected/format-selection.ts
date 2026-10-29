import type { Selection } from './selection';
import { stdoutJson } from '../json/stdout-json';

/** Lets a partial run pass when a selected context has no spec of one kind. */
export const PARTIAL_RUN = '--passWithNoTests';
const ENV_PREFIX = 'AFFECTED_';

/**
 * The selection for a reader (`text`), as data (`json`), or as `key=value` lines: `github` for
 * `$GITHUB_OUTPUT`, `env` (keys in upper case behind `AFFECTED_`) for a GitLab `dotenv` report.
 * The keys: `scope` (`all`, `contexts` or `none`); `contexts`, comma separated, which the test
 * runner reads as `DDD_TS_KIT_AFFECTED` (empty for `all`: nothing is left out); `args`, the
 * arguments a partial run adds to the test runner; `lint`, the ones it adds to the linter.
 */
export function formatSelection(selection: Selection, format: string): string {
  if (format === 'json') {
    return stdoutJson(selection);
  }

  if (format === 'text') {
    return text(selection);
  }

  const key = (name: string): string => (format === 'env' ? `${ENV_PREFIX}${name.toUpperCase()}` : name);

  return Object.entries(values(selection))
    .map(([name, value]) => `${key(name)}=${value}`)
    .join('\n');
}

function values(selection: Selection): Record<string, string> {
  const partial = selection.scope === 'contexts';

  return {
    scope: selection.scope,
    contexts: partial ? selection.contexts.join(',') : '',
    args: partial ? PARTIAL_RUN : '',
    lint: selection.leftOut.map((directory) => `--ignore-pattern ${directory}`).join(' '),
  };
}

function text(selection: Selection): string {
  if (selection.scope === 'all') {
    return `Everything is affected: ${selection.reason}.`;
  }

  if (selection.scope === 'none') {
    return `Nothing that runs is affected: ${selection.reason}.`;
  }

  return [
    `Affected contexts: ${selection.contexts.join(', ')} (${selection.reason}).`,
    `Specs: ${selection.specs.join(' ')}`,
    `Left to the default branch: ${selection.leftOut.join(' ')}`,
  ].join('\n');
}
