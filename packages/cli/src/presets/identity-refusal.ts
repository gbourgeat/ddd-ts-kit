import type { Config } from '../config/index.js';
import type { PresetRefusal } from './preset-refusal.js';

/** What the identity preset is written for, each with the value it needs and the flag of `init` that gives it. */
const NEEDED: readonly {
  readonly key: keyof Config['stack'];
  readonly values: readonly string[];
  readonly flag: string;
}[] = [
  { key: 'style', values: ['declared'], flag: '--style declared' },
  { key: 'dependencies', values: ['signature'], flag: '--dependencies signature' },
  { key: 'refusals', values: ['named', 'factories'], flag: '--refusals named or --refusals factories' },
  { key: 'valueObjects', values: ['throwing'], flag: '--value-objects throwing' },
  { key: 'routes', values: ['controllers'], flag: '--routes controllers' },
  { key: 'orm', values: ['knex', 'drizzle'], flag: '--orm knex or --orm drizzle' },
  { key: 'validation', values: ['zod', 'class-validator'], flag: '--validation zod or --validation class-validator' },
  { key: 'http', values: ['express', 'fastify'], flag: '--http express or --http fastify' },
  {
    key: 'authn',
    values: ['jwt', 'keycloak'],
    flag: '--authn jwt or --authn keycloak (an account is the subject of a token)',
  },
  { key: 'database', values: ['postgres'], flag: '--database postgres (its tables use partial unique indexes)' },
];

/** The identity preset is written for the defaults of `init` and their nearest variants; another stack is refused with what to change. */
export function identityRefusal(config: Config): PresetRefusal | undefined {
  const missing = NEEDED.find(({ key, values }) => !values.includes(config.stack[key]));

  if (missing === undefined) {
    return undefined;
  }

  return {
    message: `The identity preset is not written for "stack.${missing.key}": "${config.stack[missing.key]}".`,
    fix: `It needs ${missing.flag}, which init writes by default (docs/guides/bootstrap-with-well-designed-contexts.md says why). Otherwise, generate the context empty and build it with the generators.`,
  };
}
