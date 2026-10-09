import type { AuditStamp } from '@ddd-ts-kit/kernel';
import { EntitySchema } from 'typeorm';
import { auditColumns, schemaNameOf } from '@ddd-ts-kit/typeorm';

const {{context.constant}}_SCHEMA = schemaNameOf('{{context.kebab}}');

// ddd-ts-kit:tables
// /ddd-ts-kit:tables
