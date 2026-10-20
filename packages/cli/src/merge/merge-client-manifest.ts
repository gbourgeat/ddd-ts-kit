import { isRecord } from '../config/values/is-record.js';
import { manifestJson } from '../sdk/manifest-json.js';
import { higherVersion } from './higher-version.js';

/** What a conflict on the package.json of a client settles to: the trunk's file at the kept version, or why a person decides. */
export type ClientManifestMerge =
  | { readonly content: string; readonly how: string }
  | { readonly content?: undefined; readonly why: string };

/**
 * The package.json of a generated client is written by `sdk` but for its version, which the team
 * raises before it publishes, and which `regenerate` keeps as it finds it. Taking the trunk's file
 * whole would drop a version this branch raised: the trunk's file is kept with the higher of the
 * two versions. A side whose version is not a semantic version leaves the choice to a person.
 */
export function mergeClientManifest(ours: string, theirs: string): ClientManifestMerge {
  const trunk = manifestOf(theirs);
  const branchVersion = versionOf(manifestOf(ours));
  const trunkVersion = versionOf(trunk);

  if (trunk === undefined || branchVersion === undefined || trunkVersion === undefined) {
    return { why: 'a side is not a package.json with a version' };
  }

  const kept = higherVersion(trunkVersion, branchVersion);

  if (kept === undefined) {
    return {
      why: `the version of a side is not a semantic version (${branchVersion} on this branch, ${trunkVersion} on the trunk)`,
    };
  }

  const how = `client package.json: trunk side, version ${kept} kept, the higher of ${branchVersion} on this branch and ${trunkVersion} on the trunk`;

  return { content: kept === trunkVersion ? theirs : manifestJson({ ...trunk, version: kept }), how };
}

function manifestOf(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);

    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function versionOf(manifest: Record<string, unknown> | undefined): string | undefined {
  const version = manifest?.['version'];

  return typeof version === 'string' ? version : undefined;
}
