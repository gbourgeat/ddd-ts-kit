import { Repository } from '@ddd-ts-kit/kernel';
import type { Invoice } from '../invoice';

export abstract class InvoiceRepository extends Repository<Invoice> {}
