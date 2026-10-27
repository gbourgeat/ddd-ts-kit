import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers';
import { failure, report } from './reports';
import { initProject } from './support/init-project';

const KERNEL = 'src/shared-kernel';
const GLOSSARY = `${KERNEL}/CONTEXT.md`;
const MONEY = ['--term', 'Money=An amount in whole cents'];

/** `generate <kind> shared-kernel ...` with a report in JSON. */
const generate = (root: string, kind: string, ...args: string[]) =>
  cli(root, 'generate', kind, 'shared-kernel', ...args, '--json');

describe('generate in the shared kernel', () => {
  let root: string;

  beforeAll(() => {
    root = initProject('--context', 'lending:core', '--context', 'ledger:supporting');
  });

  it('refuses a value object whose term no glossary defines, and names the flag that defines it', () => {
    const refused = failure(generate(root, 'value-object', 'Money'));

    expect(refused.message).toBe(`"Money" uses "money", which the glossary of ${GLOSSARY} does not define.`);
    expect(refused.fix).toContain('--term "Money=<what it means for the business>"');
    expect(exists(root, GLOSSARY)).toBe(false);
  });

  it('writes a value object at its root, its spec beside it, and its term in the glossary of the shared kernel', () => {
    const written = report(generate(root, 'value-object', 'Money', ...MONEY));

    expect(written.created).toEqual([`${KERNEL}/money.vo.ts`, `${KERNEL}/money.vo.spec.ts`]);
    expect(written.updated).toEqual([GLOSSARY]);
    expect(read(root, `${KERNEL}/money.vo.ts`)).toContain('export class Money extends ValueObject<MoneyProps> {');

    expect(read(root, `${KERNEL}/money.vo.ts`)).toContain(
      '`ddd-ts-kit generate error shared-kernel InvalidMoney forValue`',
    );

    expect(read(root, `${KERNEL}/money.vo.spec.ts`)).toContain("import { Money } from '@/shared-kernel/money.vo';");
    expect(read(root, GLOSSARY)).toContain('# Shared kernel\n');
    expect(read(root, GLOSSARY)).toContain('| Money | An amount in whole cents |  |');
  });

  it('writes a refusal of the shared kernel with its code in the code list of the shared kernel', () => {
    const written = report(generate(root, 'error', 'InvalidMoney', 'forCents'));

    expect(written.created).toEqual([
      `${KERNEL}/shared-kernel.codes.ts`,
      `${KERNEL}/invalid-money.error.ts`,
      `${KERNEL}/invalid-money.error.spec.ts`,
    ]);

    expect(read(root, `${KERNEL}/shared-kernel.codes.ts`)).toContain(
      "export const SharedKernelCodes = {\n  InvalidMoney: 'INVALID_MONEY',\n} as const;",
    );

    expect(read(root, `${KERNEL}/invalid-money.error.ts`).split('\n').slice(0, 5)).toEqual([
      "import { DomainRefusal } from '@ddd-ts-kit/kernel';",
      "import { SharedKernelCodes } from '@/shared-kernel/shared-kernel.codes';",
      '',
      'export class InvalidMoney extends DomainRefusal {',
      '  readonly code = SharedKernelCodes.InvalidMoney;',
    ]);

    expect(read(root, `${KERNEL}/invalid-money.error.spec.ts`)).toContain(
      "import { InvalidMoney } from '@/shared-kernel/invalid-money.error';",
    );
  });

  it('leaves a project whose shared kernel was generated clean, its names read from its glossary', () => {
    expect(cli(root, 'check').code).toBe(0);

    write(
      root,
      `${KERNEL}/interest-rate.vo.ts`,
      read(root, `${KERNEL}/money.vo.ts`).replaceAll('Money', 'InterestRate'),
    );

    const checked = cli(root, 'check');

    expect(checked.code).not.toBe(0);

    expect(checked.stdout).toContain(
      'InterestRate uses "interest", "rate", which the glossary of the shared kernel does not define.',
    );
  });

  it('refuses a kind the shared kernel does not hold, and says what it holds', () => {
    const refused = failure(generate(root, 'aggregate', 'Loan'));

    expect(refused.message).toBe(
      '"shared-kernel" names the shared kernel (src/shared-kernel), which holds no file of this kind.',
    );

    expect(refused.fix).toContain('`generate value-object|domain-error|error|schema shared-kernel ...`');
    expect(refused.fix).toContain('the context that owns it: lending, ledger.');
  });

  it('is a shared write, refused to a run confined to a context', () => {
    const refused = failure(
      generate(root, 'value-object', 'Rate', '--term', 'Rate=A yearly percentage', '--local-only'),
    );

    expect(refused.message).toContain(`${KERNEL}/rate.vo.ts`);
    expect(exists(root, `${KERNEL}/rate.vo.ts`)).toBe(false);
  });

  it('stays flat when a context is divided into the modules of its model', () => {
    expect(cli(root, 'generate', 'module', 'lending', 'loans', '--term', 'Loans=The money lent').code).toBe(0);

    expect(report(generate(root, 'value-object', 'Rate', '--term', 'Rate=A yearly percentage')).created).toEqual([
      `${KERNEL}/rate.vo.ts`,
      `${KERNEL}/rate.vo.spec.ts`,
    ]);
  });
});

describe.each([
  ['factories', ['error', 'Money', 'negativeCents'], ['money.error.ts', 'money.error.spec.ts']],
  [
    'classes',
    ['domain-error', 'InvalidMoney', '--allow-name'],
    ['invalid-money.error.ts', 'invalid-money.error.spec.ts'],
  ],
])('generate a refusal of the shared kernel, under "stack.refusals": "%s"', (refusals, args, files) => {
  it('writes the error class and its spec at the root of the shared kernel', () => {
    const root = initProject('--context', 'lending:core');
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { stack: Record<string, unknown> };

    config.stack['refusals'] = refusals;
    write(root, 'ddd-ts-kit.config.json', JSON.stringify(config, null, 2));

    const [kind = '', ...rest] = args;
    const written = report(generate(root, kind, ...rest, ...MONEY));

    expect(written.created).toEqual(files.map((file) => `${KERNEL}/${file}`));
    expect(written.updated).toEqual([GLOSSARY]);
  });
});
