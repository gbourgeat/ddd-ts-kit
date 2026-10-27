import type { Stack } from '../config';
import { installScriptsOf } from './manifest/install-scripts-of';
import { stackSandbox } from './stack-sandbox';

/**
 * Who runs the first install under the regulated profile, and why: the owner, outside the agent.
 * What the sandbox lets a command write and reach for the install is said from the stack, with the
 * two cases where the project file is not enough (Claude Code docs, sandboxing and settings
 * reference, read on 2026-10-27; the missing path was seen on Linux with Claude Code 2.1.311).
 */
export function firstInstallNote(stack: Stack): string {
  const { writes, hosts } = stackSandbox(stack);
  const install = `${stack.packageManager} install`;

  const scripts = [
    ...(stack.orm === 'prisma' ? ['the engines of Prisma from binaries.prisma.sh'] : []),
    ...(stack.broker === 'kafka'
      ? ['the prebuilt client of Kafka from github.com and release-assets.githubusercontent.com']
      : []),
  ];

  return [
    `Run the first \`${install}\` of this project yourself, outside the agent, before its first session in the sandbox of the regulated profile.`,
    `The sandbox lets a command write ${writes.join(', ')}${hosts.length > 0 ? ` and reach ${hosts.join(', ')}` : ''}, but a path missing when the session starts stays read-only for the whole session: the first install creates it.`,
    ...(scripts.length > 0
      ? [`It also runs the install scripts of the stack under your eyes: ${scripts.join('; ')}.`]
      : []),
    ...pinNote(stack),
    ...(stack.broker === 'kafka'
      ? [
          'Where no prebuilt binary fits the machine, @confluentinc/kafka-javascript builds librdkafka from sources (a compiler, ~/.cache/node-gyp, nodejs.org, zlib.net and curl.se), which the sandbox does not allow: that install runs outside the agent every time.',
        ]
      : []),
    'When the managed settings, or the --settings of a session, set sandbox.allowUnsandboxedCommands to false (or the managed settings set sandbox.network.allowManagedDomainsOnly), the sandbox is admin-required and Claude Code ignores sandbox.filesystem.allowWrite and sandbox.network.allowedDomains of .claude/settings.json: copy them into the managed settings.',
  ].join(' ');
}

/**
 * Init allows the install scripts of the stack by name, the one form it can write before the
 * install resolves the versions. The profile narrows each to the version the owner read, so that a
 * later release runs its script only once someone read it too (npm 11.19.1 and pnpm 12.11.2:
 * `approve` turns a name into the installed version, pnpm honours a key with its version).
 */
function pinNote(stack: Stack): string[] {
  const names = installScriptsOf(stack).map(({ name }) => name);

  if (names.length === 0) {
    return [];
  }

  const pin =
    stack.packageManager === 'pnpm'
      ? `write each of ${names.join(', ')} with the version installed (\`pnpm why <package>\`) in allowBuilds of pnpm-workspace.yaml, \`'<package>@<version>': true\` in place of its name`
      : `\`npm install-scripts approve ${names.join(' ')}\` turns the names init wrote in allowScripts of package.json into the versions installed`;

  const meanwhile =
    stack.packageManager === 'pnpm' ? 'pnpm skips the new script' : 'npm 11.19 runs the new script with a warning';

  return [
    `Then pin these scripts to the versions you read: ${pin}. A bump of one of them, a Dependabot pull request for one, then needs the same step again once its new script was read: until then \`npx ddd-ts-kit doctor\` reports it and ${meanwhile}.`,
  ];
}
