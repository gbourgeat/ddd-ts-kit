import { layerApplicationInward } from '../../src/rules/layer-application-inward.js';
import { layerDomainPurity } from '../../src/rules/layer-domain-purity.js';
import { layerInfrastructureNoPresentation, layerPresentationNoInfrastructure } from '../../src/rules/layer-sideways.js';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester.js';

const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const ROUTE = `${BILLING}/presentation/http/issue-invoice.route.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`;

ruleTester.run('layer-domain-purity', layerDomainPurity, {
  valid: [
    at(AGGREGATE, "import { AggregateRoot } from '@ddd-ts-kit/kernel';"),
    at(AGGREGATE, "import type { Amount } from '../value-objects/amount.vo.js';"),
    at(AGGREGATE, "import { Money } from '@/shared-kernel/money.vo.js';"),
    at(AGGREGATE, "import { Sku } from '../../../catalog/domain/value-objects/sku.vo.js';"),
    at(AGGREGATE, "import Decimal from 'decimal.js';", { ...SAMPLE_CONFIG, domainAllowedPackages: ['decimal.js'] }),
    at(`${BILLING}/test/unit/invoice.aggregate.spec.ts`, "import { describe } from 'vitest';"),
    at('src/platform/config.ts', "import fs from 'node:fs';"),
    at(AGGREGATE, "// ddd-ts-kit-disable-next-line layer/domain-purity -- hashing is a pure function here\nimport { createHash } from 'node:crypto';"),
  ],
  invalid: [
    { ...at(AGGREGATE, "import { z } from 'zod';"), errors: [{ messageId: 'package', data: { name: 'zod' } }] },
    { ...at(AGGREGATE, "import type { Request } from 'express';"), errors: [{ messageId: 'package' }] },
    { ...at(AGGREGATE, "import { randomUUID } from 'node:crypto';"), errors: [{ messageId: 'builtin' }] },
    { ...at(AGGREGATE, "import path from 'path';"), errors: [{ messageId: 'builtin' }] },
    { ...at(AGGREGATE, "import { InvoiceRow } from '../../infrastructure/persistence/billing.schema.js';"), errors: [{ messageId: 'outerLayer' }] },
    { ...at(AGGREGATE, "import type { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';"), errors: [{ messageId: 'outerLayer' }] },
    { ...at(AGGREGATE, "import { config } from '@/platform/config.js';"), errors: [{ messageId: 'outerLayer' }] },
    { ...at(AGGREGATE, "import type { ProductListedV1 } from '../../../catalog/published-language/index.js';"), errors: [{ messageId: 'upstreamContract' }] },
    { ...at(AGGREGATE, "export * from '../../presentation/http/invoice.dto.js';"), errors: [{ messageId: 'outerLayer' }] },
    { ...at(AGGREGATE, "export { InvoiceDto } from '../../presentation/http/invoice.dto.js';"), errors: [{ messageId: 'outerLayer' }] },
    { ...at(AGGREGATE, "const orm = await import('drizzle-orm');"), errors: [{ messageId: 'package' }] },
    { ...at(AGGREGATE, "const fs = require('fs');"), errors: [{ messageId: 'builtin' }] },
    { ...at(AGGREGATE, "import fs = require('fs');"), errors: [{ messageId: 'builtin' }] },
    { ...at(AGGREGATE, "type Row = import('../../infrastructure/persistence/billing.schema.js').InvoiceRow;"), errors: [{ messageId: 'outerLayer' }] },
    { ...at(AGGREGATE, "// ddd-ts-kit-disable-next-line layer/domain-purity\nimport { createHash } from 'node:crypto';"), errors: [{ messageId: 'builtin' }] },
  ],
});

ruleTester.run('layer-application-inward', layerApplicationInward, {
  valid: [
    at(HANDLER, "import type { Clock } from '@ddd-ts-kit/kernel';"),
    at(HANDLER, "import { Invoice } from '../../../domain/aggregates/invoice.aggregate.js';"),
    at(HANDLER, "import type { PaymentGateway } from '../../ports/payment-gateway.port.js';"),
    at(HANDLER, "import type { ProductListedV1 } from '@/contexts/catalog/published-language/index.js';"),
    at(HANDLER, "import { Money } from '@/shared-kernel/money.vo.js';"),
    at(HANDLER, "import { DrizzleRepo } from '../../../../catalog/infrastructure/persistence/drizzle-product.repository.js';"),
  ],
  invalid: [
    { ...at(HANDLER, "import { eq } from 'drizzle-orm';"), errors: [{ messageId: 'package', data: { name: 'drizzle-orm', context: 'billing' } }] },
    { ...at(HANDLER, "import { readFile } from 'node:fs/promises';"), errors: [{ messageId: 'builtin' }] },
    { ...at(HANDLER, "import { DrizzleInvoiceRepository } from '../../../infrastructure/persistence/drizzle-invoice.repository.js';"), errors: [{ messageId: 'outward' }] },
    { ...at(HANDLER, "import type { IssueInvoiceBody } from '../../../presentation/http/issue-invoice.dto.js';"), errors: [{ messageId: 'outward' }] },
    { ...at(HANDLER, "import { database } from '@/platform/database/database.js';"), errors: [{ messageId: 'outward' }] },
    { ...at(HANDLER, "const adapter = await import('../../../infrastructure/external/stripe.gateway.js');"), errors: [{ messageId: 'outward' }] },
    { ...at(HANDLER, "import { billingModule } from '../../../billing.module.js';"), errors: [{ messageId: 'outward' }] },
  ],
});

ruleTester.run('layer-presentation-no-infrastructure', layerPresentationNoInfrastructure, {
  valid: [
    at(ROUTE, "import { IssueInvoiceCommand } from '../../application/commands/issue-invoice/issue-invoice.command.js';"),
    at(ROUTE, "import express from 'express';"),
    at(ADAPTER, "import { invoices } from './billing.schema.js';"),
  ],
  invalid: [
    { ...at(ROUTE, "import { DrizzleInvoiceRepository } from '../../infrastructure/persistence/drizzle-invoice.repository.js';"), errors: [{ messageId: 'forbidden' }] },
    { ...at(ROUTE, "import type { InvoiceRow } from '@/contexts/billing/infrastructure/persistence/billing.schema.js';"), errors: [{ messageId: 'forbidden' }] },
  ],
});

ruleTester.run('layer-infrastructure-no-presentation', layerInfrastructureNoPresentation, {
  valid: [at(ADAPTER, "import type { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';"), at(ROUTE, "import { body } from './issue-invoice.dto.js';")],
  invalid: [{ ...at(ADAPTER, "import type { IssueInvoiceBody } from '../../presentation/http/issue-invoice.dto.js';"), errors: [{ messageId: 'forbidden' }] }],
});
