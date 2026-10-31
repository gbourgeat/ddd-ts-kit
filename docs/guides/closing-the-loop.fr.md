[English](closing-the-loop.md) · **Français**
<!-- translation-of: closing-the-loop.md sha256:5e527ea629ba4b03 -->

# Boucler la boucle : d'une métrique sortie de sa bande à la prochaine story

**Résumé.** Un système en production nourrit le prochain changement : un script déterministe
surveille une métrique contre sa ligne de base, une configuration versionnée dit ce qu'un agent
peut faire à chaque bande (consigner, diagnostiquer en lecture seule, proposer), le diagnostic
s'écrit comme une intention ou un compte rendu d'incident, une personne trie, et la correction
part avec un test de régression que l'incident ne pourra plus passer. Cette page applique ce
patron à un projet ddd-ts-kit : les métriques que le kit émet déjà et les requêtes par
lesquelles commencer, un `bands.yaml` sur elles, ce qu'il faut à une exécution sans état, le
compte rendu d'incident que `story-scope --from` accepte comme origine d'une *story* de
correction, et ce qui arrive d'un canal de discussion. Le patron est la dernière étape du
[playbook du cycle de vie natif de l'IA d'Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf) ;
la part du kit est ce que l'agent lit et écrit, et la détection reste celle de l'équipe.

## La forme de la boucle

| Étape | Qui ou quoi | Artefact |
|---|---|---|
| détecter | un script de l'équipe : déterministe, testé unitairement, versionné, sans aucun modèle | la rupture : la métrique, la bande, la fenêtre |
| décider le palier | `bands.yaml`, versionné avec le script | consigner, diagnostiquer ou proposer |
| diagnostiquer | un agent, en lecture seule, avec des outils nommés, dans une exécution sans état | les preuves : les entrées d'audit, les traces, le déploiement dans la fenêtre |
| proposer | le même agent, par une *pull request* ou un *runbook* approuvé d'avance | `docs/architecture/intents/<slug>.md`, ou le résultat du *runbook* |
| trier | le responsable du service : corriger maintenant, planifier, écarter | l'intention acceptée, planifiée ou close ; un écart ajuste la bande |
| corriger | `/ddd-ts-kit:fix <code> docs/architecture/incidents/<id>.md` | une *spec* de régression verrouillée, le test permanent de l'incident |

La détection n'est jamais un agent : un script avec une ligne de base glissante (moyenne et
écart sur une fenêtre, les règles de Western Electric pour la dérive comme pour les pics)
répond de la même façon à chaque fois et se teste comme du code. Ce que le kit donne au script,
ce sont les métriques ; ce qu'il donne à l'agent, c'est le journal d'audit, les traces, la CLI
qui décrit le système, et deux *templates*.

## Trois ruptures par lesquelles commencer

Les noms ci-dessous sont ceux que le kit enregistre par son port `Metrics`
([observabilité](../concepts/observability.fr.md)) ; ce que montre votre entrepôt dépend de son
exportateur, lisez donc les noms là une fois avant d'écrire les requêtes.

| Rupture | Ce que le kit émet | Requête (Prometheus) | Bande de départ |
|---|---|---|---|
| un cas d'usage échoue plus qu'avant | `use_case_total{message, kind, outcome, error_code}` depuis `metricsMiddleware` de `@ddd-ts-kit/aspects`, une série par classe de commande ou de requête | `sum by (message) (rate(use_case_total{outcome="failure"}[5m])) / sum by (message) (rate(use_case_total[5m]))` | le ratio par message contre sa ligne de base sur 30 jours ; un refus métier est un échec avec son `error_code`, si bien qu'un message qui refuse par conception (un créneau déjà pris) lit le ratio sans les codes que le métier attend |
| le relais de l'outbox s'est arrêté | `outbox_pending`, `outbox_failed` et `outbox_dead`, des jauges que le relais de `main.ts` pose depuis `store.stats()` après chaque passage ; aucune jauge ne donne l'âge du plus ancien enregistrement en attente, que le script lit dans la table `outbox` | `min_over_time(outbox_pending[15m]) > 0 or outbox_dead > 0` (un arriéré qui ne s'est jamais vidé, ou un enregistrement qui a épuisé ses tentatives) ; l'âge : `SELECT extract(epoch FROM now() - min(created_at)) FROM messaging.outbox WHERE status = 'pending'` (en secondes ; `<schéma>.outbox` là où le projet l'a mise) | un enregistrement mort tout de suite ; un âge au-dessus de trois fois l'intervalle du relais, tenu sur deux relevés |
| un *job* a cessé de tourner | `scheduled_job_runs_total{job, context, status, error_code}` depuis `@ddd-ts-kit/scheduling`, `status="succeeded"` pour une exécution qui a tourné | `increase(scheduled_job_runs_total{job="notifications.send-reminders", status="succeeded"}[2h]) == 0 or absent(scheduled_job_runs_total{job="notifications.send-reminders", status="succeeded"})` (deux intervalles d'un *job* horaire) | aucun succès pendant deux intervalles, ce qui attrape toutes les façons dont un *job* s'arrête, là où une alerte sur les échecs ne le fait pas |

`dependency_call_total{class, method, kind, context, outcome}` (l'aspect `timed`) et
`circuit_breaker_state` viennent ensuite : une dépendance qui échoue ou un disjoncteur qui
s'ouvre explique une rupture d'un cas d'usage plus souvent que le cas d'usage lui-même.

## `bands.yaml`, trois paliers

```yaml
# Versionné avec le script de détection ; un écart au tri ajuste une bande ici, dans une pull request.
baseline: rolling_30d
rules: western_electric
metrics:
  use_case_failure_ratio:        # par message, 5 minutes, depuis use_case_total
    tiers:
      1sigma: { action: log }
      2sigma:
        action: diagnose
        tools: "Read,Grep,Bash(npx ddd-ts-kit describe *),Bash(npx ddd-ts-kit list *),Bash(gh run view *)"
      3sigma: { action: propose, routes: [intent, runbook:rollback-deploy] }
  outbox_oldest_pending_age_seconds:   # depuis la table outbox
    tiers:
      1sigma: { action: log }
      2sigma: { action: diagnose, tools: "Read,Grep,Bash(npx ddd-ts-kit describe *)" }
      3sigma: { action: propose, routes: [runbook:restart-relay, intent] }
  scheduled_job_success_absent:        # par job, deux intervalles, depuis scheduled_job_runs_total
    tiers:
      1sigma: { action: log }
      2sigma: { action: diagnose, tools: "Read,Grep,Bash(npx ddd-ts-kit describe *)" }
      3sigma: { action: propose, routes: [intent] }
```

- **log** écrit la rupture là où l'équipe la lit, rien d'autre.
- **diagnose** lance l'agent en lecture seule, avec les outils nommés et aucun autre : le dépôt
  au *commit* déployé, `npx ddd-ts-kit describe <context>` pour ce que tient le
  contexte, le journal d'audit de la fenêtre par la route de recherche que la plateforme expose
  sous sa propre permission ([journal d'audit](../concepts/audit-trail.fr.md), appelée avec un
  jeton en lecture seule que l'exécution reçoit pour cela), les traces par identifiant de
  corrélation, le dernier déploiement dans la fenêtre. Sa sortie est un diagnostic, pas un
  changement.
- **propose** laisse l'agent agir par l'une de deux portes : la porte de revue, une intention
  écrite depuis le *template* de la *skill* story (`plugin/skills/story/intent-template.md`,
  avec `## Evidence` tenant la métrique, la fenêtre, les entrées d'audit et le déploiement dans
  la fenêtre), ouverte en *pull request* vers `docs/architecture/intents/`, que le responsable
  accepte ou clôt comme toute intention
  ([parcours d'une story](story-workflow.fr.md#doù-vient-une-story)) ; ou un *runbook* que
  l'équipe a approuvé d'avance, par son nom, répété, avec un retour arrière que l'agent peut
  déclencher et ne peut pas inventer.

## Ce qu'il faut à une exécution sans état

Chaque exécution part de rien et ne laisse rien que son artefact : le dépôt, en lecture seule,
au *commit* déployé ; l'entrepôt de métriques, avec un jeton qui lit et n'écrit jamais ; la CLI
du projet (`npm ci`, puis `npx ddd-ts-kit describe`, `list`, `check` au besoin) ; la recherche
d'audit et les traces, en lecture seule ; la permission d'ouvrir une *pull request* sur la
branche de l'intention, et rien d'autre. Aucun identifiant de production, aucun accès en
écriture à une base de données, aucun outil de déploiement sauf si un *runbook* le nomme.
L'exécution est isolée comme toute session d'agent : voir
[isoler les agents de code](agent-sandbox.fr.md). Le déclencheur est une planification, un
*webhook* de l'outil d'alerte ou un *cron* ; deux exécutions sur la même rupture écrivent le
même diagnostic, et c'est le but.

## Le compte rendu d'incident

Celui qui traite l'incident (une personne, le répondeur du canal, le palier propose) écrit
`docs/architecture/incidents/<id>.md` depuis `plugin/skills/story/incident-template.md` : ce
qui a été observé (le symptôme, la métrique, la bande, la fenêtre), les preuves (la requête et
sa valeur, le déploiement dans la fenêtre, les entrées d'audit, les traces, les lignes de
journal), la cause par son nom métier quand elle est connue (le cas d'usage, l'agrégat,
l'invariant, la dépendance ; `unknown` sinon, avec ce qui a été écarté), ce qui a été fait (un
retour arrière, un *runbook*, une correction manuelle, rien, et quand la métrique est revenue),
et la suite. C'est le fichier des leçons que la prochaine investigation lit en premier, et
l'origine de la correction :

```text
npx ddd-ts-kit story-scope FIX-412 --kind fix --from docs/architecture/incidents/INC-2026-10-18-checkout.md
```

`story-scope` accepte un compte rendu d'incident tel quel (une intention doit d'abord être
`accepted`), écrit l'origine dans `.ddd-ts-kit/story.json`, et `## Origin` de la *story* de
correction renvoie à l'incident. La correction est `/ddd-ts-kit:fix` : sa *spec* de régression
est écrite d'abord, échoue sur l'incident, est verrouillée et tenue par la garde, et c'est le
test permanent de l'incident ; la *story* de la correction la liste sous `## Regression`, et
`npx ddd-ts-kit story <code>` lit une correction derrière cette section au lieu de
`test/acceptance/`. Un second incident de la même classe (le même `message` ou le même
`error_code` qu'un compte rendu antérieur, nommé sous `What is next`) est ce que la boucle doit
rendre rare.

## Ce qui arrive d'un canal de discussion

Un agent dans le canal d'incident, sous sa propre identité, appartient à la plateforme : le kit
n'en livre aucun. Ce qu'il dit entre dans la boucle du kit de la même façon qu'une rupture : une
correction bornée devient une *story* de correction, `/ddd-ts-kit:fix <code>`, avec le fil pour
origine (le compte rendu d'incident cite le résumé et le lien du fil, et le compte rendu est le
`--from`) ; un changement plus large devient une intention, écrite depuis le *template* avec le
résumé du fil pour problème et l'auteur de la demande pour auteur ; le post-mortem est le
compte rendu d'incident ci-dessus, écrit dans `docs/architecture/incidents/`. L'agent du canal
vérifie que la métrique est revenue dans sa bande avec les mêmes requêtes que le palier
diagnose, et rien de ce qu'il écrit dans le canal ne remplace le compte rendu dans le dépôt.

## Ce que le kit ne fait pas

- Pas de script de détection ni de planificateur : déterministes, testés, propres à l'entrepôt
  de métriques et à la plateforme ; cette page donne les requêtes et la forme, et une équipe
  les écrit en une journée.
- Pas de *runbook* : un retour arrière dépend de la plateforme cible ; le kit s'arrête à l'image.
- Pas de répondeur de canal : l'identité, le canal et les outils sont ceux de la plateforme.
- Pas de jauge pour l'âge du plus ancien enregistrement en attente de l'outbox : les jauges
  donnent la profondeur, le script lit l'âge dans la table.
- Aucune fusion décidée par un constat : le palier propose ouvre une *pull request* ou lance un
  *runbook* approuvé d'avance ; une personne accepte l'intention et un responsable du code
  approuve la correction.

## Voir aussi

- [Observabilité](../concepts/observability.fr.md), [Journal d'audit](../concepts/audit-trail.fr.md)
- [Parcours d'une story](story-workflow.fr.md), [Isoler les agents de code](agent-sandbox.fr.md)
- [Quelle commande, quand](commands.fr.md)
