import type { Actor } from '@ddd-ts-kit/kernel';
import { Policy } from '@ddd-ts-kit/kernel/declarations';
import type { Invoice } from '../../domain/invoice.js';
import { permissions } from './billing.permissions.js';

@Policy(permissions['invoice.void'], { name: 'billing.only-issuer-voids' })
export class OnlyIssuerVoids {
  allows(actor: Actor, invoice: Invoice): boolean {
    return invoice.issuedBy === actor.id;
  }
}
