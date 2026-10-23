[English](many-dependencies.md) · **Français**
<!-- translation-of: many-dependencies.md sha256:0de3626dbb093a8d -->

# Un gestionnaire aux nombreuses dépendances

**Résumé.** Un gestionnaire (handler) dont le constructeur prend beaucoup de ports, de
*repositories* et de *gateways* présente une odeur que Mark Seemann appelle la surinjection par le
constructeur (constructor over-injection) : un signe, pas une faute. Le kit ne fixe aucune limite
au nombre, parce qu'aucune référence n'en donne et qu'un nombre invite des façades faites
seulement pour le faire taire. Ce guide est plutôt un ordre de diagnostic : lisez ce que fait
chaque dépendance, et chaque remède a déjà sa place dans l'arborescence canonique. Diviser le
contexte en [modules du modèle](../concepts/modules.fr.md) n'aide pas ici : un gestionnaire garde
ses dépendances quel que soit son dossier.

## Une odeur, pas une règle

Seemann traite le nombre d'arguments du constructeur comme une indication : « This is only
guidance », et « There could be cases where it's genuinely valid to have dozens of dependencies »
(« On Constructor Over-injection », 2018). La cause profonde, quand il y en a une, est en général
une violation du principe de responsabilité unique : le gestionnaire fait plus d'une chose.
Compter traiterait le symptôme ; la question est ce que font les dépendances.

## Diagnostiquer, dans cet ordre

Lisez le constructeur, puis chaque dépendance tour à tour, et demandez ce que le gestionnaire en
fait.

| Ce que font les dépendances | Remède | Où |
|---|---|---|
| Journalisation, cache, droits, nouvelles tentatives | un décorateur ou une chaîne de responsabilité : « better addressed with Decorators or the Chain of Responsibility pattern » (Seemann) | les *middlewares* des bus, les décorateurs des adaptateurs ([préoccupations transverses](../concepts/observability.fr.md), [résilience](../concepts/resilience.fr.md)) |
| Effets qui suivent la décision (notifier, indexer, recalculer) | un événement du domaine et son gestionnaire (Evans, Domain Events : « We keep the aggregates internally consistent at all times, while making other changes asynchronously ») | `application/event-handlers/` ([événements du domaine et d'intégration](../concepts/domain-and-integration-events.fr.md)) |
| Lectures d'un autre contexte | une projection locale alimentée par ses événements d'intégration (Evans, Domain Events) | `application/projections/` |
| Étapes réparties dans le temps | un gestionnaire de processus (Hohpe et Woolf, *Enterprise Integration Patterns*, 2003) | `application/processes/` ([sagas et gestionnaires de processus](../concepts/sagas-and-process-managers.fr.md)) |
| Lectures qui forment ensemble un seul concept | un port nommé dans le langage omniprésent, dont l'adaptateur compose les sources : un Facade Service, quand les arguments « fall in two or more natural clusters » (Seemann, « Refactoring to Aggregate Services », 2010) | `application/ports/` ([ports et composition](../concepts/ports-and-composition.fr.md)) |
| Une décision sur plusieurs agrégats | un service du domaine, sans état et sans entrée-sortie (Evans, Services : « Give the service a name, which also becomes part of the ubiquitous language ») | `domain/services/` ([briques du domaine](../concepts/domain-building-blocks.fr.md)) |
| Encore trop | le gestionnaire fait deux choses : scindez le cas d'usage (responsabilité unique) | deux cas d'usage, chacun avec sa permission |

Une façade qui regroupe des dépendances sans nommer un concept du langage n'est pas un remède :
elle déplace le constructeur ailleurs et cache la seconde responsabilité. Un port mérite sa place
quand son nom est un terme du glossaire.

## Ce que le kit n'ajoute pas

| Pas ajouté | Pourquoi |
|---|---|
| une règle avec un maximum de dépendances | Seemann : « only guidance ». Un nombre serait atteint par de fausses façades |
| un rôle `application/services/` | les six emplacements ci-dessus couvrent chaque cas, et un service applicatif partagé tend à devenir l'endroit où va tout le reste |

`clean/function-size` ne compte pas les paramètres d'un constructeur : un constructeur liste les
dépendances qu'on lui donne, ce qui relève du câblage, et c'est ce guide qui lit leur nombre.

## Dans une revue

L'agent `architecture-reviewer` parcourt la table ci-dessus pour un constructeur aux nombreuses
dépendances et nomme le remède qui s'applique, avec l'emplacement où il va. Il ne compte jamais.

## Sources

- Mark Seemann, « On Constructor Over-injection », 2018, blog.ploeh.dk.
- Mark Seemann, « Refactoring to Aggregate Services », 2010, blog.ploeh.dk.
- Eric Evans, *Domain-Driven Design Reference*, Domain Language, 2015 : Services, Domain Events.
- Gregor Hohpe et Bobby Woolf, *Enterprise Integration Patterns*, Addison-Wesley, 2003
  (Process Manager).

## Voir aussi

- [Un cycle entre deux contextes](cycle-between-contexts.fr.md)
- [Modules du modèle](../concepts/modules.fr.md)
- [Événements du domaine, services du domaine, repositories et fabriques](../concepts/domain-building-blocks.fr.md)
- [Ports et composition](../concepts/ports-and-composition.fr.md)
- [Référence de l'architecture](../ARCHITECTURE.fr.md)
