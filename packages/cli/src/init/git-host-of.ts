import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git.js';
import { isRecord } from './is-record.js';

/** The hosts the shorthands of `package.json` stand for. */
const SHORTHANDS: Readonly<Record<string, string>> = {
  github: 'github.com',
  gitlab: 'gitlab.com',
  bitbucket: 'bitbucket.org',
  gist: 'gist.github.com',
};

/**
 * The host of the git repository of the project, where the agent pushes: from `repository` of
 * package.json (a URL, or a shorthand such as `github:owner/name`), else from the `origin`
 * remote of the clone; nothing when neither says.
 */
export function gitHostOf(root: string): string | undefined {
  const declared = repositoryOf(root);
  const remote = declared === undefined ? runGit(root, ['remote', 'get-url', 'origin'])?.trim() : undefined;
  const url = declared ?? remote;

  return url === undefined || url === '' ? undefined : hostOf(url);
}

function repositoryOf(root: string): string | undefined {
  try {
    const manifest: unknown = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const repository = isRecord(manifest) ? manifest['repository'] : undefined;

    if (typeof repository === 'string') {
      return repository;
    }

    return isRecord(repository) && typeof repository['url'] === 'string' ? repository['url'] : undefined;
  } catch {
    return undefined;
  }
}

/** `https://host/...`, `git+ssh://git@host/...`, `git@host:owner/name.git`, `github:owner/name` or `owner/name` (GitHub). */
function hostOf(url: string): string | undefined {
  const shorthand = /^([a-z]+):[^/]+\/[^/]+$/i.exec(url);

  if (shorthand !== null) {
    return SHORTHANDS[(shorthand[1] ?? '').toLowerCase()];
  }

  if (/^[\w.-]+\/[\w.-]+$/.test(url)) {
    return SHORTHANDS['github'];
  }

  const scp = /^[\w.-]+@([\w.-]+):/.exec(url);

  if (scp !== null) {
    return scp[1];
  }

  try {
    const { hostname } = new URL(url.replace(/^git\+/, ''));

    return hostname === '' ? undefined : hostname;
  } catch {
    return undefined;
  }
}
