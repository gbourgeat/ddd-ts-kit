import { describe, expect, it } from 'vitest';
import { rewriteUsages } from '../src/refusals/rewrite-usages.js';
import { cli, read, tempDir, write } from './helpers.js';

const PLAN = 'error-factories.plan.json';

interface Plan {
  contexts: Record<string, { class: string; code: string; concept: string; factory: string }[]>;
}

describe('rewriteUsages', () => {
  const move = {
    context: 'scheduling',
    legacyPath: 'scheduling/domain/errors/slot-taken.error',
    className: 'SlotTakenError',
    conceptClass: 'AppointmentError',
    conceptFile: 'appointment.error',
    factory: 'slotTaken',
    code: 'SLOT_TAKEN',
  };

  const rewritten = (code: string): string => rewriteUsages(code, [move]);

  it('turns an assertion on the class into an assertion on the code', () => {
    expect(rewritten('given(x).when(book).thenError(SlotTakenError);')).toBe(
      "given(x).when(book).thenError('SLOT_TAKEN');",
    );

    expect(rewritten("o.thenError(SlotTakenError, 'SLOT_TAKEN');")).toBe("o.thenError('SLOT_TAKEN');");

    expect(rewritten('expect(book).toThrow(\n  SlotTakenError,\n);')).toBe(
      "expect(book).toThrow(expect.objectContaining({ code: 'SLOT_TAKEN' }));",
    );

    expect(rewritten('expect(r).toMatchObject({ error: expect.any(SlotTakenError) });')).toBe(
      "expect(r).toMatchObject({ error: expect.objectContaining({ code: 'SLOT_TAKEN' }) });",
    );

    expect(rewritten('await expect(run()).rejects.toBeInstanceOf(SlotTakenError);')).toBe(
      "await expect(run()).rejects.toMatchObject({ code: 'SLOT_TAKEN' });",
    );
  });

  it('keeps the relative path and the extension of an import, and drops the import nothing reads any more', () => {
    expect(
      rewritten("import { SlotTakenError } from '../errors/slot-taken.error.js';\nthrow new SlotTakenError(id);\n"),
    ).toBe(
      "import { AppointmentError } from '../errors/appointment.error.js';\nthrow AppointmentError.slotTaken(id);\n",
    );

    expect(
      rewritten("import { SlotTakenError } from '@/x/domain/errors/slot-taken.error';\no.thenError(SlotTakenError);\n"),
    ).toBe("o.thenError('SLOT_TAKEN');\n");
  });

  it('tells where the class stood as a value it cannot translate', () => {
    const told: string[] = [];

    expect(rewriteUsages('register(SlotTakenError);', [move], (className) => told.push(className))).toBe(
      'register(AppointmentError);',
    );

    expect(told).toEqual(['SlotTakenError']);
    expect(rewriteUsages('const code = "SlotTakenError";', [move])).toBe('const code = "SlotTakenError";');
  });
});

describe('error-factories, with a class of the same name in two contexts', () => {
  it('sends each one to the concept of its own context', () => {
    const root = tempDir('error-factories-two');

    const timeZone = (context: string): string =>
      `import { DomainError } from '@ddd-ts-kit/kernel';\n\nexport class UnknownTimeZoneError extends DomainError {\n  readonly code = 'UNKNOWN_TIME_ZONE';\n\n  constructor(name: string) {\n    super(\`\${name} is unknown in ${context}.\`);\n  }\n}\n`;

    const user = (context: string): string =>
      `import { UnknownTimeZoneError } from '@/contexts/${context}/domain/errors/unknown-time-zone.error';\n\nexport const refuse = (name: string): never => {\n  throw new UnknownTimeZoneError(name);\n};\n`;

    expect(cli(root, 'init', '--refusals', 'classes').code).toBe(0);

    for (const [context, concept] of [
      ['billing', 'Invoice'],
      ['shipping', 'Parcel'],
    ] as const) {
      cli(root, 'generate', 'context', context, '--classification', 'core', '--term', `${concept}=A thing`);
      cli(root, 'generate', 'aggregate', context, concept);
      write(root, `src/contexts/${context}/domain/errors/unknown-time-zone.error.ts`, timeZone(context));
      write(root, `src/contexts/${context}/domain/services/zone.service.ts`, user(context));
    }

    write(root, 'src/platform/zones.ts', user('shipping'));
    cli(root, 'error-factories', '--plan');

    const plan = JSON.parse(read(root, PLAN)) as Plan;

    for (const [context, entries] of Object.entries(plan.contexts)) {
      for (const entry of entries) {
        entry.concept = context === 'billing' ? 'Invoice' : 'Parcel';
      }
    }

    write(root, PLAN, JSON.stringify(plan));
    expect(cli(root, 'error-factories', '--apply').code).toBe(0);

    expect(read(root, 'src/contexts/billing/domain/services/zone.service.ts')).toContain(
      "import { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';",
    );

    expect(read(root, 'src/contexts/shipping/domain/services/zone.service.ts')).toContain(
      'throw ParcelError.unknownTimeZone(name);',
    );

    expect(read(root, 'src/platform/zones.ts')).toContain(
      "import { ParcelError } from '@/contexts/shipping/domain/errors/parcel.error';",
    );
  });
});
