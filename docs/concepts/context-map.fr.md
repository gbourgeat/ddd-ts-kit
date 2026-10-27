[English](context-map.md) · **Français**
<!-- translation-of: context-map.md sha256:23aa4fcfc2762d6d -->

# Carte des contextes

**Résumé.** Une carte des contextes (context map) est l'image des relations entre les contextes
délimités (bounded contexts) : qui dépend de qui (l'amont et l'aval), et selon quel arrangement.
L'arrangement porte un nom, celui d'un patron de relation choisi dans un petit ensemble, et
chaque nom dit qui s'adapte à qui et ce que cela coûte. Dans ce kit, la carte n'est pas un dessin
rangé à côté du code : les relations sont déclarées dans `ddd-ts-kit.config.json`, un import
entre contextes est refusé sans relation déclarée, et `docs/context-map.md` est généré à partir
des déclarations.

## Amont et aval

Quand le contexte B a besoin de quelque chose du contexte A, A est **en amont** et B **en aval** :
les changements descendent le courant. L'amont peut casser l'aval en changeant ; l'inverse n'est
pas vrai. Le patron dit comment ce pouvoir est géré.

Dans le kit, l'aval nomme son amont et le patron :

```json
"availability": {
  "classification": "supporting",
  "upstreams": [
    { "context": "calendars", "relationship": "published-language" },
    { "context": "appointments", "relationship": "published-language" }
  ]
}
```

## Les patrons

| Patron | Qui s'adapte | Convient quand | Coûte |
|---|---|---|---|
| Langage publié | l'amont conçoit un contrat fait pour ses consommateurs | c'est le choix par défaut entre les contextes d'un même produit | l'amont doit versionner son contrat et le garder stable |
| Client-fournisseur | l'amont inscrit les besoins de l'aval dans son *backlog* | deux équipes, une organisation, l'aval a voix au chapitre | de la négociation et de la planification des deux côtés |
| Conformiste | l'aval prend le modèle de l'amont tel quel | l'amont ne s'adaptera pas, et son modèle est assez bon | le modèle de l'aval suit chaque changement de l'amont |
| Couche anticorruption | l'aval traduit à sa frontière | le modèle de l'amont est étranger, ancien ou instable | un traducteur à écrire, à tester et à maintenir |
| Service hôte ouvert | l'amont offre un seul protocole à de nombreux consommateurs | de nombreux avals, aucun particulier | une API publique à gouverner ; aucun consommateur n'a un ajustement sur mesure |
| Noyau partagé | deux contextes possèdent ensemble un petit modèle | un concept est vraiment identique et change en même temps | une propriété conjointe : aucun des deux côtés ne le change seul |
| Partenariat | deux équipes se coordonnent, réussissent ou échouent ensemble | deux contextes qui doivent évoluer de concert pendant un temps | une coordination constante ; pas d'amont clair |
| Chemins séparés | personne ne s'adapte : aucune intégration | le coût de l'intégration dépasse son bénéfice | de la duplication, et aucune donnée partagée |

![Les huit patrons de relation dessinés comme des paires de contextes : langage publié, un contrat versionné entre l'amont et l'aval ; client-fournisseur, les besoins de l'aval remontent dans le plan de l'amont ; conformiste, l'aval réutilise le modèle de l'amont ; couche anticorruption, un traducteur à la frontière de l'aval ; service hôte ouvert, un seul protocole pour de nombreux avals ; noyau partagé, un petit modèle possédé par deux contextes ; partenariat, deux contextes coordonnés sans amont ; chemins séparés, aucune intégration](../assets/diagrams/context-map-patterns.fr.svg)

### Langage publié

L'amont publie un contrat documenté et versionné : des types d'événements, des types de charge
utile (payload), des contrats de lecture. C'est le choix par défaut dans ce kit, et le seul code
qu'un autre contexte peut importer : le dossier `published-language/` de l'amont. Les événements
d'intégration y sont déclarés une fois, avec un schéma
([Événements du domaine et d'intégration](domain-and-integration-events.fr.md)). Dans l'exemple,
`appointments` publie `appointments.appointment.booked`, et `availability` et `notifications` le
consomment sans connaître l'agrégat `Appointment`.

### Client-fournisseur

L'aval est un client dont le fournisseur planifie les besoins. Ce patron convient à deux équipes
d'une même organisation aux priorités alignées. Il coûte des réunions : l'aval doit exprimer ses
besoins tôt, l'amont ne doit pas livrer un changement cassant sans prévenir. Si `notifications` a
besoin du canal préféré du client dans l'événement de réservation, une relation client-fournisseur
signifie que l'équipe d'`appointments` planifie cet ajout.

### Conformiste

L'aval renonce à traduire et utilise directement le modèle de l'amont. C'est économique et
honnête quand l'aval n'a pas de modèle qui mérite d'être protégé. `analytics` est conformiste
envers `appointments` : il stocke les événements tels qu'ils arrivent, et quand une charge utile
gagne un champ, analytics gagne une colonne. Le coût est que l'aval ne peut pas résister à un
changement de l'amont : ne l'utilisez que là où c'est acceptable.

### Couche anticorruption

L'aval protège son modèle par un traducteur. Dans le kit, il vit dans
`infrastructure/anti-corruption/` et se génère avec `generate acl`. `notifications` en utilise un
envers le fournisseur de courriel et de SMS : le fournisseur parle de « messages », de
« templates » et de statuts de livraison qui lui sont propres, et aucun de ces mots n'entre dans
le glossaire de notifications. Le coût est du vrai code, qui grandit avec la surface de l'amont :
ne traduisez que ce qui sert.

Un traducteur prend ce que le fournisseur envoie, avec ses noms et ses codes, et rend une valeur
du modèle de l'aval ; rien du vocabulaire du fournisseur ne passe au-delà :

<!-- checked sample -->
```ts
// notifications/infrastructure/anti-corruption/sms-provider.translator.ts

/** Un rapport de livraison exactement tel que le fournisseur l'envoie : ses noms, ses statuts. */
export interface SmsProviderReport {
  readonly message_sid: string;
  readonly status: 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  readonly error?: 'invalid_destination' | 'blocked_by_carrier' | 'unknown';
}

/** Comment notifications l'appelle, dans son glossaire : l'issue d'un rappel. */
export type ReminderOutcome =
  | { readonly kind: 'on-its-way' }
  | { readonly kind: 'reached' }
  | { readonly kind: 'unreachable'; readonly because: 'wrong-number' | 'refused' | 'unknown' };

export class SmsProviderTranslator {
  translate(report: SmsProviderReport): ReminderOutcome {
    switch (report.status) {
      case 'queued':
      case 'sent':
        return { kind: 'on-its-way' };
      case 'delivered':
        return { kind: 'reached' };
      case 'undelivered':
      case 'failed':
        return { kind: 'unreachable', because: this.reasonOf(report.error) };
    }
  }

  private reasonOf(error: SmsProviderReport['error']): 'wrong-number' | 'refused' | 'unknown' {
    if (error === 'invalid_destination') {
      return 'wrong-number';
    }

    return error === 'blocked_by_carrier' ? 'refused' : 'unknown';
  }
}
```

`generate acl notifications sms-provider` écrit cette classe, vide, avec des marqueurs
`TODO(domain)`, et une *spec* dont les entrées `it.todo` demandent de vrais exemples reçus du
fournisseur.

### Service hôte ouvert

L'amont définit un protocole ouvert à tous ceux qui en ont besoin, au lieu d'une intégration par
consommateur. Il va en général de pair avec un langage publié, qui est le vocabulaire du
protocole. Le fournisseur d'identité de l'exemple se comporte ainsi : OpenID Connect est son
protocole ouvert, et chaque application s'y conforme.

### Noyau partagé

Deux contextes partagent une petite partie du modèle, dans le code. Dans le kit, c'est
`src/shared-kernel/`, qui ne contient que ce qu'au moins deux contextes utilisent. Un objet-valeur
`TimeSlot` pourrait y vivre si `appointments` et `availability` entendent vraiment la même chose
par ce mot. C'est le plus couplant de tous les patrons : chaque changement demande l'accord des
deux propriétaires, donc le noyau doit rester petit, et un noyau qui ne cesse de grossir signale
qu'une frontière est mal placée.

Ses mots sont partagés aussi. `generate value-object shared-kernel TimeSlot --term "TimeSlot=<sens>"`
écrit `src/shared-kernel/time-slot.vo.ts`, sa *spec* à côté, et la ligne du terme dans
`src/shared-kernel/CONTEXT.md`, le glossaire sur lequel les deux contextes s'accordent ;
`generate error shared-kernel <Refusal> <factory>` écrit le refus d'une telle valeur.
`language/glossary-term` les nomme d'après ce glossaire, et tout autre rôle reste dans son
contexte : `generate aggregate shared-kernel ...` est refusé.

### Partenariat et chemins séparés

Evans en décrit deux de plus. **Partenariat** : deux équipes en dépendance mutuelle coordonnent
leur planification et intègrent en continu ; aucune n'est en amont. **Chemins séparés** : les
contextes ne sont pas intégrés du tout, et chacun répond seul à son besoin.

## Ce qu'accepte la configuration du kit

Six valeurs, pour `contexts.<name>.upstreams[].relationship` ([CONFIG.md](../CONFIG.fr.md)) :

`published-language` (par défaut), `customer-supplier`, `conformist`, `anti-corruption-layer`,
`open-host-service`, `shared-kernel`.

Pour le dire simplement :

- **Les chemins séparés n'ont pas de valeur**, parce qu'ils sont l'absence de relation déclarée.
  Deux contextes sans entrée `upstreams` entre eux ne peuvent pas s'importer l'un l'autre
  (`context/declared-relationship`), ce qui est exactement ce patron.
- **Le partenariat n'est pas modélisé.** La configuration est orientée (un aval nomme un amont)
  et `context/no-cycle` refuse la dépendance mutuelle. Deux contextes en partenariat doivent
  quand même choisir un sens dans la configuration, ou exprimer l'un des deux sens par un
  événement, et décrire le partenariat dans la partie écrite de la carte des contextes. L'outil
  n'en a aucune notion.
  Refuser le cycle est un choix de ce kit, pour que chaque contexte reste extractible, pas une
  règle du Domain-Driven Design : Evans accepte la dépendance mutuelle entre équipes. Quand deux
  contextes ont besoin l'un de l'autre, [Un cycle entre deux contextes](../guides/cycle-between-contexts.fr.md)
  pose trois questions avant de les fusionner : un langage ou deux, un événement pour un sens, un
  concept manquant. Des contextes fusionnés qui partagent un même langage restent lisibles en
  [modules du modèle](modules.fr.md).
- La valeur est une **étiquette avec un seul effet mécanique** : elle autorise l'import du
  langage publié de l'amont et apparaît sur la flèche du diagramme généré. Le kit n'impose pas
  le comportement qu'implique un patron. Déclarer `anti-corruption-layer` ne vérifie pas qu'un
  traducteur existe ; déclarer `customer-supplier` ne crée pas de réunion de planification.
  L'étiquette documente l'arrangement ; ce sont les personnes qui le tiennent vrai.

Quel que soit le patron, la mécanique entre deux contextes est la même dans ce kit : des imports
depuis `published-language/` seulement (`context/published-language-only`), des événements
d'intégration pour collaborer, et pour un besoin synchrone un port chez l'appelant avec un
adaptateur *gateway*.

![Ce qu'un contexte aval peut importer de son amont : availability importe le dossier published-language d'appointments, que la configuration déclare comme une relation published-language ; un import du domaine, de l'application ou de l'infrastructure d'appointments est refusé par context/published-language-only, et tout import sans relation déclarée par context/declared-relationship](../assets/diagrams/context-map-imports.fr.svg)

Au lieu d'aller chercher dans le modèle de l'amont :

```ts
// src/contexts/availability/application/...
import { Appointment } from '@/contexts/appointments/domain/aggregates/appointment.aggregate';
// context/published-language-only : l'agrégat d'appointments est désormais figé par availability
```

importez ce que l'amont a publié pour ses consommateurs, et rien d'autre :

```ts
// src/contexts/availability/application/...
import { appointmentBookedV1, type AppointmentBookedV1 } from '@/contexts/appointments/published-language';
```

Pour un besoin synchrone, l'aval déclare un port dans ses propres mots, et un adaptateur *gateway*
appelle le contrat de lecture que publie l'amont. Aujourd'hui l'appel reste dans le processus ;
quand l'amont tournera comme un service à part, seul l'adaptateur changera.
`generate gateway availability calendars OpeningTimes` écrit les trois fichiers ci-dessous (plus
un *fake* et une suite de contrat), et nomme le contrat de l'amont d'après le port *gateway* :

<!-- checked sample -->
```ts
import { Gateway } from '@ddd-ts-kit/kernel/declarations';

// calendars/published-language/opening-times.contract.ts : ce que calendars offre à la lecture
export interface WorkingInterval {
  readonly startsAt: string;
  readonly endsAt: string;
}

export abstract class OpeningTimesContract {
  abstract ofPractitioner(practitionerId: string, day: string): Promise<readonly WorkingInterval[]>;
}

// availability/application/ports/opening-times-gateway.port.ts : ce dont availability a besoin, dans ses mots
export abstract class OpeningTimesGateway {
  abstract openOn(practitionerId: string, day: string): Promise<readonly { readonly from: Date; readonly to: Date }[]>;
}

// availability/infrastructure/external/in-process-opening-times.gateway.ts : la seule classe qui
// connaît le contrat de calendars
@Gateway(OpeningTimesGateway)
export class InProcessOpeningTimesGateway implements OpeningTimesGateway {
  constructor(private readonly calendars: OpeningTimesContract) {}

  async openOn(practitionerId: string, day: string): Promise<readonly { readonly from: Date; readonly to: Date }[]> {
    const intervals = await this.calendars.ofPractitioner(practitionerId, day);

    return intervals.map((interval) => ({ from: new Date(interval.startsAt), to: new Date(interval.endsAt) }));
  }
}
```

## Choisir

![Choisir un patron : si les deux contextes n'ont pas besoin l'un de l'autre, chemins séparés, ne rien déclarer ; si le concept est identique et change en même temps, un petit noyau partagé ; si vous contrôlez l'amont ou pouvez l'influencer, langage publié au sein d'un même produit, ou client-fournisseur avec une autre équipe qui planifie avec vous ; sinon conformiste quand le modèle de l'amont est acceptable dans le vôtre, et une couche anticorruption quand il ne l'est pas](../assets/diagrams/context-map-choosing.fr.svg)

Un amont qui sert de nombreux consommateurs ajoute de son côté un service hôte ouvert. Le choix
revient au porteur du projet, et chaque patron autre que celui par défaut mérite une phrase de
justification dans la carte, et souvent un enregistrement de décision (ADR).

## La carte générée

`npx ddd-ts-kit docs` régénère `docs/context-map.md` entre des marqueurs
`<!-- ddd-ts-kit:context-map -->` :

- un diagramme Mermaid : un nœud par contexte, dont le style dépend de sa classification, une
  flèche par relation, de l'amont vers l'aval, étiquetée du nom du patron ;
- une table des contextes : la première phrase de la raison d'être de chacun, ses amonts, ses
  avals, ses événements publiés, et s'il est déployable seul.

Le texte hors des marqueurs est conservé. Le *skill* `document` dit quoi y écrire, et seulement
quand c'est vrai : un guide de lecture du flux métier principal, pourquoi les frontières débattues
ont été tracées où elles sont, pourquoi chaque patron autre que celui par défaut a été choisi et
ce qu'il coûte, et les tensions connues avec le signal qui déclencherait une séparation ou une
fusion. `docs --check` échoue en CI quand la partie générée est périmée, de sorte que la carte
ne peut pas s'écarter de la configuration.

## Limites et quand ne pas l'utiliser

- **La carte montre les relations déclarées, pas le couplage réel.** Deux contextes qui partagent
  des hypothèses par une convention de base de données, ou par de la logique dupliquée, sont
  couplés sans flèche.
- **Les systèmes externes ne sont pas des nœuds de la carte générée.** Seuls les contextes de la
  configuration y apparaissent. Un fournisseur d'identité ou un service de paiement se décrit
  dans la partie écrite et dans `docs/integration/README.md`.
- **Les noms des patrons sont des contrats sociaux.** Comme dit plus haut, le kit fait respecter
  la règle des imports et l'absence de cycles, rien de la façon dont les équipes se comportent.
- **La carte d'un seul contexte est vide**, et c'est très bien ainsi : ne découpez pas un modèle
  pour avoir quelque chose à dessiner.
- **Le noyau partagé est facile à détourner** pour contourner les frontières. Rien ne contraint
  ce que le noyau partagé importe (README de la CLI, « Limits ») : relisez-le en revue.

## Sources

- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, chapitre 14 « Maintaining Model
  Integrity » (la carte des contextes et les patrons de relation).
- Eric Evans, *Domain-Driven Design Reference*, 2015, section « Context Mapping for Strategic
  Design » (ajoute le partenariat), domainlanguage.com/ddd/reference.
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013, chapitre 3 « Context
  Maps ».
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapitre 4 « Integrating
  Bounded Contexts » (les groupes coopération, client-fournisseur et chemins séparés).

## Voir aussi

- [Un exemple détaillé : la carte des contextes de l'application de prise de rendez-vous](context-map-worked-example.fr.md)
- [Contexte délimité](bounded-context.fr.md)
- [Domaine et sous-domaines](domain-and-subdomains.fr.md)
- [Un cycle entre deux contextes](../guides/cycle-between-contexts.fr.md)
- [Événements du domaine et d'intégration](domain-and-integration-events.fr.md)
- [Versionnement des événements](event-versioning.fr.md)
- [Travail en équipe](../guides/team-workflow.fr.md)
- [Référence de la configuration](../CONFIG.fr.md)
- [Index des concepts](README.fr.md)
