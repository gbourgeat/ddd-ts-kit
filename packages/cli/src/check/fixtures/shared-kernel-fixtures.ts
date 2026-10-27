import { CONFIG_FILE } from '../../config';
import { config } from './config';
import { errorsRoute as route } from './errors-route';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { MONEY_GLOSSARY, SHARED_KERNEL_GLOSSARY as GLOSSARY } from './shared-kernel-glossary';
import { source } from './source';

const { ROUTE } = PATHS;
const NAMED = { [CONFIG_FILE]: config({ stack: { refusals: 'named' } }) };

const KERNEL = 'src/shared-kernel';
const MONEY = `${KERNEL}/money.vo.ts`;
const INVALID_MONEY = `${KERNEL}/invalid-money.error.ts`;
const CODES = `${KERNEL}/shared-kernel.codes.ts`;

const valueObject = (name: string): string =>
  source(
    "import { ValueObject } from '@ddd-ts-kit/kernel';",
    '',
    `export class ${name} extends ValueObject<{ readonly cents: number }> {}`,
  );

/** The refusal of a value of the shared kernel, its code read from the code list of the shared kernel. */
const refusal = (name: string): string =>
  source(
    "import { DomainRefusal } from '@ddd-ts-kit/kernel';",
    "import { SharedKernelCodes } from '@/shared-kernel/shared-kernel.codes.js';",
    '',
    `export class ${name} extends DomainRefusal {`,
    `  readonly code = SharedKernelCodes.${name};`,
    '}',
  );

const codes = source(
  'export const SharedKernelCodes = {',
  "  InvalidMoney: 'INVALID_MONEY',",
  '} as const;',
  '',
  'export type SharedKernelCode = (typeof SharedKernelCodes)[keyof typeof SharedKernelCodes];',
);

export const SHARED_KERNEL_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'language/glossary-term',
    name: 'a value object of the shared kernel and its refusal, named with the terms of its glossary',
    expect: 'pass',
    files: project(
      {
        ...MONEY_GLOSSARY,
        [MONEY]: valueObject('Money'),
        [INVALID_MONEY]: refusal('InvalidMoney'),
        [CODES]: codes,
        // A schema of the contract and a helper without a role are not concepts of the model.
        [`${KERNEL}/presentation/amount-line.schema.ts`]: 'export class AmountLine {}\n',
        [`${KERNEL}/storable-stamp.ts`]: 'export class StorableStamp {}\n',
      },
      NAMED,
    ),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'a value object of the shared kernel named with a word its glossary does not define',
    expect: { file: `${KERNEL}/interest-rate.vo.ts` },
    files: project({
      ...MONEY_GLOSSARY,
      [`${KERNEL}/interest-rate.vo.ts`]: valueObject('InterestRate'),
    }),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'a value object in a shared kernel without a glossary',
    expect: { file: GLOSSARY },
    files: project({ [MONEY]: valueObject('Money') }),
  },
  {
    ruleId: 'errors/known-code',
    name: 'a route declaring a code the shared kernel lists',
    expect: 'pass',
    files: project(
      {
        ...MONEY_GLOSSARY,
        [INVALID_MONEY]: refusal('InvalidMoney'),
        [CODES]: codes,
        [ROUTE]: route('INVALID_MONEY'),
      },
      NAMED,
    ),
  },
];
