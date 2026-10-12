import { Repository } from '@ddd-ts-kit/kernel';
import type { Waitlist } from '@/contexts/scheduling/domain/aggregates/waitlist.aggregate';

/** One waitlist per calendar and day, found by the identifier `Waitlist.idOf` gives: no other lookup is needed. */
export abstract class WaitlistRepository extends Repository<Waitlist> {}
