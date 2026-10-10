import { CONFIG_FILE } from '../../config/index.js';
import { aggregate } from './aggregate.js';
import { config } from './config.js';
import { DECLARED } from './declared.js';
import { declaredProject } from './declared-project.js';
import type { Fixture } from './fixture.js';
import { handler } from './handler.js';
import { outsidePackageDeviation } from './outside-package-deviation.js';
import { PATHS } from './paths.js';
import { project } from './project.js';

const { ADAPTER, AGGREGATE, COMMAND, HANDLER, REPOSITORY_PORT, ROUTE } = PATHS;

export const LAYER_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'layer/domain-purity',
    name: 'kernel, own domain and shared kernel are allowed; comments and strings are not imports',
    expect: 'pass',
    files: project(
      aggregate(
        [
          "import { AggregateRoot } from '@ddd-ts-kit/kernel';",
          "import { Money } from '../value-objects/money.vo.js';",
          "import type { Currency } from '@/shared-kernel/currency.js';",
          "// import { z } from 'zod';",
          "/* import fs from 'node:fs'; */",
          "const note = \"import x from 'zod'\";",
          "const template = `require('pg') ${note} import('express')`;",
          'const pattern = /import "zod"/;',
          'export class Invoice extends AggregateRoot {}',
          'export type { Money, Currency };',
          'export { note, template, pattern };',
        ].join('\n'),
      ),
      { [CONFIG_FILE]: config({ rules: { 'clean/no-commented-out-code': 'off' } }) },
    ),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'a validation library in the domain',
    expect: { file: AGGREGATE },
    files: project(aggregate("import { IsEmail } from 'class-validator';\nexport class Invoice {}\n")),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'a Node built-in in the domain, even node:crypto',
    expect: { file: AGGREGATE },
    also: ['purity/no-ambient-randomness'],
    files: project(aggregate("import { randomUUID } from 'node:crypto';\nexport class Invoice { id = randomUUID(); }\n")),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'a type-only import of a package in the domain',
    expect: { file: AGGREGATE },
    files: project(aggregate("import type { ZodType } from 'zod';\nexport class Invoice {}\nexport type S = ZodType;\n")),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'a dynamic import in the domain',
    expect: { file: AGGREGATE },
    files: project(aggregate("export class Invoice { load() { return import('pg'); } }\n")),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'the domain reaching the application layer',
    expect: { file: AGGREGATE },
    files: project(aggregate("import type { Mailer } from '../../application/ports/mailer.port.js';\nexport class Invoice {}\nexport type M = Mailer;\n")),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'an aspect decorator on an aggregate',
    expect: { file: AGGREGATE },
    files: project(aggregate("import { Logged } from '@ddd-ts-kit/aspects/decorators';\nexport class Invoice {\n  @Logged()\n  async issue(): Promise<void> {}\n}\n")),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'tracing in the domain, even listed in domainAllowedPackages',
    expect: { file: AGGREGATE },
    also: ['tracing/platform-only'],
    files: project(aggregate("import { withSpan } from '@ddd-ts-kit/tracing';\nexport class Invoice {}\nexport { withSpan };\n"), {
      [CONFIG_FILE]: config({ domainAllowedPackages: ['@ddd-ts-kit/kernel', '@ddd-ts-kit/tracing'], deviations: [outsidePackageDeviation('domainAllowedPackages', '@ddd-ts-kit/tracing')] }),
    }),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'domain, kernel and a declared published language are allowed',
    expect: 'pass',
    files: project(
      handler(
        [
          "import type { UseCase } from '@ddd-ts-kit/kernel';",
          "import type { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';",
          "import type { ProductListedV1 } from '../../../../catalog/published-language/index.js';",
          'export class IssueInvoiceHandler {}',
          'export type T = UseCase<ProductListedV1, InvoiceRepository>;',
        ].join('\n'),
      ),
    ),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'a handler wrapping its own call in an aspect',
    expect: { file: HANDLER },
    files: project(handler("import { retry } from '@ddd-ts-kit/aspects';\nexport class IssueInvoiceHandler {}\nexport { retry };\n")),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'a handler writing to the audit trail',
    expect: { file: HANDLER },
    files: project(handler("import type { AuditTrail } from '@ddd-ts-kit/audit';\nexport class IssueInvoiceHandler {}\nexport type T = AuditTrail;\n")),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'the Redis adapter in a handler, even listed in applicationAllowedPackages',
    expect: { file: HANDLER },
    files: project(handler("import { RedisCache } from '@ddd-ts-kit/redis';\nexport class IssueInvoiceHandler {}\nexport { RedisCache };\n"), {
      [CONFIG_FILE]: config({
        applicationAllowedPackages: ['@ddd-ts-kit/kernel', '@ddd-ts-kit/auth', '@ddd-ts-kit/redis'],
        deviations: [outsidePackageDeviation('applicationAllowedPackages', '@ddd-ts-kit/redis')],
      }),
    }),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'a handler importing an adapter',
    expect: { file: HANDLER },
    files: project(handler("import type { PgInvoiceRepository } from '../../../infrastructure/persistence/pg-invoice.repository.js';\nexport class IssueInvoiceHandler {}\nexport type R = PgInvoiceRepository;\n")),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'a handler importing a framework',
    expect: { file: HANDLER },
    files: project(handler("import type { Request } from 'express';\nexport class IssueInvoiceHandler {}\nexport type R = Request;\n")),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'a handler requiring a driver',
    expect: { file: HANDLER },
    files: project(handler("const pg = require('pg');\nexport class IssueInvoiceHandler { driver = pg; }\n")),
  },
  {
    ruleId: 'layer/presentation-no-infrastructure',
    name: 'a route calling a handler',
    expect: 'pass',
    files: project({
      ...handler('export class IssueInvoiceHandler {}\n'),
      [ROUTE]: "import type { IssueInvoiceHandler } from '../../application/commands/issue-invoice/issue-invoice.handler.js';\n\nexport type IssueInvoiceRoute = IssueInvoiceHandler;\n",
    }),
  },
  {
    ruleId: 'layer/presentation-no-infrastructure',
    name: 'a route importing an adapter',
    expect: { file: ROUTE },
    files: project({
      [ROUTE]: "import type { InMemoryInvoiceRepository } from '../../infrastructure/persistence/in-memory-invoice.repository.js';\n\nexport type IssueInvoiceRoute = InMemoryInvoiceRepository;\n",
    }),
  },
  {
    ruleId: 'layer/infrastructure-no-presentation',
    name: 'an adapter implementing a domain interface',
    expect: 'pass',
    files: project({
      [ADAPTER]: "import type { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';\nexport class InMemoryInvoiceRepository {}\nexport type R = InvoiceRepository;\n",
    }),
  },
  {
    ruleId: 'layer/infrastructure-no-presentation',
    name: 'an adapter importing a DTO',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]: "import type { InvoiceDto } from '@/contexts/billing/presentation/http/invoice.dto.js';\n\nexport type InMemoryInvoiceRepository = InvoiceDto;\n",
    }),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'declared style: a handler importing the kernel declarations and the ports of its context',
    expect: 'pass',
    files: declaredProject({ [COMMAND]: DECLARED.command, ...handler(DECLARED.handler), [REPOSITORY_PORT]: DECLARED.repositoryPort }),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'the kernel declarations in the domain, although the kernel is allowed',
    expect: { file: AGGREGATE },
    files: project(aggregate("import { Repository } from '@ddd-ts-kit/kernel/declarations';\n\nexport class Invoice {}\n\nexport const adapterOf = Repository;\n")),
  },
  {
    ruleId: 'layer/domain-purity',
    name: 'the scheduler in the domain, even listed in domainAllowedPackages',
    expect: { file: AGGREGATE },
    files: project(aggregate("import { InProcessJobScheduler } from '@ddd-ts-kit/scheduling';\n\nexport class Invoice {}\n\nexport const scheduler = InProcessJobScheduler;\n"), {
      [CONFIG_FILE]: config({ domainAllowedPackages: ['@ddd-ts-kit/kernel', '@ddd-ts-kit/scheduling'], deviations: [outsidePackageDeviation('domainAllowedPackages', '@ddd-ts-kit/scheduling')] }),
    }),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'a handler reporting an error to Sentry itself',
    expect: { file: HANDLER },
    files: project(handler("import { SentryErrorReporter } from '@ddd-ts-kit/sentry';\n\nexport class IssueInvoiceHandler {}\n\nexport const reporter = SentryErrorReporter;\n")),
  },
];
