// ddd-ts-kit:imports
import { EntitySchema } from 'typeorm';
import { schemaNameOf } from '@ddd-ts-kit/typeorm';
// /ddd-ts-kit:imports

const {{context.constant}}_SCHEMA = schemaNameOf('{{context.kebab}}');

// ddd-ts-kit:tables
// /ddd-ts-kit:tables
