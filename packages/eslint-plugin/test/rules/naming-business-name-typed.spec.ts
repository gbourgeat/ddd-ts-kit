import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll } from 'vitest';
import { namingBusinessName } from '../../src/rules/naming-business-name';
import { SAMPLE_CONFIG } from '../support/rule-tester';

const SCHEDULING = 'src/contexts/scheduling';
const HANDLER = `${SCHEDULING}/application/commands/cancel-appointment/cancel-appointment.handler.ts`;

/** A project on disk, so that the type checker reads the aggregate and the repository port the handler imports. */
const FILES: Readonly<Record<string, string>> = {
  'tsconfig.json': JSON.stringify({
    compilerOptions: { strict: true, target: 'es2022', module: 'nodenext', moduleResolution: 'nodenext', noEmit: true },
    include: ['src'],
  }),
  [`${SCHEDULING}/domain/aggregates/appointment.aggregate.ts`]:
    'export class Appointment {\n  readonly id = "appointment-1";\n\n  cancel(): void {}\n}\n',
  'src/shared-kernel/period.ts': 'export class Period {\n  readonly days = 1;\n}\n',
  [`${SCHEDULING}/domain/repositories/appointment.repository.ts`]: [
    "import type { Appointment } from '../aggregates/appointment.aggregate.js';",
    "import type { Period } from '../../../../shared-kernel/period.js';",
    '',
    'export abstract class AppointmentRepository {',
    '  abstract findById(id: string): Promise<Appointment | undefined>;',
    '',
    '  abstract findDue(at: Date): Promise<readonly Appointment[]>;',
    '',
    '  abstract countDue(at: Date): Promise<number>;',
    '',
    '  abstract findPeriod(): Promise<Period>;',
    '}',
    '',
  ].join('\n'),
  [HANDLER]: '',
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-business-name-'));

for (const [file, content] of Object.entries(FILES)) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
}

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const typedTester = new RuleTester({
  languageOptions: { parserOptions: { projectService: { allowDefaultProject: [] }, tsconfigRootDir: root } },
  linterOptions: { reportUnusedDisableDirectives: 'off' },
});

const IMPORTS =
  "import type { AppointmentRepository } from '../../../domain/repositories/appointment.repository.js';\n\n";

/** The handler with `body` in its `execute`, its repository reachable as `this.appointments` and `this.appointmentRepository`. */
function handler(body: string): { code: string; filename: string; settings: Record<string, unknown> } {
  return {
    code: `${IMPORTS}export class CancelAppointmentHandler {\n  constructor(\n    private readonly appointments: AppointmentRepository,\n    private readonly appointmentRepository: AppointmentRepository,\n  ) {}\n\n  async execute(id: string, now: Date): Promise<void> {\n${body}\n  }\n}\n`,
    filename: path.join(root, HANDLER),
    settings: { 'ddd-ts-kit': { config: SAMPLE_CONFIG_WITH_SCHEDULING, rootDir: root, filename: HANDLER } },
  };
}

const SAMPLE_CONFIG_WITH_SCHEDULING = {
  contexts: { ...SAMPLE_CONFIG.contexts, scheduling: { classification: 'core', upstreams: [] } },
};

const named = (kind: string, name: string, advice: string) => ({
  messageId: 'generic' as const,
  data: { kind, name, advice },
});

const CONCEPT = 'Name it after the concept it holds, a term of the glossary of the context (CONTEXT.md).';

typedTester.run('naming-business-name, with the types of the project', namingBusinessName, {
  valid: [handler('    const appointment = await this.appointments.findById(id);\n\n    appointment?.cancel();')],
  invalid: [
    {
      ...handler('    const target = await this.appointments.findById(id);\n\n    target?.cancel();'),
      errors: [named('variable', 'target', 'Name it `appointment`, the name the code already gives to what it holds.')],
      output: handler('    const appointment = await this.appointments.findById(id);\n\n    appointment?.cancel();')
        .code,
    },
    {
      ...handler('    const targets = await this.appointmentRepository.findDue(now);\n\n    targets.at(0)?.cancel();'),
      errors: [
        named('variable', 'targets', 'Name it `appointments`, the name the code already gives to what it holds.'),
      ],
      output: handler(
        '    const appointments = await this.appointmentRepository.findDue(now);\n\n    appointments.at(0)?.cancel();',
      ).code,
    },
    {
      ...handler('    const target = await this.appointments.findDue(now);\n\n    target.at(0)?.cancel();'),
      errors: [
        named('variable', 'target', 'Name it `appointments`, the name the code already gives to what it holds.'),
      ],
      output: null,
    },
    {
      ...handler('    const data = await this.appointmentRepository.countDue(now);\n\n    void data;'),
      errors: [named('variable', 'data', CONCEPT)],
    },
    {
      ...handler('    const target = await this.appointments.findPeriod();\n\n    void target;'),
      errors: [named('variable', 'target', 'Name it `period`, the name the code already gives to what it holds.')],
      output: handler('    const period = await this.appointments.findPeriod();\n\n    void period;').code,
    },
    {
      ...handler('    for (const item of await this.appointments.findDue(now)) {\n      item.cancel();\n    }'),
      errors: [
        named('loop variable', 'item', 'Name it after one element of the collection, in the singular: `appointment`.'),
      ],
    },
  ],
});
