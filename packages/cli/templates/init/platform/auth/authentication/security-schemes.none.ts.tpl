import { developmentActorHeader } from '{{alias.platform}}/auth/authentication/development-actor-header{{alias.ext}}';

/** The scheme routes name in `security`, as the OpenAPI document declares it. */
export const securitySchemes = { developmentActor: { type: 'apiKey', in: 'header', name: developmentActorHeader } };
