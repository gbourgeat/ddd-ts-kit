[English](cycle-between-contexts.md) · **Français**
<!-- translation-of: cycle-between-contexts.md sha256:8aa91be6d22a69a3 -->

# Un cycle entre deux contextes

**Résumé.** Deux contextes qui ont besoin l'un de l'autre forment un cycle, et `context/no-cycle`
le refuse. Refuser le cycle est un choix de ce kit, pour que chaque contexte reste extractible,
pas une règle du Domain-Driven Design : Evans décrit Partnership, deux équipes qui dépendent l'une
de l'autre et se coordonnent. Fusionner les deux contextes fait disparaître le refus, et rend
souvent un contexte trop grand pour être tenu en tête. Avant de fusionner, posez trois questions,
dans cet ordre : un langage ou deux ; un sens peut-il devenir un événement ; un concept
manque-t-il.

## Pourquoi le kit refuse le cycle

La configuration est orientée : un contexte aval nomme son amont, et la
[carte des contextes](../concepts/context-map.fr.md) générée trace la flèche. Un cycle signifie
qu'aucun des deux contextes ne peut être modifié, testé ou déployé sans l'autre, ce que
[`context/extractable`](../ARCHITECTURE.fr.md#3-règles-de-dépendance) et le
[monolithe modulaire](../concepts/modular-monolith.fr.md) cherchent à empêcher.

Evans accepte bien la dépendance mutuelle, entre équipes : Partnership, « Institute a process for
coordinated planning of development and joint management of integration » (*Domain-Driven Design
Reference*, 2015). C'est une relation entre personnes, pas un agencement du code. Le kit n'a
volontairement pas de valeur `partnership` ; deux équipes en partenariat choisissent quand même un
sens dans le code, et décrivent leur partenariat dans la partie écrite de la carte des contextes.

## Trois questions, dans cet ordre

### 1. Un langage, un modèle ?

Lisez les deux glossaires côte à côte. Si les mêmes mots veulent dire les mêmes choses, et que les
règles d'une partie ont sans cesse besoin des faits de l'autre dans la même transaction, les deux
sont un seul modèle : fusionnez-les en un contexte, et divisez-le en
[modules du modèle](../concepts/modules.fr.md) pour qu'il reste lisible. Evans place des
sous-domaines dans des modules d'un seul modèle (Generic Subdomains : « place them in separate
modules » ; Abstract Core : « modules defined by subdomain »).

```bash
npx ddd-ts-kit generate module scheduling waitlist --purpose "..."
npx ddd-ts-kit move-to-module scheduling waitlist domain/aggregates/waitlist.aggregate.ts application/commands/join-waitlist
```

Si un mot change de sens entre eux, ce sont deux contextes : passez à la question 2.

### 2. Sinon, un sens peut-il devenir un événement ?

En général, un sens est une décision et l'autre une réaction. Le contexte qui décide est en amont
et publie un événement d'intégration ; l'autre réagit, et garde ce dont il a besoin dans une
projection locale (Evans, Domain Events : « We keep the aggregates internally consistent at all
times, while making other changes asynchronously »). L'import qui créait le cycle disparaît,
remplacé par un abonnement.

```bash
npx ddd-ts-kit generate integration-event calendars Calendar Closed
npx ddd-ts-kit generate integration-handler scheduling calendars calendars.calendar.closed
```

Voir [Événements du domaine et événements d'intégration](../concepts/domain-and-integration-events.fr.md)
et [La cohérence à terme](../concepts/eventual-consistency.fr.md) : la réaction arrive un instant
plus tard, et le métier doit accepter ce délai.

### 3. Sinon, un concept manque-t-il ?

Quand les deux sens sont des décisions qui exigent une cohérence immédiate, les deux contextes se
disputent souvent un concept qui n'appartient à aucun des deux : le « concept négligé » du patron
Modules (« look for a way to change the model to disentangle the concepts, or an overlooked
concept that might be the basis of a module »). Nommez-le, confiez-le à l'un des contextes ou à un
troisième, et les deux anciens contextes deviennent ses contextes aval.

## Ce qu'il ne faut pas faire

| Pas ceci | Pourquoi |
|---|---|
| fusionner sans la question 1 | un contexte à deux langages devient trop grand et son glossaire se contredit |
| déclarer les deux amonts et faire taire `context/no-cycle` | les deux contextes ne peuvent plus être extraits, et la dérogation cache une question de conception |
| un noyau partagé qui grossit pour tenir ce dont les deux ont besoin | le noyau devient un troisième contexte que personne ne possède |

## Sources

- Eric Evans, *Domain-Driven Design Reference*, Domain Language, 2015 : Partnership, Domain
  Events, Modules, Generic Subdomains, Abstract Core.
- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, chapitre 14 (Maintaining Model
  Integrity).

## Voir aussi

- [Carte des contextes](../concepts/context-map.fr.md)
- [Contexte délimité](../concepts/bounded-context.fr.md)
- [Modules du modèle](../concepts/modules.fr.md)
- [Un gestionnaire aux nombreuses dépendances](many-dependencies.fr.md)
- [Quand extraire un microservice, et quand ne pas le faire](when-to-extract-microservices.fr.md)
