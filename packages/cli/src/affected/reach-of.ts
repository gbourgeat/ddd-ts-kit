import type { Config } from '../config';
import type { PathReach } from './path-reach';
import { ownEntry } from '../config/values/own-entry';

/** Written for people and agents, never loaded by a spec, a build or a tool of the pipeline other than the documents gate, which always runs. */
const DOCUMENT_DIRECTORIES = ['docs/', 'openapi/', '.claude/', '.github/instructions/', '.github/copilot/'];

/**
 * What a changed path, relative to the project root, reaches. A path under a declared context
 * reaches that context; a document reaches nothing; anything else (the shared kernel, the
 * platform, the composition root, the configuration, the lockfile, the tooling, the pipeline, a
 * context the config does not declare, a path nobody listed) reaches everything.
 */
export function reachOf(config: Config, file: string): PathReach {
  const contexts = `${config.contextsDir}/`;

  if (file.startsWith(contexts)) {
    return contextReach(config, file.slice(contexts.length));
  }

  if (isDocument(file)) {
    return { kind: 'nothing' };
  }

  return { kind: 'everything', reason: `${file} is shared by every context` };
}

function contextReach(config: Config, inside: string): PathReach {
  const [context = '', ...rest] = inside.split('/');

  if (rest.length === 0 || ownEntry(config.contexts, context) === undefined) {
    return { kind: 'everything', reason: `${config.contextsDir}/${inside} belongs to no declared context` };
  }

  return { kind: 'context', context, testsOnly: rest[0] === 'test' };
}

function isDocument(file: string): boolean {
  const atRoot = !file.includes('/');

  return (atRoot && file.endsWith('.md')) || DOCUMENT_DIRECTORIES.some((directory) => file.startsWith(directory));
}
