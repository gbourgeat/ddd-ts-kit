import { aggregate } from './aggregate.js';
import type { Fixture } from './fixture.js';
import { handler } from './handler.js';
import { PATHS } from './paths.js';
import { project } from './project.js';

const { AGGREGATE, HANDLER } = PATHS;

export const PURITY_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'purity/no-system-clock',
    name: 'time received as a parameter, a date built from a value',
    expect: 'pass',
    files: project(
      aggregate(
        "export class Invoice {\n  isOverdue(now: Date): boolean {\n    return new Date('2026-01-01') < now && new Date(now.getTime()) <= now;\n  }\n}\n// new Date() in a comment\nexport const note = 'Date.now()';\n",
      ),
    ),
  },
  {
    ruleId: 'purity/no-system-clock',
    name: 'new Date() in an aggregate',
    expect: { file: AGGREGATE },
    files: project(aggregate('export class Invoice {\n  readonly createdAt = new Date();\n}\n')),
  },
  {
    ruleId: 'purity/no-system-clock',
    name: 'Date.now() in a handler',
    expect: { file: HANDLER },
    files: project(
      handler('export class IssueInvoiceHandler {\n  stamp(): number {\n    return Date.now();\n  }\n}\n'),
    ),
  },
  {
    ruleId: 'purity/no-ambient-randomness',
    name: 'an identifier received from outside',
    expect: 'pass',
    files: project(aggregate('export class Invoice {\n  constructor(readonly id: string) {}\n}\n')),
  },
  {
    ruleId: 'purity/no-ambient-randomness',
    name: 'crypto.randomUUID in an aggregate',
    expect: { file: AGGREGATE },
    files: project(aggregate('export class Invoice {\n  readonly id = crypto.randomUUID();\n}\n')),
  },
  {
    ruleId: 'purity/no-ambient-randomness',
    name: 'an id library in a handler',
    expect: { file: HANDLER },
    also: ['layer/application-inward'],
    files: project(
      handler("import { nanoid } from 'nanoid';\nexport class IssueInvoiceHandler {\n  readonly id = nanoid();\n}\n"),
    ),
  },
  {
    ruleId: 'purity/no-environment',
    name: 'configuration received through the constructor',
    expect: 'pass',
    files: project(
      handler('export class IssueInvoiceHandler {\n  constructor(private readonly currency: string) {}\n}\n'),
    ),
  },
  {
    ruleId: 'purity/no-environment',
    name: 'process.env and console in a handler',
    expect: { file: HANDLER },
    files: project(
      handler(
        "export class IssueInvoiceHandler {\n  readonly currency = process.env['CURRENCY'];\n  log(): void {\n    console.log(this.currency);\n  }\n}\n",
      ),
    ),
  },
  {
    ruleId: 'purity/no-environment',
    name: 'the file system in the domain',
    expect: { file: AGGREGATE },
    also: ['layer/domain-purity'],
    files: project(
      aggregate(
        "import { readFileSync } from 'node:fs';\nexport class Invoice {\n  readonly template = readFileSync;\n}\n",
      ),
    ),
  },
];
