[English](domain-events-transactional-before-commit.md) · **Français**
<!-- translation-of: domain-events-transactional-before-commit.md sha256:9a978f4c0a72e179 -->

# ddd-ts-kit/domain-events-transactional-before-commit

Identifiant d'architecture : `domain-events/transactional-before-commit`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : les fichiers de production d'un contexte, sur chaque classe qui porte `@DomainEventHandler`.

## Pourquoi

Un effet d'un événement du domaine n'existe que si le changement d'état qui a enregistré l'événement est validé (commit). Un gestionnaire (handler) qui s'exécute avant la validation (la phase par défaut) s'exécute dans la transaction de la commande, et la validation elle-même peut encore échouer après que le gestionnaire s'est exécuté : une contrainte différée, un échec de sérialisation, une connexion perdue. Ce n'est sûr que si l'annulation (rollback) défait tout ce qu'a fait le gestionnaire ; un gestionnaire d'avant validation ne peut donc avoir que des effets transactionnels. Une entrée de cache, un verrou, un *job*, un message sur le bus ou un appel à un système distant survivraient à l'annulation et annonceraient au monde un fait qui n'a jamais eu lieu.

Déclarez le gestionnaire `phase: 'after-commit'` quand son effet peut être perdu lors d'un plantage (il s'exécute alors au plus une fois), ou publiez un événement d'intégration depuis un *publisher* (outbox, au moins une fois) et faites le travail dans le gestionnaire de cet événement quand il ne doit pas être perdu.

## Signalé

La phase d'un gestionnaire est `after-commit` quand l'objet d'options de son `@DomainEventHandler` écrit `phase: 'after-commit'` ; sinon c'est `before-commit`. Ses dépendances sont les noms de la liste de dépendances du décorateur et les types des paramètres de son constructeur, chacun résolu à travers les imports du fichier.

Pour un gestionnaire d'avant validation, une dépendance qui est :

- `Cache`, `CachePurger`, `Lock`, `RateLimiter`, `JobScheduler` ou `EventBus` de `@ddd-ts-kit/kernel`
- importée de `infrastructure/` de son contexte
- importée d'un autre contexte
- importée du répertoire de la plateforme
- importée d'un *package* autre que `@ddd-ts-kit/kernel` et `@ddd-ts-kit/auth`, module natif de Node.js compris

Pour un gestionnaire d'après validation, une dépendance à `IntegrationEventPublisher` de `@ddd-ts-kit/kernel`, et rien d'autre : après la validation, rien ne rend la ligne de l'outbox atomique avec un changement d'état, le gestionnaire envoie donc plutôt une commande par `CommandBus`.

Incorrect :

```ts
// src/contexts/billing/application/event-handlers/invoice-issued.event-handler.ts
import { Cache } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';

@DomainEventHandler(InvoiceIssued)
export class InvoiceIssuedEventHandler {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly cache: Cache,
  ) {}
}
```

```ts
@DomainEventHandler(InvoiceIssued, { phase: 'after-commit' })
export class InvoiceIssuedEventHandler {
  constructor(private readonly integrationEventPublisher: IntegrationEventPublisher) {}
}
```

Correct :

```ts
// l'état que change le gestionnaire est validé ou annulé avec la commande
@DomainEventHandler(InvoiceIssued)
export class InvoiceIssuedEventHandler {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly commandBus: CommandBus,
  ) {}
}
```

```ts
// un effet qu'aucune transaction ne couvre s'exécute une fois la transaction validée, au plus une fois
@DomainEventHandler(InvoiceIssued, { phase: 'after-commit' })
export class InvoiceIssuedEventHandler {
  constructor(private readonly cache: Cache) {}
}
```

```ts
// un effet qui ne doit pas être perdu passe par l'outbox : le gestionnaire de l'événement d'intégration fait le travail
@DomainEventHandler(InvoiceIssued)
export class InvoiceIssuedPublisher {
  constructor(
    private readonly integrationEventPublisher: IntegrationEventPublisher,
    private readonly idGenerator: IdGenerator,
  ) {}
}
```

## Détails

Un gestionnaire d'avant validation peut dépendre de tout ce que contient la couche `domain/` de son contexte (un port de *repository*, un service du domaine), de chacun des autres ports de `@ddd-ts-kit/kernel` (`IntegrationEventPublisher`, `CommandBus`, `QueryBus`, `Clock`, `IdGenerator`, `Logger`, `Metrics`, `ActorContext`, `ExecutionScope`..), de `@ddd-ts-kit/auth`, et des fichiers de son contexte hors de `infrastructure/` et de `application/ports/`. Un port du noyau importé sous un autre nom (`import { Cache as Entries }`) est reconnu par le nom qu'exporte le noyau.

Seuls les noms qui sont des dépendances sont jugés : un import de type seul qui type un paramètre de méthode, ou un import que la classe ne reçoit jamais, n'est pas une dépendance. Un nom que le fichier n'importe pas est laissé tranquille.

## Options

Aucune.

`rules."domain-events/transactional-before-commit"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line domain-events/transactional-before-commit -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

ESLint juge un fichier à la fois, si bien que deux parties de la règle ne sont tenues que par `ddd-ts-kit check` :

- Un port de `application/ports/` du contexte n'est accepté avant la validation que s'il s'agit d'un port de persistance : au moins une classe de production l'implémente sous `infrastructure/persistence/` et aucune ailleurs sous `infrastructure/`. L'endroit où vivent les adaptateurs d'un port n'est pas dans le fichier du gestionnaire : cette règle ne signale aucun port de `application/ports/`.
- Dans les styles explicites, la classe ne porte pas de décorateur et sa phase est le troisième argument de son enregistrement `.on(name, callback, { phase: 'after-commit' })` dans `<context>.module.ts` : un gestionnaire sans `@DomainEventHandler` n'est pas jugé ici.

Ne sont pas vus non plus : une liste de dépendances contenue dans une constante, un port atteint par un import d'espace de noms (`kernel.Cache`) ou par un *barrel* qui le renomme, et un effet atteint sans dépendance (un client de niveau module, un appel statique).

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers, et ajoute ce qui exige de connaître le projet : les adaptateurs d'un port de `application/ports/`, ainsi que la phase et la liste `.toClass(Handler, [..])` écrites dans le fichier de module d'un contexte de style explicite. Cette règle fait autorité pour ce que montre une classe déclarée.
