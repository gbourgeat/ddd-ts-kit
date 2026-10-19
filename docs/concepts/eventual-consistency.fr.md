[English](eventual-consistency.md) · **Français**
<!-- translation-of: eventual-consistency.md sha256:e89f171d8775d363 -->

# La cohérence à terme, expliquée à un responsable produit

**Résumé.** Dans une application découpée en contextes délimités, un changement est vrai
immédiatement dans le contexte qui l'a fait et devient vrai dans les autres un instant plus
tard, quand ils ont traité l'événement qui l'annonce. Pendant cet instant, deux écrans peuvent
ne pas être d'accord. C'est la cohérence à terme (eventual consistency). Ce n'est pas un défaut à
cacher mais une propriété à concevoir : décider ce qui doit être vrai tout de suite, combien de
temps « un instant » peut durer, ce que l'utilisateur voit entre-temps et ce qui se passe quand
la seconde étape échoue. Cette page s'adresse aux responsables produit et aux designers autant
qu'aux développeurs, et s'appuie d'un bout à l'autre sur l'application de prise de rendez-vous.

## L'idée en une image

Un client réserve un créneau. `appointments` enregistre le rendez-vous tout de suite.
`availability` (la liste des créneaux libres), `notifications` (le rappel) et `analytics` (les
chiffres d'occupation) l'apprennent par un événement.

![Une séquence dans le temps : le client réserve mardi 10:00, appointments répond « réservé » tout de suite, puis la fenêtre de cohérence s'ouvre pendant qu'availability retire le créneau et que notifications planifie le rappel à partir de l'événement appointments.appointment.booked ; la fenêtre se referme quand tous les contextes sont d'accord](../assets/diagrams/eventual-consistency-window.fr.svg)

Une comparaison de tous les jours : un virement bancaire. Votre solde baisse immédiatement ; le
bénéficiaire voit l'argent plus tard. Personne n'appelle cela un bogue, parce que le délai est
connu et que le relevé indique « en cours ».

## Ce que cela donne dans le produit

| Situation | Ce que l'utilisateur peut voir | Pourquoi |
|---|---|---|
| Deux clients regardent le même créneau libre | tous deux voient mardi 10:00 comme libre ; le second à confirmer est refusé | la liste des créneaux libres est indicative et a un instant de retard ; la réservation elle-même est vérifiée tout de suite |
| Un client réserve, puis ouvre la liste des créneaux libres | pendant une seconde, le créneau qu'il vient de prendre est encore affiché | `availability` n'a pas encore traité l'événement |
| Un praticien ajoute une absence | un créneau compris dans l'absence reste réservable un instant dans la liste | `availability` apprend l'absence par un événement de `calendars` |
| Un client réserve | le message de confirmation arrive quelques secondes plus tard | `notifications` réagit à l'événement |
| Un responsable ouvre le tableau de bord d'occupation | la dernière réservation du jour manque | `analytics` est alimenté par des événements, parfois par lots |
| Le fournisseur d'e-mails est en panne | la réservation réussit ; la confirmation arrive quand le fournisseur est revenu | les deux étapes sont indépendantes, à dessein |

La dernière ligne est le bénéfice. Si la réservation et l'envoi de la confirmation formaient une
seule opération indivisible, une panne du fournisseur d'e-mails arrêterait toutes les
réservations.

## Ce qui reste immédiatement cohérent

Tout n'est pas à terme. À l'intérieur d'un agrégat, les règles tiennent à chaque instant, dans
une transaction :

- **Pas de double réservation.** Deux clients qui confirment le même créneau à la même
  milliseconde : exactement un réussit, l'autre reçoit « ce créneau vient d'être pris ». La règle
  est gardée là où le rendez-vous est écrit, par l'agrégat et une contrainte de base de données,
  jamais par la liste des créneaux libres.
- **Un rendez-vous annulé ne peut pas être déplacé.**
- **Une annulation est acceptée ou refusée selon le délai d'annulation, tout de suite.**

La question de conception est donc : *quelles règles ne doivent jamais être vues enfreintes,
même une seconde ?* Celles-là appartiennent à un agrégat dans un contexte. Tout le reste peut
suivre.

Dans le code, la différence tient à l'endroit où la vérification lit. Au lieu d'interroger la
projection d'un autre contexte, qui a un instant de retard :

```ts
// appointments, gestionnaire de BookAppointment : la règle repose sur des données qui peuvent dater d'une seconde
if (!(await availabilityGateway.isOpen(practitionerId, slot))) {
  throw SlotTaken.forPractitioner(practitionerId, slot.startsAt);
}
```

décidez-en là où le rendez-vous est écrit, contre les rendez-vous lus dans la même transaction,
avec une contrainte d'unicité derrière : l'exemple de code de [Contexte
délimité](bounded-context.fr.md#lexemple--où-vit-linterdiction-de-la-double-réservation-) le
montre.

## Les questions à trancher pour chaque flux entre contextes

1. **Combien de temps la fenêtre peut-elle durer ?** « Quelques secondes » pour le rappel ;
   « moins d'une seconde » pour la liste des créneaux libres ; « quelques minutes » pour les
   statistiques. Cela devient un chiffre surveillé : l'âge du plus ancien événement non traité.
2. **Que voit l'utilisateur pendant la fenêtre ?** Voir les formulations types ci-dessous.
3. **Et si la seconde étape échoue pour de bon ?** Le rappel ne peut pas être planifié parce que
   le client n'a pas de numéro de téléphone. Est-ce une alerte au support, un message au client,
   rien ?
4. **Une étape ultérieure défait-elle parfois une étape antérieure ?** Si un paiement était exigé
   et échouait après la réservation, il faudrait annuler la réservation : une compensation,
   visible de l'utilisateur. Voir [Sagas et gestionnaires de
   processus](sagas-and-process-managers.fr.md).
5. **La même chose peut-elle arriver deux fois ?** Les événements peuvent être livrés deux fois ;
   la conception doit rendre le second inoffensif (un rappel, pas deux). Voir [Livraison et
   idempotence](delivery-and-idempotency.fr.md).
6. **L'ordre compte-t-il ?** Un déplacement et une annulation qui arrivent dans le mauvais ordre
   ne doivent pas rouvrir un créneau. Les événements ne sont pas ordonnés par défaut.

## Les motifs d'interface qui rendent la fenêtre acceptable

| Motif | Exemple |
|---|---|
| Dire ce qui est vrai maintenant, promettre le reste | « Votre rendez-vous est réservé. Une confirmation est en route. » |
| Montrer l'état de la source après une écriture | après la réservation, afficher le rendez-vous renvoyé par `appointments`, pas une liste rafraîchie d'`availability` |
| Appliquer localement la modification de l'utilisateur lui-même | retirer de la liste à l'écran le créneau que le client vient de réserver, sans attendre la liste du serveur |
| Formuler les refus comme des événements normaux | « Ce créneau vient d'être pris. Voici les plus proches. » plutôt qu'une page d'erreur |
| Dater les données dérivées | « Occupation à 14:05 » sur le tableau de bord des statistiques |
| Nommer les états en attente | « Rappel planifié » et non « Rappel envoyé » |
| Ne jamais promettre à partir d'une lecture indicative | la liste dit « disponible », le bouton dit « Demander ce créneau », la réponse confirme |

Ce qu'il ne faut pas faire : supprimer le délai en faisant lire chaque contexte par chaque écran,
de façon synchrone. L'application tombe alors dès qu'une partie tombe, et les contextes ne sont
plus indépendants.

## Pour les développeurs : d'où vient la fenêtre

![Le chemin d'un événement d'intégration : une transaction enregistre l'agrégat et l'enregistrement de l'outbox, le relais publie après la validation, le broker le met en file pour chaque consommateur, le consommateur d'availability met à jour sa projection ; sous chaque étape, ce qui allonge la fenêtre et ce qu'il faut mesurer](../assets/diagrams/eventual-consistency-pipeline.fr.svg)

- L'événement est stocké dans l'outbox avec le changement d'état, et un relais le publie ensuite :
  l'intervalle du relais, ou son signal de réveil, fixe le plancher de la fenêtre ([Outbox
  transactionnelle](transactional-outbox.fr.md)).
- Le consommateur le traite dans sa propre transaction, après d'éventuelles nouvelles
  tentatives : un consommateur en échec allonge la fenêtre, jusqu'à une file de rejet qui exige
  un opérateur.
- Une projection telle que les créneaux libres d'`availability` est un modèle de lecture
  alimenté de cette façon ([CQRS tel qu'il est employé ici](cqrs.fr.md)).
- La fenêtre de cohérence à terme de chaque flux entre contextes est écrite dans
  `docs/integration/README.md`, à côté de son diagramme de séquence, et un contexte qui s'appuie
  sur une projection le dit dans son `CONTEXT.md` (les *skills* `document` et `extract-service`
  demandent les deux).

Pour mesurer la fenêtre : l'âge du plus ancien enregistrement en attente dans l'outbox côté
producteur, la profondeur ou le retard de chaque consommateur sur le *broker*, et les
destinations de rejet, qui doivent être vides.

### Doublons et désordre dans une projection

Les questions 5 et 6 ci-dessus ont une réponse courte dans le code. Une ligne d'un modèle de
lecture retient l'événement qui l'a modifiée en dernier (son `EventStamp`), et un événement
entrant ne modifie la ligne que s'il est plus récent (`isNewer`). Un doublon porte le même
tampon, un événement en retard un tampon plus ancien : ni l'un ni l'autre ne change rien.
`ReadModelStore.upsertIfNewer` fait cette comparaison à chaque écriture :

<!-- checked sample -->
```ts
import { ReadModelStore, stampOf, type IntegrationEvent } from '@ddd-ts-kit/kernel';

// availability : une ligne par créneau, alimentée par les événements d'appointments.
interface OpenSlotRow {
  readonly slotId: string;
  readonly open: boolean;
}

export abstract class OpenSlots extends ReadModelStore<OpenSlotRow> {}

type SlotEvent = IntegrationEvent<{ readonly slotId: string }>;

// Une réservation ferme le créneau, une annulation le rouvre. Un doublon, ou une annulation
// livrée après une réservation ultérieure du même créneau, n'est pas plus récent que ce que
// tient la ligne : l'écriture est sautée et le créneau reste tel que le dit le fait le plus
// récent.
export async function project(slots: OpenSlots, event: SlotEvent, open: boolean): Promise<void> {
  const { slotId } = event.payload;

  await slots.upsertIfNewer(slotId, stampOf(event), () => ({ slotId, open }));
}
```

L'ordre par instant repose sur l'horloge du producteur ; quand l'amont fournit une version par
clé, `stampOf(event, version)` la porte et l'ordre ne dépend plus des horloges. Les projections
du kit sont écrites de cette façon ([CQRS tel qu'il est employé ici](cqrs.fr.md)).

## Limites et cas où s'en passer

- **Ne l'utilisez pas pour un invariant.** Si le métier ne peut pas tolérer de voir la règle
  enfreinte, même brièvement (double réservation, survente d'une place limitée, un solde qui
  devient négatif), la règle appartient à un agrégat et à une transaction. Un verrou ou un
  « vérifier puis agir » entre contextes n'en tient pas lieu.
- **Ne l'utilisez pas pour répondre à la requête qui l'a déclenchée.** Un utilisateur qui doit
  voir le résultat de l'étape deux dans la réponse de l'étape une décrit un seul cas d'usage, ou
  a besoin d'un appel synchrone avec un comportement déclaré quand l'autre côté est en panne.
- **« À terme » n'a pas de borne supérieure en soi.** Sans surveillance ni alertes sur la
  fenêtre, un consommateur arrêté est remarqué par les utilisateurs.
- **Elle déplace la complexité vers les bords.** Formulations, états en attente, compensations
  et procédures de support sont un vrai travail dont une conception immédiatement cohérente n'a
  pas besoin. Dans une petite application à un seul contexte, il n'y a rien à rendre cohérent à
  terme.
- **Relire sa propre écriture dans une projection peut dérouter les utilisateurs**, à moins que
  l'interface ne s'en charge (voir les motifs ci-dessus).

## Sources

- Werner Vogels, « Eventually Consistent », Communications of the ACM, 2009,
  https://www.allthingsdistributed.com/2008/12/eventually_consistent.html
- Pat Helland, « Life beyond Distributed Transactions: an Apostate's Opinion », CIDR 2007.
- Vaughn Vernon, « Effective Aggregate Design », partie 2, 2011 (cohérence à terme entre
  agrégats ; « whose job is it? »), https://www.dddcommunity.org/library/vernon_2011/
- Vaughn Vernon, Implementing Domain-Driven Design, Addison-Wesley, 2013, chapitre 10.
- Martin Kleppmann, Designing Data-Intensive Applications, O'Reilly, 2017, chapitres 5 et 9.
- Sam Newman, Building Microservices, 2e édition, O'Reilly, 2021, chapitre 6 (workflow).

## Voir aussi

- [Agrégats](aggregates.fr.md)
- [Invariants, permissions et validation](invariants-permissions-validation.fr.md)
- [Événements du domaine et d'intégration](domain-and-integration-events.fr.md)
- [Outbox transactionnelle](transactional-outbox.fr.md)
- [Livraison et idempotence](delivery-and-idempotency.fr.md)
- [Sagas et gestionnaires de processus](sagas-and-process-managers.fr.md)
- [CQRS tel qu'il est employé ici](cqrs.fr.md)
