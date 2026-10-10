// ddd-ts-kit:imports
import { EntitySchema } from 'typeorm';
import { auditColumns, schemaNameOf } from '@ddd-ts-kit/typeorm';
// /ddd-ts-kit:imports

const {{context.constant}}_SCHEMA = schemaNameOf('{{context.kebab}}');

// ddd-ts-kit:tables
// /ddd-ts-kit:tables
