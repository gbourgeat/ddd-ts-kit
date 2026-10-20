import { injected } from '@ddd-ts-kit/kernel/declarations';
import { Contacts } from '@/contexts/notification/application/ports/contacts.port';
import { ContactsProjection } from '@/contexts/notification/application/projections/contacts.projection';

export * from '@/contexts/notification/application/projections/contacts.projection';

injected(ContactsProjection, [Contacts]);
