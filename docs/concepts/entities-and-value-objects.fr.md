[English](entities-and-value-objects.md) · **Français**
<!-- translation-of: entities-and-value-objects.md sha256:1e4c59bf54f0199f -->

# Entités et objets-valeurs

**Résumé.** Le modèle du domaine est fait de deux sortes d'objets. Une entité a une identité qui
persiste pendant que ses attributs changent : un rendez-vous reste le même rendez-vous quand il
est déplacé. Un objet-valeur n'a pas d'identité : il est entièrement défini par ses attributs, il
est immuable, et deux objets-valeurs aux mêmes attributs sont interchangeables, comme un créneau
horaire ou un motif d'annulation. La plupart des concepts devraient être des objets-valeurs ; les
entités sont les quelques choses dont le métier suit la continuité. Dans ce kit, les deux ont un
constructeur privé et des fabriques, les entités ne changent que par des méthodes nommées d'après
une intention métier, et les objets-valeurs ne changent jamais.

## Les distinguer

Demandez à l'expert du domaine : « si tous les attributs étaient identiques, s'agirait-il encore
de deux choses différentes ? »

| | Entité | Objet-valeur |
|---|---|---|
| Identité | en a une, stable dans le temps | aucune |
| Égalité | par identifiant | par attributs (`equals`) |
| Mutabilité | change d'état par des méthodes d'intention | immuable ; une opération renvoie une nouvelle instance |
| Cycle de vie | créée, modifiée, parfois terminée ; stockée et chargée | créé au besoin, abandonné librement |
| Exemple | `Appointment`, `Calendar`, une absence `TimeOff` dans un calendrier | `TimeSlot`, `CancellationReason`, `WorkingHours`, une adresse e-mail |

Deux rendez-vous pour le même client, le même praticien et le même créneau resteraient deux
rendez-vous (et un bogue que l'invariant doit empêcher) : entité. Deux `TimeSlot` de 09:00 à 09:30
le même jour sont le même créneau : objet-valeur.

![À gauche, l'entité Appointment apt-42 est réservée, déplacée puis annulée et reste le même rendez-vous, égal par son identifiant ; à droite, deux valeurs TimeSlot aux mêmes attributs sont égales, et déplacer un créneau crée une nouvelle valeur](../assets/diagrams/entities-and-value-objects-identity.fr.svg)

Le même concept peut être une entité dans un contexte et une valeur dans un autre. Un praticien
est une entité là où l'on gère les profils ; dans `appointments`, ce n'est qu'un
`practitionerId`.

## Objets-valeurs

Un objet-valeur rassemble un concept qui serait sinon éparpillé en types primitifs, avec les
règles qui le rendent valide et les opérations qui lui appartiennent.

<!-- checked sample -->
```ts
import { ConceptError, ValueObject } from '@ddd-ts-kit/kernel';

// contexts/appointments/domain/errors/appointment.error.ts
export class AppointmentError extends ConceptError {
  static invalidTimeSlot(startsAt: Date, endsAt: Date) {
    return AppointmentError.refusal(
      'INVALID_TIME_SLOT',
      `A slot ends after it starts: ${startsAt.toISOString()} to ${endsAt.toISOString()} does not.`,
      { startsAt, endsAt },
    );
  }
}

// contexts/appointments/domain/value-objects/time-slot.vo.ts
export type TimeSlotProps = {
  readonly startsAt: Date;
  readonly endsAt: Date;
};

export class TimeSlot extends ValueObject<TimeSlotProps> {
  private constructor(props: TimeSlotProps) {
    super(props);
  }

  static create(startsAt: Date, endsAt: Date): TimeSlot {
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw AppointmentError.invalidTimeSlot(startsAt, endsAt);
    }

    return new TimeSlot({ startsAt, endsAt });
  }

  overlaps(other: TimeSlot): boolean {
    return this.startsAt < other.endsAt && other.startsAt < this.endsAt;
  }

  startsWithin(durationMs: number, now: Date): boolean {
    return this.startsAt.getTime() - now.getTime() < durationMs;
  }

  get startsAt(): Date {
    return this.props.startsAt;
  }

  get endsAt(): Date {
    return this.props.endsAt;
  }
}
```

Ce que cette forme apporte :

- **Valide par construction.** Le constructeur est privé et `create` vérifie les règles, si bien
  qu'un `TimeSlot` qui existe est valide. Le code qui reçoit un `TimeSlot` ne le revalide jamais.
- **Immuable.** Les propriétés sont en lecture seule et aucune méthode n'affecte l'objet
  (`domain/value-object-immutability`). On peut le partager et le faire circuler sans copie
  défensive.
- **Le comportement à côté des données.** `overlaps` est écrit une fois, sur le type qu'il
  concerne, au lieu d'être répété partout où deux paires de dates se rencontrent.
- **Aucune horloge cachée.** `startsWithin` reçoit `now` ; le domaine ne lit jamais l'heure du
  système (`purity/no-system-clock`).
- **L'égalité offerte.** `ValueObject` gèle les propriétés à la construction et les compare dans
  `equals`, les dates par leur instant et les tableaux élément par élément : deux créneaux
  construits à partir des mêmes instants sont égaux, `===` n'est pas la question.
- **Les propriétés sont un `type`, pas une `interface`.** `ValueObject<Props>` exige
  `Record<string, unknown>` : un alias de type objet le satisfait, une interface non, parce que
  TypeScript donne une signature d'index implicite au premier seulement.

Dans une *spec*, la valeur s'emploie comme le métier en parle :

<!-- checked sample -->
```ts
import { ValueObject } from '@ddd-ts-kit/kernel';
import { describe, expect, it } from 'vitest';

// Le TimeSlot ci-dessus, réduit à ce qu'utilise cette spec.
type TimeSlotProps = { readonly startsAt: Date; readonly endsAt: Date };

class TimeSlot extends ValueObject<TimeSlotProps> {
  private constructor(props: TimeSlotProps) {
    super(props);
  }

  static create(startsAt: Date, endsAt: Date): TimeSlot {
    return new TimeSlot({ startsAt, endsAt });
  }

  overlaps(other: TimeSlot): boolean {
    return this.props.startsAt < other.props.endsAt && other.props.startsAt < this.props.endsAt;
  }
}

const at = (time: string): Date => new Date(`2026-03-03T${time}:00.000Z`);

describe('TimeSlot', () => {
  it('is equal to another slot with the same start and end', () => {
    expect(TimeSlot.create(at('09:00'), at('09:30')).equals(TimeSlot.create(at('09:00'), at('09:30')))).toBe(true);
  });

  it('overlaps a slot that starts before it ends', () => {
    expect(TimeSlot.create(at('09:00'), at('09:30')).overlaps(TimeSlot.create(at('09:15'), at('09:45')))).toBe(true);
  });

  it('does not overlap the slot that starts when it ends', () => {
    expect(TimeSlot.create(at('09:00'), at('09:30')).overlaps(TimeSlot.create(at('09:30'), at('10:00')))).toBe(false);
  });
});
```

### L'obsession des types primitifs

La référence d'architecture en fait un défaut : un e-mail, un montant, une période sont des types
([ARCHITECTURE.md](../ARCHITECTURE.fr.md), section 4). Le symptôme est une signature telle que
`book(practitionerId: string, clientId: string, start: Date, end: Date)` : deux chaînes que l'on
peut intervertir sans s'en apercevoir, deux dates dont rien ne garantit l'ordre. Les candidats à
un objet-valeur :

- tout ce qui a un **format ou un intervalle de valeurs** (e-mail, numéro de téléphone, durée,
  pourcentage) ;
- tout ce qui est **deux valeurs qui voyagent ensemble** (début et fin, montant et devise) ;
- tout ce qui a un **ensemble fermé de valeurs** (un statut, un canal) ;
- les **identifiants d'autres agrégats**, quand les confondre coûterait cher.

Au lieu de :

```ts
book(practitionerId: string, clientId: string, startsAt: Date, endsAt: Date): void; // fin avant le début ? identifiants intervertis ?
```

écrivez :

```ts
book(practitionerId: string, clientId: string, slot: TimeSlot): void; // un TimeSlot qui existe est valide
```

Les *templates* du générateur le rappellent eux-mêmes : l'état se déclare « with value objects,
not primitives » (avec des objets-valeurs, pas des types primitifs).

## Entités

Une entité est définie par un fil de continuité. Sa classe protège ce fil :

<!-- checked sample -->
```ts
import { ConceptError, Entity, ValueObject } from '@ddd-ts-kit/kernel';

// contexts/calendars/domain/errors/calendar.error.ts
export class CalendarError extends ConceptError {
  static timeOffCanOnlyShrink(timeOffId: string) {
    return CalendarError.refusal('TIME_OFF_CAN_ONLY_SHRINK', `Time off ${timeOffId} can only be shortened.`, {
      timeOffId,
    });
  }
}

// contexts/calendars/domain/value-objects/period.vo.ts, réduit à ce qu'utilise l'entité
type PeriodProps = { readonly from: Date; readonly to: Date };

export class Period extends ValueObject<PeriodProps> {
  private constructor(props: PeriodProps) {
    super(props);
  }

  static create(from: Date, to: Date): Period {
    return new Period({ from, to });
  }

  overlaps(other: Period): boolean {
    return this.props.from < other.props.to && other.props.from < this.props.to;
  }

  contains(other: Period): boolean {
    return this.props.from <= other.props.from && other.props.to <= this.props.to;
  }
}

// contexts/calendars/domain/entities/time-off.entity.ts
export interface TimeOffState {
  readonly period: Period;
  readonly reason: string;
}

export class TimeOff extends Entity<string> {
  private constructor(
    id: string,
    private state: TimeOffState,
  ) {
    super(id);
  }

  static create(id: string, state: TimeOffState): TimeOff {
    return new TimeOff(id, state);
  }

  static rehydrate(id: string, state: TimeOffState): TimeOff {
    return new TimeOff(id, state);
  }

  shortenTo(period: Period): void {
    if (!this.state.period.contains(period)) {
      throw CalendarError.timeOffCanOnlyShrink(this.id);
    }

    this.state = { ...this.state, period };
  }

  covers(period: Period): boolean {
    return this.state.period.overlaps(period);
  }

  toState(): TimeOffState {
    return { ...this.state };
  }
}
```

- **Constructeur privé, deux fabriques.** `create` est la naissance et vérifie les invariants que
  l'entité garde à elle seule ; `rehydrate` est le chargement depuis le stockage et ne vérifie
  rien, parce que l'état stocké était valide quand il a été enregistré.
- **Aucun *setter*, aucune propriété publique modifiable** (`domain/aggregate-encapsulation`).
  L'état est remplacé par une méthode dont le métier reconnaîtrait le nom : `shortenTo`, pas
  `setPeriod`.
- **L'identité est donnée, pas générée à l'intérieur.** L'identifiant vient du port
  `IdGenerator` en passant par la couche application (`purity/no-ambient-randomness`), ce qui
  garde les tests déterministes.
- **La méthode d'intention garde sa règle.** `shortenTo` refuse une période qui n'est pas incluse
  dans la période actuelle : on ne peut pas allonger l'entité par une méthode nommée
  « raccourcir ».
- **L'état est fait d'objets-valeurs.** L'entité porte l'identité et le cycle de vie ; les valeurs
  portent la validité.
- **Égale par identité.** `Entity.equals` compare la classe et l'identifiant, jamais l'état : un
  `TimeOff` chargé avant et après `shortenTo` est la même absence.

Une entité est soit la racine d'un [agrégat](aggregates.fr.md) (`Appointment`, `Calendar`), soit
elle vit à l'intérieur de l'un d'eux (`TimeOff` dans `Calendar`). Une entité interne n'est
atteinte et modifiée qu'à travers sa racine, n'a pas de *repository* à elle, et son identité n'a
besoin d'être unique qu'à l'intérieur de l'agrégat.

![L'agrégat Calendar : un gestionnaire le charge et appelle une méthode de sa racine, qui tient WorkingHours et deux entités internes TimeOff avec chacune une Period ; atteindre directement une entité interne n'arrive jamais, et le CalendarRepository charge et enregistre le tout](../assets/diagrams/entities-and-value-objects-aggregate.fr.svg)

```bash
npx ddd-ts-kit generate value-object appointments TimeSlot
npx ddd-ts-kit generate entity calendars TimeOff
```

Chaque commande écrit le fichier et sa *spec*, avec des marqueurs `TODO(domain)` là où une
décision métier est attendue.

## Choisir : préférer les valeurs

Modélisez un concept comme un objet-valeur, sauf si le métier a besoin de le suivre dans le
temps. Les valeurs coûtent moins cher à tous points de vue : pas d'identité à gérer, pas de cycle
de vie, pas de concurrence, triviales à tester. Une erreur fréquente consiste à donner une
identité à quelque chose parce qu'il a une ligne en base de données. Le stockage est l'affaire du
*mapper* ; un objet-valeur peut être stocké dans des colonnes de la table de son propriétaire, ou
dans une table à lui avec une clé technique que le domaine ne voit jamais.

| Question | Si oui |
|---|---|
| Le métier parle-t-il de « celui-là » dans le temps, même après qu'il a changé ? | entité |
| Pourrait-on le remplacer par un égal sans que personne s'en aperçoive ? | objet-valeur |
| A-t-il un cycle de vie avec des états ? | entité |
| Est-ce une mesure, une description, une quantité, un intervalle ? | objet-valeur |

## Limites et cas où s'en passer

- **Toute chaîne ne mérite pas un type.** Une note en texte libre, sans règle ni opération, ne
  gagne rien à être enveloppée dans une classe. Enveloppez ce qui a des règles de validité, un
  comportement, ou un vrai risque de confusion.
- **Lever une erreur, ou `Result`.** L'objet-valeur généré lève une erreur depuis `create`, comme
  le fait une méthode d'agrégat : `throw PersonError.invalidEmail(raw)`, et l'appelant prend la
  valeur sans `unwrap`. Un projet qui préfère traiter les échecs attendus comme des valeurs
  déclare `"stack.valueObjects": "result"` : `create` renvoie `err(PersonError.invalidEmail(raw))`
  et l'appelant le déballe ; une configuration sans la clé se lit de cette façon, et
  `ddd-ts-kit value-objects` fait passer un tel projet aux fabriques qui lèvent une erreur
  ([CONFIG.md](../CONFIG.fr.md#stack)). Dans les deux cas, le refus est construit par une
  fabrique de la classe d'erreur du concept que décrit la valeur, pas par une classe par
  objet-valeur.
- **L'immuabilité est vérifiée syntaxiquement.** `domain/value-object-immutability` voit les
  propriétés en lecture seule et les écritures dans `this` ; il ne voit pas un objet modifiable
  tenu dans un champ en lecture seule (une `Date` peut encore être modifiée par ses méthodes, on
  peut ajouter des éléments à un tableau). Tenez des valeurs elles-mêmes immuables, ou copiez-les
  à l'entrée et à la sortie.
- **Les règles d'encapsulation relèvent du *plugin* ESLint**, qui lit l'arbre syntaxique ; le
  *checker* de la CLI, qui travaille au niveau du texte, n'a pas d'équivalent pour `domain/*`
  (README de la CLI).
- **Un contexte CRUD mince** peut avoir des entités avec peu de règles. C'est acceptable là où le
  sous-domaine est simple ; voir [Modèle anémique](anemic-model.fr.md).

## Sources

- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, chapitre 5 « A Model Expressed in
  Software » (entités, objets-valeurs, services).
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013, chapitre 5
  « Entities » et chapitre 6 « Value Objects ».
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapitre 6 « Tackling Complex
  Business Logic ».
- Martin Fowler, *Patterns of Enterprise Application Architecture*, Addison-Wesley, 2002,
  « Value Object » ; et « ValueObject », martinfowler.com/bliki/ValueObject.html.

## Voir aussi

- [Agrégats](aggregates.fr.md)
- [Événements du domaine, services du domaine, repositories et fabriques](domain-building-blocks.fr.md)
- [Invariants, permissions et validation](invariants-permissions-validation.fr.md)
- [Modèle anémique](anemic-model.fr.md)
- [Langage omniprésent](ubiquitous-language.fr.md)
- [Code propre](clean-code.fr.md)
- [Référence d'architecture](../ARCHITECTURE.fr.md)
- [Index des concepts](README.fr.md)
