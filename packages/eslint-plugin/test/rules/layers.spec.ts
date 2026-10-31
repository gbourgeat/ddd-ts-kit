import { layerApplicationInward } from '../../src/rules/layer-application-inward';
import { layerDomainPurity } from '../../src/rules/layer-domain-purity';
import { layerInfrastructureNoPresentation, layerPresentationNoInfrastructure } from '../../src/rules/layer-sideways';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester';

const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const ROUTE = `${BILLING}/presentation/http/issue-invoice.route.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`;
const BACKGROUND_JOB = `${BILLING}/application/background/compile-statements.background-job.ts`;

const ASPECT =
  'an aspect (logging, metrics, retry, timeout, circuit breaking, caching) is applied from outside, never written in the model or in a use case';

const AT_THE_ROOT =
  'Remove the import and apply the aspect at the composition root (`.with(...)` on the binding, or the `decorate` hook), in a bus middleware for what concerns every use case, or on an adapter class in infrastructure/.';

ruleTester.run('layer-domain-purity', layerDomainPurity, {
  valid: [
    at(AGGREGATE, "import { AggregateRoot } from '@ddd-ts-kit/kernel';"),
    at(AGGREGATE, "import type { Amount } from '../value-objects/amount.vo.js';"),
    at(AGGREGATE, "import { Money } from '@/shared-kernel/money.vo.js';"),
    at(AGGREGATE, "import { Sku } from '../../../catalog/domain/value-objects/sku.vo.js';"),
    at(AGGREGATE, "import Decimal from 'decimal.js';", { ...SAMPLE_CONFIG, domainAllowedPackages: ['decimal.js'] }),
    at(`${BILLING}/test/unit/invoice.aggregate.spec.ts`, "import { describe } from 'vitest';"),
    at('src/platform/config.ts', "import fs from 'node:fs';"),
    at(
      ADAPTER,
      "import { Retry } from '@ddd-ts-kit/aspects/decorators';\nimport { RedisCache } from '@ddd-ts-kit/redis';\nimport { withSpan } from '@ddd-ts-kit/tracing';",
    ),
    at(
      `${BILLING}/test/unit/invoice.aggregate.spec.ts`,
      "import { recordingAspect } from '@ddd-ts-kit/aspects/testing';",
    ),
    at(
      AGGREGATE,
      "// ddd-ts-kit-disable-next-line layer/domain-purity -- hashing is a pure function here\nimport { createHash } from 'node:crypto';",
    ),
  ],
  invalid: [
    { ...at(AGGREGATE, "import { z } from 'zod';"), errors: [{ messageId: 'package', data: { name: 'zod' } }] },
    {
      ...at(AGGREGATE, "import { FixedClock } from '@ddd-ts-kit/kernel/testing';"),
      errors: [
        {
          messageId: 'entry',
          data: {
            importer: 'The domain',
            specifier: '@ddd-ts-kit/kernel/testing',
            what: 'test doubles',
            name: '@ddd-ts-kit/kernel',
          },
        },
      ],
    },
    { ...at(AGGREGATE, "import type { Request } from 'express';"), errors: [{ messageId: 'package' }] },
    {
      ...at(AGGREGATE, "import { Logged } from '@ddd-ts-kit/aspects/decorators';"),
      errors: [
        {
          messageId: 'outsideConcern',
          data: { importer: 'The domain', specifier: '@ddd-ts-kit/aspects/decorators', why: ASPECT, fix: AT_THE_ROOT },
        },
      ],
    },
    {
      ...at(
        AGGREGATE,
        "import { retry } from '@ddd-ts-kit/aspects';\nimport type { AuditEntry } from '@ddd-ts-kit/audit';",
      ),
      errors: [{ messageId: 'outsideConcern' }, { messageId: 'outsideConcern' }],
    },
    {
      ...at(AGGREGATE, "import { withSpan } from '@ddd-ts-kit/tracing';", {
        ...SAMPLE_CONFIG,
        domainAllowedPackages: ['@ddd-ts-kit/kernel', '@ddd-ts-kit/tracing'],
      }),
      errors: [{ messageId: 'outsideConcern' }],
    },
    {
      ...at(
        AGGREGATE,
        "import { InProcessJobScheduler } from '@ddd-ts-kit/scheduling';\nimport { SentryErrorReporter } from '@ddd-ts-kit/sentry';",
        {
          ...SAMPLE_CONFIG,
          domainAllowedPackages: ['@ddd-ts-kit/kernel', '@ddd-ts-kit/scheduling', '@ddd-ts-kit/sentry'],
        },
      ),
      errors: [{ messageId: 'outsideConcern' }, { messageId: 'outsideConcern' }],
    },
    {
      ...at(AGGREGATE, "import { S3FileStorage } from '@ddd-ts-kit/s3';", {
        ...SAMPLE_CONFIG,
        domainAllowedPackages: ['@ddd-ts-kit/kernel', '@ddd-ts-kit/s3'],
      }),
      errors: [{ messageId: 'outsideConcern' }],
    },
    { ...at(AGGREGATE, "import { randomUUID } from 'node:crypto';"), errors: [{ messageId: 'builtin' }] },
    { ...at(AGGREGATE, "import path from 'path';"), errors: [{ messageId: 'builtin' }] },
    {
      ...at(AGGREGATE, "import { InvoiceRow } from '../../infrastructure/persistence/billing.schema.js';"),
      errors: [{ messageId: 'outerLayer' }],
    },
    {
      ...at(
        AGGREGATE,
        "import type { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';",
      ),
      errors: [{ messageId: 'outerLayer' }],
    },
    { ...at(AGGREGATE, "import { config } from '@/platform/config.js';"), errors: [{ messageId: 'outerLayer' }] },
    {
      ...at(AGGREGATE, "import type { ProductListedV1 } from '../../../catalog/published-language/index.js';"),
      errors: [{ messageId: 'upstreamContract' }],
    },
    {
      ...at(AGGREGATE, "export * from '../../presentation/http/invoice.dto.js';"),
      errors: [{ messageId: 'outerLayer' }],
    },
    {
      ...at(AGGREGATE, "export { InvoiceDto } from '../../presentation/http/invoice.dto.js';"),
      errors: [{ messageId: 'outerLayer' }],
    },
    { ...at(AGGREGATE, "const orm = await import('drizzle-orm');"), errors: [{ messageId: 'package' }] },
    { ...at(AGGREGATE, "const fs = require('fs');"), errors: [{ messageId: 'builtin' }] },
    { ...at(AGGREGATE, "import fs = require('fs');"), errors: [{ messageId: 'builtin' }] },
    {
      ...at(AGGREGATE, "type Row = import('../../infrastructure/persistence/billing.schema.js').InvoiceRow;"),
      errors: [{ messageId: 'outerLayer' }],
    },
    {
      ...at(
        AGGREGATE,
        "// ddd-ts-kit-disable-next-line layer/domain-purity\nimport { createHash } from 'node:crypto';",
      ),
      errors: [{ messageId: 'builtin' }],
    },
  ],
});

ruleTester.run('layer-application-inward', layerApplicationInward, {
  valid: [
    at(BACKGROUND_JOB, "import { z } from 'zod';\nimport { zodSchema } from '@ddd-ts-kit/validation/zod';"),
    at(BACKGROUND_JOB, "import { IsString } from 'class-validator';", {
      ...SAMPLE_CONFIG,
      stack: { validation: 'class-validator' },
    }),
    at(HANDLER, "import type { Clock } from '@ddd-ts-kit/kernel';"),
    at(HANDLER, "import { Permission } from '@ddd-ts-kit/auth';"),
    at(HANDLER, "import type { RelationTuple } from '@ddd-ts-kit/auth/rebac';", {
      ...SAMPLE_CONFIG,
      applicationAllowedPackages: ['@ddd-ts-kit/kernel', '@ddd-ts-kit/auth', '@ddd-ts-kit/auth/rebac'],
    }),
    at(HANDLER, "import { Invoice } from '../../../domain/aggregates/invoice.aggregate.js';"),
    at(HANDLER, "import type { PaymentGateway } from '../../ports/payment-gateway.port.js';"),
    at(HANDLER, "import type { ProductListedV1 } from '@/contexts/catalog/published-language/index.js';"),
    at(HANDLER, "import { Money } from '@/shared-kernel/money.vo.js';"),
    at(HANDLER, "import type { Cache, Logger } from '@ddd-ts-kit/kernel';"),
    at(
      `${BILLING}/test/unit/issue-invoice.handler.spec.ts`,
      "import { InMemoryAuditTrail } from '@ddd-ts-kit/audit/testing';",
    ),
    at(
      HANDLER,
      "import { DrizzleRepo } from '../../../../catalog/infrastructure/persistence/drizzle-product.repository.js';",
    ),
  ],
  invalid: [
    {
      ...at(HANDLER, "import { z } from 'zod';\nimport { zodSchema } from '@ddd-ts-kit/validation/zod';"),
      errors: [
        { messageId: 'package', data: { name: 'zod', context: 'billing' } },
        { messageId: 'package', data: { name: '@ddd-ts-kit/validation', context: 'billing' } },
      ],
    },
    {
      ...at(
        HANDLER,
        "import { passportAuthenticator } from '@ddd-ts-kit/auth/passport';\nimport { jwtAuthenticator } from '@ddd-ts-kit/auth/jwt';",
      ),
      errors: [
        {
          messageId: 'entry',
          data: {
            importer: 'The application layer',
            specifier: '@ddd-ts-kit/auth/passport',
            what: 'an authentication adapter',
            name: '@ddd-ts-kit/auth',
          },
        },
        { messageId: 'entry' },
      ],
    },
    {
      ...at(`${BILLING}/application/background/statements.ts`, "import { z } from 'zod';"),
      errors: [{ messageId: 'package', data: { name: 'zod', context: 'billing' } }],
    },
    {
      ...at(BACKGROUND_JOB, "import { IsString } from 'class-validator';\nimport * as v from 'valibot';"),
      errors: [
        { messageId: 'package', data: { name: 'class-validator', context: 'billing' } },
        { messageId: 'package', data: { name: 'valibot', context: 'billing' } },
      ],
    },
    {
      ...at(`${BILLING}/application/reports/background/statements.background-job.ts`, "import { z } from 'zod';"),
      errors: [{ messageId: 'package', data: { name: 'zod', context: 'billing' } }],
    },
    {
      ...at(BACKGROUND_JOB, "import { Knex } from 'knex';"),
      errors: [{ messageId: 'package', data: { name: 'knex', context: 'billing' } }],
    },
    {
      ...at(HANDLER, "import { retry, timeout } from '@ddd-ts-kit/aspects';"),
      errors: [
        {
          messageId: 'outsideConcern',
          data: { importer: 'The application layer', specifier: '@ddd-ts-kit/aspects', why: ASPECT, fix: AT_THE_ROOT },
        },
      ],
    },
    {
      ...at(
        HANDLER,
        "import { Cached } from '@ddd-ts-kit/aspects/decorators';\nimport { recordingAspect } from '@ddd-ts-kit/aspects/testing';",
      ),
      errors: [{ messageId: 'outsideConcern' }, { messageId: 'outsideConcern' }],
    },
    {
      ...at(
        HANDLER,
        "import type { AuditTrail } from '@ddd-ts-kit/audit';\nimport { drizzleAuditTrail } from '@ddd-ts-kit/audit/drizzle';",
      ),
      errors: [{ messageId: 'outsideConcern' }, { messageId: 'outsideConcern' }],
    },
    {
      ...at(HANDLER, "const tracing = await import('@ddd-ts-kit/tracing/node');"),
      errors: [{ messageId: 'outsideConcern' }],
    },
    {
      ...at(HANDLER, "import { RedisCache } from '@ddd-ts-kit/redis';", {
        ...SAMPLE_CONFIG,
        applicationAllowedPackages: ['@ddd-ts-kit/kernel', '@ddd-ts-kit/redis'],
      }),
      errors: [{ messageId: 'outsideConcern' }],
    },
    {
      ...at(HANDLER, "import { ManualJobScheduler } from '@ddd-ts-kit/scheduling/testing';", {
        ...SAMPLE_CONFIG,
        applicationAllowedPackages: ['@ddd-ts-kit/kernel', '@ddd-ts-kit/scheduling'],
      }),
      errors: [{ messageId: 'outsideConcern' }],
    },
    {
      ...at(
        `${BILLING}/application/scheduling/send-reminders.job.ts`,
        "import { SentryErrorReporter } from '@ddd-ts-kit/sentry';",
      ),
      errors: [{ messageId: 'outsideConcern' }],
    },
    {
      ...at(HANDLER, "import { eq } from 'drizzle-orm';"),
      errors: [{ messageId: 'package', data: { name: 'drizzle-orm', context: 'billing' } }],
    },
    { ...at(HANDLER, "import { readFile } from 'node:fs/promises';"), errors: [{ messageId: 'builtin' }] },
    {
      ...at(
        HANDLER,
        "import { DrizzleInvoiceRepository } from '../../../infrastructure/persistence/drizzle-invoice.repository.js';",
      ),
      errors: [{ messageId: 'outward' }],
    },
    {
      ...at(HANDLER, "import type { IssueInvoiceBody } from '../../../presentation/http/issue-invoice.dto.js';"),
      errors: [{ messageId: 'outward' }],
    },
    {
      ...at(HANDLER, "import { database } from '@/platform/database/database.js';"),
      errors: [{ messageId: 'outward' }],
    },
    {
      ...at(HANDLER, "const adapter = await import('../../../infrastructure/external/stripe.gateway.js');"),
      errors: [{ messageId: 'outward' }],
    },
    {
      ...at(HANDLER, "import { billingModule } from '../../../billing.module.js';"),
      errors: [{ messageId: 'outward' }],
    },
  ],
});

ruleTester.run('layer-presentation-no-infrastructure', layerPresentationNoInfrastructure, {
  valid: [
    at(
      ROUTE,
      "import { IssueInvoiceCommand } from '../../application/commands/issue-invoice/issue-invoice.command.js';",
    ),
    at(ROUTE, "import express from 'express';"),
    at(ADAPTER, "import { invoices } from './billing.schema.js';"),
  ],
  invalid: [
    {
      ...at(
        ROUTE,
        "import { DrizzleInvoiceRepository } from '../../infrastructure/persistence/drizzle-invoice.repository.js';",
      ),
      errors: [{ messageId: 'forbidden' }],
    },
    {
      ...at(
        ROUTE,
        "import type { InvoiceRow } from '@/contexts/billing/infrastructure/persistence/billing.schema.js';",
      ),
      errors: [{ messageId: 'forbidden' }],
    },
  ],
});

ruleTester.run('layer-infrastructure-no-presentation', layerInfrastructureNoPresentation, {
  valid: [
    at(ADAPTER, "import type { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';"),
    at(ROUTE, "import { body } from './issue-invoice.dto.js';"),
  ],
  invalid: [
    {
      ...at(ADAPTER, "import type { IssueInvoiceBody } from '../../presentation/http/issue-invoice.dto.js';"),
      errors: [{ messageId: 'forbidden' }],
    },
  ],
});
