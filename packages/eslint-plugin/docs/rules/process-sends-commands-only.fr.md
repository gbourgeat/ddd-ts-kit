[English](process-sends-commands-only.md) · **Français**
<!-- translation-of: process-sends-commands-only.md sha256:530c9a3a274b1397 -->

# ddd-ts-kit/process-sends-commands-only

Identifiant d'architecture : `process/sends-commands-only`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `application/processes/*.process.ts` d'un contexte, *specs* mises à part.

## Pourquoi

Un gestionnaire de processus (process manager) coordonne un processus de longue durée : il réagit
à des événements, garde un état à lui et décide de la suite. Quand il charge et enregistre aussi
des agrégats, il devient un cas d'usage que personne ne peut envoyer, sans permission, sans audit,
avec une transaction qui couvre ce qu'il devrait seulement coordonner ; quand il écrit l'agrégat
d'un autre contexte, la frontière a disparu. Ses étapes répondent à une décision, et les commandes
de cette décision font le travail, chacune dans son propre gestionnaire.

## Signalé

Un import, dans un fichier de processus, de :

- `domain/aggregates/`, `domain/entities/`, `domain/repositories/` ou `domain/services/` de
  n'importe quel contexte
- `application/ports/` de n'importe quel contexte
- `infrastructure/` de n'importe quel contexte

Incorrect :

```ts
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';

export class AppointmentReminderProcess { /* enregistre lui-même les rappels */ }
```

Correct :

```ts
import { PlanReminderCommand } from '@/contexts/notification/application/commands/plan-reminder/plan-reminder.command';

export class AppointmentReminderProcess implements ProcessManager<ReminderProcessState> {
  booked(event: AppointmentBookedV1, current: ReminderProcessState | undefined): ProcessDecision<ReminderProcessState> | undefined {
    return { state: { appointmentId: event.payload.appointmentId, stage: 'waiting' }, commands: [new PlanReminderCommand(/* ... */)] };
  }
}
```

## Détails

Les commandes, le langage publié des contextes amont, les objets-valeurs, les vocabulaires et le
*kernel* restent permis : un processus construit des commandes et lit des événements.

## Options

Aucune.

`rules."process/sends-commands-only"` à `off` dans `ddd-ts-kit.config.json` désactive la règle,
et `// ddd-ts-kit-disable-next-line process/sends-commands-only -- <reason>` désactive une ligne,
exactement comme pour `ddd-ts-kit check`.

## Limites

- Un import lu par une expression dynamique n'est pas suivi.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers.
