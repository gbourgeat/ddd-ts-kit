import type { BackgroundJobDeclaration } from './background-job-declaration.js';
import type { DomainEventHandlerDeclaration } from './domain-event-handler-declaration.js';
import type { EdgeDeclaration } from './edge-declaration.js';
import type { HandlerDeclaration } from './handler-declaration.js';
import type { IntegrationEventHandlerDeclaration } from './integration-event-handler-declaration.js';
import type { JobDeclaration } from './job-declaration.js';
import type { MessageDeclaration } from './message-declaration.js';
import type { PolicyDeclaration } from './policy-declaration.js';
import type { PortDeclaration } from './port-declaration.js';
import type { ProjectionDeclaration } from './projection-declaration.js';

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
