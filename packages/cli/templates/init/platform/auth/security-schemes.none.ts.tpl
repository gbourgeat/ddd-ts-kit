import { developmentActorHeader } from './development-actor-header.js';

/** The scheme routes name in `security`, as the OpenAPI document declares it. */
export const securitySchemes = { developmentActor: { type: 'apiKey', in: 'header', name: developmentActorHeader } };
