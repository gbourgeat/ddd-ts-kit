[English](scheduling-job-name.md) · **Français**
<!-- translation-of: scheduling-job-name.md sha256:fcce14a1f2803f23 -->

# ddd-ts-kit/scheduling-job-name

Identifiant d'architecture : `scheduling/job-name`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier passé au lint ; la vérification de `systemActor` s'applique aux fichiers `*.job.ts`.

## Pourquoi

Le nom d'un *job* est son identité : le verrou qui limite une occurrence à une seule exécution, ses réglages, ses métriques, sa ligne dans le journal d'audit sont indexés par lui. Il est écrit une fois comme un littéral de chaîne, jamais dérivé d'un nom de classe qui peut être renommé, et il commence par le contexte auquel appartient le *job*, pour qu'il parte avec le contexte quand celui-ci est extrait.

## Signalé

- un premier argument de `@Scheduled(..)` ou de `job(..)` (dans une instruction qui se termine par `handledBy` ou `handledByFactory`) qui n'est pas un littéral de chaîne
- un nom qui n'est pas de la forme `<context>.<job-name>` : deux segments en kebab-case minuscule
- un nom dont le premier segment n'est pas le contexte du fichier (dans un fichier de module, le contexte du module)
- dans un fichier `*.job.ts` : un appel `systemActor(..)` qui ne passe pas le nom sous lequel le *job* est déclaré

Incorrect :

```ts
@Scheduled('SendReminders', { every: '15m' })
export class SendRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendRemindersCommand(systemActor('reminders'), execution.scheduledAt));
  }
}
```

Correct :

```ts
@Scheduled('billing.send-reminders', { every: '15m' })
export class SendRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendRemindersCommand(systemActor('billing.send-reminders'), execution.scheduledAt));
  }
}
```

## Détails

Un littéral de gabarit sans substitution compte comme un littéral de chaîne. Hors d'un contexte (`main.ts`, la plateforme), le format est vérifié et le premier segment est libre. Dans un fichier de *job* sans `@Scheduled` (le style explicite, où le nom est écrit dans le fichier de module), `systemActor(..)` doit passer un littéral qui est un nom de *job* du contexte du fichier.

## Options

Aucune.

`rules."scheduling/job-name"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line scheduling/job-name -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Qu'un nom de *job* soit unique dans le projet est un fait du projet : `ddd-ts-kit check` le tient.
- Dans le style explicite, le nom passé à `systemActor` dans le fichier du *job* n'est pas comparé au nom écrit dans le fichier de module.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers, et est le seul à vérifier qu'un nom est unique dans tout le projet.
