import type { Stack } from '../config';
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
    ...(stack.broker === 'kafka'
      ? [
          'Where no prebuilt binary fits the machine, @confluentinc/kafka-javascript builds librdkafka from sources (a compiler, ~/.cache/node-gyp, nodejs.org, zlib.net and curl.se), which the sandbox does not allow: that install runs outside the agent every time.',
        ]
      : []),
    'When the managed settings, or the --settings of a session, set sandbox.allowUnsandboxedCommands to false (or the managed settings set sandbox.network.allowManagedDomainsOnly), the sandbox is admin-required and Claude Code ignores sandbox.filesystem.allowWrite and sandbox.network.allowedDomains of .claude/settings.json: copy them into the managed settings.',
  ].join(' ');
}
