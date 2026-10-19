[English](README.md) · **Français**
<!-- translation-of: README.md sha256:9b8292041b12ffa0 -->

# ddd-ts-kit

Amorcez, générez, documentez et vérifiez des projets en Domain-Driven Design et en Clean
Architecture, en TypeScript. Un seul binaire : `init` crée le projet, `generate` écrit chaque
morceau de code répétitif à sa place canonique, `docs` tient à jour la documentation
d'architecture, `describe`, `status` et `todo` relisent le projet sous forme de faits, `check`
prouve que le code suit toujours [docs/ARCHITECTURE.fr.md](../../docs/ARCHITECTURE.fr.md).
`init` installe aussi le *pipeline* de qualité : ESLint avec `@ddd-ts-kit/eslint-plugin`,
dependency-cruiser, knip, des seuils de couverture, des *hooks* git et la CI de GitHub ou de GitLab.

Le générateur et le *checker* partagent une seule définition de l'arbre canonique, et un test
génère chaque genre de pièce pour chaque *stack* en exigeant zéro violation : ils ne peuvent pas
être en désaccord.

Les principales commandes se rangent en deux familles. La première écrit le projet : `init` une fois,
`generate` pour chaque pièce, `docs`, `sdk` et `depcruise-config` pour ce qui dérive du code et de
la configuration, et trois migrations qui font passer un projet d'une forme ancienne à la forme
actuelle. La seconde relit le projet sans le modifier : `check` le juge, `list` et `describe`
disent ce qu'il contient, `status` et `todo` disent ce qui reste à faire, `affected` dit ce
qu'une *pull request* doit exécuter.

![Les commandes de la CLI autour d'un projet : à gauche celles qui l'écrivent (init, generate, docs, sdk et depcruise-config, les trois migrations), au milieu le projet (ddd-ts-kit.config.json, les contextes délimités et la plateforme sous src/, les documents générés), à droite celles qui le relisent (check et check-file, list et describe, status et todo, affected)](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/cli-commands-and-project.fr.svg)

Aucune dépendance d'exécution. Node 22.12 ou ultérieur.

```
npx ddd-ts-kit init
npx ddd-ts-kit generate context billing --classification core --term "Invoice=A request for payment"
npx ddd-ts-kit generate aggregate billing Invoice
npx ddd-ts-kit generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue --grant accountant --term "Issue=To make an invoice final"
npx ddd-ts-kit generate route billing IssueInvoice --method POST --path /invoices
npx ddd-ts-kit check
```

`init` se termine en disant quoi lancer ensuite : `pnpm install`, puis `pnpm run verify`
(`npm install`, puis `npm run verify` avec `--package-manager npm` ; avec `--preset`,
`docs:generate` entre les deux, qui ajoute les routes et les événements du *preset* aux
contrats), puis les étapes recommandées
de la méthode, dans l'ordre ([méthodologie](../../docs/guides/methodology.fr.md)) ;
[quelle commande, quand](../../docs/guides/commands.fr.md) donne la commande de chaque moment d'un
projet et la référence de chaque option. Un nouveau projet passe toute cette porte avant que quoi
que ce soit soit généré, sans contexte, avec un et avec plusieurs : la suite de bout en bout
l'installe pour de vrai et l'exécute, avec les deux gestionnaires de paquets et sur chaque *stack*
éprouvée. Après l'installation, la CLI est celle que le projet épingle :
`pnpm exec ddd-ts-kit <command>`, ou `npx ddd-ts-kit <command>`.

Chaque commande accepte `--json` (sortie lisible par une machine, erreurs comprises) et
`--cwd <dir>`. Les commandes autres que `init` cherchent `ddd-ts-kit.config.json` dans le
répertoire et ses parents. Codes de sortie : `0` succès, `1` violations, documentation périmée
ou, sous `--strict`, un *commit* au-delà de ses limites, `2` mauvais usage (le message dit quoi
faire).

## init

```
ddd-ts-kit init [--http express|fastify|hono|nest|none]
                [--validation zod|class-validator|typebox|standard-schema|none]
                [--di tsyringe|nest|manual] [--tests vitest|jest]
                [--orm drizzle|knex|prisma|typeorm|custom|none]
                [--database postgres|mysql|sqlite|none]
                [--events in-memory|outbox] [--docs-ui swagger|scalar|redoc|none]
                [--ci github|gitlab|both|none] [--ci-extras <extra>,...|none]
                [--authn jwt|keycloak|none] [--authz rbac|abac|rebac|custom]
                [--broker none|rabbitmq|kafka|nats|redis|custom] [--cache none|redis]
                [--http-cache none|varnish] [--storage local|s3|none] [--audit on|off]
                [--errors none|sentry] [--logger stdout|pino|winston]
                [--style declared|explicit] [--assembly barrel|discovery]
                [--dependencies signature|listed] [--refusals named|factories|classes]
                [--routes controllers|functions] [--value-objects throwing|result]
                [--literals named|free] [--values classes|free] [--tenancy none|shared-table]
                [--queue database|redis|memory]
                [--schemas shared|per-route]
                [--package-manager npm|pnpm]
                [--allow-no-outbox "<reason>"] [--import-alias '$<name>/']
                [--import-extension none|js] [--sdk]
                [--context <name>:<core|supporting|generic>]...
                [--preset identity]...
                [--dry-run] [--force]
```

Fonctionne dans un répertoire vide comme dans un projet existant. Un fichier existant n'est
jamais remplacé sans `--force` ; il est signalé comme ignoré. `init` écrit aussi les contrats
générés tels que les scripts du projet les écrivent pour un projet qui n'a encore ni route ni
événement d'intégration à lui (`openapi/openapi.yaml`, `docs/integration/asyncapi.yaml` et
`event-catalog.md` ; en JSON sous `"openapi": { "format": "json" }` de la configuration), afin
que le premier *commit* les contienne et que `docs:check` passe d'emblée ; un contrat déjà
présent est laissé tel quel, `--force` compris. Un `package.json` existant est fusionné : les
scripts et les dépendances qui manquent sont ajoutés, les vôtres sont gardés et mentionnés dans
les notes. Relancé plus tard, `init` garde la *stack* enregistrée dans la configuration.

`init --force` sur un projet déjà initialisé réécrit les fichiers qui appartiennent à `init` et
garde la configuration : les contextes et leurs amonts, les règles, les limites, les dérogations
et toute autre clé restent tels qu'ils sont écrits, et la *stack* ne change que là où une option
nomme un choix (`init --force --logger pino` change le *logger* ; une combinaison que la *stack*
enregistrée ne peut pas accepter est refusée comme pour un nouveau projet). La racine de
composition, la preuve que chaque contexte se câble seul et le registre des permissions sont
réécrits depuis leurs *templates*, puis les contextes déclarés y sont câblés de nouveau ; ce
qu'un autre générateur avait ajouté à un fichier de la plateforme (la valeur d'une *gateway*, les
réglages d'un *job*) ne l'est pas, et une note le dit. Une configuration illisible est remplacée.

Le *pipeline* n'utilise que des outils gratuits. `--ci-extras` ajoute des *jobs* qui demandent
une offre payante sur un dépôt privé, ou qui ne remontent dans une *merge request* qu'avec une
offre payante : `codeql`, `dependency-review` (GitHub), `gitlab-sast`, `gitlab-secret-detection`,
`gitlab-dependency-scanning` (GitLab). La liste est enregistrée comme `ci.extras` dans la
configuration ; un nom inconnu, ou un *job* d'une plateforme que `--ci` ne couvre pas, est
refusé. Le tableau de chaque outil et de ses conditions :
[pipeline/README.md](../../pipeline/README.md#free-by-default-paid-on-request).

Un import d'un fichier du projet s'écrit sans extension
(`@/contexts/billing/domain/aggregates/invoice.aggregate`) : `init` enregistre
`"importExtension": "none"`, et `--import-extension js` demande à la place le `.js` du fichier
émis. Une configuration sans cette clé se lit comme `js`, si bien qu'un projet généré avant
l'existence de la clé garde son écriture. Voir [docs/CONFIG.fr.md](../../docs/CONFIG.fr.md).

Valeurs par défaut : `express`, `zod`, `tsyringe` (`nest` avec `--http nest`, et seulement
alors), `vitest`, `drizzle` sur `postgres`, `outbox` quand il y a un ORM, `swagger`, `github`,
`jwt`, `rbac`, aucun *broker*, le cache dans le processus, les fichiers dans un répertoire local
(`--storage local`), le journal d'audit `on` quand il y a un ORM, les échecs inattendus remontés
nulle part (`--errors none`), des lignes JSON sur la sortie standard (`--logger stdout`), et le
style `declared` avec un `barrel` partout où les déclarations sont lues : avec `--di tsyringe`.

**Gestionnaire de paquets.** `pnpm` sauf `--package-manager npm` : chaque script, *pipeline*,
*hook*, le Dockerfile, les consignes et les permissions des agents sont écrits dans le dialecte
de celui qui est choisi, enregistré sous `stack.packageManager`. pnpm est épinglé dans
`package.json` et fourni par corepack ; `pnpm-workspace.yaml` dit qu'aucune dépendance n'exécute
de script de build sans être autorisée par son nom. Les deux sont prouvés par une installation
réelle d'un projet généré, son build et son `verify`. Le kit est installé depuis le registre dans
les deux cas.

**Pipelines.** Une *pull request* ou une *merge request* exécute les *specs* unitaires, les
*specs* d'intégration et le lint des contextes que son changement atteint par la carte des
contextes ([`ddd-ts-kit affected`](#affected)) ; les types, l'architecture, le graphe des
imports, le code mort, le bout en bout, le build et les documents tournent toujours sur le projet
entier, et la branche par défaut et l'exécution nocturne planifiée exécutent tout.

**Deux styles.** Dans le style `declared`, chaque classe dit ce qu'elle est par un décorateur de
`@ddd-ts-kit/kernel/declarations` (`@Requires` ou `@Public` sur une commande ou une requête,
`@CommandHandler`, `@QueryHandler`, `@IntegrationEventHandler`, `@DomainEventHandler`, `@Scheduled`,
`@Policy`, `@Repository`, `@Gateway`, `@Adapter`), un contexte n'a pas de `<context>.module.ts`, et
la racine de composition l'assemble en une ligne. Dans le style `explicit`, chaque liaison est
écrite dans le fichier de module du contexte : `builder.bind(Port).toClass(Adapter, [Ports])`,
`builder.command(Message).requires(...).handledBy(Handler, [Ports])`, `builder.job(name, schedule)`.
`--style declared` est refusé avec `--di manual` et `--di nest` : les déclarations sont de simples
métadonnées, et seul `@ddd-ts-kit/di` (sur tsyringe) les transforme en liaisons.
`--assembly` dit comment un contexte déclaré rejoint la racine de composition : `barrel` (par
défaut) est un fichier généré par contexte, `<context>.declarations.ts`, statique, que suivent un
bundler, knip et dependency-cruiser ; `discovery` écrit à la place `await discoverContext(...)`,
avec l'entrée knip et l'exception dependency-cruiser dont les fichiers découverts ont besoin
(*publishers* et *jobs* compris : ils sont découverts comme le reste), et intègre
`@ddd-ts-kit/di` en ligne (inline) dans les deux configurations vitest, afin que les fichiers
qu'il importe lui-même soient compilés par l'exécuteur des tests. La découverte est acceptée
derrière un *broker* : un contexte écoute sur l'abonné que `EventSubscribers.forContext(name)`
lui remet, dans l'un ou l'autre assemblage. Une configuration écrite avant l'existence de
`stack.style` est explicite.

Le même cas d'usage dans les deux styles. Dans le style déclaré, la commande et son gestionnaire
(handler) portent leur décorateur, et le constructeur du gestionnaire dit ce dont il a besoin. Le
corps du gestionnaire est celui qu'écrit
`generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue`, avant
que son `TODO(domain)` soit traité ; l'entrée de la commande est remplie :

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { type Actor, AggregateRoot, AuthorizedCommand, type Clock, type IdGenerator, Repository } from '@ddd-ts-kit/kernel';
import { CommandHandler, Requires } from '@ddd-ts-kit/kernel/declarations';

declare class Invoice extends AggregateRoot {
  static create(id: string, now: Date): Invoice;
}

// domain/repositories/invoice.repository.ts
export abstract class InvoiceRepository extends Repository<Invoice> {}

// application/authorization/billing.permissions.ts
export const billingPermissions = definePermissions('billing', {
  'invoice.issue': { description: 'Issue invoice' },
});

// application/commands/issue-invoice/issue-invoice.command.ts
@Requires(billingPermissions['invoice.issue'])
export class IssueInvoiceCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly customerId: string,
  ) {
    super(actor);
  }
}

// application/commands/issue-invoice/issue-invoice.handler.ts
@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  // chaque paramètre est typé par une classe, qui est aussi son jeton d'injection
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: IssueInvoiceCommand): Promise<string> {
    const invoice = Invoice.create(this.ids.next(), this.clock.now());

    await this.invoiceRepository.save(invoice);

    return invoice.id;
  }
}
```

Dans le style explicite, les mêmes classes ne portent aucun décorateur, et le fichier de module
du contexte lie chacune d'elles, avec sa permission et les ports qu'elle reçoit :

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { defineContextModule } from '@ddd-ts-kit/di';
import { AggregateRoot, AuthorizedCommand, Clock, type CommandHandler, IdGenerator, Repository } from '@ddd-ts-kit/kernel';

// les classes de l'exemple déclaré, sans leurs décorateurs
declare class Invoice extends AggregateRoot {}
declare class IssueInvoiceCommand extends AuthorizedCommand<string> {}
declare class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  constructor(invoiceRepository: InvoiceRepository, ids: IdGenerator, clock: Clock);
  execute(command: IssueInvoiceCommand): Promise<string>;
}
declare class InMemoryInvoiceRepository implements InvoiceRepository {
  findById(id: string): Promise<Invoice | undefined>;
  save(invoice: Invoice): Promise<void>;
}

export abstract class InvoiceRepository extends Repository<Invoice> {}

export const billingPermissions = definePermissions('billing', {
  'invoice.issue': { description: 'Issue invoice' },
});

// billing.module.ts : chaque liaison du contexte, une ligne chacune
export const billingModule = defineContextModule({
  name: 'billing',
  register(builder) {
    builder.bind(InvoiceRepository).toClass(InMemoryInvoiceRepository).as('repository');
    builder
      .command(IssueInvoiceCommand)
      .requires(billingPermissions['invoice.issue'])
      .handledBy(IssueInvoiceHandler, [InvoiceRepository, IdGenerator, Clock]);
  },
});
```

`check` tient les deux formes : `authz/declared` signale une commande qui ne dit ni qui peut
l'envoyer ni qu'elle est publique, `declarations/role-declared` un fichier de rôle du style
déclaré sans son décorateur.

**Un port est une classe abstraite, et son propre jeton d'injection.**
`application/ports/<name>.port.ts` et `domain/repositories/<name>.repository.ts` contiennent
chacun une classe abstraite. Le code généré ne contient aucun `token()`, aucune constante
d'injection en UPPER_SNAKE, aucun `<context>.ports.ts` et aucun `platform/tokens.ts` : un
paramètre de constructeur typé par une classe de port nomme ce qui est injecté
(`private readonly clock: Clock`), les ports du kernel sont importés comme valeurs partout où ils
sont nommés dans une liste ou une liaison, et comme types là où ils ne font que typer un
paramètre, un adaptateur `implements` son port.

Au lieu d'une interface, d'une constante de jeton et d'une injection par nom :

```ts
export interface IPaymentGateway {
  charge(invoiceId: string, amountInCents: number): Promise<void>;
}

export const PAYMENT_GATEWAY = Symbol('PaymentGateway'); // ports/no-token-constant

constructor(@inject(PAYMENT_GATEWAY) private readonly payments: IPaymentGateway) {}
```

écrivez une seule classe abstraite, qui est à la fois le contrat et le jeton :

<!-- checked sample -->
```ts
import { Adapter } from '@ddd-ts-kit/kernel/declarations';

// application/ports/payment-gateway.port.ts
export abstract class PaymentGateway {
  abstract charge(invoiceId: string, amountInCents: number): Promise<void>;
}

// infrastructure/external/remote-payment-gateway.adapter.ts : implémente le port, ne l'étend jamais
@Adapter(PaymentGateway, { kind: 'external' })
export class RemotePaymentGateway implements PaymentGateway {
  async charge(invoiceId: string, amountInCents: number): Promise<void> {
    // TODO(platform): appeler le prestataire de paiement avec invoiceId et amountInCents
  }
}

// un gestionnaire nomme le port par le type de son paramètre : rien d'autre ne dit ce qui est injecté
export class SettleInvoiceHandler {
  constructor(private readonly payments: PaymentGateway) {}

  async settle(invoiceId: string, amountInCents: number): Promise<void> {
    await this.payments.charge(invoiceId, amountInCents);
  }
}
```

`ports/abstract-class`, `ports/implements-never-extends`, `ports/no-token-constant` et
`ports/value-import` tiennent cette forme, dans `check` et dans ESLint.

**Le constructeur énonce les dépendances.** Dans le style déclaré, une classe générée ne liste
rien dans son décorateur (`@CommandHandler(IssueInvoiceCommand)`) : chaque paramètre du
constructeur est typé par une classe, son jeton (`declarations/constructor-injection`).
`generate`, `docs` et le script `dev` lisent les signatures, avec le scanner sans dépendance du
*checker* et sans compilateur, et écrivent des instructions `injected(Class, [Tokens])` dans le
fichier généré de chaque contexte : le barrel `<context>.declarations.ts`, ou
`<context>.dependencies.ts` sous discovery. `@ddd-ts-kit/di` injecte à partir de là. Rien ne
repose sur `emitDecoratorMetadata` : il est absent avec les décorateurs standard et sous `tsx`.
`init` écrit `"stack.dependencies": "signature"` ; une configuration sans la clé vaut `listed`,
la forme de 0.1 (`@CommandHandler(M, [Ports])`), qui continue de fonctionner sans changement, et
`--dependencies listed` la demande. Le style explicite reste explicite : son fichier de module
liste ce que reçoit chaque classe. Chaque fichier généré exporte une classe, une interface ou une
fonction, et porte son nom.

![Comment un contexte déclaré rejoint la racine de composition : les fichiers de rôle portent leur décorateur et typent les paramètres de leur constructeur par des classes ; generate, docs et le script dev lisent ces signatures et écrivent le barrel, un export par fichier de rôle et une instruction injected par classe qui reçoit quelque chose ; la racine de composition inclut le barrel avec contextModule et @ddd-ts-kit/di injecte à partir de lui ; check et docs --check signalent un barrel qui ne correspond plus aux fichiers de rôle](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/cli-declared-barrel.fr.svg)

Un extrait du barrel du contexte `notification` de l'application d'exemple, tel que la CLI
l'écrit (jamais à la main) :

```ts
// src/contexts/notification/notification.declarations.ts
import { injected } from '@ddd-ts-kit/kernel/declarations';
import { WithdrawReminderHandler } from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.handler';
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';
import { KnexReminderRepository } from '@/contexts/notification/infrastructure/persistence/knex-reminder.repository';
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';

export * from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.command';
export * from '@/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.handler';
export * from '@/contexts/notification/infrastructure/persistence/knex-reminder.repository';

injected(WithdrawReminderHandler, [ReminderRepository]);
injected(KnexReminderRepository, [KnexContext, ExecutionScope, Clock]);
```

et l'unique ligne de la racine de composition qui ajoute tout le contexte :
`contextModule('notification', notificationDeclarations)` dans `src/platform/compose-application.ts`.

**Un refus est une classe à lui.** `init` écrit `"stack.refusals": "named"` : chaque refus d'un
contexte est une classe nommée d'après ce qui est refusé, qui étend `DomainRefusal` du kernel,
construite par des fabriques (factories) statiques nommées d'après ce sur quoi porte le refus, et
son code se lit dans la liste fermée des codes du contexte, `domain/errors/codes.ts`.
`generate error <context> <Refusal> <factory>` écrit la classe, son code et la fabrique. Les
règles `errors/*` tiennent cette forme. Deux formes antérieures continuent de fonctionner :
`--refusals factories`, une classe d'erreur par concept qui étend `ConceptError`, chaque refus une
fabrique statique de celle-ci, comme l'écrivait `init` auparavant ; et `--refusals classes`, ou
une configuration sans la clé, une classe par erreur construite avec `new`, comme 0.1 et 0.2 les
écrivaient. `error-factories` fait passer un projet de l'une ou l'autre à `named`.

La forme qu'écrit `init`, que commence `generate error scheduling SlotTaken forCalendar` :

<!-- checked sample -->
```ts
import { DomainRefusal } from '@ddd-ts-kit/kernel';

// domain/errors/codes.ts : la liste fermée des codes du contexte
export const SchedulingCodes = {
  SlotTaken: 'SLOT_TAKEN',
} as const;

export type SchedulingCode = (typeof SchedulingCodes)[keyof typeof SchedulingCodes];

// domain/errors/slot-taken.error.ts
export class SlotTaken extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTaken;

  static forCalendar(calendarId: string) {
    return SlotTaken.refusal(`The slot of calendar ${calendarId} is already held.`, { calendarId });
  }
}

const refusal = SlotTaken.forCalendar('calendar-1');

// ce qui l'attrape reconnaît le refus à sa classe, et lit ses faits
if (SlotTaken.is(refusal)) {
  console.log(refusal.facts.calendarId);
}
```

Sous `"stack.refusals": "factories"` : une classe par concept du glossaire, une fabrique par refus,
que `generate error scheduling Appointment slotTaken` ajoute.

<!-- checked sample -->
```ts
import { ConceptError } from '@ddd-ts-kit/kernel';

// domain/errors/appointment.error.ts
export class AppointmentError extends ConceptError {
  static slotTaken(calendarId: string) {
    return AppointmentError.refusal('SLOT_TAKEN', `The slot of calendar ${calendarId} is already held.`, { calendarId });
  }
}

const refusal = AppointmentError.slotTaken('calendar-1');

// ce qui l'attrape reconnaît le refus à sa classe et à son code, et lit ses faits
if (AppointmentError.is(refusal, 'SLOT_TAKEN')) {
  console.log(refusal.facts.calendarId);
}
```

La forme la plus ancienne, sous `"stack.refusals": "classes"` : une classe par erreur.

<!-- checked sample -->
```ts
import { DomainError } from '@ddd-ts-kit/kernel';

// domain/errors/slot-taken.error.ts
export class SlotTakenError extends DomainError {
  readonly code = 'SLOT_TAKEN';

  constructor(readonly calendarId: string) {
    super(`The slot of calendar ${calendarId} is already held.`);
  }
}

const refusal = new SlotTakenError('calendar-1');
```

**Une route est une classe contrôleur.** `init` écrit `"stack.routes": "controllers"` : chaque
route est une classe à une seule méthode, dans un dossier à elle, derrière les gardes de son
groupe de routes, et un contexte déclaré ne liste aucune route : ses contrôleurs rejoignent
l'application par son fichier généré. `--routes functions`, ou une configuration sans la clé,
garde une fonction `defineRoute` par route, listée dans `<context>.routes.ts`, comme 0.1 à 0.3
les écrivaient ; `controllers` fait passer un projet de l'une à l'autre, un contexte à la fois.

**Une forme se déclare une seule fois.** `init` écrit `"stack.schemas": "shared"` : une route de
commande répond son identifiant avec `acceptedSchema` de `@ddd-ts-kit/http`, un seul composant
`Accepted` dans le contrat, et `generate schema <context> <Name>` (ou
`schema shared-kernel <Name>`) écrit une forme qu'utilisent plusieurs routes, que le contrat
documente une fois et à laquelle chaque route renvoie. Les règles `schema/*` tiennent cette
forme. `--schemas per-route`, ou une configuration sans la clé, garde un schéma par route,
réponse d'identifiant comprise, comme 0.1 à 0.5 les écrivaient.

**Un objet-valeur lève ses refus.** `init` écrit `"stack.valueObjects": "throwing"` :
`generate value-object` écrit un `create` qui renvoie l'objet-valeur ou lève le refus de son
concept, et une *spec* qui le vérifie avec `expectRefusal(() => ..)`. `--value-objects result`,
ou une configuration sans la clé, garde un `create` qui renvoie un `Result` que l'appelant
déballe, comme 0.1 à 0.5 l'écrivaient ; `value-objects` fait passer un projet de l'un à l'autre.

**Les événements du domaine partent avec la sauvegarde.** Un gestionnaire de commande généré
construit ou charge son agrégat, appelle une méthode d'intention, `await repository.save(aggregate)`
et répond : pas de `pullEvents()`, et pas de `DomainEventDispatcher` dans un gestionnaire ni dans
un adaptateur de *repository*, qui ne fait que persister. Les événements que l'agrégat a
enregistrés sont distribués une fois la sauvegarde résolue, dans l'unité de travail de la
commande : par le module du kernel sur tsyringe, par `dispatchingOnSave` autour de chaque
*repository* dans `platform/create-platform.ts` en câblage manuel
(`domain-events/dispatched-on-save`).

Au lieu de tirer les événements et de les distribuer dans le gestionnaire :

```ts
async execute(command: IssueInvoiceCommand): Promise<void> {
  const invoice = await this.invoiceRepository.findById(command.invoiceId);

  invoice.issue(this.clock.now());
  await this.invoiceRepository.save(invoice);
  await this.dispatcher.dispatch(invoice.pullEvents()); // domain-events/dispatched-on-save
}
```

écrivez la sauvegarde, et rien après elle :

<!-- checked sample -->
```ts
import { type Actor, AggregateRoot, AuthorizedCommand, type Clock, type CommandHandler, DomainRefusal, Repository } from '@ddd-ts-kit/kernel';

declare class Invoice extends AggregateRoot {
  /** Rend la facture définitive et enregistre InvoiceIssued, qui attend dans l'agrégat. */
  issue(now: Date): void;
}

declare class UnknownInvoice extends DomainRefusal {
  readonly code: 'INVOICE_NOT_FOUND';
  static forInvoice(invoiceId: string): UnknownInvoice;
}

export abstract class InvoiceRepository extends Repository<Invoice> {}

export class IssueInvoiceCommand extends AuthorizedCommand<void> {
  constructor(
    actor: Actor,
    readonly invoiceId: string,
  ) {
    super(actor);
  }
}

export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: IssueInvoiceCommand): Promise<void> {
    const invoice = await this.invoiceRepository.findById(command.invoiceId);

    if (invoice === undefined) {
      throw UnknownInvoice.forInvoice(command.invoiceId);
    }

    invoice.issue(this.clock.now());

    // InvoiceIssued est distribué une fois cette sauvegarde résolue, dans l'unité de travail de la commande
    await this.invoiceRepository.save(invoice);
  }
}
```

`--events in-memory` avec un ORM est refusé sauf si `--allow-no-outbox "<reason>"` est donné :
il enregistre une entrée `deviations` (`stack.events`) et écrit l'enregistrement de décision vers
lequel elle pointe. La persistance générée des quatre ORM est écrite pour PostgreSQL ; `custom`
démarre sur des adaptateurs en mémoire tenus aux suites de contrat, à vous de les remplacer. Les
choix sont enregistrés sous `stack` dans la configuration, `docsUi`, `ci` et `logger` compris.

| Écrit | Contenu |
|---|---|
| `ddd-ts-kit.config.json` | *stack*, contextes, sévérités des règles ([docs/CONFIG.fr.md](../../docs/CONFIG.fr.md)) |
| `package.json` | scripts et dépendances de la *stack* (ci-dessous) ; `build` est le compilateur, puis `ddd-ts-kit build-aliases` |
| `tsconfig.json`, `tsconfig.build.json` | strict, NodeNext, `rootDir` `.` et `outDir` `dist`, et `paths` : l'unique déclaration de l'alias d'import (`@/*` vers `./src/*`, `$test/*`, `$scripts/*`, et `$generated/*` avec Prisma), dérivée de `importAlias` (`--import-alias '$<name>/'`, `@/` par défaut ; `#<name>/` et `@<name>/` sont refusés avec la raison) ; la configuration de build étend l'autre et ne déclare pas de `paths` ; `experimentalDecorators` (et `emitDecoratorMetadata`) seulement pour nest ou class-validator, dont les décorateurs sont de l'ancienne forme (legacy) : les déclarations et les aspects servent les deux modes |
| `src/main.ts` | racine de composition : le traçage d'abord (la remontée des erreurs en second avec `--errors sentry`), la configuration, la persistance, l'application (`log`, `traceConsumers: config.tracing.consumers`, `resilience`, `jobs: { start: config.runJobs, settings: jobSettings(process.env) }`), le relais de l'outbox, le serveur HTTP ; sur `SIGTERM` ou `SIGINT`, il ferme le serveur, arrête le relais, arrête l'application, ferme la persistance et éteint le traçage |
| `src/platform/` | un export par fichier, chacun portant son nom, dans un dossier par préoccupation. À sa racine : `tracing.ts`, `compose-application.ts` et `job-settings.ts` (`jobSettings(environment, context?)` : une ligne par *job*, `JOB_<CONTEXT>_<JOB>_ENABLED=false` en désactive un). `config/` (`app-config.ts`, `load-config.ts`, `config-error.ts`, `read-tracing.ts` : échec immédiat sur `DATABASE_URL`, `LOG_LEVEL`, `LOG_FORMAT`, `LOG_SCRUB_MESSAGES`, la politique `OUTBOUND_*`, `RUN_JOBS` et les variables de traçage ci-dessous) ; `observability/` (`create-logger.ts`, voir `--logger` ; `create-metrics.ts` : un `NoopMetrics` derrière un `TODO(platform)`) ; `resilience/` (`resilience-settings.ts`, `default-resilience.ts`, `adapter-aspects.ts` : nouvelle tentative avec temporisation croissante et délai d'expiration pour `external` et `gateway`, `own-policy.ts` pour un adaptateur qui énonce la sienne, `self-governed.ts`) ; `events/`, `database/`, `auth/`, `audit/`, `redis/` (ci-dessous) ; `http/` (`start-http-server.ts`, `with-documentation.ts` : `/docs` et `/openapi.json`, ou `/openapi/<name>.json` par document d'un contrat découpé, désactivés en production sauf `API_DOCS=true` ; `openapi-documents.ts`, le découpage qu'écrit `ddd-ts-kit docs` depuis `openapi.documents`). Avec `--di tsyringe` : `compose-application.ts` (`composeApplication(persistence, options, contexts?)` : `kernelModule({...})`, le module de la plateforme, le module d'autorisation, les contextes ; installe le moteur des aspects), `lay-foundations.ts` (une portée d'exécution, l'horloge, le générateur d'identifiants, le *logger*, les métriques, l'instrumentation et l'audit, construits avant tout module), `platform.module.ts` (ce qui remplace les valeurs par défaut du kernel dans le processus : unité de travail, magasin des événements traités, la classe de stockage, `OutboxStore`, `EventSubscribers` derrière un *broker*, `ErrorMapper`, et `builder.around(['external', 'gateway'], ...)`, la résilience de chaque adaptateur qui sort du processus), `platform-test.module.ts` (ce qu'une *spec* de gestionnaire liste à côté de son contexte : la classe de stockage liée à une fabrique qui lève une erreur), `buses/create-command-bus.ts` et `create-query-bus.ts` (du plus extérieur au plus intérieur : `errorReportingMiddleware`, `loggingMiddleware`, `metricsMiddleware`, la permission, le *span* du cas d'usage, l'entrée d'audit, puis l'unité de travail d'une commande). Avec `--di manual` ou `nest` : `compose-application.ts`, `platform.ts` (`interface Platform`, avec `jobs: JobScheduler` et `adapter`, qui enveloppe ce qu'un fichier de module instancie), `create-platform.ts`, `jobs/configured-job-scheduler.ts` (applique `job-settings.ts` à ce qu'un module enregistre) |
| traçage | câblé une fois, par la plateforme (`tracing/platform-only`) : pas de *hook* `decorate`, pas de `decorate-bindings.ts`. `tracing.ts` démarre `initTracing` de `@ddd-ts-kit/tracing/node` avant tout autre module, sur ce que valide `config/read-tracing.ts` : `OTEL_EXPORTER_OTLP_ENDPOINT` (une URL ; absente, aucun *span* ne sort du processus), `TRACE_SAMPLE_RATIO` (de 0 à 1) et `TRACE_CONSUMERS` (`continue`, par défaut : un événement consommé reste dans la trace de sa publication ; `link` : chaque livraison démarre une trace liée à elle). Avec `--di tsyringe` : `lay-foundations.ts` construit `traceApplication({ consumers })`, `compose-application.ts` la remet à `kernelModule({ instrumentation })` (un *span* par cas d'usage, appel de *repository*, événement du domaine, publication, consommateur et *job*) et donne au relais de l'outbox `tracedPublisher(bus)`. En câblage manuel : `create-platform.ts` applique lui-même les membres de `traceApplication()` (`useCase` sur les deux bus, `domainEvents`, `publisher`, `binding` autour de chaque adaptateur, `job`, `executionScope`, `errorReporter`), avec `tracedSubscriber` et `tracedPublisher` autour du fournisseur. Avec une *stack* HTTP, dans les deux familles, `auth/http-boundary.ts` pose `around: tracedRoutes()` : un *span* `SERVER` par requête HTTP, nommé d'après sa route |
| `--logger` | `src/platform/observability/create-logger.ts`, un par choix : `stdout` (par défaut) est le `StdoutLogger` de `@ddd-ts-kit/aspects`, des lignes JSON, identifiants de connexion non masqués ; `pino` est `createPinoLogger` de `@ddd-ts-kit/pino` (dépendances `pino` et `pino-pretty`) ; `winston` est `createWinstonLogger` de `@ddd-ts-kit/winston` ; ces deux-là masquent les clés d'identifiants de connexion du kernel. Chaque entrée porte `traceLogFields(scope)` : l'identifiant de corrélation, l'origine, l'acteur et le *tenant* du travail en cours, et les identifiants de la trace active. `LOG_LEVEL`, `LOG_FORMAT` (`json`, par défaut, ou `pretty` ; avec `stdout`, qui n'a pas de format lisible, `pretty` est refusé au chargement de la configuration) et `LOG_SCRUB_MESSAGES` (`[message removed]` à la place du message d'une erreur journalisée qui n'est pas une `DomainError`) sont validés dans `config/load-config.ts`. L'arrêt de l'application vide le tampon du *reporter* d'erreurs, puis celui du *logger*, en dernier : `container.stop()` le fait sur tsyringe, `compose-application.ts` le fait explicitement en câblage manuel. Les outils et les tests composent l'application sans `log` et n'écrivent rien |
| `src/platform/auth/` | `create-authenticator.ts` (`--authn jwt` : `JwtAuthenticator` sur `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URI` ; `--authn keycloak` : `keycloakAuthenticator` sur `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_AUDIENCE` et l'optionnel `KEYCLOAK_CLIENT_ID` ; `--authn none` : `development-header-authenticator.ts`, qui lit `x-development-actor` et lève une erreur en production), `principal-of.ts`, `security-schemes.ts`, `offline-authenticator.ts`, `http-boundary.ts` (`resolvePrincipal` qui répond une `Session`, `executionScope`, `errorMapper` et `onError`, étalés dans les options de montage : chaque requête HTTP s'exécute dans la portée d'exécution, avec son identifiant de corrélation), `create-authorizer.ts` et les fichiers du modèle (`roles.ts`, avec le rôle `system` que détient chaque acteur système ; `attribute-policies.ts` ; `relationship-schema.ts`, `create-tuple-store.ts` et sa *spec* de contrat, `relation-tuples.ts`, `relate-system-actors.ts`, `permission-mapping.ts` et `permissions.ts` ; `custom-authorizer.ts`, sa *spec* `authorizerContract` et `permissions.ts`), `authorization.ts` (`authorizationModule` avec tsyringe) ou `use-case-protection.ts` (la garde des bus câblés à la main), `access-policies.ts`, et avec `--audit off` `log-decisions.ts` (une entrée de journal par décision, identifiants et codes seulement). Sans *stack* HTTP, il n'y a ni authentificateur ni frontière |
| `--representations negotiated`, `--forms on` | `src/platform/http/presentation-of.ts` (`Representations.standard()` avec `negotiated`, et `fieldDeciderOf` sur l'`Access` de l'application), décomposé dans la frontière HTTP et donné au script du contrat ; avec `--forms on`, `src/platform/http/with-forms.ts` ajoute `formRoutes` aux routes et `scripts/openapi.ts` écrit `openapi/forms/<operationId>.json`. Les deux sont la valeur par défaut avec une *stack* HTTP ; `json` et `off` les laissent de côté ([docs/CONFIG.fr.md](../../docs/CONFIG.fr.md)) |
| `--audit on` | `src/platform/audit/` : `create-audit.ts` (le journal, le `onDecision` de l'autorisation, les refus des gardes à la frontière remis à la frontière HTTP comme `onGuardRefusal`, le *middleware* avant l'unité de travail, les événements d'intégration abonnés sous le nom de consommateur `audit`), `audited-events.ts` (le registre auquel `generate integration-event` ajoute), `audit.module.ts`, et avec une *stack* HTTP le côté lecture : `audit.permissions.ts` (`audit:trail.read`), `search-audit-entries.query.ts`, son gestionnaire, `search-audit-entries.route.ts` (`GET /audit/entries` : pages par curseur, filtres `actorId`, `action`, `outcome`, `correlationId`). C'est une capacité de la plateforme, pas un contexte délimité : pas de modèle, une requête protégée sur le port `AuditReader`, bornée par le *tenant* de l'acteur (avec `--tenancy shared-table`, par le *tenant* du travail au moyen de `TenantAuditReader` : le personnel de la plateforme ne lit à travers les *tenants* qu'à l'intérieur de `acrossTenants`). Les refus d'un appelant sans identifiant de connexion ne sont pas enregistrés. Un *job* planifié est audité comme une requête HTTP : origine `schedule`, acteur `system:<context>.<job>`. Avec knex, les deux tables et leurs déclencheurs en ajout seul sont créés par la première migration ; avec drizzle, les tables sont dans `schema.ts` et `npm run db:audit-guard` affiche les instructions des déclencheurs pour une migration personnalisée ; avec prisma, typeorm, `custom` ou sans ORM, le journal est un `InMemoryAuditTrail` derrière un `TODO(platform)`. Les bases de test laissent le schéma d'audit hors de `reset()` |
| `--tenancy shared-table` | enregistré comme `stack.tenancy` ; Knex ou Drizzle seulement. Chaque `generate repository` est cloisonné par *tenant* (comme `--tenant-scoped`), au moyen de `tenantTable` et `ownTenantTable` ou de `tenantCondition` et `ownTenantCondition` ; l'outbox garde le *tenant* de chaque événement (`createOutboxTables(knex, { tenant: true })` et le `tenant: true` de `KnexOutboxStore`, ou `tenantOutboxTable`), si bien que les consommateurs s'exécutent dans ce *tenant* ; `tenancy/scoped-statement` juge les adaptateurs. La sécurité au niveau des lignes, un schéma par *tenant* et une base par *tenant* sont refusés, avec ce qu'il faut câbler à la main ([Multitenance](../../docs/concepts/multitenancy.fr.md)) |
| `--queue database\|redis\|memory` | enregistré comme `stack.queue`. `database` (par défaut sur Knex ou Drizzle avec tsyringe) : `createJobTable` et `createProcessTable`, ou `jobsTable` et `processesTable`, dans le schéma `messaging`, `Persistence` gagne `jobs` et `processes`, et le module de la plateforme relie `JobStore` et `ProcessStore` à eux, si bien qu'un *job* mis en file par une commande est écrit dans sa transaction ; `redis` (avec `--cache redis`) : `RedisJobStore` sur la connexion du cache, les processus dans la base de données ; `memory` (par défaut sinon) : rien n'est écrit, le module du kernel garde les deux dans le processus. Refusé hors de tsyringe, `database` avec un autre ORM, `redis` sans le cache |
| `--cache redis` | `src/platform/redis/open-redis.ts` (`RedisServices` : le cache lié au `Cache` du kernel, le limiteur à `RateLimiter`, le verrou à `Lock`, qui réserve un *job* planifié à une seule instance, le signal du relais comme `wakeOn` du relais de l'outbox avec `relayWakeUpMiddleware` sur le bus de commandes), `http/refusal-for.ts` (une fenêtre glissante par adresse d'appelant, 429 `application/problem+json` avec `retry-after` ; `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`), `GET /health/ready` sur le serveur HTTP, `REDIS_URL` validée, un service compose `cache` qui exécute Dragonfly avec un contrôle de santé. Sans serveur (outils, tests sans `REDIS_URL`), les mêmes ports restent dans la mémoire du processus |
| `--http-cache varnish` | un service compose `varnish` (Varnish 9.1.0, qui joint l'API sur `host.docker.internal`) avec son VCL dans `docker/varnish/default.vcl` (seules les réponses dont le `Cache-Control` les autorise par `max-age` ou `s-maxage` sont gardées, rangées sous leurs étiquettes `xkey`, purgées par `PURGE` depuis la machine de Varnish ou avec `VARNISH_PURGE_KEY`, `x-cache: HIT\|MISS`), `VARNISH_URL` et `VARNISH_PURGE_KEY` validées, `cacheTags: { header: CacheTagHeader.xkey }` dans la frontière HTTP, et le relais de l'outbox de `main.ts` et de chaque point d'entrée de `generate service` qui publie au moyen de `PurgingPublisher` avec `VarnishCachePurger` (l'application de bout en bout enregistre les purges dans `purges`) ; sur `--di manual` et `nest`, la plateforme gagne `cacheInvalidation` ; avec `--tenancy`, les étiquettes des réponses et les purges sont rangées sous le *tenant* (`perTenant`) et le *tenant* d'une requête HTTP est lu dans `x-tenant-id`. Demande un framework HTTP et `--events outbox` : une purge est une ligne de l'outbox |
| `--errors sentry` | les échecs inattendus remontés à Sentry ou à GlitchTip (un seul protocole, seul le DSN diffère) au moyen de l'`ErrorReporter` du kernel, lié à `@ddd-ts-kit/sentry`. `src/platform/errors.ts` (`initSentry` sur la configuration validée, puis `reportProcessFailures`), le deuxième import de `main.ts`, de `apps/<context>/main.ts` et de `apps/worker/main.ts`, juste après `tracing.ts` ; `errors` remis à `composeApplication`, qui le donne au module du kernel sur tsyringe (`errorReporter`, vidé par `container.stop()` avant le *logger*, `errorReportingMiddleware` en premier sur les deux bus, le planificateur par défaut qui observe avec `reportFailedRuns`) ou à `createPlatform` à la main (le même *middleware*, `onRun: reportFailedRuns(errors)`, `platform.errors`, vidé en deux secondes au plus quand l'application s'arrête) ; `reportHttpErrors` dans `auth/http-boundary.ts` pour chaque requête HTTP qui reçoit une réponse 5xx ; `DeadLetterReports` sur le *hook* `onFailure` d'un *broker* fourni (`createEventProvider(config, errors)`, avec `observing` autour de chaque consommateur) et du relais de l'outbox. `SENTRY_DSN`, `SENTRY_ENVIRONMENT` (par défaut : `NODE_ENV`), `SENTRY_RELEASE` et `SENTRY_SCRUB_MESSAGES` validées dans `config/load-config.ts` comme `errorReporting` : sans DSN, l'application démarre et ne remonte rien ; un DSN qui n'est pas une URL refuse le démarrage. Dépendances `@ddd-ts-kit/sentry` et `@sentry/node`. Un profil compose `errors` qui exécute GlitchTip 6.2.6 avec son propre PostgreSQL et son propre Valkey (`GLITCHTIP_PORT`, sur la boucle locale seulement, amorçage de développement), et une section du README généré qui dit comment lire son DSN. Les outils et les tests composent l'application sans *reporter*. Il va avec tous les autres choix de la *stack* ; avec `--errors none`, rien de tout cela n'est écrit |
| `--authn keycloak` | un service compose `keycloak` (Keycloak 26.8.0, `start-dev --import-realm`, profil `identity`) et `docker/keycloak/<project>-realm.json` : le client de l'API, un client public `<project>-local` avec l'octroi direct, ses *mappers* d'audience et de `tenant_id`, le rôle de realm `admin`, et les utilisateurs de démonstration `demo-admin` et `demo-user`, pour le développement local seulement |
| `--storage local\|s3` | enregistré comme `stack.storage` : où vit le contenu des fichiers, jamais dans la base de données. `src/platform/config/read-files.ts` et `src/platform/files/open-files.ts`, un par choix : `local`, un répertoire en développement (`FILES_DIRECTORY`, `.data/files`) et les liens signés servis par l'application sous `/files` (`FILES_PUBLIC_URL` et `FILES_SIGNING_SECRET` requises en production) ; `s3`, un bucket de n'importe quel fournisseur du protocole S3 au moyen de `@ddd-ts-kit/s3` (les variables `S3_*`, MinIO dans la stack compose) ; la mémoire du processus dans les tests et les outils, dans les deux cas. Avec `--di tsyringe` : `files/bind-files.ts`, `files/files.module.ts` et `files/staging-uploads.ts` ; en câblage manuel, `files/create-files.ts` ; avec une *stack* HTTP, `files/file-routes.ts`. Ils lient `FileStorage`, `FileKeys`, `FileScanner` et `FileStaging`, enregistrent la purge horaire des fichiers en attente et mettent en attente le fichier que porte une commande avant sa transaction ; `generate file-upload` en a besoin. `--storage none` n'écrit rien de tout cela ([Stockage de fichiers](../../docs/concepts/file-storage.fr.md)) |
| `src/platform/events/` | `event-provider.ts` (`bus`, `forConsumer(name)`, `start()`, `close()`), `in-process-events.ts`, et pour `--broker` `create-event-provider.ts` : `RabbitMqEventBus` (`AMQP_URL`), `KafkaEventBus` (`KAFKA_BROKERS`, avec `aggregate-key-of.ts` pour l'ordre par agrégat), `NatsEventBus` (`NATS_URL`) ou `RedisStreamsEventBus` de `@ddd-ts-kit/redis/event-bus` (`REDIS_URL` : Redis, Dragonfly ou Valkey), chacun avec un abonné par contexte consommateur (`forConsumer`), `assertTopology` au démarrage, son adresse validée et un service compose avec un contrôle de santé ; ou `custom-event-bus.ts` avec sa *spec* `eventBusContract`. `start-outbox-relay.ts` avec l'outbox. `--broker redis` avec `--cache redis` fait un seul serveur et un seul service compose, `cache` ; seul, le service s'appelle `streams` |
| `src/platform/database/` | `persistence.ts` (`interface Persistence` : unité de travail, magasins de l'outbox et des événements traités du *package* de l'ORM, la poignée de stockage), `open-persistence.ts`, `persistence-over.ts`, `inert-persistence.ts`, la connexion (`connect-to-database.ts`, `create-client.ts` ou `create-data-source.ts`), `schema.ts`, `open-test-database.ts` (PostgreSQL dans le processus, ou le serveur nommé par une URL ; avec Vitest chaque *spec* ouvre une copie du cluster que `test/support/test-database-template.ts`, la mise en place globale de l'exécution, initialise une fois, et y crée ses tables). La classe de stockage qu'un adaptateur de *repository* nomme dans sa liste de dépendances : `database.ts` avec drizzle et prisma (`abstract class Database extends` le type de contexte du *package* de l'ORM), `KnexContext` de `@ddd-ts-kit/knex`, `TypeOrmContext` de `@ddd-ts-kit/typeorm` |
| outillage des migrations | `drizzle.config.ts`, `knexfile.js` et `migrations/00000000000000_initial.js`, `prisma/schema.prisma` et `prisma.config.ts`, ou `data-source.ts` |
| `scripts/openapi.ts`, `scripts/events.ts` | écrivent `openapi/openapi.yaml` (un fichier par document de `openapi.documents`), `docs/integration/asyncapi.yaml` et `docs/integration/event-catalog.md`, en JSON sous `openapi.format: json` ; `--check` échoue sur une différence |
| `docker-compose.yml`, `.env.example`, `Dockerfile`, `.dockerignore` | la base de données avec un contrôle de santé et un volume nommé, `jaegertracing/jaeger:2.22.0` derrière le profil `observability` (son interface et son port OTLP liés à 127.0.0.1), les ports depuis `.env` ; une image multi-étapes, sans root, avec les seules dépendances de production |
| `vitest.e2e.config.ts`, `test/e2e/support/` | `start-application.ts` (l'application entière sur un port libre, sur une base de données dans le processus sauf si `DATABASE_URL` est définie, aucun *job* lancé par le temps ; `settled()` se résout quand l'outbox a relayé ce que les requêtes HTTP ont enregistré), `create-credentials.ts`, `auth-environment.ts`, `test-environment.ts`, `story-of.ts` (`storyOf(trace)` : une trace sans les appels qu'un adaptateur fait sur lui-même, la forme que vérifie `expectSpanTree`) |
| `docs/context-map.md`, `docs/integration/README.md` | voir `docs` |
| `test/architecture/extractable.spec.ts` | écrit avec le premier contexte : démarre chaque contexte seul sur le kernel et la plateforme, ses *jobs* compris |
| `eslint.config.mjs` | le preset `dddTsKit` de `@ddd-ts-kit/eslint-plugin`, lint typé sur le tsconfig du projet |
| `.dependency-cruiser.cjs` | les règles du graphe des imports, générées depuis la configuration (voir `depcruise-config`) |
| `biome.json` | le formateur : Biome avec son linter et son organisateur d'imports désactivés, largeur de ligne 120 ; `npm run format` écrit, `npm run format:check` vérifie, et ce que la CLI génère est déjà formaté |
| `knip.json` | code mort : les points d'entrée sont `main.ts` et `apps/*/main.ts`, les scripts, les *specs* et les *fakes*, les fichiers de module dans le style explicite, les fichiers de rôle sous discovery (*jobs* et *publishers* compris) |
| `vitest.config.ts` | projets unitaires et d'intégration, les seuils de couverture lus dans `ddd-ts-kit.config.json` (`governedCoverage`), par contexte et par couche, dans le mode des décorateurs standard `decorators()` de `@ddd-ts-kit/testing/vitest`, qui compile les fichiers contenant un décorateur avec le compilateur du projet (Vitest ne transforme pas les décorateurs standard ; il transforme lui-même les anciens, si bien qu'un projet avec `experimentalDecorators` ne reçoit pas de *plugin*), et sous `--assembly discovery` `server.deps.inline: ['@ddd-ts-kit/di']` |
| `lefthook.yml`, `commitlint.config.mjs` | *hooks* pre-commit (ESLint, la vérification du format et `check` sur les fichiers indexés, `check --commit-size --staged`, qui ne bloque jamais), pre-push (types, tests unitaires) et commit-msg (`npm run hooks:install`), chacun lancé par le lefthook du *checkout* où il se déclenche (`lefthook: node_modules/.bin/lefthook` : un *worktree* sans ses dépendances fait échouer le *commit* au lieu de sauter les vérifications), *commits* conventionnels |
| `--ci github` | `.github/workflows/ci.yml`, `pr-title.yml`, `copilot-setup-steps.yml` (Node et les dépendances, installés avant le démarrage de l'agent cloud de Copilot), `.github/dependabot.yml`, `.github/branch-protection.md`, `renovate.json` ; `codeql.yml` avec `--ci-extras codeql` |
| `--ci gitlab` | `.gitlab-ci.yml` (les constats d'architecture comme rapport Code Quality au moyen de `check --format gitlab`), `.gitlab/merge-request-settings.md`, `renovate.json` |
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/rules/*.md`, `.github/instructions/*.instructions.md` | comment le lancer ; un guide léger dans `AGENTS.md`, que lisent Codex, Copilot et la plupart des agents de code et qu'importe `CLAUDE.md` (commandes, comment lire moins, la carte des règles, fichiers générés, note sur le compilateur, les *skills* du *plugin* : `/ddd-ts-kit:start`, `glossary`, `use-case`, `document`, `quality-gate`) et les invariants dans sept fichiers de règles, `domain.md`, `application.md`, `published-language.md`, `infrastructure.md`, `presentation.md`, `platform.md` et `tests.md`, chacun délimité par un frontmatter `paths`, et les mêmes sept pour GitHub Copilot, chacun délimité par `applyTo` |
| `.github/copilot/settings.json` | le *plugin* du kit, déclaré pour GitHub Copilot (`extraKnownMarketplaces`, `enabledPlugins`) : son agent cloud l'installe, la CLI Copilot et VS Code le recommandent ; un fichier existant garde ce qu'il contient et reçoit les deux entrées |
| `.claude/settings.json` | des permissions seulement : les vérifications et les générateurs s'exécutent sans demander, les fichiers `.env` sont illisibles (`.env.example` reste lisible), les trois documents générés ne sont pas modifiés à la main, `git push`, `npm publish` et toute modification des fichiers qui portent les règles et le *pipeline* (`ddd-ts-kit.config.json`, `eslint.config.mjs`, `biome.json`, `.dependency-cruiser.cjs`, `knip.json`, `lefthook.yml`, `.gitlab-ci.yml`, `.github/workflows/**`, `.claude/settings.json`, `.github/copilot/settings.json`) demandent d'abord |
| `.gitignore` | `node_modules`, `dist`, `coverage`, `.env`, `*.tsbuildinfo`, `.ddd-ts-kit/`, où écrit `worker-scope`, et `.worktrees/`, où vivent les *worktrees* |

`--ci both` écrit les deux *pipelines*, `--ci none` aucun (et pas de `renovate.json`). Les
fichiers de *pipeline* sont des copies des fichiers du répertoire `pipeline/` du dépôt, livrées
dans `templates/pipeline/` ; un test échoue quand une copie diffère de sa source au-delà de ses
emplacements à remplacer documentés.

Un `.claude/settings.json` existant n'est jamais écrasé : les permissions manquantes sont ajoutées
à ses listes, tout le reste est gardé, et les notes de la commande listent ce qui a été ajouté. La
règle sur `.env` repose sur la sémantique gitignore des motifs de permission : `Read(./.env.*)`
est refusé et `Read(!./.env.example)`, une négation placée après lui dans la même liste, en
ressort le fichier d'exemple.

Chaque fichier `.ts` qu'écrivent `init` et `generate` importe par l'alias (`@/platform/errors`),
jamais par un chemin relatif ; le barrel et l'index d'un langage publié réexportent par lui aussi.

Scripts : `dev` (`tsx watch`, qui résout un alias depuis les `paths` de `tsconfig.json`, avec
`.env` chargé par `--env-file-if-exists` et le traçage préchargé),
`build` (le compilateur, puis `ddd-ts-kit build-aliases`), `start` (`node` seul sur `dist/`), `typecheck`, `lint`, `lint:fix`, `test`, `test:e2e`, `check:arch`, `depcruise`,
`deadcode`, `quality`, `openapi:generate|check`, `events:generate|check`, `docs:generate|check`,
`db:generate`, `db:migrate`, `infra:up`, `infra:down`, `hooks:install`, `start:<context>` et
`start:worker` une fois que `generate service` et `generate worker` ont écrit leur point d'entrée,
les scripts `ci:*` qu'appellent les *pipelines*, `test:coverage` (chaque *spec* une fois, chaque
contexte et chaque couche tenus aux seuils de `ddd-ts-kit.config.json`) et `verify`, qui enchaîne
toute la base : typecheck, lint, `format:check`, `test:coverage`, tests de bout en bout,
`check:arch`, `depcruise`, `deadcode`, `docs:check`.

`package.json` porte deux compilateurs : `typescript ~6.0.3`, que les outils chargent comme une
bibliothèque, et `@typescript/native` (`npm:typescript@~7.0.2`), que `build` et `typecheck`
appellent par son chemin (`node node_modules/@typescript/native/bin/tsc`). `npx tsc` lancerait
l'ancien.

`init` et `generate context` commencent par le langage : la première entrée de `next` est le
glossaire du contexte à remplir.

### Presets

`--preset identity` (sur `init`, ou sur `generate context` ; une fois par projet) écrit un
contexte délimité entier au lieu d'un contexte vide : qui sont les personnes de l'application, les
organisations auxquelles elles appartiennent et avec quel rôle. Les comptes sont provisionnés
depuis le fournisseur d'identité à la première connexion (aucun mot de passe n'est gardé), les
organisations (les *tenants* sous `--tenancy shared-table`), les membres avec des rôles d'un
vocabulaire déclaré, les invitations par jeton avec une expiration, les délégations de droits pour
une période ; les permissions, les politiques, le langage publié (membre arrivé, rôle changé,
compte désactivé...), une recherche, les contrôleurs, les *specs* avec *builders* et *fakes*, les
adaptateurs de l'ORM, et le port vers l'API d'administration du fournisseur d'identité, tenu à
jour au moins une fois par les consommateurs des faits publiés, avec un adaptateur Keycloak donné
comme une recette (prouvé contre un serveur qui répond comme Keycloak, pas contre Keycloak dans le
*pipeline*). Personne ne change son propre rôle ni n'agit au-dessus de lui, quoi que prête une
délégation ; un compte désactivé quitte ses organisations ; une adresse que le fournisseur n'a pas
vérifiée ne provisionne aucun compte. Sur `init` sans `--context` de son nom, le contexte
`identity` est déclaré `generic`. Chaque personne connectée détient les permissions du contexte
quoi que dise `--authz` : l'attribution `'identity:*'` de `platform/auth/signed-in-grants.ts`,
à laquelle répond `SignedInGrantsAuthorizer` avant le modèle dans `createAuthorizer`. Avec des
*tenants*, les tables du contexte n'appartiennent à aucun, sous un enregistrement de décision que
le *preset* écrit, et avec `--authn keycloak` l'authentificateur lit le *claim* `organization`
comme les *tenants* de la personne (un autre authentificateur reçoit une étape suivante qui dit
quoi faire correspondre). Le *preset* est écrit pour `declared` avec les dépendances `signature`,
`factories`, les objets-valeurs `throwing`, `controllers`, Knex ou Drizzle sur PostgreSQL, Zod ou
class-validator, Express ou Fastify, et un vérificateur de jeton (`jwt` ou `keycloak`) ; une
autre *stack* est refusée avec ce qu'il faut changer, de même qu'un second contexte écrit depuis
le même *preset*. Pourquoi, et quels autres contextes en méritent un :
[Démarrer avec des contextes bien conçus](../../docs/guides/bootstrap-with-well-designed-contexts.fr.md).

## generate (alias g)

```
ddd-ts-kit generate <kind> ... [--term "<Term>=<meaning>"]... [--allow-name] [--local-only] [--dry-run] [--force]
ddd-ts-kit generate --help --json
```

Un passage de `generate` fait cinq choses, dans cet ordre, et n'écrit rien quand la première
refuse :

![Un passage de generate command : le nom est vérifié dans le glossaire du contexte (refusé avec le code de sortie 2 et le --term à ajouter quand un mot n'est pas défini), les fichiers sont écrits depuis les templates, les nouvelles pièces sont enregistrées entre des commentaires marqueurs, les documents dérivés sont rafraîchis, et les endroits qui attendent une décision métier sont affichés en fichier:ligne](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/cli-generate-one-run.fr.svg)

Dans l'application d'exemple, un cas d'usage nommé avec un mot que son glossaire ne définit pas
est refusé, et le message dit comment continuer :

```
$ npx ddd-ts-kit generate command notification ArchiveNotification --permission notification.archive --aggregate Notification
error: "ArchiveNotification" uses "archive", which the glossary of src/contexts/notification/CONTEXT.md does not define.
  fix: Either use an existing term (Notification, Send, Recipient, Contact, Confirmation, Reminder, Plan, Due, Withdraw, Mailer, Kind, Request, Rescheduling, Cancellation, Read, Search), or add the term in the same command: --term "Archive=<what it means for the business>". The glossary is written before the code (rule language/glossary-term).
```

Avec le terme donné dans la même commande (et `--dry-run`, qui dit ce qu'il écrirait) :

```
$ npx ddd-ts-kit generate command notification ArchiveNotification --permission notification.archive --aggregate Notification \
    --term "Archive=To set a sent notification aside, out of the default search" --dry-run
would create src/contexts/notification/application/commands/archive-notification/archive-notification.command.ts
would create src/contexts/notification/application/commands/archive-notification/archive-notification.handler.ts
would create src/contexts/notification/test/unit/archive-notification.handler.spec.ts
would update src/contexts/notification/CONTEXT.md
would update src/contexts/notification/application/authorization/notification.permissions.ts
would update src/contexts/notification/notification.declarations.ts

Next, in this order: the language of the context first, then the business decisions only you can make
  src/contexts/notification/application/commands/archive-notification/archive-notification.command.ts:9  declare the input of "archive notification" as a constructor with the actor first, ...
  src/contexts/notification/application/commands/archive-notification/archive-notification.handler.ts:16  decide what "archive notification" does to a Notification: ...
  src/contexts/notification/test/unit/archive-notification.handler.spec.ts:38  replace each entry below by a test named after the business behaviour of "archive notification": ...
```

| Genre | Arguments | Écrit |
|---|---|---|
| `context` | `<name> --classification <c> [--purpose "<two sentences>"] [--term ...]... [--upstream <ctx>[:relationship]]... [--preset identity]` | `CONTEXT.md` avec son glossaire, `published-language/index.ts`, l'entrée de configuration, l'enregistrement dans `platform/compose-application.ts` et dans `test/architecture/extractable.spec.ts` ; sur tsyringe, avec HTTP, `presentation/http/<name>.routes.ts` (une fonction des deux bus, dans les deux styles) ; déclaré : le barrel `<name>.declarations.ts` ; explicite et câblage manuel : `<name>.module.ts`. `application/authorization/<name>.permissions.ts` naît avec la première permission, ou tout de suite quand `platform/auth/permissions.ts` liste les ensembles de permissions (rebac, custom). Avec `--preset`, le contexte est ensuite écrit en entier depuis ce *preset*, sa classification et son objet étant ceux du *preset* sauf si les options disent autre chose ([Presets](#presets)) |
| `aggregate` | `<context> <Name> [--event-sourced]` | agrégat, *builder*, *spec* sur le modèle étant donné / quand / alors ; avec `--event-sourced`, un agrégat sur `EventSourcedAggregate` dont l'état est le rejeu de ses événements, né avec son événement du domaine `Created`, le codec de ses événements stockés dans `infrastructure/persistence/<name>-events.mapper.ts`, un *builder* qui rejoue un historique et une *spec* à partir d'événements donnés, et une note qui nomme le `EventSourcedRepository` auquel délègue son adaptateur de *repository* |
| `builder` | `<context> <Aggregate>` | `test/builders/<name>.builder.ts`, une classe qui étend `Builder` |
| `test-world` | `<context> [Name]` | `test/worlds/<name>.world.ts` (le nom est par défaut celui du contexte) : `a<Name>World({ now, idPrefix, given })`, la mise en place que partagent plusieurs *specs* du contexte. Il lit les *fakes* de `test/fakes/` et le port que chacun implémente, les construit, les passe à `given` pour que la *spec* enregistre ce dont elle part, puis à l'application de test (avec `modules`, l'autorisation de la *spec*) ou, câblé à la main, enveloppe les *repositories* des bus de `createTestBuses` par `dispatching` ; il rend chaque *fake* sous le nom de son port. Un *fake* qui attend des arguments de constructeur, ou, avec un conteneur, celui d'un port que rien ne lie ni n'utilise encore, est laissé de côté avec une note |
| `entity` | `<context> <Name>` | entité, *spec* |
| `value-object` (`vo`) | `<context> <Name>` | objet-valeur, *spec* |
| `vocabulary` | `<context> <Name> --value <value> [--value <value>]...` | `domain/vocabularies/<name>.vocabulary.ts` : un objet `as const` des valeurs, indexé par chaque valeur en PascalCase, et le type union du même nom ; relancé, ajoute les valeurs que le fichier ne contient pas |
| `domain-event` | `<context> <Aggregate> <Fact>` | événement nommé `<context>.<aggregate>.<fact>`, *spec* |
| `error` (`refusal`) | `<context> <Refusal> <factory> [--code CODE] [--term ...]...` | sous `"stack.refusals": "named"` : la classe `<Refusal>` dans `domain/errors/<refusal>.error.ts`, qui étend `DomainRefusal` et lit son code dans la liste, son entrée dans `domain/errors/codes.ts` (la liste `<Context>Codes` et son type `<Context>Code`, créés s'ils manquent ; l'entrée est ajoutée à la fin), la fabrique statique `<factory>` et son cas dans `test/unit/<refusal>.error.spec.ts`. Chacun est écrit s'il manque : relancée, la commande ne change rien ; avec une autre fabrique, elle l'ajoute à la classe. `<Refusal>` est en PascalCase (un `Error` final est retiré), nommé avec des termes du glossaire et les qualificatifs d'un refus, `invalid`, `unknown`, `already`, `too`, `no`, `missing` et `required` (`BookingTooLate`) : un mot que le glossaire ne définit pas est refusé, avec le `--term` qui l'ajoute ; `<factory>` commence par `for`, `with`, `because`, `on` ou `at` (`forAccountId`), sinon la commande refuse et propose `for<Factory>`. Le code est le refus en casse de constante (`InsufficientFunds` pose `INSUFFICIENT_FUNDS`), `--code` en donne un autre ; refusé : un code déjà posé dans le contexte. Sous `factories` et `classes`, `<context> <Concept> <refusal>` : une fabrique statique `<refusal>` sur `domain/errors/<concept>.error.ts`, la classe des erreurs de ce concept (créée si elle manque, qui étend `ConceptError`), et son cas dans `test/unit/<concept>.error.spec.ts`. La fabrique est ajoutée après la dernière ; relancée, la commande ne change rien. `<Concept>` est un terme du glossaire (`--term` l'ajoute). Le code est le nom du refus en casse de constante, précédé du concept quand le nom est un seul mot ou un code du kit (`Appointment notFound` pose `APPOINTMENT_NOT_FOUND`) ; `--code` prend l'une des formes qu'accepte `errors/factory-name`. Refusés : un nom comme `create` ou `error1`, et un code déjà posé dans le contexte |
| `domain-error` | `<context> <Name> [--code CODE]` | une classe par erreur avec un code stable, *spec* : la forme d'un projet dont la configuration dit `"stack.refusals": "classes"` ou rien. Refusé sous `named` et `factories`, avec la commande `generate error` à lancer à la place |
| `domain-service` | `<context> <Name>` | service, *spec* |
| `state-machine` | `<context> <Aggregate> [--value <state>]... [--transition "<intention>:<from>[,<from>]...[><to>]"]...` | le vocabulaire `<Aggregate>Status` (créé depuis `--value`, deux états au moins, ou complété des valeurs qui lui manquent), `domain/state-machines/<aggregate>.state-machine.ts` (`<aggregate>Lifecycle` : chaque valeur un état, la première initiale, les transitions demandées, un `TODO(domain)` pour le refus de l'erreur du concept) et `test/unit/<aggregate>.state-machine.spec.ts` (chaque transition là où elle mène, un refus depuis un état qu'elle ne quitte pas) ; c'est à l'agrégat de l'utiliser |
| `repository` | `<context> <Aggregate> [--tenant-scoped]` | le port `domain/repositories/<name>.repository.ts` (`abstract class <Name>Repository extends Repository<<Name>>`), l'adaptateur de l'ORM du projet (qui `implements` le port) avec son *mapper* et sa table (ou son modèle), un *fake*, une *spec* `repositoryContract` exécutée sur les deux, l'enregistrement |
| `command` | `<context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] \| --public) [--aggregate <Name>]` | `<use-case>.command.ts` sur `AuthorizedCommand` (simple `Command` quand elle est publique), `<use-case>.handler.ts` (il construit l'agrégat, le sauvegarde et répond : les événements partent avec la sauvegarde), une *spec* par le bus avec le refus d'un acteur à qui manque la permission, l'enregistrement avec `.requires(...)` ou `.public()` (et le *repository* s'il manque). Une commande générée répond `void` ou l'identifiant de son agrégat, si bien qu'aucun `<use-case>.result.ts` n'est écrit |
| `query` | `<context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] \| --public) [--search]` | `<use-case>.query.ts` sur `AuthorizedQuery` (simple `Query` quand elle est publique), `<use-case>.result.ts`, `<use-case>.handler.ts`, le port de lecture `application/ports/<use-case>-reader.port.ts` (une classe abstraite), son adaptateur en mémoire, un *fake*, une *spec*, l'enregistrement sur le bus de requêtes. Avec `--search` (demande `--permission`) : une `PageRequest` du kernel dans la requête, l'élément, le tri et `Page<Item>` dans le fichier de résultat, un gestionnaire qui demande `Access.scope` et remet le périmètre au port de lecture, un lecteur en mémoire qui pagine par décalage ou par curseur |
| `port` | `<context> <Name>` | `application/ports/<name>.port.ts`, une classe abstraite, et son *fake* |
| `route` | `<context> <UseCaseName> --method <GET\|POST\|PUT\|PATCH\|DELETE> --path <p> [--command\|--query] [--group <Name>] [--mapper] [--serializer] [--cache public\|private\|no-store]` | sous `"stack.routes": "controllers"` : une classe contrôleur dans `presentation/http/<resource>/<use-case>/` (la ressource est le premier segment du chemin), qui dépend de `CommandBus` ou de `QueryBus`, derrière le groupe de routes de sa ressource, écrit avec elle quand il est nouveau (`<resource>.routes.ts` : préfixe, étiquette, `Authenticated`) ; un cas d'usage public ne se tient dans aucun groupe et dit `guards: [Public]` ; avec class-validator, une classe par fichier (`<use-case>.params.ts`, `.body.ts`, `.answer.ts`, `.accepted.ts`, `.line.ts`) ; `--mapper` et `--serializer` ajoutent un *mapper* de requête HTTP et un sérialiseur que reçoit le contrôleur ; une *spec* ; aucun enregistrement dans un projet déclaré, un contrôleur construit à la main dans `<context>.routes.ts` (le fichier de module en câblage manuel) dans un projet explicite. Sous `"functions"` : une fonction `defineRoute`, sa *spec*, son enregistrement dans `<context>.routes.ts`, et des classes `<use-case>-<role>.dto.ts` |
| `controller` | les mêmes arguments que `route` | la classe contrôleur, quoi que dise `stack.routes` : pour un projet de routes en fonctions qui écrit sa prochaine route comme une classe. `--cache` écrit sa politique de cache : `private` (un `GET` d'un appelant, `max-age=0`, `must-revalidate`, `ETag` fort), `public` (un `GET` d'un cas d'usage public, `max-age` 1m, `s-maxage` 5m, étiqueté avec les ressources de son chemin), `no-store` ; refusé sur une écriture, et `public` derrière un groupe de routes |
| `file-upload` | `<context> <UseCaseName> --path <p> (--permission <aggregate>.<action> [--grant <role>] \| --public) [--method POST\|PUT] [--group <Name>]` | un téléversement : un contrôleur qui déclare le fichier qu'il reçoit (sa taille et ses types de média dans le contrat, vérifiés au fil du flux), la commande qui le porte comme un `FileUpload`, mis en attente par le bus de commandes avant la transaction, le gestionnaire qui l'enregistre et le promeut avec la validation (commit), et leurs *specs*. Refusé sans `stack.storage` ou sans *stack* HTTP, avec le `init --force --storage local` à lancer |
| `route-group` (`group`) | `<context> <Name> [--prefix <path>] [--group <ParentName>] [--public \| --role <role>]` | `presentation/http/<name>.routes.ts` : une classe vide qui porte `@RouteGroup`, derrière `Authenticated` sauf si `--public` ou `--role` dit autre chose (`HasRole(Role.Admin)`, le rôle lu dans le vocabulaire de la plateforme, `<platformDir>/auth/role.ts`, qui le reçoit s'il ne le contient pas) ; avec `--group`, il affine ce groupe et en hérite |
| `guard` | `<context> <Name>` | `presentation/http/guards/<name>.guard.ts` : une classe de garde déclarée à remplir, et sa *spec* |
| `representation` | `<context> <UseCase> <xml\|csv\|media/type>[,...]` | ajoute `produces` au `@Controller` du cas d'usage, et `consumes: ['application/xml']` à celui qui reçoit un corps quand XML est demandé ; dit quand CSV a besoin d'une page ou d'une liste en flux, et quand `stack.representations` n'est pas `negotiated` |
| `form` | `<context> <UseCase>` | ajoute `const form = defineForm<Infer<typeof body>>({ ... })` avant le `@Controller` d'un cas d'usage qui reçoit un corps, et `form` à ses options : les indications de son formulaire à `GET /forms/<operationId>` |
| `schema` | `<context\|shared-kernel> <Name>` | `presentation/http/shared/<name>.schema.ts` du contexte, ou `presentation/<name>.schema.ts` du noyau partagé : une forme du contrat déclarée une fois (un schéma zod avec `.meta({ id })`, une classe class-validator, ou un schéma enveloppé par `sharedSchema`), à remplir ; les routes l'utilisent en entier, imbriquée ou en partie |
| `integration-event` | `<context> <Aggregate> <Fact> [--version n]` | la déclaration `defineIntegrationEvent` dans le langage publié (sa charge utile dans `<event>.v<n>.payload.ts` avec class-validator ou un schéma à vous), l'export de l'index, le *publisher* `application/integration/publishers/<event>.publisher.ts`, une *spec*, l'enregistrement, une ligne de `platform/audit/audited-events.ts` |
| `integration-handler` (`consumer`) | `<context> <upstreamContext> <eventType>` | `application/integration/handlers/<name>.integration-handler.ts`, une classe `<Name>IntegrationHandler` qui dépend de `CommandBus`, sa *spec*, son abonnement idempotent sous le nom de consommateur `<context>.<name>` ; refusé sauf si l'amont est déclaré |
| `event-handler` | `<context> <Aggregate> <Fact> [--phase before-commit\|after-commit]` | réaction à un événement du domaine du contexte, *spec*, abonnement ; avant la validation (commit) de l'unité de travail par défaut, après elle avec `--phase after-commit` (un effet qu'aucune transaction ne couvre, au plus une fois), et la *spec* exécute la réaction dans cette phase |
| `projection` (`projector`) | `<context> <Name> <event-type>` | un projecteur dans `application/projections/<name>.projection.ts`, déclaré avec `@Projection('<context>.<name>')` et une méthode `@On(definition)` pour l'événement d'intégration, que publie le contexte lui-même ou un amont déclaré, et sa *spec* ; style déclaré seulement. Il tient un seul modèle de lecture : son port est reçu par le constructeur |
| `job` | `<context> <Name> (--every <duration> \| --cron "<expression>" [--time-zone <zone>]) --command <UseCaseName>` | `application/scheduling/<name>.job.ts`, une classe `<Name>Job implements ScheduledJob` qui envoie la commande, en tant que `systemActor('<context>.<name>')` quand elle est protégée, avec `execution.scheduledAt` quand la commande le prend ; `test/unit/<name>.job.spec.ts`, qui exécute le *job* (par son nom sur tsyringe, `application.jobs.runNow` ; `job.run(occurrence)` en câblage manuel) et vérifie la commande qu'il a envoyée ; son enregistrement ; son interrupteur dans `platform/job-settings.ts` ; l'autorisation de son acteur système (ci-dessous) |
| `background-job` | `<context> <Name> --command <UseCaseName>` | `application/background/<name>.background-job.ts`, une classe `<Name>BackgroundJob implements BackgroundJob<<Name>Payload>` nommée par son `jobName` statique `<context>.<name>`, qui envoie la commande en tant que `execution.actor` quand elle est protégée, suivi d'un champ de `<Name>Payload` par autre paramètre du constructeur de la commande (chaînes, nombres, booléens, littéraux et listes de ceux-ci tels qu'écrits, une `Date` sous forme de son texte ISO ; tout le reste est refusé) ; `test/unit/<name>.background-job.spec.ts`, qui le met en file avec une charge utile de chaque champ en tant qu'utilisateur détenant la permission et exécute ce qui est dû ; son enregistrement (`@Background()`, ou `builder.backgroundJob(..)` dans le fichier de module). `--di tsyringe` seulement |
| `process` (`process-manager`) | `<context> <Name>` | `application/processes/<name>.process.ts` (son état, `processName`, `timeoutJob`, `isState`, une première étape qui arme une échéance, une étape qui y met fin à temps, l'étape de l'échéance), `application/background/<name>-timeout.background-job.ts`, qui livre ses expirations au moyen de `ProcessRunner`, et les *specs* des deux (`givenProcess`, la file d'attente de l'application de test). `--di tsyringe` seulement |
| `acl` | `<context> <upstreamOrSystemName>` | traducteur dans `infrastructure/anti-corruption/`, *spec* |
| `e2e` | `<context> <UseCaseName>` | `test/e2e/<use-case>.e2e.spec.ts` qui pilote la route du cas d'usage : 401 sans identifiant de connexion, 403 sans la permission, le statut documenté avec elle ; pour une commande, un test de plus vérifie la trace de la requête HTTP, exacte sur les noms et la structure, avec `installTestTracing()` et `expectSpanTree(storyOf(trace), [...])` de `@ddd-ts-kit/tracing/testing` (`POST /invoices`, puis `command IssueInvoiceCommand`, puis `repository InvoiceRepository.save`) ; demande la route |
| `policy` | `<context> <Name> --permission <aggregate>.<action>` | `application/authorization/<name>.policy.ts`, *spec* ; déclaré : la classe porte `@Policy(permission, { name })` et rien d'autre n'est écrit ; explicite : l'enregistrement dans `platform/auth/access-policies.ts` |
| `gateway` | `<context> <upstreamContext> <Name>` | le contrat de lecture dans le langage publié de l'amont (`<name>.contract.ts`, une classe abstraite et le jeton de la valeur de l'amont), le port `application/ports/<name>-gateway.port.ts`, un adaptateur dans le processus dans `infrastructure/external/` lié `.as('gateway')`, un *fake*, une suite de contrat ; refusé sauf si l'amont est déclaré |
| `adapter` | `<context> <Port> [--kind external\|gateway] [--decorators]` | `infrastructure/external/remote-<port>.adapter.ts` pour un port existant, sa *spec*, et sur tsyringe sa liaison `builder.bind(<Port>).toClass(Remote<Port>).as(<kind>).with(ownPolicy(retry(...), timeout(...)))` ; avec `--decorators`, sur toute *stack*, la classe porte `@Retry` et `@Timeout` de `@ddd-ts-kit/aspects/decorators` sur son unique méthode sortante et est liée `.with(ownPolicy())`. Explicite : un port déjà lié, ou le câblage manuel, reçoit une note au lieu d'une liaison. Déclaré : la classe porte `@Adapter(<Port>, { kind, aspects })`, ou `@Gateway(<Port>, { aspects })` dans `remote-<port>.gateway.ts` avec `--kind gateway`, et un port qui a déjà un adaptateur déclaré est refusé |
| `service` | `<context>` | `src/apps/<context>/main.ts` (kernel, plateforme, ce contexte seul, avec ses *jobs* : `jobSettings(process.env, '<context>')`), le script `start:<context>`, un service compose derrière le profil `services`, l'entrée knip, `deployable: true` dans la configuration. Le Dockerfile prend le point d'entrée comme argument de build `ENTRY` |
| `worker` | aucun | `src/apps/worker/main.ts` : les modules de `main.ts`, pas de serveur HTTP, pas de relais de l'outbox, les *jobs* démarrés quoi que dise `RUN_JOBS`, un arrêt propre ; le script `start:worker`, un service compose `worker` derrière le profil `services`, l'entrée knip, `"worker": true` dans la configuration, et `RUN_JOBS` qui vaut `false` par défaut à partir de là, si bien que l'API cesse d'exécuter les *jobs* qu'exécute le *worker*. Avec plusieurs instances, le verrou doit être un vrai verrou : `--cache redis` lie le verrou Redis, et sans lui le README généré dit la limite. Un contexte nommé `worker` est refusé |
| `adr` | `"<title>" [--deviation <what>] [--reason "<why>"]` | `docs/adr/NNNN-<slug>.md` ; avec `--deviation`, l'entrée `deviations` de la configuration qui pointe vers lui |

- **Le style déclaré, genre par genre.** Aucun jeton nulle part : une liste nomme des classes de
  port. `command` et `query` mettent `@Requires(<permissions>[...])` ou `@Public()` sur le
  message et `@CommandHandler(Message)` ou
  `@QueryHandler(Message, [<UseCase>Reader])` sur le gestionnaire ; `repository` écrit
  `@Repository(InvoiceRepository, [<storage>, ExecutionScope, Clock])`, le stockage étant
  `Database` de la plateforme (drizzle, prisma), `KnexContext` ou `TypeOrmContext` ; l'adaptateur
  en mémoire d'un port de lecture est `in-memory-<name>-reader.repository.ts`, un fichier de rôle
  avec `@Repository(<UseCase>Reader)` ; `integration-handler` écrit
  `@IntegrationEventHandler(definition, { consumer })` et est refusé quand l'amont ne déclare pas
  l'événement ; `event-handler` et le *publisher* de `integration-event` écrivent
  `@DomainEventHandler(Event)`, rattaché au `eventName` que déclare la classe d'événement (le *publisher* avec
  `[IntegrationEventPublisher, IdGenerator]`), et tous deux sont trouvés comme n'importe quel
  fichier de rôle : la racine de composition ne liste aucun *publisher* ; `job` écrit
  `@Scheduled('<context>.<name>', schedule)` ; `policy` écrit une classe avec
  `@Policy(permission, { name })` et n'enregistre rien ; `gateway` écrit
  `@Gateway(<Name>Gateway, [<Name>Contract])` et lie la valeur de l'amont dans les régions
  marquées de `platform/platform.module.ts` et de `platform/platform-test.module.ts` : une valeur
  ou une fabrique, c'est ce qu'un décorateur ne peut pas dire ; `route` ajoute sa fonction à
  `presentation/http/<context>.routes.ts`. Une *spec* de gestionnaire construit son application
  de test à partir de `platformTestModule`, de `contextModule('<context>', <context>Declarations)`,
  d'un module d'autorisation et de *fakes* (`fake(InvoiceRepository, new FakeInvoiceRepository())`).
- **Le style explicite, genre par genre.** Les mêmes fichiers sans décorateurs, et une ligne du
  fichier de module chacun : `builder.bind(InvoiceRepository).toClass(DrizzleInvoiceRepository, [Database, ExecutionScope, Clock]).as('repository')`,
  `builder.command(IssueInvoiceCommand).requires(...).handledBy(IssueInvoiceHandler, [InvoiceRepository, IdGenerator, Clock])`,
  `builder.on(definition, { consumer }).handledBy(Handler, [CommandBus])`,
  `builder.job('<context>.<name>', schedule).handledBy(<Name>Job, [CommandBus])` ; un *publisher*
  et un gestionnaire d'événement du domaine sont liés sous eux-mêmes et abonnés dans la région
  `start`. En câblage manuel (`--di manual`, `--di nest`), le fichier de module est une fonction
  de la `Platform` :
  `platform.adapter(new DrizzleInvoiceRepository(...), { kind: 'repository', context, token })`,
  qui donne au *repository* son *span* et la distribution de ce qu'il sauvegarde,
  `platform.commands.register(Message, new Handler(...), { context })`,
  `platform.jobs.register({ name, schedule, run })`.
- **Les *jobs*.** Le planning est validé quand le *job* est généré, par les règles du planificateur
  (`parseJobSchedule` du kernel, fixé par un test) : une durée (`15m`, `2s`, des chiffres seuls
  sont des millisecondes) ou une expression cron à cinq champs ou un raccourci (`@daily`), avec un
  fuseau horaire IANA ; `--time-zone` sans `--cron` est refusé, de même qu'un *job* sans
  `--command`, une commande qui n'existe pas (avec la commande qui la crée) et une commande dont le
  constructeur demande plus que l'acteur et l'instant pour lequel le travail est fait : un *job* dit
  seulement que le moment est venu, le gestionnaire trouve sur quoi agir. Les paramètres optionnels
  ou qui ont une valeur par défaut sont laissés hors de l'appel.
- **L'autorisation d'un *job*.** Un *job* dont la commande est protégée l'envoie en tant que
  `system:<context>.<name>`, qui n'a aucun droit tant que le modèle ne lui en donne pas.
  `generate job` écrit l'autorisation là où le modèle en fait une ligne, dans une région marquée
  `system-grants`, et `next` pointe vers cette ligne : `--authz rbac`, l'identifiant de la
  permission sous le rôle `system` de `platform/auth/roles.ts`, le rôle que `createAuthorizer`
  donne à chaque acteur système (`systemRole`) ; `--authz abac`, une règle
  `permit('system-<job>', [permission], ({ actor }) => actor.id === 'system:<job>')` dans
  `platform/auth/attribute-policies.ts` ; `--authz rebac`, le tuple
  `context:<context>#operator@system:system:<job>` dans `platform/auth/relate-system-actors.ts`,
  écrit dans le magasin de tuples au démarrage de l'application, tant que le schéma laisse encore
  un sujet `system` opérer un contexte. Avec `--authz custom`, une région supprimée, un schéma de
  relations remodelé ou une permission que le générateur ne sait pas lire, rien n'est écrit et le
  fichier du *job* porte le `TODO(domain)` qui nomme l'acteur et la permission.
- **Le barrel est dérivé.** `<context>.declarations.ts` contient un `export *` par fichier de
  rôle, trié par chemin, puis un `injected(Class, [Tokens])` par classe dont le constructeur
  reçoit quelque chose, lu depuis sa signature, avec les imports dont ils ont besoin. Chaque
  `generate`, et `docs`, le réécrivent ; `docs --check` et `check`
  (`declarations/barrel-current`) signalent un barrel qu'un fichier de rôle écrit à la main a
  laissé en arrière ou dont un constructeur a changé depuis, en nommant la classe
  (`stale  src/contexts/billing/billing.declarations.ts: the dependency list of IssueInvoiceHandler is stale: ...`).
  Le script `dev` charge `ddd-ts-kit/dist/refresh-declarations.js` avant l'application, à chaque
  démarrage et à chaque rechargement de `tsx watch` : un port ajouté à un constructeur est injecté
  au rechargement qui suit l'enregistrement du fichier. Le même module est le binaire
  `ddd-ts-kit-refresh-declarations`. Il est mis en page comme Biome le met en page à une largeur
  de ligne de 120 ; un projet qui formate à une autre largeur laisse `**/*.declarations.ts` et
  `**/*.dependencies.ts` hors de son formateur.
- **Refus par défaut.** `command` et `query` sont refusés sans `--permission` ou `--public`. Une
  nouvelle permission rejoint `<context>.permissions.ts` ; ses mots sont vérifiés dans le
  glossaire comme tout autre nom. Avec `--authz rebac`, l'exigence nomme le contexte comme sa
  ressource, un point de départ à remplacer par l'élément sur lequel porte le droit. Avec
  `--authz rbac`, `--grant <role>` accorde la permission au rôle dans `platform/auth/roles.ts`
  (le rôle rejoint `role.ts` s'il est nouveau) ; sans lui, une étape `next` dit que
  l'attribution reste à faire (`authz/granted`).
- `route` remet `actorOf(context.principal)` à un cas d'usage protégé et pose `security` (le
  schéma de `--authn`, ou `false` pour un cas d'usage public). `integration-handler` porte
  `systemActor('<context>.<name>')` pour la commande qu'il construit ; derrière un *broker*, il
  écoute sur l'abonné de son contexte (`EventSubscribers.forContext`), sa marque et son travail
  dans une seule unité de travail.
- Un adaptateur de *repository* généré ne fait que persister : il prend `ExecutionScope` et
  `Clock`, jamais `ActorContext` ni un distributeur, et estampille `created_at`, `created_by`,
  `updated_at`, `updated_by` avec `stampCreation` et `stampUpdate` ; la table utilise les
  `auditColumns` du *package* de l'ORM (les cinq champs sont écrits en entier pour Prisma). Le
  fait d'exemple d'un agrégat est `registeredAt`, puisque `created_at` est la colonne d'audit.
  `repository --tenant-scoped` (drizzle et knex), et chaque *repository* d'un projet dont
  `stack.tenancy` vaut `shared-table`, ajoute `tenantColumn`, nomme le *tenant* à l'insertion et
  atteint la table par les fonctions utilitaires du *package* de l'ORM (`tenantTable` et
  `ownTenantTable` sur Knex, `tenantCondition` et `ownTenantCondition` sur Drizzle), avec une
  *spec* qui vérifie qu'un *tenant* ne voit pas les lignes d'un autre. Avec un autre ORM,
  l'adaptateur ordinaire est écrit et une note dit quoi ajouter.
- `adapter --decorators` est accepté sur toute *stack* : les décorateurs des aspects servent le
  mode standard et l'ancien mode (legacy) qu'impose un `tsconfig.json` avec
  `experimentalDecorators`.
- `route` d'une requête `--search` lit la page avec `pageQuerySchema` et répond avec
  `pageSchemaOf` et `pageResponse`. Un abonnement d'un gestionnaire d'événement d'intégration qui
  n'est pas un `builder.on` est écrit dans la région `start` avec `idempotent(...)` autour de
  `inEventScope(...)`.
- **Le langage d'abord.** Le nom d'un agrégat, d'une entité, d'un objet-valeur, d'un service du
  domaine, d'un événement du domaine, d'une commande ou d'une requête est refusé quand l'un de ses
  mots n'est couvert par aucun terme du tableau `## Ubiquitous language` du contexte (les formes
  du pluriel, du participe passé et en -ing sont reconnues). `--term "<Term>=<meaning>"`,
  répétable, ajoute les lignes dans la même commande. Les mots techniques (`Manager`, `Helper`,
  `Data`, `Impl`, `Model`...) et un fait d'événement qui ne se lit pas au passé sont refusés eux
  aussi. `--allow-name` passe outre les trois vérifications ; `check` signalera tout de même ce
  que le glossaire ne définit pas.
- Le code généré compile tel quel et passe `check`, le preset ESLint, dependency-cruiser et knip
  aux sévérités par défaut : un export par fichier, des fichiers bien en dessous de 350 lignes,
  des membres `private`, la disposition des lignes vides. Chaque endroit qui demande une
  connaissance métier porte un commentaire `// TODO(domain): ...` qui dit quelle décision est
  attendue, et un endroit où un adaptateur est à remplacer un commentaire `// TODO(platform): ...` ;
  les seuls autres commentaires disent ce que le code ne peut pas dire.
- Les *specs* contiennent un vrai test qui passe là où il peut s'écrire de façon générique, et
  des entrées `it.todo` qui nomment les comportements à couvrir. Aucun *mock* : des *fakes*, des
  *builders* et l'application de test. Sur tsyringe, une *spec* de gestionnaire passe par
  `createTestApplication` de `@ddd-ts-kit/di` et observe les faits annoncés avec la sauvegarde
  par `application.domainEvents.on('<name>', ...)` ; en câblage manuel, elle passe par
  `createTestBuses()` de `@ddd-ts-kit/testing`, dont `dispatching(fake)` fait que la sauvegarde
  d'un *fake* annonce ses événements à `domainEvents`. La mise en place que partagent plusieurs
  *specs* d'un contexte se génère une fois, `generate test-world`, dans `test/worlds/`.
- `--json` affiche `{ dryRun, created, updated, skipped, next, todos, notes }`. `next` liste les
  endroits `TODO(domain)` en `file:line`, le glossaire d'abord, puis les lignes qu'une commande a
  écrites pour que l'équipe les vérifie (l'autorisation d'un *job*) ; `todos` ajoute leur texte.
- Un genre qui a besoin d'autre chose pour compiler soit le crée (un *repository* ou un événement
  du domaine manquant), soit s'arrête avec la commande qui le crée (un agrégat, un cas d'usage ou
  une route manquant).
- L'enregistrement se fait entre des commentaires marqueurs (`// ddd-ts-kit:<region>` ...
  `// /ddd-ts-kit:<region>`, des commentaires HTML en Markdown). Retirez un marqueur, et le
  générateur affiche ce qu'il faut ajouter à la main.
- Chaque `generate` rafraîchit la documentation générée et `.dependency-cruiser.cjs` quand ils
  existent ; générer deux fois ne change rien.
- `--local-only` refuse, en nommant les fichiers et sans rien écrire, quand le passage écrirait
  hors de `<contextsDir>/<context>/` et de `test/e2e/*.e2e.spec.ts`. `generate --help --json`
  affiche chaque genre avec son `usage`, ses `aliases`, son `summary` et son `writesShared`, plus
  `shared` et `sharedWhen` : ce qu'il écrit hors de son contexte, et quand. Les deux servent un
  build réparti entre des *workers* (voir `worker-scope`).
- Un *fake* est un point d'entrée pour knip et peut n'avoir aucun importateur pour
  dependency-cruiser : un port et son *fake* générés avant qu'un cas d'usage en ait besoin ne font
  échouer ni l'un ni l'autre analyseur. Un service du domaine est gardé en vie par la *spec*
  générée avec lui.

Les *templates* sont des fichiers ordinaires dans `templates/<kind>/`, avec des emplacements
`{{name.pascal}}`, `{{name.camel}}`, `{{name.kebab}}`, `{{name.constant}}`, `{{context.kebab}}`
et des blocs `{{#if x}}` / `{{#unless x}}`. Un emplacement inconnu est une erreur.

## docs

```
ddd-ts-kit docs [--check] [--stored-events]
```

Régénère ce qui dérive de la configuration et du code, et rien d'autre :

- `docs/context-map.md`, entre des marqueurs `<!-- ddd-ts-kit:context-map -->` : un diagramme
  Mermaid (un nœud par contexte, stylé selon sa classification, une flèche par relation, de
  l'amont vers l'aval, étiquetée du patron) et le tableau des contextes avec la première phrase
  de leur raison d'être, leurs amonts, leurs avals, les événements qu'ils publient et s'ils sont
  déployables seuls. Le texte hors des marqueurs est gardé ; à la première création, les quatre
  sections écrites sont posées avec des indications.
- les listes générées de chaque `CONTEXT.md` (agrégats, événements publiés, permissions, *jobs*
  planifiés en tableau de nom, planning et commande, relations) ;
- le fichier généré de chaque contexte déclaré : le barrel `<context>.declarations.ts`, avec ce
  que reçoit chaque constructeur, lu depuis sa signature, ou sous discovery
  `<context>.dependencies.ts`, qui ne contient que cela ;
- la référence de chaque `CONTEXT.md` : les faits de `describe`, en tableaux sous
  `## Reference`, entre des marqueurs `ddd-ts-kit:reference` ; un `CONTEXT.md` qui n'a pas cette
  section la reçoit après sa dernière liste générée ;
- `docs/integration/README.md`, créé une fois et jamais réécrit ; sa section Provider commence par
  la stratégie du *broker* choisi.

`--stored-events` enregistre aussi dans `stored-events.lock.json` la forme de chaque version d'un
événement stocké déclarée dans les codecs de `infrastructure/persistence/`, sans jamais réécrire
une version enregistrée : lancez-le une fois que la forme d'une version est définitive.

`--check` n'écrit rien, nomme chaque fichier périmé et chaque version d'événement stocké déclarée
qui n'est pas enregistrée dans `stored-events.lock.json`, et sort avec le code 1. Le catalogue
des événements et le document AsyncAPI ont besoin d'exécuter le code du projet, c'est pourquoi
ils sont produits par `scripts/events.ts` (`npm run events:generate`, qui fait partie de
`npm run docs:generate`).

## sdk

```
ddd-ts-kit sdk [--check] [--dry-run]
```

Génère le client typé de chaque document du contrat OpenAPI, lu depuis les `openapi/*.yaml` (ou
`.json`) commités : un *package* du *workspace* sous `clients/<document>` (`clients/api` pour le
contrat entier), sans dépendance d'exécution. Chaque opération est une méthode de
`createClient()` et une fonction à elle ; son résultat est typé par statut, un refus par les
codes d'erreur que le contrat liste pour elle (`x-error-codes`) ; un identifiant de connexion est
donné par schéma de sécurité. Le premier passage enregistre `"sdk"` dans la configuration
(`init --sdk` le fait pour un nouveau projet) et câble le projet : le *workspace*, l'entrée
`paths` de chaque client dans `tsconfig.json`, les exclusions de Biome et de knip, les scripts
`sdk:generate` et `sdk:build`, et `docs:generate`, `docs:check`, `ci:docs`, `ci:build` étendus. Le
package.json d'un client garde sa version et les clés qu'une équipe ajoute. Sous npm, tant que
`package-lock.json` ne liste pas encore un client, il dit de lancer `npm install` et de commiter
le lockfile, ce que `npm ci` refuserait. `--check` n'écrit rien, nomme chaque fichier périmé (et
un client que le lockfile ne connaît pas) et sort avec le code 1. La comparaison avec
openapi-typescript, hey-api et orval, et comment publier un client :
[docs/tools/client-sdk.fr.md](../../docs/tools/client-sdk.fr.md).

## depcruise-config

```
ddd-ts-kit depcruise-config [--check | --write]
```

Affiche la configuration de dependency-cruiser dérivée de `ddd-ts-kit.config.json` : couches,
langages publiés, amonts déclarés, *packages* autorisés, cycles et orphelins. `--write` la
sauvegarde sous `.dependency-cruiser.cjs` ; `--check` sort avec le code 1 quand le fichier
manque ou est périmé, ce que `npm run depcruise` exécute en premier. Modifiez la configuration,
pas le fichier.

## value-objects

```sh
ddd-ts-kit value-objects [--dry-run]
```

Fait passer les objets-valeurs d'un projet d'un `Result` à des fabriques qui renvoient la valeur
ou lèvent une erreur (`"stack.valueObjects": "throwing"`). Ce qu'il réécrit, et ce qu'il laisse à
une personne, est dans [CONFIG.fr.md](../../docs/CONFIG.fr.md#stack).

## controllers

```sh
ddd-ts-kit controllers [<context>] [--dry-run]
```

Fait passer les routes en fonctions d'un projet, ou d'un contexte, à des classes contrôleurs
(`"stack.routes": "controllers"`). Pour chaque `presentation/http/<name>.route.ts` :

- le contrôleur est écrit dans `presentation/http/<resource>/<name>/<name>.controller.ts`, la
  ressource étant le premier segment de son chemin : la déclaration garde la méthode, le résumé,
  les schémas, l'unique réponse avec sa description et les codes d'erreur ; le gestionnaire de la route devient
  `handle`, avec l'acteur lu dans la requête HTTP et la réponse renvoyée sans son statut ;
- un groupe de routes par ressource est écrit (`<resource>.routes.ts` : son préfixe, les
  étiquettes de ses routes, `Authenticated`, et `FORBIDDEN` quand chaque route le déclarait) ;
  une route avec `security: false` ne se tient dans aucun groupe et dit `guards: [Public]` ;
- les fichiers de schéma nommés d'après la route la suivent (`<name>-body.dto.ts` devient
  `<name>.body.ts`), les autres vont dans `shared/` sous leur nom, et chaque import d'un fichier
  déplacé est réécrit ;
- la *spec* devient `<name>.controller.spec.ts` et exécute le contrôleur sans ses gardes ;
- dans un projet déclaré, la liste `<context>.routes.ts`, sa *spec* et sa ligne dans la racine
  de composition sont supprimées ; dans un projet explicite, la liste construit chaque contrôleur
  à la main ;
- la configuration dit `controllers` une fois qu'il ne reste plus aucune route en fonction dans
  les contextes.

Un contexte est converti en entier ou pas du tout. Une route qui n'est pas écrite comme
`export function <name>Route(<bus>): Route { return defineRoute(spec, async (input) => { .. }); }`,
qui déclare plusieurs réponses, ou dont le gestionnaire répond autre chose que `{ status, body }`,
est nommée avec la raison, et son contexte est laissé tel quel : les routes en fonctions
continuent de tourner à côté des contrôleurs. La commande se termine par ce qui reste à une
personne : lancer le formateur et `ddd-ts-kit docs`, déplacer les fonctions utilitaires qu'un
contrôleur a gardées vers un *mapper* de requête HTTP ou un sérialiseur, donner leurs gardes aux
groupes, tenir les gardes dans les *specs*.

## error-factories

```
ddd-ts-kit error-factories --plan [--to named|factories]
ddd-ts-kit error-factories --apply [--dry-run]
```

Fait passer les refus d'un projet à une classe par refus (`--to named`, par défaut), depuis une
classe par erreur (`new SlotTakenError(..)`) ou depuis les fabriques d'une classe d'erreur par
concept (`AppointmentError.slotTaken(..)`), vers `SlotTaken.forCalendar(..)`. En deux étapes,
parce que le nom d'un refus et celui de sa fabrique sont des décisions du modèle.

`--plan` écrit `error-factories.plan.json`, `{ "to": "named", "contexts": { .. } }` : par
contexte, une entrée par refus, avec ce qui le construit aujourd'hui (`from` : `SlotTakenError`,
`AppointmentError.ended`), son fichier, son code, qui est gardé, la classe proposée pour lui
(`class` : le PascalCase de son code, `APPOINTMENT_ENDED` donne `AppointmentEnded`, et `X_NOT_FOUND`
donne `UnknownX`) et sa fabrique (`factory` : `for` et son premier paramètre, sans suffixe `Id`,
`appointmentId` donne `forAppointment`, `cause` donne `becauseOf` ; sinon `for` et le concept ou
l'agrégat d'après lequel la classe est nommée).
Modifiez les noms que vous voulez autres : deux entrées sous une même classe sont deux fabriques
de celle-ci, sous son unique code. Une fabrique dont le code n'est pas un littéral de chaîne est
laissée hors du plan, et se déplace à la main. Une classe est nommée avec des termes du glossaire
de son contexte, puisque `language/glossary-term` juge chaque classe de `domain/errors/` sous
`named`, les qualificatifs d'un refus mis à part : pour chaque classe proposée dont le nom emploie
un mot que le glossaire ne définit pas, `--plan` dit, sous « Left to you », quels mots et où les
définir, ou de renommer la classe dans le plan ; `--apply` le redit pour chaque classe qu'il
écrit.

`--apply` suit le plan, et refuse une classe qui n'est pas en PascalCase ou finit par `Error`, une
fabrique qui ne commence pas par `for`, `with`, `because`, `on` ou `at` puis une majuscule, une
classe à qui l'on donne deux codes et une fabrique prévue deux fois. Il :

- écrit `domain/errors/codes.ts` dans chaque contexte, la liste `<Context>Codes` avec une entrée
  par classe, et un fichier par classe de refus, `domain/errors/<refusal>.error.ts`, qui étend
  `DomainRefusal` et lit son code dans la liste, avec ses fabriques : chacune garde les
  paramètres, le message et les faits qu'elle avait ;
- déplace chaque cas d'une *spec* vers `test/unit/<refusal>.error.spec.ts` ;
- réécrit chaque fichier sous la racine des sources et sous `test/` :
  `AppointmentError.ended(a, b)` devient `AppointmentEnded.forAppointment(a, b)`,
  `AppointmentError.is(error, 'APPOINTMENT_ENDED')` devient `AppointmentEnded.is(error)`,
  `new SlotTakenError(..)` devient `SlotTaken.forCalendar(..)`, et le nom d'une classe par erreur
  devient le nom de sa classe partout ailleurs (assertions, `instanceof`, types), imports compris.
  Les commentaires et les chaînes sont laissés tels quels ;
- supprime les classes par erreur qu'il a déplacées, et les classes de concept restées vides ;
- pose `"stack.refusals": "named"` dans la configuration.

Il laisse, et le dit avec sa ligne, ce qui nomme encore une classe de concept disparue : un
`AppointmentError.is(error)` sans code, qui désignait chaque refus du concept (écrivez les refus
qu'il désigne, `AppointmentEnded.is(error) || ..`), et `CodeOf<typeof AppointmentError>` (écrivez
l'union des codes qu'il désigne, ou le type des codes de `codes.ts`). Et toujours : lancer le
formateur et les vérifications, décider quels faits un client peut lire là où aucune fabrique
n'en expose encore, vérifier les faits dans les *specs*, et supprimer le fichier du plan.
Relancé, il ne trouve plus rien à déplacer. `--json` répond
`{ dryRun, moved, written, removed, manual }`.

`--to factories` est le passage antérieur, d'une classe par erreur à des fabriques statiques sur
une classe d'erreur par concept, dans les deux mêmes étapes. `--plan --to factories` écrit une
entrée par classe de `domain/errors/` qui étend `DomainError`, avec son code, le concept proposé
pour elle (l'agrégat par lequel son nom commence ou finit, vide quand aucun ne convient) et le
nom de fabrique qui dit son code (`APPOINTMENT_NOT_FOUND` sur `Appointment` donne `notFound`) ;
chaque entrée a besoin d'un `concept`, un terme du glossaire. `--apply` refuse alors une entrée
sans concept, un nom de fabrique vague ou un nom qui ne dit pas le code. Il écrit
`domain/errors/<concept>.error.ts`, une classe qui étend `ConceptError` avec une fabrique par
classe déplacée là (les paramètres du constructeur, le message qu'il donnait à `super`, et comme
faits les paramètres qui sont de simples données), déplace les cas des *specs* sous
`describe('<factory>')` dans `test/unit/<concept>.error.spec.ts`, réécrit chaque usage
(`new X(..)` devient `<Concept>Error.<factory>(..)`, `thenError(X)` devient `thenError('<CODE>')`,
`toThrow(X)` et `expect.any(X)` une assertion sur le code, `toBeInstanceOf(X)`
`toMatchObject({ code })`, `e instanceof X` `<Concept>Error.is(e, '<CODE>')`) et pose
`"stack.refusals": "factories"`. Il laisse, et le dit : une classe qui a des membres à elle, lit
`this` dans son constructeur ou donne des options à `super` ; un endroit où une classe tenait
lieu de valeur qu'il ne sait pas traduire ; une propriété de l'erreur devenue un fait
(`error.personId` est désormais `error.facts.personId`) ; une fabrique de plus de trois
paramètres ; les fabriques qui prennent encore une phrase comme seul paramètre.

## build-aliases

```
ddd-ts-kit build-aliases [--project <tsconfig>]
```

La seconde étape de `npm run build`, après le compilateur. Le compilateur émet un alias d'import
tel qu'il a été écrit (`@/platform/errors`), et Node ne résout aucun alias et ne complète aucune
extension : cette commande réécrit, dans chaque `.js`, `.mjs`, `.cjs`, `.d.ts`, `.d.mts` et
`.d.cts` sous le répertoire de sortie du tsconfig (`tsconfig.build.json` par défaut), chaque
spécificateur d'alias en chemin relatif vers le fichier émis qu'il nomme, avec son extension
`.js` (`../../platform/errors.js`), afin que `node dist/src/main.js` s'exécute sans chargeur ni
option.

```js
// dist/src/contexts/billing/domain/aggregates/invoice.aggregate.js, tel que le compilateur l'émet
import { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';

// la même ligne après ddd-ts-kit build-aliases
import { InvoiceError } from '../errors/invoice.error.js';
```

Elle lit `importAlias` et `importExtension` de la configuration : `@/platform/errors` nomme
`platform/errors.js` sous `none`, `@/platform/errors.js` le nomme sous `js`, et aucune autre
écriture n'est devinée.

- Réécrits : le spécificateur de `import ... from`, `export ... from`, un `import` nu,
  `import('...')` et `require('...')` avec une chaîne littérale, `import.meta.resolve('...')`, et
  dans les déclarations `import type`, `typeof import('...')` et `declare module '...'`.
- Exacte : le fichier est analysé, pas fouillé ; une chaîne qui ressemble seulement à un import,
  dans un autre code, un commentaire, un template literal ou une expression régulière, est laissée
  telle quelle. Les lignes ne bougent jamais et les source maps ne sont pas touchées.
- Idempotente : un second passage ne réécrit rien.
- Elle sort avec le code 2 et n'écrit rien quand un alias ne nomme aucun fichier émis, quand il
  nomme un répertoire (un alias nomme un fichier : `.../published-language/index`), quand il est
  écrit dans une forme que la configuration ne demande pas, quand `import()` reçoit un alias
  complété à l'exécution (un template literal avec une interpolation, une concaténation), ou quand
  le répertoire de sortie n'existe pas. Chaque refus dit le fichier, la ligne et quoi écrire à la
  place.
- Un *package* n'est jamais touché, quelle que soit la fin de son sous-chemin
  (`zod/v4/core.js`, `@scope/package/file.js`, `node:fs`).

`--json` répond `{ outDir, files, changed, specifiers }`. `ddd-ts-kit check` signale un script
qui compile sans cette étape (`imports/alias-declared`). Tout le mécanisme :
[docs/tools/import-aliases.fr.md](../../docs/tools/import-aliases.fr.md).

## list

```
ddd-ts-kit list [--context <name>]
```

`--context` restreint la réponse à un contexte. Les contextes avec leur classification, la
taille de leur glossaire, leurs amonts, agrégats, commandes, requêtes, événements du domaine,
événements publiés, gestionnaires d'événements d'intégration, *jobs* planifiés (nom, planning, la
commande que chacun envoie ; `jobs` en `--json`), *builders*, mondes, permissions, politiques, *gateways*
et s'ils sont déployables seuls, puis les *specs* de bout en bout. Dans le style déclaré, les cas
d'usage, les gestionnaires, les politiques, les *gateways* et les adaptateurs sont lus dans les
décorateurs : une commande ou une requête montre ce qu'elle exige (ou `public`), un gestionnaire
son nom de consommateur et son événement, une politique sa permission, un adaptateur son port ;
`--json` les ajoute sous `declarations`. Dans le style explicite, les *jobs* sont lus dans les
lignes `builder.job(...)` et `platform.jobs.register(...)` du fichier de module.

## describe

```
ddd-ts-kit describe <context>
```

Un contexte sous forme de faits lus dans la configuration et le texte des sources, dans les deux
styles : les cas d'usage avec leur permission (ou `public`), les routes (méthode, chemin,
identifiant d'opération, cas d'usage, noms de schémas, codes d'erreur, les types de média dans
lesquels elles répondent et qu'elles lisent en plus de JSON, leur formulaire), les événements consommés
et publiés, les ports avec leurs adaptateurs, les politiques, les *gateways* avec leur amont, les
*jobs* planifiés, les amonts et les avals. Les listes de champs ne sont pas devinées : elles sont
dans `openapi/openapi.yaml` et `docs/integration/event-catalog.md`. `docs` écrit les mêmes faits
dans chaque `CONTEXT.md`.

`--json` affiche un seul objet :

| Clé | Valeur |
|---|---|
| `name`, `classification`, `purpose`, `deployable`, `doc` | le contexte, sa raison d'être (vide tant qu'elle n'est pas écrite) et le chemin de son `CONTEXT.md` |
| `glossary`, `aggregates`, `domainEvents`, `permissions` | des noms |
| `upstreams`, `downstreams` | `{ context, relationship }` |
| `useCases` | `{ kind, name, permission, file }`, `kind` valant `command` ou `query` |
| `routes` | `{ method, path, operationId, useCase, permission, request: [{ part, schema }], responses: [{ status, schema }], errors, file }`, et `produces`, `consumes` (types de média en plus de JSON) et `form` (`GET /forms/<operationId>`) quand la route les déclare |
| `consumedEvents` | `{ type, version, from, handler, consumer, file }` |
| `publishedEvents` | `{ type, versions, publishers }` |
| `ports` | `{ name, kind, adapters, file }`, `kind` étant celui de sa liaison (`repository`, `external`, `gateway`) |
| `policies` | `{ name, permission, file }` |
| `gateways` | `{ name, upstream, adapters, file }` |
| `jobs` | `{ name, schedule, command }` |
| `contracts` | `{ openapi, eventCatalog }` : où sont les listes de champs |

## status, todo

```
ddd-ts-kit status [--workers]
ddd-ts-kit todo [<context>]
```

`status` affiche la ligne `Next:` de `docs/architecture/plan.md`, les lignes de
`docs/architecture/slices.md` par statut et par responsable, et par contexte les `TODO(domain)`,
`TODO(platform)` et `it.todo` restants, puis ceux hors des contextes. Un fichier manquant n'est
pas une erreur. Chaque ligne qui n'est pas faite dit si elle peut commencer : prête sur le tronc
quand toutes ses dépendances sont faites, prête sur une branche quand chaque dépendance non faite
est une ligne confiée à un *worker* dont le *worktree* a des *commits* d'avance sur sa base (les
`rows` de son `.ddd-ts-kit/worker.json`, tels que `status --workers` les lit), et en attente
sinon, avec les identifiants qu'elle attend. Une story ou un jalon dont toutes les lignes sont
faites mais que des marqueurs qui lui appartiennent gardent ouvert a sa propre ligne (seuls les
marqueurs qui peuvent garder une telle story ouverte passent par git blame, un appel par fichier), avec la commande qui les liste :
`story M1: every row done, 3 markers left: npx ddd-ts-kit story-check M1` (voir
[story-check](#story-check)). `--json` affiche `{ next, slices, remaining }` :
`next` et `slices` valent `null` quand leur fichier manque, `slices` contient
`{ file, rows, byStatus, byOwner, duplicates, unscoped, unclosed }`, `unclosed` valant
`[{ story, markers, command }]`, une ligne non faite portant
`ready: 'trunk' | 'branch' | 'waiting'` et `waitingFor` (ses dépendances non faites), et
`landedNotDone` les lignes non marquées terminées arrivées sur le tronc avec la branche d'un
*worker*, chacune `{ id, commit }` (dite `#<id> landed on the trunk (<commit>) but is not marked
done`),
`remaining` un `{ context, domain, platform, test }` par contexte, et un avec un `context` vide
pour ce qui reste hors d'eux.

`status --workers` affiche à la place les *workers* d'une construction en parallèle : chaque
*worktree* du dépôt dont la copie du projet porte `.ddd-ts-kit/worker.json`, avec sa branche,
son contexte, ses lignes, sa base, les *commits* qu'il a d'avance sur la base,
`dependencies not installed` quand sa copie du projet n'a pas de `node_modules`, les fichiers qu'il
a changés (commités depuis la base de fusion, modifiés, et non suivis mais non ignorés, relatifs
au sommet du dépôt) et son `.ddd-ts-kit/report.md` avec sa date d'écriture. Une fois sa branche
fusionnée en *squash* dans la base, trouvée comme `merge-trunk` la trouve (*patch ids*, aucun
appel à GitHub), le *commit* qui l'a reçue et les lignes qu'elle y avait terminées sont affichés,
et ses *commits* d'avance et ses fichiers sont comptés depuis l'endroit où elle est arrivée : une
branche réutilisée sans rien de neuf ne compte rien, et aucun faux recouvrement n'est signalé sur
ce qui est déjà arrivé. Suivent ses *commits* de retard sur la base et, quand elle est en retard,
ce que `merge-trunk` laisserait en conflit maintenant (calculé par `git merge-tree`, rien
d'écrit). Puis les contextes construits par plus d'un *worker* et les fichiers changés par plus d'un *worker*, chacun avec
leurs *worktrees*. Un fichier de périmètre qui ne porte que le contexte est lu aussi : le
*worker* vient sans ses lignes, sa base ni son avance, et ses fichiers sont les fichiers non
commités. `--json` affiche
`{ workers: [{ worktree, branch, context, rows, base, ahead, behind, landed, mergePreview, installed, files, report, progress }], overlaps: { contexts: [{ context, worktrees }], files: [{ file, worktrees }] } }`,
`landed` valant `{ commit, subject, rows }`, `mergePreview` `{ conflicts, files }`, `report`
`{ file, modified }` ou `null`. Sans *worker*, elle le dit en une ligne. Un
*worker* dont le fichier de périmètre nomme ses lignes reçoit une ligne `state:`, par exemple
`stopped mid-row #M1.14 (6 files uncommitted, 3 TODO(domain), last verify-slice failed: tests);
resume: npx ddd-ts-kit worker-scope billing --resume`, et `progress` en JSON : `{ rows: [{ id,
slice, state, commit?, byOrder? }], inSlice, leftOut, markers: { domain, test }, verification,
report: { modified, current }, agent, phase, next }`, `phase` valant `not started`, `mid-row`,
`between rows` ou `rows committed`, et `next` l'un de `wait`, `send-message` (avec `to`),
`new-agent`, `merge`, tel que `worker-scope --resume` le décide (`wait` tant que l'agent a appelé
un outil dans les trois dernières minutes sans s'arrêter depuis).

`todo` liste ces marqueurs en `file:line` avec leur genre et leur texte, dans le projet ou dans
un contexte ; `--json` affiche `{ count, remaining: [{ kind, context, file, line, text }] }`.

## plan-waves

```
ddd-ts-kit plan-waves [<context>]
```

Ordonne les lignes de `docs/architecture/slices.md` qui ne sont pas `done`, pour une construction
répartie entre des *workers*. La vague 1 porte les lignes dont toutes les dépendances sont faites ;
la vague n les lignes dont les dépendances sont faites ou dans des vagues antérieures, de sorte
qu'une ligne n'attend jamais une ligne de sa propre vague. Chaque vague est découpée en lots : un
responsable et un contexte par lot, deux lignes au plus (ce que tient un agent), et deux lignes
ensemble seulement quand leur `Start with` nomme le même agrégat. L'agrégat d'une ligne est lu dans
ses commandes de générateur : `--aggregate <Name>`, `aggregate <context> <Name>` et
`repository <context> <Name>`. Deux lots d'un contexte dans une vague sont dits susceptibles de
toucher les mêmes fichiers quand ils nomment le même agrégat ; quand l'un d'eux n'en nomme aucun,
le chevauchement est dit inconnu plutôt que deviné. Chaque lot du *worker* d'un contexte vient avec
la commande qui le consigne, `npx ddd-ts-kit worker-scope <context> --base origin/main --rows <ids>`,
avec ses propres `--worktree` et `--branch` quand sa vague porte un autre lot de ce contexte ; un
lot du chef d'orchestre se construit sur le tronc ; une personne reçoit sa consigne à la main.
Puis l'ordre des fusions : par vague, et dans une vague d'abord le lot que le plus de lignes
attendent, directement ou non, et ce qui se lance avant chaque fusion :
`npx ddd-ts-kit merge-trunk --to-land --cwd <worktree>`, puis la fusion en *squash*. Avec un
contexte, seules ses lignes sont montrées ; les lignes
d'autres contextes qu'elles attendent comptent dans la numérotation des vagues.

Un cycle dans `Depends on`, une dépendance vers un identifiant qu'aucune ligne ne porte, une ligne
sans responsable et un identifiant que portent deux lignes rendent les lignes impossibles à
ordonner : ils sont signalés seuls, sans vagues, et la commande sort avec 1. Un fichier sans table
de tranches, ou un contexte qu'aucune ligne ne nomme, est refusé. `--json` affiche
`{ file, context, problems: [{ kind, rows, message }], waves: [{ wave, batches: [{ id, owner, context, rows: [{ id, kind, slice, status, waitingFor }], aggregates, brief, sameFiles, unknownOverlap }] }], mergeOrder }`.

## story-check

```
ddd-ts-kit story-check <code> [--strict]
```

Dit si une story ou un jalon peut être clos : chacune de ses lignes de
`docs/architecture/slices.md` est `done` (les autres sont listées avec leur statut), et il ne reste
aucun marqueur qui lui appartient. `<code>` est le début des identifiants de ses lignes,
l'identifiant sans son dernier `.<numéro>` : `M1` pour `M1.01`, `M1.02`, `US5` pour `US5.03` (un
`#` devant est ignoré).

Plusieurs stories construisent souvent le même contexte à la fois, et un marqueur ne dit pas à qui
il est : chaque `TODO(domain)`, `TODO(platform)`, `it.todo` et `TODO(review)` est d'abord attribué
à des lignes.

1. Son texte nomme une ligne : `#M1.03` ou `M1.03`, comme mot entier, ainsi que `cited` les lit
   (`M1.035` n'est pas `M1.03`). C'est pourquoi une remarque de revue s'écrit
   `TODO(review): #<identifiant de ligne> <remarque>`.
2. Sinon le *commit* qui a écrit sa ligne en nomme une : `git blame --porcelain` donne le *commit*
   (un appel par fichier, sur les lignes de ses marqueurs, et un appel git pour tous les
   *commits*), dont le *trailer* `Slice: <id>`, sinon les identifiants de lignes que nomment son
   sujet ou son corps, donnent les lignes. Un `TODO(domain)` ou un `it.todo` écrit par un
   générateur appartient à la ligne dont le *commit* l'a créé.
3. Sinon, pour une ligne pas encore commitée, les lignes de `.ddd-ts-kit/worker.json` quand le
   projet est le *worktree* d'un *worker*.

Un marqueur appartient à la story quand il appartient à une de ses lignes, où qu'il soit. Un
marqueur d'un contexte de ses lignes qui n'appartient à aucune ligne lui appartient quand aucune
autre story ouverte (qui a une ligne non faite) n'a de ligne dans ce contexte, puisqu'il ne peut
être à personne d'autre ; sinon il est listé sans bloquer, avec les stories à qui il peut
appartenir : le régler, ou y nommer sa ligne. Un marqueur des lignes d'autres stories ne bloque
pas, et il est compté. Une cellule Context qui ne nomme aucun contexte du projet (`all`,
`platform`) n'en ajoute aucun : hors des contextes, seul un marqueur attribué à une de ses lignes
compte. `--strict` fait bloquer chaque marqueur de ses contextes, à qui qu'il soit.

Elle ne lit que les fichiers et git. Elle sort avec 0 quand la story peut être close (une ligne,
puis les marqueurs listés sans bloquer, s'il y en a), 1 quand quelque chose la garde ouverte,
chaque marqueur bloquant avec la raison pour laquelle il est à elle (`names #M1.01`,
`written by a782a19 Slice: M1.02`, `no other open story in payments`), son `file:line` et sa
correction (le traiter, ou l'écarter par un enregistrement de décision,
`npx ddd-ts-kit generate adr "<title>"`, puis supprimer le marqueur), et 2 sur un code qu'aucune
ligne ne porte ou sans tableau des tranches. `--json` affiche
`{ story, rows, contexts, unread, strict, open: [{ id, context, slice, status }], markers, unattributed, others, canClose }`,
chaque marqueur valant `{ kind, context, file, line, text, attribution: { by, rows, commit? } }`,
avec `why`, `sharedWith` et `fix` dans `markers` et `unattributed` ; `by` vaut `text`, `commit`,
`worker` ou `none`.

```
$ npx ddd-ts-kit story-check M1
M1 cannot close: every row done, 3 markers of its own left.

TODO(review) (1): handle it in a slice, or dismiss it by a decision record (`npx ddd-ts-kit generate adr "<title>"`, quoting the remark without its marker), then delete the marker in the same commit
  docs/architecture/reviews/invoices.md:3  #M1.01 name the total after its term.  (names #M1.01)

TODO(domain) (1): write the business decision it asks for, or dismiss it by a decision record (`npx ddd-ts-kit generate adr "<title>"`), then delete the marker
  src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts:2  the rounding of a total.  (written by a782a19 Slice: M1.02)

TODO(platform) (1): make the technical choice it asks for, or dismiss it by a decision record (`npx ddd-ts-kit generate adr "<title>"`), then delete the marker
  src/contexts/payments/domain/aggregates/payment.aggregate.ts:2  the provider of a refund.  (no other open story in payments)

Not blocking, unattributed (1): settle each, or name its row in the marker (`TODO(review): #<row> <remark>`)
  src/contexts/billing/test/unit/invoice.aggregate.spec.ts:1  it.todo  refuses an invoice without lines  (unattributed, may belong to open US2: settle it or name the row in the marker)

Not blocking: 1 marker of these contexts belongs to rows of US2.

Once each is settled: npx ddd-ts-kit story-check M1
```

Une fois les trois réglés :

```
$ npx ddd-ts-kit story-check M1
M1 can close: its 3 rows done, no marker of its own left in billing, payments.

Not blocking, unattributed (1): settle each, or name its row in the marker (`TODO(review): #<row> <remark>`)
  src/contexts/billing/test/unit/invoice.aggregate.spec.ts:1  it.todo  refuses an invoice without lines  (unattributed, may belong to open US2: settle it or name the row in the marker)

Not blocking: 1 marker of these contexts belongs to rows of US2.
```

## doctor

```
ddd-ts-kit doctor [--strict]
```

Ce qu'une montée de version a laissé à faire : les scripts, les paquets du kit (aux plages de
cette version) et les permissions des agents que cette version écrit et que le projet n'a pas ou
écrit autrement, puis les *hooks* git. `lefthook.yml` doit porter
`lefthook: node_modules/.bin/lefthook`, qui fait lancer à chaque *checkout* et à chaque
*worktree* son propre lefthook, et fait échouer un *commit*, bruyamment, quand ses dépendances
manquent ; le correctif est cette ligne, ou `init --force` pour le fichier entier. Le *hook*
pre-commit sous `git rev-parse --git-path hooks` doit exister et venir de lefthook ; le correctif
est `npm run hooks:install`, une fois par clone.

Puis ce qui manque à ce *checkout* pour faire tourner le projet, l'état d'un clone ou d'un
nouveau *worktree* plutôt que du projet, lu dans ses fichiers sans réseau : le Node qui tourne
face à `engines.node` de `package.json` (`unsupported`) et à la version que nomme `.nvmrc`
(`other version` ; un alias comme `lts/*` n'est pas jugé) ; `node_modules` présent (`missing`)
et installé depuis la dernière modification du *lockfile* (`outdated`, d'après la copie du
*lockfile* que le gestionnaire de paquets écrit sous `node_modules`) ; `ddd-ts-kit` et chaque
paquet `@ddd-ts-kit/*` que `package.json` déclare ou que `node_modules` contient, installé
(`not installed`) à la version de la CLI qui tourne (`other version`). Un projet sans *lockfile*
à lui dans un *workspace* (un `package.json` au-dessus qui déclare `workspaces`, ou un
`pnpm-workspace.yaml`, avec le *lockfile*) est lu là où le *workspace* installe, ses paquets
résolus comme le fait Node, du projet vers le haut ; et, quand le dépôt a un
`.gitmodules`, chaque sous-module initialisé (`not initialised`, d'après `git submodule status`).
Chacun vient avec son correctif : un Node qu'`engines.node` accepte (`nvm use`), `npm ci`, les
paquets du kit montés ensemble, `git submodule update --init --recursive`.

`--strict` sort avec 1 tant que quelque chose manque ou est à une autre plage, ou tant que le
*checkout* ne peut pas faire tourner le projet : un Node hors d'`engines.node`, pas de
`node_modules`, un paquet du kit non installé ou à une autre version, un sous-module non
initialisé. Un script écrit autrement, un *hook* que ce clone n'a pas installé, un Node que
`.nvmrc` ne nomme pas quand `engines.node` l'accepte, et un *lockfile* modifié depuis
l'installation (un *checkout* peut le réécrire avec ce que `node_modules` contient déjà) sont
signalés sans le faire échouer. `--json` affiche `{ version, findings: [{ area, name, problem,
expected, found }] }`, `area` valant `script`, `package`, `permission`, `hook`, `node`,
`install` ou `submodule`.

## worker-scope

```
ddd-ts-kit worker-scope <context> [--base <ref>] [--rows <id,...>] [--worktree <path>] [--branch <name>] [--no-install] [--dry-run]
ddd-ts-kit worker-scope <context> --resume [--worktree <path> | --branch <name>] [--fresh]
```

Prépare la place d'un *worker* d'un build réparti par contexte : crée un *worktree* git du projet
(`.worktrees/<context>` du *checkout* principal par défaut, à côté du projet tant que son
`.gitignore` ne contient pas `.worktrees/`) sur la branche `build/<context>`, à partir de `--base` (une
branche, une étiquette ou un *commit* : `origin/main` ; par défaut la branche courante), y écrit
`.ddd-ts-kit/worker.json` (`{ context, rows, base, baseCommit, branch }`, `baseCommit` étant le
*commit* que nomme la base à ce moment ; `init` ignore `.ddd-ts-kit/`), et
affiche la consigne du *worker* : son périmètre, les générateurs qu'il peut lancer, ses tranches
d'après `docs/architecture/slices.md` (par défaut le premier lot que `plan-waves` découpe pour le
contexte, une ou deux lignes encore à faire sur un agrégat, avec une note qui nomme le `--rows` du
lot suivant), son budget de tours, les langages publiés qu'il consomme, et la
base comme tronc de ses vérifications (`check --changed-since <base>`). `--rows 4.15,4.16` ne
donne que ces lignes, dans cet ordre : un identifiant est lu tel qu'il est écrit, et une ligne
absente du fichier, présente deux fois ou confiée à un autre propriétaire est refusée. Chaque
ligne porte ses règles, lues sur une ligne `- #<id>: <règles>` sous les tableaux ; au-delà de
deux lignes, une note le signale, car un agent en tient une ou deux. Un *worktree* existant, ou
une branche existante, est gardé quand il contient la base et refusé sinon, pour qu'aucun
*worker* ne construise sur un tronc périmé, avec le correctif :
`npx ddd-ts-kit merge-trunk --trunk <base> --cwd <worktree>`, jamais un simple `git merge`, qui
entre de nouveau en conflit sur ce qui est déjà arrivé ; seul le fichier est réécrit. Sans `--base`, lancé
depuis le *worktree* d'un *worker* (son `.ddd-ts-kit/worker.json`, ou une branche
`build/<context>`), il refuse : cette branche deviendrait le tronc. Dans un *worktree* qu'il
crée, il lance ensuite l'installation propre du gestionnaire de paquets du projet (`npm ci`,
`pnpm install --frozen-lockfile`), dont la sortie n'est gardée qu'en cas d'échec ; une note donne
le temps qu'elle a pris, ou, quand elle a échoué ou que `--no-install` l'a écartée, quoi lancer
avant que le *worker* ne démarre. `--dry-run` ne crée, n'écrit et n'installe rien. Il faut un dépôt git avec au moins un *commit*. Le *worker* génère ensuite avec
`--local-only`.

Sous chaque ligne dont la conception vit dans un document de `docs/architecture/`, la consigne le
nomme (`design: docs/architecture/reviews/refunds.md (section "#M2.03 Compute the refund")`), et
les noms que cette conception cite et que la base n'a pas, tels que `cited` les trouve, viennent
dans un bloc de huit lignes au plus, avec une note pour le chef d'orchestre qui nomme les lignes à
corriger sur le tronc. `--json` les porte sous `citations`.

Dans le *worktree* d'un *worker*, `verify-slice` nomme la ligne qu'il ferme (la première de
`worker.json` qu'aucun *commit* de la branche ne ferme encore) et affiche la commande de *commit*
exacte, avec le *trailer* qui nomme la ligne :
`git commit -m "feat(billing): pay an invoice" -m "Slice: M1.14"`. Il garde son résultat dans
`.ddd-ts-kit/verification.json` (`{ at, head, row, ok, failed, toStage }`), et le garde du
*plugin* garde les exécutions de l'agent `context-builder` dans `.ddd-ts-kit/agent.json`.

`--resume` lit où en est le *worker* arrêté du contexte, depuis le tronc, et ne crée ni ne réécrit
rien : ses lignes (commitées d'après leur *trailer* `Slice:`, ou dans l'ordre des *commits*
`feat(<contexte>)` pour un *commit* plus ancien, affichées `(by order)`), les fichiers de la ligne
en cours, les marqueurs laissés dans le contexte, sa dernière vérification et ce qui a changé
depuis, si son rapport est à jour, et son agent. Puis l'étape suivante : `SendMessage` à cet agent,
avec le message à envoyer tel quel, quand il s'est arrêté au milieu d'une ligne après un progrès,
dans une exécution qui n'est pas sa troisième ; un nouveau `context-builder` avec la consigne de la
seule ligne en cours, plus les fichiers que l'agent précédent a laissés (jamais à régénérer) et son
rapport cité, entre deux lignes, sans agent enregistré, après trois exécutions ou une exécution
sans progrès, ou avec `--fresh` (un contexte plein) ; la fusion quand chaque ligne est commitée et
que rien ne reste. Elle refuse un contexte qu'aucun *worktree* ne construit, et nomme les
*worktrees* d'un contexte que deux *workers* construisent : choisissez-en un avec `--worktree` ou
`--branch`. `--json` affiche `{ context, worktree, root, branch, base, progress, next,
sendMessage, briefing, notes }`.

## cited

```
ddd-ts-kit cited [<context>] [--rows <id,...>] [--base <ref>] [--removed-since <ref>]
```

Les noms que la conception des lignes non terminées cite comme du code et que le code n'a pas. La
conception d'une ligne, ce sont ses cellules `Slice` et `Start with` et ses lignes de règles dans
`docs/architecture/slices.md`, la section d'un fichier Markdown de `docs/architecture/` dont le
titre nomme la ligne (jusqu'au titre suivant de même niveau), un fichier qui la nomme dans son
texte (le fichier entier), et un fichier vers lequel pointe sa ligne de règles ; un fichier écrit
avant l'amorçage et une traduction à côté de son original sont laissés de côté. Un nom est un
segment de code en ligne : un chemin sous la racine des sources ou relatif à un contexte,
`Classe.membre`, ou un nom en PascalCase (d'un seul mot seulement s'il n'est pas un terme du
glossaire du contexte de la ligne). Un segment qui contient une espace, comme une commande de
générateur, ne nomme rien.

Chaque nom est lu contre `--base` (la branche courante par défaut) dans git, sans extraction, et
n'est signalé qu'avec une preuve :

- retiré (`removed`) : l'historique de la référence a retiré le fichier qui le donnait
  (`verify-occupancy.command.ts` donne `VerifyOccupancy`, quand ce fichier le déclarait), ou le
  dernier commit qui a changé une classe en a sorti le membre ; le rapport nomme le commit, son
  jour et son sujet, et ce qui l'a remplacé, trois au plus : le fichier vers lequel il a été
  renommé, un fichier que le même commit a ajouté dans le même contexte avec ses mots, un nom de
  même radical ;
- refusé (`refused`) : un chemin que l'arborescence canonique refuse, jugé comme `tree/closed`
  juge un fichier ;
- proche (`similar`) : un nom que la référence n'a jamais eu, terminé par un suffixe de rôle
  (`RefundBasisService`), quand la référence a un nom de même radical dont le rôle tient la même
  place (`RefundBasisReader`, un port) et dont le fichier est arrivé après la dernière modification
  de la ligne qui le cite.

Tout le reste est prévu, et muet. Un nom dont la phrase dit qu'il a été retiré ou renommé est de
l'histoire, et reste muet ; de même un nom dont la même partie cite déjà le successeur. `--rows`
vérifie ces lignes ; sans lui, chaque ligne non terminée, du contexte quand il est donné. Avec
`--removed-since <ref>`, il liste plutôt les noms que le changement retire, de la base de fusion
avec `<ref>` à l'arbre de travail, et que la conception d'une ligne non terminée cite encore (les
lignes du *worker* du *worktree* mises à part), et un document lié à aucune ligne est lu aussi. Il
lit, n'écrit rien, et sort avec le code 0. `--json` affiche `{ base, commit, counts: { present,
planned }, citations: [{ rows, document, line, cited, kind, state, removedBy?, refusal?,
candidates }], notes }`, ou `{ since, citations }` avec `--removed-since`. Un clone superficiel, où
un nom retiré ne se distingue pas d'un nom prévu, et une base locale en retard sur sa branche amont
sont notés.

Dans l'application d'exemple, avant la correction de son fichier des tranches :

```text
$ npx ddd-ts-kit cited analytics --rows M1.37 --base HEAD
Names of the design of #M1.37 that HEAD does not have (checked at d2bb88de):
- docs/architecture/briefings/analytics.md:18 `VerifyOccupancy`: removed by eefe4d21 (2026-10-10, "refactor(example): compute analytics occupancy at read time from one row per appointment (#5)") (#M1.37)
- docs/architecture/briefings/analytics.md:33 `VerifyOccupancy`: removed by eefe4d21 (2026-10-10, "refactor(example): compute analytics occupancy at read time from one row per appointment (#5)") (#M1.37)
- docs/architecture/slices.md:49 `VerifyOccupancy`: removed by eefe4d21 (2026-10-10, "refactor(example): compute analytics occupancy at read time from one row per appointment (#5)") (#M1.37)
Also cited: 4 present, 3 planned (silent).
```

## verify-merge

```
ddd-ts-kit verify-merge [<commit>] [--since <ref>] [--theirs <ref>] [--base <commit>] [--warn]
```

Dit ce que les fusions d'une branche ont perdu, lu dans git seul (sans *build*, sans
configuration), en une seconde environ. Sans *commit*, elle contrôle chaque *commit* de fusion de
`<since>..HEAD` et la fusion en cours, dont le résultat est l'index plus l'arbre de travail,
nouveaux fichiers non suivis compris ; `--since` vaut par défaut la base de
`.ddd-ts-kit/worker.json`, puis `origin/HEAD`, puis `origin/main`. Avec un *commit*, elle contrôle
celui-là : un *commit* de fusion, ou un *commit* de *squash* avec
`--theirs <tête de la branche qu'il a intégrée>`. Une fusion est comparée à sa base : `--base`,
sinon le *trailer* `Merge-Base:` de son message (une fusion calculée depuis la base propre de la
branche après un *squash* a une autre base que celle que git trouverait), sinon `git merge-base`.

Sur les fichiers que la fusion, sa base ou ses côtés ont changés, chaque ligne est comptée,
débarrassée de ses espaces de bord et de ses espaces répétés, les lignes de ponctuation seule et
les marqueurs de conflit qu'un côté a commités écartés, et chaque import de liaisons nommées éclaté en une entrée par liaison : le résultat doit
la contenir autant de fois que la base, plus ce que chaque côté a ajouté, moins ce que chaque côté
a retiré. Les fichiers sont comptés ensemble : une ligne déplacée dans un autre fichier n'est pas
perdue, une ligne remise en forme sur plusieurs lignes non plus. Les fichiers dérivés, les
fichiers dont les premières lignes disent qu'un outil les a écrits (`@generated`,
`autogenerated`, `DO NOT EDIT`), les migrations, les fichiers de verrouillage (npm, pnpm, yarn,
bun, uv, poetry, Pipfile, Cargo, Bundler, Composer, Go, NuGet) et `docs/architecture/slices.md`
sont tenus hors des lignes.

| Constat | Gravité |
|---|---|
| une ligne ajoutée par un côté, ou gardée par les deux, absente du résultat | erreur |
| un fichier qu'aucun côté n'a supprimé, absent du résultat avec des lignes qu'aucun autre fichier n'a (un constat par fichier) | erreur |
| une ligne de `slices.md` terminée d'un côté et non terminée dans le résultat, ou une ligne d'un côté disparue | erreur |
| le titre d'un `it(` ou d'un `test(` d'un côté disparu, un fichier de *spec* d'un côté supprimé | erreur |
| une migration d'un côté dont aucune migration du résultat n'a la description (son nom sans numéro ni `working-`) | erreur |
| un marqueur de conflit laissé dans un fichier modifié (`=======` seulement dans un conflit ouvert ; un fichier dont les côtés portent autant de marqueurs est écarté) | erreur |
| une ligne retirée par un côté, revenue | avertissement |
| une ligne écrite par un côté là où l'autre a changé les mêmes lignes de la base, dans un bloc que l'autre a supprimé, ou dans un fichier qu'il a supprimé : la fusion a choisi (`superseded`) | avertissement |
| une ligne que la fusion a remplacée, à sa place, par des lignes à elle qu'aucun côté n'a ; des lignes perdues par les deux côtés dans un fichier où la fusion a écrit ses propres lignes (`rewritten`) | avertissement |

Une ligne insérée entre des lignes de la base que l'autre côté n'a pas touchées reste une erreur,
même quand l'autre côté a inséré au même endroit : perdre l'une de deux nouvelles méthodes est la
perte que le contrôle cherche. De même pour une réécriture qui a perdu plus de lignes que les
lignes de la base ou que la réécriture de l'autre côté qu'elle concurrençait (une modification
suivie d'une nouvelle méthode). Ce qu'un côté a supprimé, ou rouvert, n'est jamais signalé. Une
suppression voulue se consigne dans le *commit* de fusion par un *trailer*
`Lost-Accepted: <file:line>,...` (un fichier seul accepte toutes ses lignes) : ces constats sont
listés et ne font jamais échouer. Pour une fusion plus ancienne que HEAD, un constat que HEAD ne
montre plus a été réparé par un *commit* suivant : listé aussi.

Sans fusion, elle n'affiche rien et sort avec 0 ; elle sort avec 1 sur une erreur. `--warn`
affiche le même rapport, ajoute que les erreurs ne bloquent pas encore, et sort avec 0. Dans
cette version, le *hook* de *pre-push* d'`init` lance `verify-merge --warn`, dont lefthook
affiche la sortie, et `verify-slice` signale les fusions depuis son `--since` sans faire échouer
la tranche ; une version mineure ultérieure les fera bloquer toutes deux. Le contrôle est une
estimation : sur 150 fusions qui ont résolu des conflits dans trois projets publics, une sur cinq
signalait encore une erreur, le plus souvent un changement d'une branche abandonné exprès parce
que l'autre branche avait remplacé la fonction, ce que seul un lecteur distingue d'une perte.
`--json` affiche
`{ since, merges: [{ commit, subject, base, baseFrom, ours, theirs, errors, warnings, accepted, repaired }], errorCount, warningCount, ok }`,
chaque constat étant `{ kind, file, line, side, text }`. Elle ne voit pas une même ligne ajoutée par les deux côtés à deux endroits,
une ligne de ponctuation perdue, ni un changement de sens, et un clone superficiel n'a pas les
*commits* qu'elle lit : en CI il lui faut `fetch-depth: 0`, c'est pourquoi les *pipelines*
d'`init` ne la lancent pas.


## merge-trunk

```
ddd-ts-kit merge-trunk [--trunk <ref>] [--since <commit>] [--to-land] [--dry-run]
ddd-ts-kit merge-trunk --continue [--accept-lost] | --abort
```

Apporte le tronc dans la branche en un seul *commit* de fusion calculé à partir du *diff* propre
de la branche. Ne rebase jamais, ne récupère jamais rien (le *commit* que nomme `--trunk` est
affiché ; par défaut `origin/HEAD`, puis `origin/main`). Refusé, sortie 2 : un arbre de travail
qui n'est pas propre (hors `.ddd-ts-kit/`), une fusion, un *rebase*, un *cherry-pick* ou un
*revert* en cours, un dépôt où git ne connaît aucun auteur de *commit* (la fusion se termine
par un *commit*), un tronc inconnu.

1. **La base** : le *commit* le plus récent de la branche que le tronc porte déjà. `--since
   <commit>` (un *commit* de la branche) ; sinon le point d'arrivée : le *commit* le plus récent
   dont le changement entier depuis le tronc est un *commit* du tronc, comparé par *patch id*
   stable sans lignes de contexte, sans les fichiers dérivés, les migrations, `slices.md`,
   `plan.md` ni les fichiers de verrouillage, cherché sur cette branche, sur la branche que
   `.ddd-ts-kit/worker.json` enregistre comme sa base, et sur les branches locales qui partagent
   des *commits* avec elle (une branche empilée dont le parent a été fusionné en *squash*, une
   branche réutilisée après l'arrivée de sa première ligne) ; parmi des *commits* qui partagent un
   même *patch*, le plus ancien est pris, un plus récent seulement quand le tronc porte ce qu'il a
   changé ; sinon le `baseCommit` enregistré par worker-scope, quand c'est un *commit* de la
   branche et que ses propres lignes sont toutes sur le tronc (sinon il s'arrête, rien de changé,
   et les liste pour qu'une personne confirme par `--since`) ; sinon `git merge-base`, et le
   rapport nomme chaque branche qui partage des *commits* sans être trouvée sur le tronc, avec son
   `--since`. Trop ancienne, la base se voit en conflits de plus, jamais en perte silencieuse.
2. **L'aperçu** : `git merge-tree --write-tree --merge-base=<base> HEAD <trunk>`, marqueurs diff3 ;
   le même sans la base donne ce sur quoi un simple `git merge` entrerait en conflit. `--dry-run`
   s'arrête ici et ne change rien.
3. **La fusion** : l'arbre devient une fusion en cours que git comprend (`ORIG_HEAD`, l'index
   avec les trois étapes de chaque chemin en conflit, `MERGE_HEAD`, `MERGE_MODE`, `MERGE_MSG`,
   *worktrees* liés compris) : `git status`, `git add`, `git commit` et `git merge --abort`
   fonctionnent dessus. Le message est `Merge <trunk> into <branch>` avec les *trailers*
   `Merge-Base: <base>`, `Trunk: <commit>` et, quand la branche y a été trouvée écrasée,
   `Landed: <commit>`.
4. **Ce qui se règle sans personne** :

   | Classe | Chemins | Résolution |
   |---|---|---|
   | dérivé | `openapi/`, `clients/`, `docs/integration/`, `.dependency-cruiser.cjs`, les *barrels* et listes de chaque contexte | côté du tronc, réécrit par `regenerate` |
   | document mixte | `CONTEXT.md`, `docs/context-map.md` | un conflit dans une région `<!-- ddd-ts-kit:<region> -->` : côté du tronc ; hors région : pour vous |
   | registre | un conflit entre des marqueurs `// ddd-ts-kit:<region>` de n'importe quel fichier | la base sans ce que l'un ou l'autre côté a retiré, plus ce que chacun a ajouté, le nôtre d'abord, une fois chacun ; dans `imports`, les noms importés d'un même module joints en une instruction |
   | tranches | `docs/architecture/slices.md` | ligne par ligne par `#` : le statut le plus avancé (done, in progress, todo), chaque autre cellule du côté qui l'a changée ; une cellule changée autrement par les deux : pour vous |
   | méta de drizzle | `<out>/meta/_journal.json`, *snapshots* | côté du tronc, puis le *replay* |
   | verrouillage | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` | côté du tronc ; `<manager> install` quand la branche a changé `package.json` depuis la base |
   | événements stockés | `stored-events.lock.json` | chaque version des deux côtés ; une enregistrée sous deux formes : pour vous |
   | tout le reste | sources, tests, `package.json`, configuration, un fichier supprimé par un côté | pour vous |

   S'il reste quelque chose pour vous : `.ddd-ts-kit/merge.json` enregistre la fusion, le rapport
   liste chaque fichier avec les lignes de chaque bloc, ce que cette branche et ses lignes du plan
   y ont fait, les *commits* du tronc qui l'ont touché depuis la base et ce qu'ils y ont fait, et
   la commande sort avec 1.
5. **`--continue`** (ou directement sans conflit pour vous) : refusé tant qu'un chemin n'est pas
   fusionné ou garde un marqueur de conflit ; l'installation, puis les migrations : sous
   drizzle-kit, quand les deux côtés en ont ajouté depuis la base, ou avec `--to-land` et une
   migration de travail, le *replay* de `drizzle-generate --replay` (avec `--to-land`, les vrais
   noms, dans le *worktree* d'un *worker* aussi) ; sous knex, Prisma et TypeORM avec `--to-land`
   seulement, chaque migration de la branche que le tronc n'a pas renommée après la dernière du
   tronc, sans `working-`, le contenu gardé (la classe et le `name` de TypeORM, le dossier de
   Prisma), et un arrêt quand une migration reçue par le tronc depuis la base nomme une table
   qu'une de la branche nomme (la générer de nouveau sur le tronc) ; un enregistrement de décision
   de la branche dont le tronc a pris le numéro depuis la base reçoit le prochain libre (ses
   fichiers, son titre `# ADR-NNNN`, les liens de ses traductions, consignés en lignes
   `Lost-Accepted:`).
6. **`regenerate`** (sauté sans la configuration du kit ou le script) ; un échec arrête.
7. **`verify-merge`** sur le résultat non commité, sur la base qu'enregistre le *trailer* : une
   erreur arrête (sortie 1), avec `file:line (ours|theirs)  <text>`, les lignes du plan qui ne
   sont plus terminées, les tests perdus ; `--continue --accept-lost` les consigne dans un
   *trailer* `Lost-Accepted:` et continue.
8. **Le *commit*** des seuls chemins de la fusion : ce qui est indexé plus ce que les étapes ont
   réécrit (les fichiers dérivés, les migrations, les décisions, le fichier de verrouillage,
   `slices.md`, le verrou des événements stockés). Tout autre chemin changé est listé comme laissé
   de côté et le bloque jusqu'à ce qu'il soit indexé ou mis de côté. Les *hooks* du projet
   tournent.

`--abort` défait la fusion en cours comme `git merge --abort` et oublie son état. Chaque arrêt
dit quoi faire ensuite et garde la fusion en cours pour le `--continue` suivant. git 2.40 est
nécessaire pour une base que git ne calculerait pas ; un git plus ancien fusionne avec
`git merge` lui-même depuis `git merge-base` (`--since <merge base>`), et refuse `--dry-run`.
Sortie 0 une fois commité, à jour ou en aperçu, 1 sur un arrêt, 2 quand il ne peut pas démarrer.

```text
merge-trunk build/billing-2 <- origin/main (d8d281b)
base 6d8be4b: build/billing-1 landed as d8d281b "feat(billing): issue and cancel (#1)"
conflicts: plain git merge 3, own diff since base 2, automatic 1, for you 1
automatic:
  openapi/openapi.yaml  derived: trunk side, regenerated at the end
for you (a merge is in progress; `merge-trunk --abort` undoes it):
  src/contexts/billing/domain/invoice.ts  hunks at lines 40-58
    ours  (build/billing-2, rows #M1.02): adds 4 lines: pay(amount: Money, at: Date): void {
    theirs (origin/main since 6d8be4b, 9a0c1f2 "feat(billing): cancel an invoice (#7)"): adds 3 lines: cancel(reason: CancelReason): void {
    both sides only add lines: keep both. Never take one side of the whole file.
stopped: 1 conflicted path left for you
next: resolve each hunk, `git add <file>`, then `npx ddd-ts-kit merge-trunk --continue`
```

`--json` affiche le même rapport :
`{ status, branch, trunk: { ref, commit }, base: { commit, evidence, landedAs?, unlanded?, notOnTrunk? }, conflicts: { plainMerge, ownDiff, automatic, forYou }, automatic: [{ file, kind, how }], forYou: [{ file, kind, why, hunks, ours: { branch, rows, change }, theirs: { ref, commits, change }, advice }], migrations, regenerate: { status, output? }, lostLines: { errors, warnings, accepted } | null, leftOut, stop?, commit?, next }`,
`status` valant `up-to-date`, `dry-run`, `stopped` ou `committed` et `evidence` `option`,
`landed`, `recorded` ou `merge-base`. La garde du *plugin* refuse `--to-land` à un sous-agent :
poser une branche est l'étape du chef d'orchestre, juste avant sa fusion en *squash*.

## affected

```
ddd-ts-kit affected [--base <git-ref>] [--head <git-ref>] [--format text|json|github|env]
```

Ce qu'une *pull request* ou une *merge request* doit exécuter, lu dans la carte des contextes et
dans les chemins qui diffèrent entre `--base` et `--head` (`HEAD` par défaut ; la base de fusion
est utilisée quand le clone l'a). Chaque chemin modifié atteint quelque chose :

- un chemin sous un contexte déclaré atteint ce contexte et chaque contexte en aval de lui,
  puisque leur code peut lire son langage publié ; un chemin sous son seul `test/` atteint ce
  contexte seul, puisqu'aucun autre contexte ne peut importer ses tests ;
- un document n'atteint rien qui s'exécute : un fichier Markdown à la racine, tout ce qui est
  sous `docs/`, `openapi/`, `.claude/`, `.github/instructions/` ou `.github/copilot/` (la porte des
  documents tourne toujours) ;
- tout le reste atteint tout : la plateforme, le noyau partagé, `main.ts`, la configuration, le
  lockfile, le *pipeline*, un répertoire de `src/contexts/` que la configuration ne déclare pas.

Sans `--base`, ou quand git ne sait pas dire ce qui a changé (une référence inconnue, un clone
superficiel sans la base), tout est retenu : c'est ce qu'obtiennent la branche par défaut et
l'exécution nocturne. La sélection n'est jamais plus étroite que les relations déclarées, parce
que `context/declared-relationship` garde chaque import entre contextes à l'intérieur d'elles, et
que cette règle tourne sur le projet entier dans chaque *pipeline*.

![Un changement dans le contexte scheduling de l'application d'exemple : scheduling est retenu, et avec lui notification et analytics, qui sont en aval de lui dans la carte des contextes ; identity, en amont, est laissé à la branche par défaut](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/cli-affected-selection.fr.svg)

Dans l'application d'exemple, une branche qui modifie un agrégat de `scheduling` :

```
$ npx ddd-ts-kit affected --base main
Affected contexts: scheduling, notification, analytics (the changed contexts and the contexts downstream of them in the context map).
Specs: src/contexts/scheduling/**/*.spec.ts src/contexts/notification/**/*.spec.ts src/contexts/analytics/**/*.spec.ts !src/contexts/**
Left to the default branch: src/contexts/identity/

$ npx ddd-ts-kit affected --base main --format github
scope=contexts
contexts=scheduling,notification,analytics
args=--passWithNoTests
lint=--ignore-pattern src/contexts/identity/
```

`--format github` écrit des lignes `key=value` pour `$GITHUB_OUTPUT`, `--format env` les mêmes
clés en majuscules derrière `AFFECTED_` pour un rapport `dotenv` de GitLab, `--json` la sélection
sous forme de données (`{ scope, reason, contexts, specs, leftOut }`). `contexts` est ce que
l'exécuteur des tests lit comme `DDD_TS_KIT_AFFECTED`, `args` ce qu'une exécution partielle y
ajoute, `lint` ce qu'elle ajoute à ESLint ; les *pipelines* générés câblent les trois.

## check

```
ddd-ts-kit check [paths...] [--rule <id>]... [--format text|json|github|gitlab]
                 [--changed-since <git-ref>] [--explain] [--self]
ddd-ts-kit check --clean-only <dir>... [--rule <id>]... [--format text|json|github]
ddd-ts-kit check --commit-size [--staged] [--strict]
```

Chaque violation a un identifiant de règle, une sévérité, un fichier, une ligne, un message et un
`fix` : une phrase qui dit quoi faire à la place. Code de sortie 1 quand il y a au moins une
erreur. Supposons que l'agrégat `Reminder` de l'application d'exemple lise l'horloge système dans
son domaine : un `isDue()` en ligne 63 qui appelle `Date.now()`, là où le vrai reçoit l'instant,
`isDue(asOf: Date)`. `check` signalerait :

```
$ npx ddd-ts-kit check src/contexts/notification/domain
src/contexts/notification/domain/aggregates/reminder.aggregate.ts:64  error  purity/no-system-clock
  Date.now() is used in the domain layer.
  fix: Receive the instant as a parameter in the domain, and take it from the Clock port (`this.clock.now()`) in a handler, so that a test fixes time with FixedClock.

1 error, 0 warnings, 0 suppressions in 772 files.
```

Le `fix` est le changement à faire. Au lieu de cette méthode hypothétique :

```ts
isDue(): boolean {
  return this.state.status === ReminderStatus.Planned && this.state.dueAt.getTime() <= Date.now();
}
```

écrivez :

<!-- checked sample -->
```ts
import { Clock, FixedClock } from '@ddd-ts-kit/kernel';

// domaine : l'instant est un paramètre, comme dans l'agrégat Reminder de l'exemple
export class Reminder {
  constructor(private readonly dueAt: Date) {}

  isDue(asOf: Date): boolean {
    return this.dueAt.getTime() <= asOf.getTime();
  }
}

// application : le gestionnaire prend l'instant du port Clock
export class SendDueRemindersHandler {
  constructor(private readonly clock: Clock) {}

  isDueNow(reminder: Reminder): boolean {
    return reminder.isDue(this.clock.now());
  }
}

// un test fixe le temps
const handler = new SendDueRemindersHandler(new FixedClock(new Date('2026-03-02T09:00:00Z')));
const due = handler.isDueNow(new Reminder(new Date('2026-03-01T09:00:00Z'))); // true
```

`ddd-ts-kit explain <rule-id>` affiche le même genre de mauvais et de bon exemple pour chaque
règle.

- `paths` et `--changed-since` limitent ce qui est signalé, pas ce qui est analysé.
  `--changed-since` lance `git diff --name-only --relative <ref>...` dans le projet.
- `--format github` affiche des annotations `::error file=...,line=...::`.
- `--explain` fait suivre les violations de chaque règle qu'elles signalent, une fois, avec sa
  description et la raison de son existence (comme `explain` l'affiche, sans les exemples), et
  ajoute en JSON un tableau `explanations`. Avec `--format github` ou `gitlab`, la raison va à la
  place à la fin du message de chaque annotation : une *pull request* montre une annotation seule
  sur sa ligne, et un rapport Code Quality n'a pas de place pour du texte à côté de ses problèmes.
  Les empreintes restent les mêmes.
- `--format gitlab` affiche un rapport Code Quality de GitLab : un problème par violation,
  `major` pour une erreur et `minor` pour un avertissement, avec une empreinte qui ne dépend pas
  de la ligne.
- Les sévérités viennent de `rules` dans la configuration (`error`, `warn`, `off`). Par défaut
  `error`, sauf `test/no-mocks`, `test/builder-required`, `clean/function-size`,
  `clean/no-noise-comment`, `clean/no-flag-argument`, `standard/no-parallel-interface`,
  `declarations/port-adapter-wired` et, tenue
  par ESLint, `application/command-query-separation` (`warn`). `any` dans un fichier de test est
  toujours un avertissement.
- `limits: { "maxParameters": 3, "maxFunctionLines": 30 }` dans la configuration règle
  `clean/function-size`. `maxFunctionLines` va de 1 à 100 : une valeur au-dessus est lue comme 100
  et signalée par `config/valid`, et une fonction de plus de 100 lignes est une `error` quelle que
  soit la sévérité de la règle (seul `off` la fait taire). `clean/file-size` (350 lignes) n'est
  pas configurable.
- `onePerFile: { "allow": [{ "file": "<path or glob>", "reason": "<why these exports are one thing>" }] }`
  exempte des fichiers du décompte de `clean/one-export-per-file`, jamais de sa vérification du
  nom de fichier ; `*` correspond à l'intérieur d'un segment de chemin, `**` à travers les
  segments ; une entrée sans raison est ignorée et signalée par `config/valid`.
- `domainAllowedPackages`, `applicationAllowedPackages` et `publishedLanguageAllowedPackages`
  étendent ce que les couches intérieures peuvent importer. `@ddd-ts-kit/aspects`,
  `@ddd-ts-kit/audit`, `@ddd-ts-kit/redis`, `@ddd-ts-kit/scheduling`, `@ddd-ts-kit/sentry` et
  `@ddd-ts-kit/tracing` restent refusés dans `domain/` et `application/` même quand une liste les
  nomme.
- `standardInterfaces: { "<DeclaredName>": "<kernel interface to use instead>" }` dans la
  configuration ajoute des noms à `standard/no-parallel-interface` en plus de ses noms par défaut ;
  la valeur `false` retire un nom par défaut.
- Désactivez une ligne avec `// ddd-ts-kit-disable-next-line <rule-id> -- ADR-0007: <reason>`.
  Sans raison, le commentaire est lui-même une violation, tout comme une raison qui ne nomme aucun
  enregistrement de décision existant. Sur la première ligne d'un fichier, il couvre aussi les
  violations au niveau du fichier.
- `--clean-only` exécute les règles qui jugent un fichier seul (`clean/stepdown`,
  `clean/function-size`, `clean/no-commented-out-code`, `clean/no-noise-comment`,
  `clean/no-escape-hatch`, `clean/no-hash-private`, `clean/blank-lines`, `clean/braces`,
  `clean/one-export-per-file`, `clean/file-size`) sur n'importe quels répertoires, sans projet ni
  configuration.
- `--self` rejoue les *fixtures* de règles livrées avec la CLI et sort avec le code 0 quand chaque
  règle se comporte comme attendu.

| Règle | Détecte |
|---|---|
| `layer/domain-purity` | dans `domain/` : un *package* hors de `domainAllowedPackages`, tout module natif de Node, une autre couche, un autre contexte ; toute entrée de `@ddd-ts-kit/aspects`, `@ddd-ts-kit/audit`, `@ddd-ts-kit/redis`, `@ddd-ts-kit/scheduling`, `@ddd-ts-kit/sentry` ou `@ddd-ts-kit/tracing`, autorisée ou non ; `@ddd-ts-kit/kernel/declarations`, bien que le kernel soit autorisé : le domaine ne déclare rien |
| `layer/application-inward` | dans `application/` : `infrastructure/`, `presentation/`, la plateforme, un *package* hors de la liste autorisée, un module natif de Node ; toute entrée de `@ddd-ts-kit/aspects`, `@ddd-ts-kit/audit`, `@ddd-ts-kit/redis`, `@ddd-ts-kit/scheduling`, `@ddd-ts-kit/sentry` ou `@ddd-ts-kit/tracing`, autorisée ou non, avec l'endroit où la préoccupation a sa place (la racine de composition, un *middleware* de bus, un adaptateur, un port) |
| `layer/presentation-no-infrastructure`, `layer/infrastructure-no-presentation` | l'import interdit, à l'intérieur d'un contexte |
| `context/published-language-only` | un import d'un autre contexte hors de son `published-language/` |
| `context/declared-relationship` | un import d'un langage publié dont le contexte n'est pas un amont déclaré |
| `context/published-language-is-a-contract` | `published-language/` qui importe autre chose que sa liste autorisée et d'autres langages publiés |
| `context/no-cycle` | un cycle dans les amonts déclarés, avec son chemin |
| `tree/closed` | un répertoire hors de l'arbre canonique et de `extraDirectories` ; un fichier source hors d'un répertoire de rôle ; dans le style déclaré, `<context>.declarations.ts` est accepté à la racine d'un contexte |
| `tree/context-doc` | un `CONTEXT.md` manquant, une section manquante, une classification qui contredit la configuration |
| `naming/suffix` | un fichier sans le suffixe de son rôle, ou pas en kebab-case. `application/scheduling/` contient des `*.job.ts` ; un dossier de cas d'usage accepte un `*.result.ts` à côté de son message et de son gestionnaire ; `presentation/http/<context>.routes.ts`, nommé d'après son contexte au lieu d'un rôle, est accepté dans les deux styles |
| `naming/one-concept-per-file` | plusieurs classes exportées dans un fichier d'agrégat, d'entité, d'objet-valeur, d'événement, de commande, de requête, de gestionnaire, de gestionnaire d'événement, de gestionnaire d'événement d'intégration ou de *job* ; dans le style déclaré, plusieurs classes portant un décorateur de déclaration dans un même fichier de rôle |
| `naming/search-not-list` | dans un contexte, une méthode nommée `list` ou `list<Something>` dans un port (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`), dans une classe de `infrastructure/` ou dans un *fake* de `test/fakes/` ; sous `application/queries/`, un dossier ou un fichier nommé `list`, `list-...` ou `list....`, ou une classe nommée `List` ou `List<Something>`. Les propriétés et `listAccessible` (exigée par le port `Authorizer`) ne sont pas jugées. Nommez-les `search...` : `generate query <context> Search<Things> --search` |
| `naming/business-name` | dans `domain/` et `application/` d'un contexte et dans le noyau partagé hors de `presentation/`, une variable, une variable de boucle, un nom déstructuré, un paramètre ou une propriété nommés d'un mot générique (`target`, `data`, `item` et les autres mots de la liste, que `businessNames` de la configuration change) ; le correctif nomme le concept qu'un initialiseur construit ou lit quand le texte le dit, et `npx eslint --fix` le renomme |
| `test/spec-required` | un agrégat, un objet-valeur, un service du domaine, un gestionnaire, un gestionnaire d'événement du domaine, un gestionnaire d'événement d'intégration ou un *job* sans *spec* (un `*.result.ts` n'en a pas besoin) |
| `test/no-mocks` | `vi.mock`, `vi.fn`, `vi.spyOn`, leurs jumeaux `jest`, ou une bibliothèque de *mocks* dans les tests d'un contexte |
| `test/builder-required` | un agrégat sans `test/builders/<name>.builder.ts` |
| `test/helper-placed` | un fichier du `test/unit/` ou du `test/integration/` d'un contexte qui n'est pas une *spec* (`*.spec.ts`, `*.test.ts`) : il va dans `test/worlds/`, `test/builders/` ou `test/fakes/` |
| `events/name-format` | un nom d'événement qui n'est pas `<context>.<aggregate>.<fact>` en kebab-case avec le bon contexte |
| `events/name-declared-once` | une classe de `domain/events/` sans `static readonly eventName`, ou dont le `readonly name` écrit le nom une seconde fois au lieu de le lire |
| `events/defined-in-published-language` | `defineIntegrationEvent` hors d'un langage publié, sans charge utile, deux fois pour une même version ; un événement décrit à la main |
| `language/glossary-term` | une classe du modèle nommée avec un mot que le glossaire de son contexte ne définit pas ; un glossaire vide ; sous `"stack.refusals": "factories"` ou `"named"`, une classe de `domain/errors/` aussi, une classe de refus de `named` ayant droit en plus aux qualificatifs `invalid`, `unknown`, `already`, `too`, `no`, `missing` et `required` (`codes.ts` n'est pas jugé) |
| `language/declared-vocabulary` | une chaîne littérale dont la valeur est une valeur d'un vocabulaire fermé que le projet déclare (un objet `as const` exporté avec le type union de son nom, un ensemble de permissions de `definePermissions`), hors du fichier qui le déclare, à l'endroit qui parle son langage (son contexte ; la plateforme et les groupes de routes pour la plateforme ; partout pour un identifiant de permission ou le noyau partagé) ; les tests, les langages publiés et le schéma de relations ne sont pas jugés, ni, hors de `domain/`, un mot typé par un autre langage (une clé d'un `Record<T, ..>`, une valeur d'un `Record<.., T>`, `'x' satisfies T`, `T` un type d'un langage publié, d'un paquet ou de `infrastructure/anti-corruption/` ou `infrastructure/external/`) ; sous `"stack.literals": "named"` |
| `language/no-technical-name` | `Manager`, `Helper`, `Util`, `Utils`, `Data`, `Info`, `Processor`, `Wrapper`, `Impl`, `Base`, `Abstract`, `Dto`, `Entity`, `Model` dans un type déclaré sous `domain/` ou dans un dossier de cas d'usage |
| `purity/no-system-clock` | `new Date()` sans argument, `Date.now()`, `performance.now()` dans `domain/` ou `application/` |
| `purity/no-ambient-randomness` | `Math.random`, la source aléatoire de `crypto`, une bibliothèque d'identifiants |
| `purity/no-environment` | `process.env` et apparentés, `console`, `fetch`, les modules de système de fichiers et de réseau |
| `clean/stepdown` | une méthode privée avant la dernière méthode publique ou au-dessus de son premier appelant ; une fonction non exportée au-dessus de sa première utilisation |
| `clean/function-size` | plus de paramètres ou de lignes de corps que les limites (les constructeurs sont exemptés de la limite de paramètres, les fichiers de module et les callbacks de `describe` de la limite de lignes) ; toute fonction de plus de 100 lignes, celles-là comprises, signalée comme une `error` |
| `clean/no-commented-out-code` | des lignes de commentaire qui ont la forme d'instructions |
| `clean/no-noise-comment` | les bannières, les étiquettes d'accolades fermantes, les auteurs et les dates, les `@param` et `@returns` vides, un commentaire qui ne fait que répéter le nom déclaré, un `TODO` sans responsable ni référence |
| `clean/no-escape-hatch` | `any`, une assertion de non-nullité, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` ou `eslint-disable` sans raison |
| `clean/no-flag-argument` | un paramètre `boolean` sur une méthode publique d'une classe du domaine ou sur `execute` |
| `clean/no-hash-private` | un membre de classe `#name` : champ, méthode, accesseur, statique |
| `clean/blank-lines` | une approximation de la disposition que tiennent ESLint et le formateur : un `return` dont la ligne précédente n'est ni vide, ni une accolade ouvrante, ni une étiquette `case` ; une ligne vide juste après une accolade ouvrante ou juste avant une accolade fermante |
| `clean/braces` | un `if`, `else`, `for`, `while` ou `do` dont le corps n'a pas d'accolades ou partage une ligne avec elles, un `else` sur une ligne à lui ; une approximation de ce que tiennent ESLint (`curly`) et le formateur |
| `clean/one-export-per-file` | sous la racine des sources, tests à part : plus d'une classe, interface ou fonction exportée que les tolérances n'expliquent pas (les types de la signature de l'export principal, un type et une valeur qui partagent un nom, un type avec ses constructeurs, les accesseurs d'un même état privé, `onePerFile.allow`) ; un fichier qui ne porte pas le nom de son export principal en kebab-case (`invoice.aggregate.ts` pour `Invoice`) ; un `index.ts` ou un `<context>.declarations.ts` qui contient autre chose que des réexports |
| `clean/file-size` | un fichier de plus de 350 lignes, sources et tests ; un chemin avec un segment `generated` et les fichiers de déclaration sont exemptés |
| `composition/only-in-module` | `new X`, ou `bind(..).toClass(X, ..)` et `rebind(..).toClass(X, ..)`, d'une classe importée de `infrastructure/`, hors du fichier de module, de `main.ts`, de la plateforme et des tests ; dans un fichier qui importe `@ddd-ts-kit/di`, un appel de `contextModule`, `discoverContext` ou `.include(` hors de ces endroits et de `apps/<context>/main.ts` |
| `imports/alias-only` | sous la racine des sources, `test/` et `scripts/` : un `import`, `export ... from` ou `import()` avec un spécificateur relatif, même répertoire compris (la correction nomme l'alias à écrire ; `eslint --fix` l'écrit) ; un spécificateur d'alias avec un segment `.` ou `..` |
| `imports/extension` | sous la racine des sources, `test/` et `scripts/` : avec `importExtension` `none`, un spécificateur d'alias qui se termine par `.js`, `.mjs`, `.cjs`, `.ts`, `.mts` ou `.cts`, ou qui nomme un répertoire contenant un `index.ts` ; avec `js` (ou sans clé), un spécificateur d'alias qui ne se termine pas par `.js` (la correction nomme le spécificateur à écrire ; `eslint --fix` l'écrit). Un sous-chemin de *package* n'est jamais jugé |
| `imports/alias-declared` | un `importAlias` qui n'est pas `@/` ou `$<name>/`, ou qui est `$test/`, `$scripts/`, `$generated/` ; une entrée `paths` de `tsconfig.json` manquante ou différente de ce que donne `importAlias` (la correction donne l'entrée) ; une autre entrée `paths` sous un alias ; un `baseUrl` ; un `tsconfig.build.json` dont les `paths` diffèrent ; des `paths` de `knip.json` qui associent un alias ; un script qui compile (`tsc` sans `--noEmit`) et ne lance pas `ddd-ts-kit build-aliases` ensuite ; un script qui lance `tsx --tsconfig` sur un autre fichier ; une configuration `vitest` à la racine sans `tsconfigPaths: true`, une configuration `jest` sans les entrées `moduleNameMapper` dérivées, ou `.dependency-cruiser.cjs` sans `tsConfig` ; un `module` et un `moduleResolution` de `tsconfig.json` (ou d'un `tsconfig.build.json` qui pose les siens) qui ne sont pas ce que donne `importExtension` : `ESNext`, `Bundler` et `customConditions` contenant `node` sous `none`, et sous `js` une valeur écrite qui n'est pas une résolution Node ; une association jest dont le motif ne se termine pas comme les imports. Un projet sans `package.json` n'est pas jugé |
| `config/valid` | un amont, une classification, une relation, un identifiant de règle, un mode de `guard` ou un `importExtension` inconnu ; un contexte absent du disque ou de la configuration ; une limite de `commit` qui n'est pas un entier positif |
| `config/suppression-needs-reason` | une désactivation sans identifiant de règle ou sans raison (gardée comme alias à côté de `governance/recorded-deviation`, qui juge la raison) |
| `authz/declared` | dans un fichier de module, `builder.command(X)` ou `builder.query(X)` sans `.requires(` ni `.public(` dans sa chaîne, sauf si la classe du message porte `@Requires` ou `@Public` de `@ddd-ts-kit/kernel/declarations` ; en câblage manuel ou nest, une classe de commande ou de requête absente de tous les `requires(X, ...)` et `publicUseCase(X)` du fichier de module et de `application/authorization/` ; un `defineRoute` sans `security` (le type de la route le refuse déjà, et une liste vide aussi : c'est le filet au niveau du texte pour une définition construite de façon lâche) ; dans le style déclaré, la classe exportée d'un fichier `*.command.ts` ou `*.query.ts` qui ne porte ni `@Requires` ni `@Public` |
| `authz/granted` | avec `stack.authz` `rbac`, une permission du `definePermissions` d'un contexte que ni `platform/auth/roles.ts` ni `platform/auth/signed-in-grants.ts` n'accorde par son nom (par l'entrée de son ensemble, son identifiant ou `<contexte>:*`) ; le `*` du super-administrateur ne compte pas (un avertissement) |
| `authz/in-application` | `presentation/` : un test sur les rôles, `isAdmin`, l'import d'un autorisateur ou de `Access` ; `infrastructure/` : `authorize(` ou `check(` sur un autorisateur ou un accès, `ForbiddenError` ; `domain/` : tout import de `@ddd-ts-kit/auth`, des types d'acteur du kernel (`Actor`, `ActorContext`, `Session`, `ExecutionContext`, les messages autorisés), une lecture de `.roles` ou `.permissions` sur un acteur. La glu de requête HTTP de `@ddd-ts-kit/auth` (`actorOf`, `sessionOf`, `resolveSession`, `SessionAuthenticator`) est libre dans `presentation/`. `presentation/` et `infrastructure/` : l'import de `Requires`, `Public` ou `Policy` depuis `@ddd-ts-kit/kernel/declarations`, ou des ports `Access` et `PolicyAccess` depuis `@ddd-ts-kit/auth` ; ils sont libres dans `application/` |
| `authz/actor-explicit` | dans `domain/` et `application/` : `ActorContext`, `ExecutionScope` (comme type ou comme valeur : la classe est le jeton d'une liste de dépendances), `AsyncLocalStorageExecutionScope`, `ScopedActorContext`, `AsyncLocalStorage` ; `.current()` ou `.require()` sur un contexte d'acteur ou sur quelque chose nommé `scope`, `scopes` ou `...executionScope` ; un import de `stampCreation`, `stampUpdate` ou `tenantScopeOf` |
| `authz/fields-by-schema` | sous `application/queries/` : `roles.includes(`, `.some(`, `.every(`, `.find(`, `.indexOf(`, une comparaison avec un `role`, `isAdmin` |
| `aspects/outside-in` | un import de `@ddd-ts-kit/aspects/decorators` hors de `infrastructure/` d'un contexte et du répertoire de la plateforme : `presentation/`, le fichier de module, `published-language/`, le noyau partagé, `main.ts`, toute autre source (`domain/` et `application/` sont signalés par les deux règles `layer/*` à la place) |
| `tracing/platform-only` | un import de `@ddd-ts-kit/tracing` ou d'un *package* `@opentelemetry/*` hors du répertoire de la plateforme, de `main.ts` et de `apps/`, tests compris |
| `tenancy/scoped-statement` | avec `stack.tenancy` autre que `none`, dans `infrastructure/` d'un contexte, tests mis à part : sur Knex, l'exécuteur utilisé autrement que comme argument (`executor()(`, `executor().from(`, `executor().raw(`, `const db = ...executor();`) et tout `.raw(` ; sur Drizzle, instruction par instruction, une lecture, une mise à jour ou une suppression sur l'exécuteur dont le where n'a ni `tenantCondition(` ni `ownTenantCondition(` (en ligne ou dans la variable locale qu'il reçoit), une insertion dont la ligne n'a pas de `tenantScopeOf(`, une requête relationnelle (`executor().query`), un `execute(` brut, ou l'exécuteur gardé dans une variable ; sur les deux, un magasin de modèle de lecture construit sans son option `tenant`. Un where construit par une autre fonction n'est pas suivi |
| `standard/no-parallel-interface` | une classe, une interface ou un alias de type déclaré comme `ILogger`, `AppLogger`, `LoggerService`, `LoggerInterface`, `IMetrics`, `MetricsService`, `ICache`, `CacheService`, `UserContext`, `CurrentUser`, `AuthContext`, `RequestContext` (hors de `presentation/` et de la plateforme), `UserSession`, `AuthSession`, `SessionData`, `PaginatedResult`, `PageResult`, `PaginatedResponse`, `Paginated`, `PaginationParams`, `PageParams`, `AuditLog`, `AuditLogEntry`, `AuditRecord`, `IJobScheduler`, `JobSchedulerService`, `CronScheduler`, `TaskScheduler`, `IScheduledJob`, `CronJob`, `ScheduledTask`, `BackgroundJob`, `IErrorReporter`, `ErrorReporterService`, `ErrorTracker`, `ExceptionReporter`, `CrashReporter`, `CacheInvalidator`, `CacheInvalidationService`, `CachePurgeService`, `CdnPurger`, `I` suivi d'un nom standard (`IClock`, `IIdGenerator`, `IUnitOfWork`, `ISession`, ...) ou un nom de `standardInterfaces` ; une classe qui implémente ou étend l'interface standard est un adaptateur et n'est pas signalée |
| `events/outbox-required` | `stack.events` autre que `outbox` avec un ORM et sans dérogation `stack.events` ; dans `domain/` et `application/`, l'import d'un client de *broker* ou d'une implémentation de bus ou de relais ; un *publisher* qui dépend de plus que `IntegrationEventPublisher` ; un module de la plateforme qui distribue un *publisher* et ne nomme jamais `OutboxPublisher` |
| `events/consumer-idempotent` | une classe de gestionnaire d'événement d'intégration (`application/integration/handlers/*.integration-handler.ts`) qui ne porte pas `@IntegrationEventHandler` et n'est pas non plus enregistrée dans son fichier de module sous un nom de consommateur ; un `@IntegrationEventHandler` dont le `consumer` n'est pas une chaîne littérale non vide ; un `on(` ou un `consume(` libre sans `processed` ; un nom de consommateur utilisé deux fois, dans les déclarations comme dans les enregistrements |
| `domain-events/dispatched-on-save` | un appel de `pullEvents()` dans `application/` ou `infrastructure/` d'un contexte ; `DomainEventDispatcher` importé, listé comme dépendance ou reçu par un constructeur dans `application/commands/`, `application/queries/` ou un adaptateur de *repository*. Le fichier de module, les tests, la plateforme et `main.ts` sont laissés tranquilles |
| `domain-events/transactional-before-commit` | un gestionnaire d'événement du domaine (une classe de `application/event-handlers/*.event-handler.ts` ou de `application/integration/publishers/*.publisher.ts`, ou toute classe portant `@DomainEventHandler`) qui s'exécute avant la validation (commit) et dépend de `Cache`, `CachePurger`, `Lock`, `RateLimiter`, `JobScheduler` ou `EventBus` du kernel, d'un port de `application/ports/` qui n'est pas un port de persistance (aucun adaptateur sous `infrastructure/persistence/`, ou un adaptateur ailleurs sous `infrastructure/`), de quoi que ce soit importé de `infrastructure/`, d'un autre contexte, de la plateforme ou d'un *package* autre que `@ddd-ts-kit/kernel` et `@ddd-ts-kit/auth` ; un gestionnaire après la validation (`phase: 'after-commit'` dans son décorateur, ou dans le troisième argument de chaque `.on(` du fichier de module qui le mentionne) qui dépend de `IntegrationEventPublisher`. `check-file` laisse les adaptateurs d'un port à la vérification complète |
| `event-sourcing/state-in-apply` | dans une classe de `domain/aggregates/` qui étend `EventSourcedAggregate`, une écriture sur quelque chose de `this` (affectation, incrément, appel qui modifie) hors du constructeur, des méthodes statiques, des méthodes `apply<Fact>` et de `restore` ; `this.record(..)` dans une méthode apply |
| `event-sourcing/past-tense` | dans un fichier de `domain/aggregates/` qui contient un agrégat en *event sourcing*, un nom importé de `domain/events/` dont le fait (les mots après le nom de l'agrégat) ne contient aucun participe passé, ou seulement un participe qui s'écrit comme son impératif en tête (`SetPrice`) |
| `event-sourcing/store-behind-repository` | `EventStore`, `SnapshotStore`, `CheckpointStore`, `EventSourcedRepository`, `EventSerializer`, `CatchUpSubscription` ou `InMemoryEventStore` importé dans `domain/` ou `application/` |
| `event-sourcing/projection-never-appends` | dans `application/projections/` ou un fichier qui déclare `@Projection`, `EventStore` ou `EventSourcedRepository` importé ; dans une projection déclarée `{ feed: 'event-store' }`, tout ce qui vient de `domain/repositories/` aussi |
| `event-sourcing/upcaster-required` | un `defineStoredEvent` dont `encode` ne nomme aucun type, ou un type non déclaré dans le fichier, ou un type qu'il atteint et que le fichier ne déclare pas ; une version au-dessus de 1 sans *upcaster* depuis chaque version inférieure ; une version en dessous de la dernière enregistrée dans `stored-events.lock.json`, ou une version enregistrée dont la forme a changé. `ddd-ts-kit docs --stored-events` enregistre les nouvelles versions et n'en réécrit jamais une ; `docs --check` échoue tant qu'une version déclarée n'est pas enregistrée |
| `context/extractable` | un fichier de module qui importe un autre contexte hors de son langage publié ; une persistance qui importe l'infrastructure d'un autre contexte ou nomme son schéma ; un gestionnaire qui importe le *repository* d'un autre contexte ; `export let` ou un `new Map`, `Set`, `WeakMap` exporté au niveau du module ; `deployable: true` sans `apps/<context>/main.ts` ; dans le style déclaré, un fichier de rôle qui importe quoi que ce soit d'un fichier de port d'un autre contexte |
| `governance/recorded-deviation` | un commentaire `ddd-ts-kit-disable` ou `eslint-disable` dont la raison ne nomme aucun `ADR-<number>` avec un fichier `docs/adr/<number>-*.md` ; une règle mise à `off` (ou à `warn` en dessous de sa valeur par défaut), un répertoire supplémentaire, un *package* autorisé supplémentaire, un `guard` autre que `enforce` ou `stack.events` hors de l'outbox, sans entrée `deviations` `{ what, adr, reason }` qui pointe vers un enregistrement existant |
| `declarations/role-declared` | style déclaré seulement : un fichier de rôle (autre que `*.command.ts` et `*.query.ts`, tenus par `authz/declared` ; `*.job.ts` sous `application/scheduling/` avec `@Scheduled` et `*.publisher.ts` avec `@DomainEventHandler` sont des rôles) qui n'exporte aucune classe portant le décorateur de son suffixe et de son dossier, ou une classe qui en porte une autre ; une classe déclarée dans un fichier qui n'est pas un fichier de rôle ; une option `consumer` ou `name` manquante, vide, une variable, une concaténation ou un template literal avec une substitution ; tout décorateur de déclaration sur une classe sous `domain/` |
| `declarations/barrel-current` | style déclaré seulement : avec `stack.assembly: barrel`, un `<context>.declarations.ts` manquant ou qui diffère d'un `export *` par fichier de rôle trié par chemin, suivi d'un `injected(Class, [Tokens])` par classe dont le constructeur reçoit quelque chose (lu depuis les signatures, avec leurs imports) ; avec `discovery`, un barrel qui existe encore, et un `<context>.dependencies.ts` qui diffère de ces instructions `injected` (son absence est acceptée tant qu'il n'en contiendrait aucune). Le message nomme le fichier de rôle manquant ou la classe dont la liste est périmée. Elle a besoin de l'arbre, c'est pourquoi `check-file` ne l'exécute pas |
| `declarations/constructor-injection` | style déclaré seulement, dans un fichier de rôle : sur une classe dont le décorateur ne liste rien, un paramètre de constructeur optionnel, qui a une valeur par défaut, est un paramètre du reste ou est déstructuré, n'a pas de type, ou est typé par autre chose qu'un nom de classe (arguments de type mis à part) : une union, une intersection, un tableau, un nom qualifié, un type du langage, une interface, un alias de type, une enum ou une classe non exportée du fichier ou du fichier du projet d'où elle est importée ; une classe qui hérite son constructeur d'une classe que le projet ne sait pas lire. Sous `stack.dependencies: signature`, un décorateur qui porte une liste alors que le constructeur peut être lu : une liste qui le répète, une qui en diffère |
| `declarations/port-adapter-wired` | une classe de `infrastructure/` qui implémente un port et que rien ne câble : ni `@Repository`, `@Gateway` ou `@Adapter` dans le style déclaré, ni fichier de la racine de composition (`<context>.module.ts`, `main.ts`, `apps/<context>/main.ts`, la plateforme) qui l'importe, une fois que le fichier ne porte plus de `TODO(domain)` ni de `TODO(platform)` ; celle gardée à dessein porte `// ddd-ts-kit-disable-next-line declarations/port-adapter-wired -- ADR-NNNN: <why>` |
| `ports/abstract-class` | dans un fichier de port (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`) : une classe qui n'est pas `abstract` ; un membre qui n'est pas une méthode ou une propriété abstraite (`static readonly tokenKey = '<text>'` mis à part) : un constructeur, un corps, un initialiseur, un membre `private`, `protected` ou `#` ; une `interface` exportée (un alias `type`, une forme de données, n'est pas signalé) |
| `ports/implements-never-extends` | une classe portant `@Repository(P)`, `@Gateway(P)` ou `@Adapter(P)`, ou donnée à `bind(P).toClass(C)` ou `rebind(P).toClass(C)`, sans `implements P` ou avec `extends P` ; sous `infrastructure/`, une classe qui étend une classe importée d'un fichier de port |
| `ports/no-token-constant` | un appel de `token` importé d'un *package* `@ddd-ts-kit/*` ; `Symbol(..)`, `Symbol.for(..)` ou une chaîne littérale comme premier argument de `bind`, `rebind`, `resolve`, `fake` ou `override` dans un fichier qui importe `@ddd-ts-kit/di` ; un nom en UPPER_SNAKE_CASE dans une liste de dépendances ; un fichier nommé `*.ports.ts` ou `tokens.ts` |
| `ports/no-concrete-dependency` | une liste de dépendances qui nomme une classe importée de `infrastructure/` ou de `test/fakes/` d'un contexte ; dans le style déclaré, un paramètre de constructeur d'une classe déclarée qui ne liste rien, typé par une telle classe |
| `ports/value-import` | une classe nommée dans une liste de dépendances, ou donnée à `bind` ou `rebind`, importée avec `import type` ou `import { type X }` |
| `scheduling/job-triggers-use-case` | dans `application/scheduling/*.job.ts` : une classe exportée qui n'implémente pas `ScheduledJob` ; un `run` qui n'envoie aucune commande (pas d'appel `.execute(`) ; un *repository* dans la liste de dépendances ou le constructeur ; un import de `domain/aggregates/`, `domain/entities/`, `domain/services/` ou `infrastructure/`. Un enregistrement `builder.job(..)` d'une classe qui vit ailleurs |
| `scheduling/job-name` | le premier argument de `@Scheduled(..)` ou de `.job(..)` qui n'est pas une chaîne littérale `<context>.<job-name>` en kebab-case minuscule avec le contexte de son fichier ; un `systemActor(..)` d'un fichier de *job* qui passe un autre nom ; un même nom de *job* utilisé deux fois dans le projet |
| `errors/code-unique` | sous `"stack.refusals": "named"` ou `"factories"`, dans le `domain/errors/` d'un contexte : un code posé une seconde fois, par une valeur de `codes.ts`, une fabrique (`refusal('CODE', ..)`) ou une classe (`readonly code = 'CODE'`), avec le fichier et la ligne du premier. Le même code dans deux contextes n'est pas signalé |
| `errors/code-listed` | sous `"stack.refusals": "named"`, dans le `domain/errors/` d'un contexte : une classe de refus (qui étend `DomainRefusal`) dont le code n'est pas `readonly code = <Context>Codes.<Class>` lu dans le `codes.ts` de son contexte, des classes de refus sans `codes.ts`, une classe que la liste ne contient pas ; dans `codes.ts`, pas de liste `<Context>Codes` ou une liste non déclarée `as const`, une clé qui ne nomme aucune classe de refus du contexte, une valeur qui n'est pas un littéral de chaîne en casse de constante |
| `schema/presentation-only` | sous `"stack.schemas": "shared"` : dans le noyau partagé hors de `presentation/`, un import d'une bibliothèque de validation ; dans `domain/`, `application/`, `infrastructure/`, `published-language/` et le noyau partagé hors de `presentation/`, un import d'un fichier de `presentation/` du noyau partagé |
| `schema/no-duplicate-shape` | sous `"stack.schemas": "shared"`, dans la couche présentation d'un contexte, ou dans celle-ci et `presentation/` du noyau partagé : une classe DTO ou un schéma objet (`z.object`, `v.object`, `Type.Object`) qui déclare la forme d'un autre, avec l'endroit de l'original (le noyau partagé, puis `presentation/http/shared/`) ; deux contextes ne sont pas comparés, et les paramètres de requête HTTP et les formes qui portent encore un `TODO(domain)` du générateur ne sont pas jugés |
| `errors/known-code` | sous `"stack.refusals": "named"` ou `"factories"`, dans un `*.route.ts` : un code de la liste `errors` que le `codes.ts` du contexte de la route ne liste pas, qu'aucun refus de ce contexte ne pose, qu'aucune classe hors des contextes ne pose, et qui n'est pas un code du kit |
| `domain/value-object-class` | sous `"stack.values": "classes"` : dans `domain/value-objects/` d'un contexte ou un `*.vo.ts` du noyau partagé hors de `presentation/`, aucune classe exportée ou une seconde, une classe qui n'étend ni `ValueObject` ni un autre objet-valeur du projet, un constructeur public, une classe concrète sans méthode statique, une fonction, une constante fléchée ou un objet littéral exporté (en ligne, par une liste ou par défaut) ; dans `domain/` et dans le noyau partagé hors de `presentation/`, une fonction exportée qui répond un enregistrement de données : des entrées de données, aucune décomposition, rien qu'un appel du modèle a construit |

D'autres identifiants appartiennent à `@ddd-ts-kit/eslint-plugin`, qui lit l'arbre syntaxique là
où ce *checker* lit du texte : `domain/aggregate-encapsulation`,
`domain/value-object-immutability`, `domain/no-generic-error`, `application/handler-shape`,
`application/command-query-separation` et `clean/no-magic-number` parmi eux (`ddd-ts-kit rules`
les liste tous). `rules` et `explain` les montrent comme « checked by @ddd-ts-kit/eslint-plugin »,
la configuration les accepte sous `rules`, et `check --rule` sur l'un d'eux répond avec
`npm run lint`. Un identifiant, `clean/formatted`, appartient au formateur : `rules` et `explain`
le montrent comme « checked by Biome », et `check --rule` sur lui répond avec
`npm run format:check`.

`guard` dans la configuration (`enforce`, `advise` ou `off`) dit au *hook* d'éditeur du *plugin*
comment réagir à une violation après une écriture : la refuser, seulement la signaler, ou rester
silencieux. `check` l'ignore, en dehors de la validation de sa valeur.

### Taille des commits

`check --commit-size [--staged] [--strict]` compte les fichiers et les lignes sur le point d'être
commités (les changements suivis depuis HEAD et les fichiers non suivis ; l'index seulement avec
`--staged`) par rapport à `commit` dans la configuration (`{ "maxFiles": 20, "maxLines": 600 }`
par défaut). Les documents générés, les lockfiles, `.dependency-cruiser.cjs`,
`docs/context-map.md`, les barrels de déclarations et `.ddd-ts-kit/worker.json` ne sont pas
comptés ; un fichier non suivi de plus de 1 Mo ne compte aucune ligne. Il nomme les tranches
auxquelles appartiennent les changements : un cas d'usage, une couche d'un contexte, la
plateforme. Indicatif : code de sortie 0, sauf avec `--strict` au-delà des limites. Hors d'un
dépôt git, il le dit et sort avec le code 0. Le `lefthook.yml` généré l'exécute sur l'index à
chaque *commit*, sans bloquer.

### Limites

Le *checker* lit les sources avec un petit analyseur lexical et une lecture superficielle des
déclarations, pas avec un compilateur. Il suit les spécificateurs relatifs, les alias du projet
(`importAlias`, `$test/`, `$scripts/`, `$generated/`) et les *packages* nus, et classe les
fichiers d'après leur chemin : un import par alias est jugé par chaque règle de frontière
exactement comme le chemin relatif vers le même fichier.

- Les commentaires, les chaînes, les template literals et les expressions régulières sont
  sautés ; une expression régulière dans une position inhabituelle peut masquer le reste de sa
  ligne. La syntaxe `.tsx` n'est pas comprise.
- Les réexports, les barrels, les `paths` de `tsconfig` autres que l'alias et les spécificateurs
  calculés ne sont pas résolus, si bien qu'un type qui atteint une couche par le barrel d'une
  couche autorisée n'est pas vu.
- Déclarations : les déclarations `function` de premier niveau et les méthodes de classe sont
  lues ; les fonctions fléchées affectées à des constantes ou à des propriétés, les méthodes de
  littéraux d'objet et les fonctions imbriquées ne le sont pas, si bien que `clean/stepdown`,
  `clean/function-size` et `clean/no-flag-argument` ne les jugent pas.
- `clean/stepdown` reconnaît les utilisations par leur nom : une fonction utilitaire masquée par
  une variable locale du même nom, ou une méthode privée appelée par un autre receveur que
  `this`, est mal jugée. Les méthodes protégées sont neutres.
- `clean/no-commented-out-code` et `clean/no-noise-comment` sont des heuristiques sur la forme
  d'une ligne : de la prose qui se termine comme une instruction peut être signalée, du code
  écrit comme une phrase passe inaperçu.
- `language/glossary-term` compare mot à mot avec une flexion anglaise grossière ; elle ne
  connaît pas les synonymes, et un terme de plusieurs mots couvre chacun de ses mots séparément.
- `purity/*` cherche les jetons et les modules listés ; une enveloppe autour d'eux passe
  inaperçue.
- `clean/no-escape-hatch` ne voit pas un `any` produit par inférence, ni une assertion de type
  vers un autre type que `any`.
- `composition/only-in-module` voit `new` et `toClass` sur des noms importés ; une fonction
  fabrique ou un adaptateur réexporté lui échappe.
- `events/name-format` vérifie la forme et le préfixe du contexte, pas la grammaire du fait.
- `test/spec-required` et `test/builder-required` vérifient que le fichier existe, pas son
  contenu.
- `authz/*`, `events/*` et `context/extractable` reconnaissent des noms et des formes : un import
  renommé, une définition de route construite à partir d'une variable ou d'un étalement, un test
  de propriété (`invoice.ownerId === actor.id`), un nom de schéma dans du SQL brut, une
  transaction entre contextes et un tableau ou un objet exporté modifiable passent inaperçus ; le
  contenu de `apps/<context>/main.ts` n'est pas jugé.
- `governance/recorded-deviation` vérifie que l'enregistrement de décision existe, pas ce qu'il
  dit ; une entrée de dérogation qui ne justifie plus rien n'est pas signalée, et `limits` et
  `standardInterfaces` ne sont pas gouvernés.
- `authz/actor-explicit` ne connaît aucun type : `.current()` ou `.require()` sans argument sur
  un concept du domaine nommé `scope` est signalé, une portée d'exécution gardée sous un autre nom
  ne l'est pas, et `stampCreation`, `stampUpdate` et `tenantScopeOf` ne sont vus que lorsqu'ils
  sont importés sous leur propre nom.
- `aspects/outside-in` et les *packages* extérieurs des règles `layer/*` sont reconnus sur le
  spécificateur d'import : un décorateur ou un client réexporté par un fichier d'un endroit
  autorisé passe inaperçu.
- `standard/no-parallel-interface` compare des noms déclarés entiers avec un tableau et ne lit
  pas le glossaire : un concept du domaine légitimement appelé `AuditLog` ou `CurrentUser` est
  signalé (retirez le nom dans `standardInterfaces` ou enregistrez une désactivation), une copie
  sous n'importe quel autre nom ne l'est pas, et l'exemption d'une classe lit les noms après
  `implements` et `extends`, pas ce vers quoi ils se résolvent.
- Un décorateur de déclaration est vu quand il se trouve sur une classe de premier niveau et que
  son propre nom est importé de `@ddd-ts-kit/kernel/declarations` dans le même fichier. Un import
  renommé (`Requires as Needs`), un import d'espace de noms, un décorateur réexporté par un autre
  module, appliqué par une fonction utilitaire ou appelé comme une fonction, et un décorateur sur
  une expression de classe ou une classe imbriquée passent inaperçus (ESLint suit les renommages
  et les espaces de noms). Les options `consumer` et `name` ne sont lues que dans un littéral
  d'objet écrit dans l'appel du décorateur : gardées dans une variable, étalées ou construites par
  une fonction, elles sont signalées comme n'étant pas une chaîne littérale.
- `authz/declared` suit un import direct du message depuis un fichier de module.
- `context/extractable` reconnaît un port à son fichier (`domain/repositories/*.repository.ts`,
  `application/ports/*.port.ts`) : un port d'un autre contexte atteint par un réexport n'est pas
  vu.
- `composition/only-in-module` signale chaque `.include(` d'un fichier qui importe
  `@ddd-ts-kit/di` hors des endroits de composition, quel que soit le receveur.
- `declarations/barrel-current` compare le texte exactement (fins de ligne mises à part) : un
  barrel reformaté est périmé. Elle ne vérifie pas que la racine de composition importe le
  barrel.
- `clean/blank-lines` tient la partie bon marché de la disposition, le `return` et le bloc
  rembourré ; la ligne vide après un groupe de déclarations, autour de `if`, `for`, `try` et
  d'une instruction sur plusieurs lignes et entre les membres d'une classe est tenue par ESLint
  (`@stylistic`), qui fait autorité et la corrige.
- `clean/braces` lit les instructions de contrôle comme du texte : une méthode ou une propriété
  nommée `if`, `for`, `while`, `else` ou `do` est distinguée par ce qui la suit, pas par un arbre
  syntaxique. ESLint (`curly`) fait autorité pour les accolades et le formateur pour leur
  emplacement.
- `clean/formatted` est listée et expliquée, jamais jugée : le formateur du projet, Biome, en
  décide (`npm run format:check`).
- `clean/one-export-per-file` lit les déclarations comme du texte : les types d'une signature
  sont les interfaces et les types exportés dont le nom apparaît dans le texte de l'export
  principal, une famille fermée est reconnue aux annotations de type de retour et aux noms des
  liaisons de niveau module. Un fichier que les deux analyseurs jugent différemment revient à
  ESLint ; ce que ni l'un ni l'autre n'explique va dans `onePerFile.allow`.
- Le plafond de 100 lignes de `clean/function-size` est jugé sur les fonctions que lit ce
  *checker* : une fonction fléchée et le callback d'un `describe` sont tenus par ESLint
  (`clean-function-ceiling`).
- Les règles `ports/*` lisent une liste de dépendances là où elle est écrite comme un littéral de
  tableau : le dernier argument d'un décorateur de déclaration, le second de `.toClass(..)` et de
  `.handledBy(..)`. Une liste gardée dans une constante ou construite par une fonction n'est pas
  lue. `bind`, `rebind`, `resolve`, `fake` et `override` ne sont des appels de liaison que dans un
  fichier qui importe `@ddd-ts-kit/di`. `ports/implements-never-extends` lit la classe liée par
  un import direct relatif ou par alias ; une classe d'un *package* ou derrière un barrel n'est
  pas jugée.
- Le constructeur d'une classe déclarée est lu comme du texte, par le scanner du *checker* : le
  constructeur de la classe exportée qui porte le décorateur de son fichier de rôle, le sien ou le
  plus proche dont elle hérite par des imports du projet. Un type importé d'un *package* est
  présumé être une classe (le compilateur juge le fichier généré, qui l'importe comme une
  valeur) ; un type atteint par un barrel est présumé l'être aussi. Un constructeur surchargé par
  des signatures sans corps, ou construit par un mixin, n'est pas lu : écrivez un constructeur
  simple. `declarations/barrel-current` compare le texte exactement, si bien que le fichier
  généré n'est jamais reformaté à la main.
- `scheduling/job-triggers-use-case` prend n'importe quel appel `.execute(` dans `run` pour une
  commande envoyée ; un *job* qui exécute autre chose, ou qui envoie sa commande depuis une
  fonction utilitaire, est mal jugé. `scheduling/job-name` compare des noms littéraux : un *job*
  enregistré sous un nom calculé est signalé pour son nom et échappe à la vérification
  d'unicité.
- `domain-events/transactional-before-commit` lit les dépendances là où elles sont écrites : un
  littéral de tableau (le décorateur, `.toClass(Handler, [..])` dans le fichier de la classe ou
  dans le fichier de module) et le type d'un paramètre de constructeur, résolu par les imports de
  ce fichier. Un nom qui n'est pas importé, un port du kernel importé sous un autre nom et un
  effet atteint sans dépendance (un client de niveau module) ne sont pas vus. Un gestionnaire du
  style explicite est associé à ses enregistrements `.on(` par son nom de classe ou par une
  variable affectée depuis `new <Class>(` ; un adaptateur est une classe qui `implements` le port
  sous le nom qu'exporte le fichier du port.
- Rien ne contraint ce qu'importent `shared-kernel/`, `platform/` et `main.ts`.

## check-file

```
ddd-ts-kit check-file <path>
```

Exécute les règles par fichier (couches, contextes, nommage, événements, langage, pureté, code
propre, *mocks*, composition, désactivations) sur un fichier sans parcourir le projet : conçu pour
un *hook* d'éditeur ou d'agent après chaque écriture. Un fichier qui n'est pas une source du
projet est ignoré.

## lint

```
ddd-ts-kit lint [paths...] [--format <eslint formatter>] [--fix]
```

Ce que lancent `lint` et `ci:lint` d'un projet généré : l'ESLint du projet, par son API, sur les
chemins donnés (le projet sinon), son rapport dans le format demandé (`--format gitlab` écrit le
rapport Code Quality comme le fait `eslint-formatter-gitlab`), `--fix` comme ESLint le prend. Il
sort en 1 sur une erreur, et sur un avertissement comme sur une erreur, sauf sur un avertissement
d'une règle du kit en transition : une règle nouvelle dans cette version, dont la documentation
nomme la version où elle devient une erreur. Ceux-là sont affichés dans le rapport et listés
après lui, une ligne par règle, sans échouer : une mise à jour du kit ne fait jamais passer au
rouge un lint vert. Sans ESLint installé, il sort en 2 et nomme l'installation. Voir
[Base de qualité](../../docs/tools/quality-baseline.fr.md#un-avertissement-fait-échouer-le-lint).

## rules, explain

```
ddd-ts-kit rules
ddd-ts-kit explain <rule-id>
```

`rules` liste les identifiants, les descriptions et les sévérités actuelles, et dit lesquels
ESLint vérifie. `explain` affiche la règle, pourquoi elle existe, un mauvais et un bon exemple,
et la syntaxe de désactivation.

## Développement

```
node node_modules/@typescript/native/bin/tsc -b packages/cli
npx vitest run packages/cli                     # la suite rapide
npm run build && npm run ci:test:e2e            # la suite lente : DDD_TS_KIT_E2E=1, un fichier après l'autre
node packages/cli/dist/bin.js check --self
npm run clean:self --workspace ddd-ts-kit       # les règles clean/* sur ce package
npm run clean:packages --workspace ddd-ts-kit   # les mêmes règles sur les sources de chaque autre package
```

La suite lente vit dans `test/e2e/`, dans ses fichiers de *spec* et leurs fichiers de support ;
hormis pour les *specs* `first-minute`, elle génère chaque projet avec chaque genre, un *job* sur
un intervalle et un sur une expression cron avec un fuseau horaire, `adapter --decorators`,
`generate service` et `generate worker` compris. Elle s'exécute dans le processus, sans
conteneur :

- `zero-violation.spec.ts` (fait aussi partie de la suite rapide) : les 39 *stacks* de `STACKS`
  dans `test/e2e/stacks.ts`, parmi lesquelles les trois *loggers* et les deux familles de câblage
  avec `--errors sentry`, passent `check` et `docs --check` telles que générées.
- `typecheck.spec.ts` : les 36 d'entre elles que le *workspace* sait compiler (jest, prisma et
  typeorm à part) passent la vérification de types contre les sources des *packages* du
  *workspace*.
- `proven-stacks.spec.ts` : les huit projets de `PROVEN` sont installés comme le serait un kit
  publié et tenus à tout ce qu'exécute leur propre *pipeline* : `check` avec zéro violation et
  zéro avertissement, ESLint avec le preset (le test lit d'abord dans `eslint --print-config` que
  les règles des ports, de la planification, de la forme des fichiers et de la disposition sont
  actives), dependency-cruiser avec la configuration générée, knip, leurs *specs* (chaque *job*
  exécuté, par `runNow` sur tsyringe, et tenu à la commande qu'il a envoyée, un adaptateur
  décoré, l'extraction de chaque contexte), leurs *specs* de bout en bout (401 sans jeton, 403
  sans la permission, 2xx avec elle, avec des jetons signés dans le test, et la trace de la
  requête HTTP en un seul arbre), leur build (le *worker* et le service extrait compris) et leurs
  documents générés. Ce sont la *stack* par défaut, qui est déclarée ; déclarée avec
  `--authz rebac --broker rabbitmq --ci gitlab` ; déclarée avec
  `--orm knex --assembly discovery`, seule et derrière `--broker nats` avec `--errors sentry`
  (aucun DSN n'est configuré : rien n'est remonté, le câblage est linté, construit et exécuté) ;
  le style explicite sur la *stack* par défaut et sur
  `--authz rebac --broker rabbitmq --ci gitlab` ; et le câblage manuel (`--di manual`) sur
  `--authz abac --orm knex` et sur
  `--http fastify --orm knex --broker rabbitmq --cache redis --errors sentry --logger winston`.
- `first-minute.spec.ts`, `first-minute-proven.spec.ts`, `first-minute-no-context.spec.ts` et
  `first-minute-two-contexts.spec.ts` : un projet est vert dès sa première minute, avant que quoi
  que ce soit soit généré. La première exécute le démarrage rapide du README racine ligne à ligne
  tel qu'il est écrit, sur pnpm et, dans les termes que le README donne pour lui, sur npm :
  `init` seul, l'installation et le `verify` que nomme la note de `init` (tenus aussi au README et
  au `CLAUDE.md` du projet), puis un contexte, un second en aval de lui, un cas d'usage avec sa
  route, `docs:generate`, avec un `verify` à chaque étape ; et la séquence avec laquelle le défaut
  de 0.1.0 a été signalé, des contextes demandés à `init`. La deuxième fait de même sur les sept
  autres *stacks* éprouvées, un gestionnaire de paquets chacune à tour de rôle : aucun contexte,
  un, deux avec un amont, un premier cas d'usage. Les deux installent pour de vrai depuis le kit
  empaqueté et tournent dans les *jobs* de gestionnaires de paquets du *pipeline*
  (`ci:test:managers`). Les deux dernières prennent chaque *stack* que le *workspace* sait
  exécuter, installée comme le serait un kit publié, sans contexte et avec deux : aucun constat
  des quatre analyseurs, des *specs* qui passent, un build, et les contrats écrits par `init`
  égaux à ce que génèrent les scripts du projet.
- `package-managers.spec.ts` : un projet par gestionnaire de paquets sur la *stack* par défaut et
  sur NestJS avec Prisma, chaque genre généré, installé pour de vrai depuis le kit empaqueté :
  l'installation figée d'un *pipeline*, le build, `verify`, et `affected` depuis la CLI installée.
- `first-class.spec.ts` : la *stack* de première classe, `--validation class-validator --orm knex --authn
  keycloak --authz rebac --cache redis --http-cache varnish --audit on --errors sentry --logger pino --style declared`
  (mode des anciens décorateurs), trois fois, avec `--broker redis` (un seul serveur pour le cache
  et le bus d'événements), `--broker nats` et `--broker kafka` : les mêmes analyseurs avant et
  après les décisions métier de `test/first-class-proof.ts`, un *job* en échec et un événement
  envoyé en file de rejet remontés au *reporter* en mémoire de l'application de test, puis une
  liste restreinte par les relations, le journal d'audit lu par sa route, l'identifiant de
  corrélation d'une requête HTTP suivi jusqu'à l'événement publié, cet événement porté d'un
  contexte jusqu'au gestionnaire d'un autre, et le tout vérifié comme une seule trace avec
  `expectSpanTree`.
- `error-reporting.spec.ts` : `--errors sentry` dans les deux familles de câblage (déclaré sur
  tsyringe derrière RabbitMQ et l'outbox, à la main sans base de données), installé comme le
  serait un kit publié : les mêmes analyseurs sans constat, les trois points d'entrée construits
  avec le *reporter* comme deuxième import, puis une *spec* écrite dans le projet
  (`fixtures/reported-failures.spec.ts.txt`) qui fait échouer une requête derrière sa route : une
  remontée sur un `InMemoryErrorReporter`, nommée d'après la requête, et un vidage quand
  l'application s'arrête ; un `NoopErrorReporter` et une application qui fonctionne sans
  `SENTRY_DSN` ; et, avec un DSN qui nomme un point d'accès de l'interface de boucle locale
  ouvert par la *spec*, exactement un événement envoyé par le vrai SDK, qui porte
  l'environnement, la version publiée et l'identifiant de l'acteur, et ni l'identifiant de
  connexion ni la chaîne de requête de la requête HTTP. Aucun serveur Sentry ou GlitchTip n'est
  impliqué.
- `violations.spec.ts` et `new-rule-violations.spec.ts` : dans un projet de la *stack* par
  défaut, une violation délibérée à la fois doit être attrapée par l'analyseur qui tient la
  règle : une erreur générique dans le domaine (ESLint), un domaine qui importe son infrastructure
  (dependency-cruiser), un export inutilisé (knip), un barrel périmé (le *checker* et
  `docs --check`), et par le *checker* comme par ESLint une commande qui dit que personne ne peut
  l'envoyer, un gestionnaire qui ne se déclare plus, un gestionnaire d'événement nommé d'après un
  autre événement, puis `ports/abstract-class`, `ports/implements-never-extends`,
  `ports/no-token-constant`, `ports/no-concrete-dependency`, `ports/value-import`,
  `clean/no-hash-private`, `clean/blank-lines` (un `return` collé et un bloc rembourré),
  `clean/braces`, `clean/one-export-per-file`, `clean/file-size`, le plafond de 100 lignes de
  `clean/function-size`, `scheduling/job-triggers-use-case` et `scheduling/job-name` ; deux
  *jobs* sous un même nom sont attrapés par le *checker*.

Les événements, le cache et la base de données restent dans le processus sauf si
`DDD_TS_KIT_TEST_REDIS_URL`, `DDD_TS_KIT_TEST_NATS_URL`, `DDD_TS_KIT_TEST_KAFKA_BROKERS`,
`DDD_TS_KIT_TEST_AMQP_URL` et `DDD_TS_KIT_TEST_DATABASE_URL` (*stack* de première classe
seulement, migrée par le test) nomment de vrais services : l'événement traverse alors vraiment le
*broker*.
