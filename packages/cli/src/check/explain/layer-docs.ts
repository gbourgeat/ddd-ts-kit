import type { RuleDoc } from '../model/rule-doc.js';

export const LAYER_DOCS: Readonly<Record<string, RuleDoc>> = {
  'layer/domain-purity': {
    why: 'The domain is the part of the system that has to survive a change of framework, database or transport. Every outside import ties a business rule to a technical choice and makes it impossible to test without that choice. Values that come from the outside world (ids, time, randomness) enter as parameters. The packages that apply a concern from outside (@ddd-ts-kit/aspects, audit, redis, scheduling, sentry, tracing) are refused whatever `domainAllowedPackages` says. The kernel itself is allowed, its entry @ddd-ts-kit/kernel/declarations is not: a declaration is wiring, and the domain declares nothing, neither a decorator on a class nor a dependency list. A repository port is a plain abstract class.',
    bad: `// domain/aggregates/invoice.aggregate.ts
import { randomUUID } from 'node:crypto';
import { IsEmail } from 'class-validator';
import { Logged } from '@ddd-ts-kit/aspects/decorators';
import { Repository } from '@ddd-ts-kit/kernel/declarations';`,
    good: `// domain/aggregates/invoice.aggregate.ts
import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { Money } from '../value-objects/money.vo.js';`,
  },
  'layer/application-inward': {
    why: 'A use case orchestrates the domain and talks to the outside through ports. If it imports an adapter, a framework or a driver, the technical choice can no longer be replaced or faked, and the handler cannot be unit tested with plain fakes. Cross-cutting behaviour reaches a use case from outside: @ddd-ts-kit/aspects, audit, redis, scheduling, sentry and tracing are refused whatever `applicationAllowedPackages` says, their place is the composition root, a bus middleware or an adapter. The declarations of the kernel (@ddd-ts-kit/kernel/declarations) are part of the kernel and belong here: a handler, a job or a policy says what it is and names the ports it depends on, which are abstract classes, without knowing a container.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
import { PgInvoiceRepository } from '../../../infrastructure/persistence/pg-invoice.repository.js';
import { RedisCache } from '@ddd-ts-kit/redis';
import { retry } from '@ddd-ts-kit/aspects';`,
    good: `// application/commands/issue-invoice/issue-invoice.handler.ts
import { Cache, Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';`,
  },
  'layer/presentation-no-infrastructure': {
    why: 'A route translates a transport request into a command or a query and maps the answer back. Reaching an adapter directly skips the use case, so the business rule that guards the operation is skipped too.',
    bad: `// presentation/http/issue-invoice.route.ts
import { PgInvoiceRepository } from '../../infrastructure/persistence/pg-invoice.repository.js';`,
    good: `// presentation/http/issue-invoice.route.ts
import type { IssueInvoiceHandler } from '../../application/commands/issue-invoice/issue-invoice.handler.js';`,
  },
  'layer/infrastructure-no-presentation': {
    why: 'Adapters implement ports declared inward. An adapter that knows a DTO or a route depends on one transport, and both outer layers start changing together.',
    bad: `// infrastructure/persistence/pg-invoice.repository.ts
import type { InvoiceDto } from '../../presentation/http/invoice.dto.js';`,
    good: `// infrastructure/persistence/pg-invoice.repository.ts
import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';`,
  },
};
