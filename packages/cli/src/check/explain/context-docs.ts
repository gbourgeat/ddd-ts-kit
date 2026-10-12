import type { RuleDoc } from '../model/rule-doc.js';

export const CONTEXT_DOCS: Readonly<Record<string, RuleDoc>> = {
  'context/published-language-only': {
    why: 'A bounded context owns its model and must be free to change it. The published language is the only part designed for others; importing anything else couples two models and turns every refactoring into a cross-team negotiation.',
    bad: `// contexts/shipping/application/...
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';`,
    good: `// contexts/shipping/application/...
import type { InvoiceIssuedV1 } from '@/contexts/billing/published-language/index';`,
  },
  'context/declared-relationship': {
    why: 'The context map is a strategic decision, not a side effect of an import. Declaring the upstream and the pattern keeps the map reviewable and lets the cycle check work.',
    bad: `// shipping imports billing/published-language, config has "shipping": { "upstreams": [] }`,
    good: `"shipping": { "classification": "supporting",
  "upstreams": [{ "context": "billing", "relationship": "published-language" }] }`,
  },
  'context/published-language-is-a-contract': {
    why: 'A contract that re-exports a domain class is no contract: consumers get the internal model and its behaviour through the back door. The published language holds serializable types that are versioned on purpose.',
    bad: `// published-language/index.ts
export { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';`,
    good: `// published-language/invoice-issued.v1.integration-event.ts
export interface InvoiceIssuedV1Payload { readonly invoiceId: string }`,
  },
  'context/no-cycle': {
    why: 'Two contexts that are upstream of each other are one context with a line drawn through it: neither can be changed, deployed or understood alone. One of them has to be the supplier.',
    bad: `"billing": { "upstreams": [{ "context": "shipping" }] },
"shipping": { "upstreams": [{ "context": "billing" }] }`,
    good: `"billing": { "upstreams": [] },
"shipping": { "upstreams": [{ "context": "billing" }] }`,
  },
  'context/extractable': {
    why: 'A bounded context is a deployable unit in waiting. Moving one to its own service must change a composition root and adapters, never domain or application code. A module that wires another context, a repository that reads its tables, a handler that loads its aggregates or a map shared through an export all hold only while both live in one process and one database. In the declared style the wiring is written on the classes: a role file that imports a port of another context (anything of its domain/repositories/*.repository.ts or application/ports/*.port.ts) ties the composition of the two, so ports come from the context itself, the kernel, @ddd-ts-kit/auth and the platform.',
    bad: `// contexts/shipping/infrastructure/persistence/drizzle-parcel.repository.ts
import { invoices } from '@/contexts/billing/infrastructure/persistence/invoice.schema';
export const cache = new Map<string, Parcel>();
// contexts/shipping/application/commands/ship-parcel/ship-parcel.handler.ts, declared style
import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';`,
    good: `// contexts/shipping/application/ports/invoice-status.gateway.port.ts
export abstract class InvoiceStatusGateway { abstract isPaid(invoiceId: string): Promise<boolean>; }
// contexts/shipping/infrastructure/external/in-process-invoice-status.gateway.ts
import type { InvoiceStatus } from '@/contexts/billing/published-language/index';
// contexts/shipping/application/commands/ship-parcel/ship-parcel.handler.ts, declared style
import { InvoiceStatusGateway } from '@/contexts/shipping/application/ports/invoice-status.gateway.port';`,
  },
};
