@@imports
import { EventStore{{aggregate.pascal}}Repository } from '{{alias.context}}/infrastructure/persistence/event-store-{{aggregate.kebab}}.repository{{alias.ext}}';
@@registrations
const {{aggregate.camel}}Repository = platform.adapter(new EventStore{{aggregate.pascal}}Repository(platform.eventSourcing.events, platform.eventSourcing.cipher), { kind: 'repository', context: '{{context.kebab}}', token: '{{aggregate.pascal}}Repository' });
