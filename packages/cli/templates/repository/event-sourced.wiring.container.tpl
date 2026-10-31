@@imports
import { EventStore, PersonalDataCipher } from '@ddd-ts-kit/kernel';
import { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
import { EventStore{{aggregate.pascal}}Repository } from '{{alias.context}}/infrastructure/persistence/event-store-{{aggregate.kebab}}.repository{{alias.ext}}';
@@registrations
builder.bind({{aggregate.pascal}}Repository).toClass(EventStore{{aggregate.pascal}}Repository, [EventStore, PersonalDataCipher]).as('repository');
