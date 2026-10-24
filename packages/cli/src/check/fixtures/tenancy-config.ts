import { CONFIG_FILE } from '../../config';
import { config } from './config';

/** The config file of a project on shared tables (or another strategy), on the given ORM. */
export function tenancyConfig(orm: string, value = 'shared-table'): Readonly<Record<string, string>> {
  return { [CONFIG_FILE]: config({ stack: { orm, tenancy: value } }) };
}
