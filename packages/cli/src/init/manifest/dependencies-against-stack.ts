import type { Stack } from '../../config';
import { isRecord } from '../is-record';

/** A key of the stack, its flag, and the packages whose presence in a package.json says its value. */
interface Clue {
  readonly flag: string;
  readonly key: keyof Stack;
  readonly packages: Readonly<Record<string, string>>;
}

/** What a direct dependency of an existing project says about each key `init` writes for it. */
export const CLUES: readonly Clue[] = [
  {
    flag: '--http',
    key: 'http',
    packages: { express: 'express', fastify: 'fastify', hono: 'hono', '@nestjs/core': 'nest' },
  },
  {
    flag: '--validation',
    key: 'validation',
    packages: {
      zod: 'zod',
      'class-validator': 'class-validator',
      '@sinclair/typebox': 'typebox',
      typebox: 'typebox',
      valibot: 'standard-schema',
      arktype: 'standard-schema',
    },
  },
  { flag: '--di', key: 'di', packages: { tsyringe: 'tsyringe', '@nestjs/core': 'nest' } },
  { flag: '--tests', key: 'tests', packages: { vitest: 'vitest', jest: 'jest' } },
  {
    flag: '--orm',
    key: 'orm',
    packages: {
      'drizzle-orm': 'drizzle',
      knex: 'knex',
      '@prisma/client': 'prisma',
      prisma: 'prisma',
      typeorm: 'typeorm',
    },
  },
  {
    flag: '--database',
    key: 'database',
    packages: { pg: 'postgres', postgres: 'postgres', mysql2: 'mysql', 'better-sqlite3': 'sqlite', mongodb: 'mongodb' },
  },
  {
    flag: '--broker',
    key: 'broker',
    packages: { amqplib: 'rabbitmq', 'amqp-connection-manager': 'rabbitmq', kafkajs: 'kafka', nats: 'nats' },
  },
  {
    flag: '--authn',
    key: 'authn',
    packages: { 'keycloak-connect': 'keycloak', jose: 'jwt', jsonwebtoken: 'jwt', 'passport-jwt': 'passport' },
  },
  { flag: '--logger', key: 'logger', packages: { pino: 'pino', winston: 'winston' } },
  { flag: '--errors', key: 'errors', packages: { '@sentry/node': 'sentry' } },
  { flag: '--storage', key: 'storage', packages: { '@aws-sdk/client-s3': 's3' } },
];

/**
 * What the direct dependencies of an existing package.json say against the stack `init` is about
 * to write for it, one line per key they contradict: the flag to pass when the project keeps what
 * it runs on. Nothing when they agree or say nothing. A key two packages answer differently is
 * left to the owner, and said. The rights model (`--authz`) is never read from a dependency.
 */
export function dependenciesAgainstStack(manifest: string, stack: Stack): string[] {
  const installed = dependencyNames(parsed(manifest));

  return CLUES.flatMap((clue) => {
    const found = installed.filter((name) => clue.packages[name] !== undefined);
    const values = [...new Set(found.map((name) => clue.packages[name]))];
    const written = stack[clue.key];

    if (values.length === 0 || values.includes(written)) {
      return [];
    }

    const packages = listed(found);

    return values.length === 1
      ? [
          `package.json depends on ${packages}, and the project is written for ${clue.flag} ${written}: pass ${clue.flag} ${values[0] ?? ''} to keep it.`,
        ]
      : [
          `package.json depends on ${packages}: ${clue.flag} says which one the project is written for (${written} now, without the flag).`,
        ];
  });
}

function parsed(manifest: string): unknown {
  try {
    return JSON.parse(manifest);
  } catch {
    return undefined;
  }
}

function dependencyNames(manifest: unknown): string[] {
  if (!isRecord(manifest)) {
    return [];
  }

  return ['dependencies', 'devDependencies'].flatMap((field) => {
    const block = manifest[field];

    return isRecord(block) ? Object.keys(block) : [];
  });
}

function listed(names: readonly string[]): string {
  const unique = [...new Set(names)];

  return unique.length === 1 ? (unique[0] ?? '') : `${unique.slice(0, -1).join(', ')} and ${unique.at(-1) ?? ''}`;
}
