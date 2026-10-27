/** One entry of `allowBuilds` in pnpm-workspace.yaml: a package, by name or with its versions, allowed or denied. */
export interface AllowBuildsEntry {
  readonly key: string;
  readonly allowed: boolean;
}

/** The entries of that block, `'<package>': true` or `false`, quoted or not. */
export function allowBuildsEntries(block: string): AllowBuildsEntry[] {
  return [...block.matchAll(/^[ \t]+(['"]?)(.+?)\1:[ \t]*(true|false)[ \t]*$/gm)].map(([, , key = '', value]) => ({
    key,
    allowed: value === 'true',
  }));
}
