import { Repository } from '@ddd-ts-kit/kernel';
import type { Invoice } from '../invoice.js';

export abstract class InvoiceRepository extends Repository<Invoice> {}
