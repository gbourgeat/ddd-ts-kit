import type { BackgroundJobDeclaration } from './background-job-declaration';
import type { DomainEventHandlerDeclaration } from './domain-event-handler-declaration';
import type { EdgeDeclaration } from './edge-declaration';
import type { HandlerDeclaration } from './handler-declaration';
import type { IntegrationEventHandlerDeclaration } from './integration-event-handler-declaration';
import type { JobDeclaration } from './job-declaration';
import type { MessageDeclaration } from './message-declaration';
import type { PolicyDeclaration } from './policy-declaration';
import type { PortDeclaration } from './port-declaration';
import type { ProjectionDeclaration } from './projection-declaration';

/** What a class said about itself. Plain data: reading it instantiates and resolves nothing. */
export type Declaration =
  | BackgroundJobDeclaration
  | MessageDeclaration
  | HandlerDeclaration
  | IntegrationEventHandlerDeclaration
  | DomainEventHandlerDeclaration
  | PortDeclaration
  | PolicyDeclaration
  | JobDeclaration
  | ProjectionDeclaration
  | EdgeDeclaration;
