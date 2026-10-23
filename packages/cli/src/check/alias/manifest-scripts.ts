import { isRecord } from '../support/is-record';
import type { Inspected } from './inspected';
import { ALIAS_FILES } from './alias-files';
import { parseJsonc } from './parse-jsonc';
import { readProjectFile } from './read-project-file';

export interface ManifestScripts {
  /** The text of package.json, to place a finding on its line. */
  readonly text: string;
  readonly manifest: Readonly<Record<string, unknown>>;
  /** The scripts whose command is a string, by name. */
  readonly scripts: readonly (readonly [string, string])[];
}

/** package.json as the parts of the rule read it; nothing when it is absent or unreadable. */
export function manifestScripts({ project }: Inspected): ManifestScripts | undefined {
  const text = readProjectFile(project, ALIAS_FILES.manifest);
  const manifest = text === undefined ? undefined : parseJsonc(text);

  if (text === undefined || manifest === undefined) {
    return undefined;
  }

  const scripts = isRecord(manifest['scripts']) ? Object.entries(manifest['scripts']) : [];

  return {
    text,
    manifest,
    scripts: scripts.flatMap(([name, command]) => (typeof command === 'string' ? [[name, command] as const] : [])),
  };
}
