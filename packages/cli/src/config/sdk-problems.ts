import type { CommitLimitProblem } from './commit-limit-problems.js';
import { DEFAULT_SDK_NAME } from './default-sdk-name.js';
import { SDK_ACCESSES } from './sdk-accesses.js';
import { isRecord } from './values/is-record.js';

/** A name npm takes once `{project}` and `{document}` are replaced: lower case, an optional scope. */
const PACKAGE_NAME = /^(?:@[a-z0-9{][a-z0-9-._{}~]*\/)?[a-z0-9{][a-z0-9-._{}~]*$/;

/** What the raw `sdk` value of a config says that `ddd-ts-kit sdk` would not do as written. */
export function sdkProblems(value: unknown): CommitLimitProblem[] {
  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    return [
      {
        key: 'sdk',
        message: '"sdk" is not an object: no client is generated.',
        fix: `Write it as { "name": "${DEFAULT_SDK_NAME}" }, or remove it.`,
      },
    ];
  }

  return [...nameProblems(value['name']), ...accessProblems(value['access'], value['name'])];
}

function nameProblems(name: unknown): CommitLimitProblem[] {
  if (name === undefined || (typeof name === 'string' && PACKAGE_NAME.test(name) && name.includes('{document}'))) {
    return [];
  }

  return [
    {
      key: 'sdk',
      message: `"sdk.name" is ${JSON.stringify(name)}: npm takes no such package name, or two documents of the contract would share it.`,
      fix: 'Write a lower-case name holding "{document}", scoped or not: "@acme/{project}-{document}-client".',
    },
  ];
}

function accessProblems(access: unknown, name: unknown): CommitLimitProblem[] {
  if (access !== undefined && !SDK_ACCESSES.some((known) => known === access)) {
    return [
      {
        key: 'access',
        message: `"sdk.access" is ${JSON.stringify(access)}: npm publishes with ${SDK_ACCESSES.join(' or ')} access.`,
        fix: `Use one of: ${SDK_ACCESSES.join(', ')}, or remove it.`,
      },
    ];
  }

  const scoped = typeof name === 'string' ? name.startsWith('@') : DEFAULT_SDK_NAME.startsWith('@');

  return access === 'restricted' && !scoped
    ? [
        {
          key: 'access',
          message:
            '"sdk.access" is "restricted" for a package without a scope: npm publishes such a package for everyone or not at all.',
          fix: 'Scope the name ("@acme/{project}-{document}-client"), or write "public".',
        },
      ]
    : [];
}
