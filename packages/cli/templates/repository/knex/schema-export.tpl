@@imports
import { create{{context.pascal}}Tables } from '{{paths.databaseToContexts}}/{{context.kebab}}/infrastructure/persistence/create-{{context.kebab}}-tables.schema.js';
@@schemas
await create{{context.pascal}}Tables(knex);
