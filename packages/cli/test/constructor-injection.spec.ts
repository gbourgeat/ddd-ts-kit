import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { refreshDeclarations } from '../src/dev/refresh-declarations';
import { cli, exists, read, scaffoldEverything, tempDir, write } from './helpers';
import { checkJsonOf } from './check-support';
import { initProject } from './support/init-project';

const BILLING = 'src/contexts/billing';
/** The declarations of the folder the handler sits in, where its list is registered. */
const BARREL = `${BILLING}/application/application.declarations.ts`;
const HANDLER = `${BILLING}/application/commands/cancel-invoice/cancel-invoice.handler.ts`;
const RULE = 'declarations/constructor-injection';

let root: string;

/** The cancel-invoice handler with no constructor: generated, it asks the policy of its permission through `Access`. */
const TAKING_NOTHING = [
  "import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';",
  "import { CancelInvoiceCommand } from '@/contexts/billing/application/commands/cancel-invoice/cancel-invoice.command';",
  '',
  '@CommandHandler(CancelInvoiceCommand)',
  'export class CancelInvoiceHandler implements CommandHandler<CancelInvoiceCommand> {',
  '  async execute(): Promise<void> {}',
  '}',
  '',
].join('\n');

beforeAll(() => {
  root = tempDir('constructor-injection');
  scaffoldEverything(root);
  write(root, HANDLER, TAKING_NOTHING);
  cli(root, 'docs');
});

describe('the generated list of a constructor follows the code, and a gate says when it does not', () => {
  const stale = () => checkJsonOf(cli(root, 'check', '--rule', 'declarations/barrel-current', '--json')).violations;

  const original = (): string => {
    cli(root, 'docs');

    return read(root, HANDLER);
  };

  it('fails `check` and `docs --check`, naming the class and the command, when a constructor changes without regeneration; passes once regenerated', () => {
    const before = original();

    write(
      root,
      HANDLER,
      taking('private readonly invoiceRepository: InvoiceRepository', 'private readonly clock: Clock'),
    );

    const [checked] = stale();
    const documented = cli(root, 'docs', '--check');

    expect(checked?.message).toBe(
      'The declarations of "billing" in application/ are stale: it registers no dependency list for CancelInvoiceHandler, whose constructor takes [InvoiceRepository, Clock].',
    );

    expect(checked?.fix).toContain('Run `ddd-ts-kit docs`');
    expect(documented.code).toBe(1);

    expect(documented.stdout).toContain(
      `stale  ${BARREL}: it registers no dependency list for CancelInvoiceHandler, whose constructor takes [InvoiceRepository, Clock]`,
    );

    expect(documented.stdout).toContain('Run `ddd-ts-kit docs` and commit the result.');

    expect(cli(root, 'docs').code).toBe(0);
    expect(read(root, BARREL)).toContain('injected(CancelInvoiceHandler, [InvoiceRepository, Clock]);');
    expect(cli(root, 'check', '--rule', 'declarations/barrel-current').code).toBe(0);
    expect(cli(root, 'docs', '--check').code).toBe(0);

    write(root, HANDLER, taking('private readonly ids: IdGenerator', 'private readonly clock: Clock'));

    expect(stale()[0]?.message).toBe(
      'The declarations of "billing" in application/ are stale: the dependency list of CancelInvoiceHandler is stale: its constructor takes [IdGenerator, Clock] and the file says [InvoiceRepository, Clock].',
    );

    write(root, HANDLER, before);

    expect(cli(root, 'docs', '--check', '--json').json()).toMatchObject({
      ok: false,
      drift: { [BARREL]: expect.stringContaining('a dependency list for CancelInvoiceHandler') },
    });

    expect(cli(root, 'docs').code).toBe(0);
  });

  it('is rewritten by what the dev script loads before the application, which tells what it rewrote and never throws', () => {
    const before = original();
    const told: string[] = [];

    write(root, HANDLER, taking('private readonly clock: Clock'));

    expect(refreshDeclarations(root, (line) => told.push(line))).toEqual([BARREL]);
    expect(told).toEqual([`ddd-ts-kit: rewrote ${BARREL} from the role files and their constructors`]);
    expect(read(root, BARREL)).toContain('injected(CancelInvoiceHandler, [Clock]);');
    expect(refreshDeclarations(root, (line) => told.push(line))).toEqual([]);

    write(root, HANDLER, taking('private readonly retries: number'));
    told.length = 0;

    expect(refreshDeclarations(root, (line) => told.push(line))).toEqual([BARREL]);
    expect(told.join('\n')).toContain('CancelInvoiceHandler');
    expect(told.join('\n')).toContain('is registered no dependency list');
    expect(read(root, BARREL)).not.toContain('injected(CancelInvoiceHandler');

    expect(refreshDeclarations(tempDir('no-project'), (line) => told.push(line))).toEqual([]);
    expect(told.at(-1)).toContain('the generated declarations were not refreshed');

    write(root, HANDLER, before);
    cli(root, 'docs');
  });

  it('tells which file it deleted once its folder holds no declared class, and which it could not write', () => {
    const project = initProject('--context', 'billing:core');
    const declarations = 'src/contexts/billing/application/application.declarations.ts';
    const handler = 'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts';
    const told: string[] = [];

    const terms = ['--term', 'Invoice=A request for payment', '--term', 'Issue=To make an invoice final'];

    expect(cli(project, 'generate', 'command', 'billing', 'IssueInvoice', '--public', ...terms).code).toBe(0);
    expect(exists(project, declarations)).toBe(true);

    fs.rmSync(path.join(project, 'src/contexts/billing/application/commands'), { recursive: true });

    expect(refreshDeclarations(project, (line) => told.push(line))).toContain(declarations);

    expect(told).toContainEqual(
      `ddd-ts-kit: deleted ${declarations}: its folder holds no declared class any more, or the declarations of its layer replace it`,
    );

    expect(exists(project, declarations)).toBe(false);

    const masked = initProject('--context', 'billing:core');

    expect(cli(masked, 'generate', 'command', 'billing', 'IssueInvoice', '--public', ...terms).code).toBe(0);

    write(
      masked,
      handler,
      read(masked, handler).replace(/\{\n/, '{\n  constructor(private readonly clock: Clock) {}\n'),
    );

    fs.rmSync(path.join(masked, declarations));
    fs.symlinkSync('/dev/null', path.join(masked, declarations));
    told.length = 0;

    expect(refreshDeclarations(masked, (line) => told.push(line))).toEqual([]);

    expect(told).toContainEqual(
      `ddd-ts-kit: ${declarations} could not be written here: a sandbox or the permissions protect it`,
    );
  });
});

describe('what a constructor may say', () => {
  const judged = (...parameters: string[]): string[] => {
    const before = read(root, HANDLER);

    write(root, HANDLER, taking(...parameters));

    const { violations } = checkJsonOf(cli(root, 'check', '--rule', RULE, '--json'));

    write(root, HANDLER, before);

    return violations.map(({ message }) => message);
  };

  it.each([
    ['private readonly clock: Clock | IdGenerator', 'is typed `Clock | IdGenerator`, which names no single class'],
    ['private readonly clock?: Clock', 'is optional'],
    ['private readonly clock: Clock = fixed', 'has a default value'],
    ['private readonly clock: string', 'is typed `string`, a type of the language'],
    ['private readonly clock: Missing', 'is typed `Missing`, which its file neither imports nor declares'],
    ['private readonly clock', 'has no type'],
    ['...clocks: Clock[]', 'is a rest parameter'],
    ['{ now }: Clock', 'is destructured'],
    ['private readonly clock: kernel.Clock', 'is typed `kernel.Clock`, which names no single class'],
  ])('refuses %s', (parameter, reason) => {
    const [message, ...others] = judged(parameter);

    expect(others).toEqual([]);
    expect(message).toContain('of the constructor of CancelInvoiceHandler');
    expect(message).toContain(reason);
  });

  it('accepts a port, a port of the kernel, a generic class by its raw class and a parameter decorator of another library', () => {
    expect(
      judged(
        'private readonly invoiceRepository: InvoiceRepository',
        '@Optional() protected readonly clock: Clock',
        'public readonly ids: IdGenerator<string>',
      ),
    ).toEqual([]);
  });
});

/** The cancel-invoice handler, which takes nothing here, given a constructor. */
function taking(...parameters: string[]): string {
  const imports = [
    "import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';",
    "import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';",
  ];

  const signature = `{\n  constructor(\n${parameters.map((parameter) => `    ${parameter},\n`).join('')}  ) {}\n`;

  return [...imports, read(root, HANDLER).replace(/\{\n/, signature)].join('\n');
}
