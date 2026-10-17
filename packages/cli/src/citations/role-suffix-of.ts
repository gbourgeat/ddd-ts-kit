/**
 * Role suffixes by the part their role plays for a use case. A design written with one of a
 * part and code built with another of the same part (a service that became a port) name one
 * thing; a policy and a reader, or a command and its handler, name two.
 */
const PARTS: Readonly<Record<string, string>> = {
  Service: 'collaborator',
  Port: 'collaborator',
  Reader: 'collaborator',
  Repository: 'collaborator',
  Gateway: 'collaborator',
  Adapter: 'collaborator',
  EventHandler: 'reaction',
  IntegrationHandler: 'reaction',
  Projection: 'reaction',
  Process: 'reaction',
  Job: 'work by time',
  BackgroundJob: 'work by time',
};

/** A role suffix a name ends with (the longest), and the part its role plays. */
export interface RoleSuffix {
  readonly suffix: string;
  readonly part: string;
}

/** The role suffix a name ends with after one word at least; undefined when it ends with none of a part. */
export function roleSuffixOf(name: string): RoleSuffix | undefined {
  const [suffix] = Object.keys(PARTS)
    .filter((candidate) => name.endsWith(candidate) && name.length > candidate.length)
    .sort((a, b) => b.length - a.length);

  const part = suffix === undefined ? undefined : PARTS[suffix];

  return suffix === undefined || part === undefined ? undefined : { suffix, part };
}
