import type { Config } from '../config';
import type { NestControllerEntry } from './nest-controller-entry';
import { nestControllersIn } from './nest-controllers-in';
import type { ProjectFiles } from './project-files';

/**
 * The Nest controllers of a context that the kit serves (a class of a `presentation/` folder of the
 * context or of one of its modules, carrying Nest's `@Controller`, in a file that imports the
 * bridge), in the order of their files, with what the signature of each route method says: the DTO class of each part of the request a parameter
 * takes whole (`@Body() body: IssueInvoiceBody`), and its answer, `Promise<IssuedInvoice>` a DTO
 * class, `Promise<Accepted>` an identifier, `Promise<void>` nothing.
 */
export function readNestControllers(files: ProjectFiles, config: Config, context: string): NestControllerEntry[] {
  // The presentation of the context, and that of each of its modules.
  return files
    .under(`${config.contextsDir}/${context}`)
    .filter((file) => file.includes('/presentation/') && file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .sort()
    .flatMap((file) => nestControllersIn(files, config, file));
}
