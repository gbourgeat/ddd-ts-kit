@@imports
import { create{{context.pascal}}Tables } from '{{alias.context}}/infrastructure/persistence/create-{{context.kebab}}-tables.schema{{alias.ext}}';
@@schemas
await create{{context.pascal}}Tables(knex);
