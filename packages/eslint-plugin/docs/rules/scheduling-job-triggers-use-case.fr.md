[English](scheduling-job-triggers-use-case.md) · **Français**
<!-- translation-of: scheduling-job-triggers-use-case.md sha256:2d4c41372454b22f -->

# ddd-ts-kit/scheduling-job-triggers-use-case

Identifiant d'architecture : `scheduling/job-triggers-use-case`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : les fichiers de production d'un contexte.

## Pourquoi

Un *job* est une planification, pas un cas d'usage. Il envoie une commande, et le travail se trouve dans le gestionnaire de cette commande, où il est autorisé, transactionnel, audité et testé comme tout autre cas d'usage, et où un opérateur peut aussi le déclencher à la main. Un *job* qui charge des agrégats et les enregistre est un cas d'usage qui a échappé à tout cela.

## Signalé

Dans `application/scheduling/*.job.ts` :

- aucune classe exportée qui implémente `ScheduledJob`
- une méthode `run` qui n'appelle aucun `<something>.execute(..)`, ou pas de méthode `run`
- un *repository* (une classe importée de `domain/repositories/`) dans la liste des dépendances ou comme type d'un paramètre de constructeur
- un import de `domain/aggregates/`, `domain/entities/`, `domain/services/` ou `infrastructure/`

Partout ailleurs dans un contexte :

- une classe qui porte `@Scheduled`
- `job(..).handledBy(Class, ..)` qui nomme une classe importée d'un fichier qui n'est pas un `application/scheduling/*.job.ts`

Incorrect :

```ts
// application/scheduling/send-reminders.job.ts
@Scheduled('billing.send-reminders', { every: '15m' }, [InvoiceRepository, Mailer])
export class SendRemindersJob implements ScheduledJob {
  async run(): Promise<void> {
    for (const invoice of await this.invoices.overdue()) {
      await this.mailer.remind(invoice);
    }
  }
}
```

Correct :

```ts
// application/scheduling/send-reminders.job.ts
@Scheduled('billing.send-reminders', { every: '15m' }, [CommandBus])
export class SendRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendRemindersCommand(systemActor('billing.send-reminders'), execution.scheduledAt));
  }
}
```

## Détails

La règle vaut dans les deux styles : un *job* de style explicite est la même classe sans `@Scheduled`, enregistrée par `builder.job('<context>.<job>', schedule).handledBy(Job, [CommandBus])` dans le fichier de module. Les objets-valeurs, les événements, les erreurs et les commandes de `application/commands/` peuvent être importés par un *job*. Qu'un fichier de *job* d'un projet de style déclaré porte `@Scheduled` relève de `declarations/role-declared`.

## Options

Aucune.

`rules."scheduling/job-triggers-use-case"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line scheduling/job-triggers-use-case -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une commande envoyée par un utilitaire d'un autre fichier (`this.trigger()`) n'est pas vue : appelez `execute` dans `run`.
- Un *job* enregistré avec `handledByFactory` ne nomme aucune classe et n'est pas suivi.
- Une classe qui porte `@Scheduled` hors d'un contexte (la plateforme) n'est pas jugée.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers. Cette règle fait autorité pour le code.
