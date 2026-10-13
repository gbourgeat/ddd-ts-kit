[English](presentation-guard-at-the-edge.md) · **Français**
<!-- translation-of: presentation-guard-at-the-edge.md sha256:0ba14f34ba6e9b17 -->

# ddd-ts-kit/presentation-guard-at-the-edge

Identifiant d'architecture : `presentation/guard-at-the-edge` (ajouté par ce *plugin*). Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier `*.guard.ts`, dans un contexte ou dans la plateforme.

## Pourquoi

Une garde est un contrôle à la frontière sur un ensemble de routes : l'appelant est-il authentifié, a-t-il un rôle, le *tenant* de son jeton est-il celui du chemin, la clé de la requête HTTP est-elle connue. Une permission métier est autre chose : elle dépend de l'élément (à qui appartient ce rendez-vous, cette facture est-elle encore un brouillon) et elle se déclare sur le cas d'usage avec `@Requires`, pour qu'un *job* ou un gestionnaire d'événement qui envoie la même commande soit tenu au même droit. Une garde qui charge un agrégat décide d'une permission à l'entrée même que tous les appelants ne franchissent pas.

## Signalé

- un import depuis `domain/` ou `infrastructure/`, de n'importe quel contexte
- un nom importé qui se termine par `Repository` ou `UnitOfWork`
- un import de `CommandBus`

Incorrect :

```ts
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';

@Guard()
export class OwnAppointmentGuard implements Guard {
  constructor(private readonly appointments: AppointmentRepository) {}
}
```

Correct :

```ts
@Guard()
export class SameClinicGuard implements Guard {
  readonly documents = { errors: ['FORBIDDEN'] };

  check({ actor, params }: GuardRequest): void {
    if (actor.tenantId !== params['clinicId']) {
      throw new ForbiddenError('The caller belongs to another clinic');
    }
  }
}
```

## Détails

Une garde peut dépendre d'un port de `application/ports/` qui répond à une question sur l'appelant, par exemple si une clé d'API existe : le port est la ligne vérifiable, un agrégat derrière lui n'est pas vu.

## Options

Aucune.

`rules."presentation/guard-at-the-edge"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line presentation/guard-at-the-edge -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent.
