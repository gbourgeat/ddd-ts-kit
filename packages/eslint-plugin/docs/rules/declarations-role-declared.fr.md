[English](declarations-role-declared.md) · **Français**
<!-- translation-of: declarations-role-declared.md sha256:d6c86f0b480155cb -->

# ddd-ts-kit/declarations-role-declared

Identifiant d'architecture : `declarations/role-declared`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier d'un contexte dans un projet de style déclaré (`stack.style: "declared"` dans `ddd-ts-kit.config.json`), tests exclus. Rien n'est signalé dans un projet de style explicite, qui est aussi ce qu'est une configuration qui ne dit rien.

## Pourquoi

Dans le style déclaré, un contexte n'a pas de fichier de module : une classe dit ce qu'elle est par un décorateur de `@ddd-ts-kit/kernel/declarations`, et la racine de composition est assemblée à partir de ce que disent les classes. Un fichier de rôle dont la classe ne dit rien n'entre dans aucun assemblage : le gestionnaire (handler) n'est jamais enregistré et la première commande échoue à l'exécution. Un nom dérivé au lieu d'être écrit change quand une classe est renommée, et avec lui la portée d'idempotence d'un consommateur. Un décorateur dans le domaine lie le modèle au câblage.

## Signalé

Dans un fichier de rôle (le tableau ci-dessous), hors `*.command.ts` et `*.query.ts`, que tient `authz-declared` :

- aucune classe exportée ne porte le décorateur du rôle
- une classe du fichier porte un autre décorateur de déclaration que celui du rôle

Sur toute classe de `application/`, `infrastructure/`, `presentation/` ou de la racine du contexte :

- `@IntegrationEventHandler(definition, { consumer })`, `@Policy(permission, { name })` ou `@DomainEventHandler(Event, { name })` dont le nom n'est pas un littéral de chaîne non vide : absent, vide, une variable, un gabarit avec une substitution, des options contenues dans une variable ou seulement étalées. Un gestionnaire d'événement du domaine peut à la place lire le nom que déclare sa classe d'événement, `@DomainEventHandler(InvoiceIssued, { name: InvoiceIssued.eventName })`, la classe étant celle qu'il reçoit
- `@DomainEventHandler(Event, { name })` dont le `name`, écrit en toutes lettres, diffère du nom que déclare la classe d'événement, quand cette classe est en vue

Sous `domain/` :

- une classe qui porte un décorateur de déclaration quel qu'il soit : `Requires`, `Public`, `CommandHandler`, `QueryHandler`, `IntegrationEventHandler`, `DomainEventHandler`, `Scheduled`, `Projection`, `Repository`, `Gateway`, `Adapter`, `Policy`

| Fichier, relatif au contexte | La classe exportée porte |
|---|---|
| `application/commands/**/*.handler.ts` | `@CommandHandler` |
| `application/queries/**/*.handler.ts` | `@QueryHandler` |
| `application/integration/handlers/**/*.integration-handler.ts` | `@IntegrationEventHandler` |
| `application/event-handlers/**/*.event-handler.ts` | `@DomainEventHandler` |
| `application/integration/publishers/**/*.publisher.ts` | `@DomainEventHandler` |
| `application/authorization/**/*.policy.ts` | `@Policy` |
| `application/scheduling/**/*.job.ts` | `@Scheduled` |
| `application/projections/**/*.projection.ts` | `@Projection` |
| `infrastructure/persistence/**/*.repository.ts` | `@Repository` |
| `infrastructure/**/*.gateway.ts` | `@Gateway` |
| `infrastructure/**/*.adapter.ts` | `@Adapter` |

Incorrect :

```ts
// application/commands/issue-invoice/issue-invoice.handler.ts
export class IssueInvoiceHandler {}

// application/queries/search-invoices/search-invoices.handler.ts
@CommandHandler(SearchInvoicesQuery)
export class SearchInvoicesHandler {}

// application/authorization/only-issuer-voids.policy.ts
@Policy(billingPermissions['invoice.void'], { name: policyName })
export class OnlyIssuerVoidsPolicy {}

// application/event-handlers/invoice-issued.event-handler.ts, où InvoiceIssued s'appelle 'billing.invoice.issued'
@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.sent' })
export class InvoiceIssuedEventHandler {}

// domain/aggregates/invoice.aggregate.ts
@Repository(InvoiceRepository)
export class Invoice {}
```

Correct :

```ts
// application/commands/issue-invoice/issue-invoice.handler.ts
import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';

@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
  ) {}
}

// application/authorization/only-issuer-voids.policy.ts
@Policy(billingPermissions['invoice.void'], { name: 'billing.only-issuer-voids' })
export class OnlyIssuerVoidsPolicy {}

// application/event-handlers/invoice-issued.event-handler.ts
@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' })
export class InvoiceIssuedEventHandler {}
```

## Détails

Un décorateur compte quand son nom est l'un des douze décorateurs de déclaration et que ce nom est importé de `@ddd-ts-kit/kernel/declarations` dans le fichier : `{ Repository }`, un alias `{ Repository as Repo }`, ou un espace de noms `declarations.Repository`. Un décorateur maison du même nom, ou celui d'un autre *package* (`@Retry` de `@ddd-ts-kit/aspects/decorators`), est ignoré.

Le rôle d'un fichier se lit à son suffixe et à son dossier, tels que le générateur les écrit. Une classe est exportée en ligne, par `export { A }` ou par `export default A`. Quand une classe porte un autre décorateur de déclaration, seul celui-ci est signalé : le corriger répond aussi au décorateur manquant.

La classe d'événement de `@DomainEventHandler` est en vue quand elle est déclarée dans le même fichier, ou importée par son nom depuis une source du projet qui existe sur le disque ; ce fichier est alors analysé, syntaxe seulement, et son `static readonly eventName = '...'` (ou, comme l'écrivait la 0.5, son `readonly name = '...'`) est lu (`as const` et `satisfies` sont traversés). Quand la classe est introuvable, ou que son nom n'est pas un littéral, rien n'est comparé.

## Options

Aucune.

`rules."declarations/role-declared"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line declarations/role-declared -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une classe d'événement atteinte par un *barrel* (`@/contexts/billing/domain/events/index`), un export qui renomme, un import par défaut ou un espace de noms n'est pas suivie : son nom n'est pas comparé. `ddd-ts-kit check` résout le même import dans le projet.
- Un décorateur appliqué par une variable (`const declare = Repository(InvoiceRepository); @declare class ...`) n'est pas reconnu.
- Ce qu'une classe reçoit relève de `declarations/constructor-injection` ; qu'une liste corresponde au constructeur et qu'un gestionnaire traite son message est vérifié par le compilateur, pas ici ; qu'un adaptateur implémente son port relève de `ports/implements-never-extends`, et l'endroit où vit un *job* et son nom relèvent de `scheduling/job-triggers-use-case` et de `scheduling/job-name`.
- Que chaque fichier de rôle contienne une seule classe déclarée relève de `naming/one-concept-per-file` de `ddd-ts-kit check`.
- Que le *barrel* généré `<context>.declarations.ts` liste chaque fichier de rôle relève de `declarations/barrel-current` de `ddd-ts-kit check` : c'est un fait du projet, pas d'un fichier.
- Un fichier de rôle écrit hors des dossiers du tableau n'est pas reconnu comme tel : `naming/suffix` et `tree/closed` de `ddd-ts-kit check` tiennent l'arborescence.
- Le `consumer` non écrit de `@IntegrationEventHandler` est aussi signalé par `events-consumer-idempotent`, pour ce qu'il coûte à l'exécution.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers et reste le garde-fou rapide pendant l'écriture. Cette règle fait autorité.
