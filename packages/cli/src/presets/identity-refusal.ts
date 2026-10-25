import type { Config } from '../config';
import type { PresetRefusal } from './preset-refusal';

/** What the identity preset is written for, each with the value it needs and the flag of `init` that gives it. */
const NEEDED: readonly {
  readonly key: keyof Config['stack'];
  readonly values: readonly string[];
  readonly flag: string;
  /** Read in the declared style only: the explicit one lists what each class is given in its module file. */
  readonly declaredOnly?: boolean;
}[] = [
  { key: 'dependencies', values: ['signature'], flag: '--dependencies signature', declaredOnly: true },
  { key: 'refusals', values: ['named', 'factories'], flag: '--refusals named or --refusals factories' },
  { key: 'valueObjects', values: ['throwing'], flag: '--value-objects throwing' },
  { key: 'routes', values: ['controllers'], flag: '--routes controllers' },
  { key: 'orm', values: ['knex', 'drizzle', 'prisma'], flag: '--orm knex, --orm drizzle or --orm prisma' },
  { key: 'validation', values: ['zod', 'class-validator'], flag: '--validation zod or --validation class-validator' },
  { key: 'http', values: ['express', 'fastify', 'nest'], flag: '--http express, --http fastify or --http nest' },
  {
    key: 'authn',
    values: ['jwt', 'keycloak'],
    flag: '--authn jwt or --authn keycloak (an account is the subject of a token)',
  },
  { key: 'database', values: ['postgres'], flag: '--database postgres (its tables use partial unique indexes)' },
];

/** The identity preset is written for the defaults of `init` and their nearest variants; another stack is refused with what to change. */
export function identityRefusal(config: Config): PresetRefusal | undefined {
  const { style, di } = config.stack;

  if (style === 'explicit' && di === 'tsyringe') {
    return {
      message: 'The identity preset is not written for "stack.style": "explicit" with "stack.di": "tsyringe".',
      fix: 'In the explicit style it is written for --di manual and --di nest, whose module file lists every binding; on tsyringe, keep --style declared, which init writes by default (docs/guides/bootstrap-with-well-designed-contexts.md says why).',
    };
  }

  const missing = NEEDED.find(
    ({ key, values, declaredOnly }) =>
      (declaredOnly !== true || style === 'declared') && !values.includes(config.stack[key]),
  );

  if (missing === undefined) {
    return undefined;
  }

  return {
    message: `The identity preset is not written for "stack.${missing.key}": "${config.stack[missing.key]}".`,
    fix: `It needs ${missing.flag}, which init writes by default (docs/guides/bootstrap-with-well-designed-contexts.md says why). Otherwise, generate the context empty and build it with the generators.`,
  };
}
