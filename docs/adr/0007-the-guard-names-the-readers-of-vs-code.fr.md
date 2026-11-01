[English](0007-the-guard-names-the-readers-of-vs-code.md) · **Français**
<!-- translation-of: 0007-the-guard-names-the-readers-of-vs-code.md sha256:3c7235a6c81dd6c6 -->

# ADR-0007 : la garde nomme les lecteurs de VS Code

## Décision

VS Code lance les *hooks* du *plugin* sans *matcher* : les *hooks* d'écriture de la garde tournent donc sur chaque outil de son chat. La garde nomme les outils qui ne font que lire, par les noms que le chat donne à ses *hooks* dans copilot-chat 0.72, lus dans le manifeste de cette extension et dans les noms que son code donne à chaque outil : `read_file`, `view_image`, `list_dir`, `file_search`, `grep_search`, `semantic_search`, `search_workspace_symbols`, `get_errors`, `get_changed_files`, `read_project_structure`, `copilot_getNotebookSummary`, `read_notebook_cell_output`, `test_search`, `fetch_webpage`, `github_repo`, `github_text_search`, `get_vscode_api`, `search_subagent`, `explore_subagent`, `resolve_memory_file_uri`, et `memory` quand sa commande est `view`. Un appel de l'un d'eux n'écrit rien, quel que soit le champ qui nomme un fichier : `path`, `filePath` ou `file_path`. Tout autre nom est lu comme avant : un `file_path` ou un `path` est une écriture, et `filePath` en est une pour les outils qui écrivent.

## Pourquoi

Un lecteur pris pour un écrivain est un refus à tort. `list_dir` nomme son dossier dans `path`, le champ que la garde lit pour une écriture : un *worker* qui listait un dossier hors de son contexte était refusé. À l'inverse, un écrivain pris pour un lecteur est une écriture que la garde ne juge jamais.

Une liste d'écrivains échoue ouverte. Un outil qui écrit, ajouté dans une version suivante du chat, n'y serait pas, et ses écritures passeraient sans être jugées jusqu'à ce que la liste rattrape. Une liste de lecteurs échoue fermée. Un lecteur ajouté plus tard est jugé comme une écriture, ce qui coûte un refus à tort, dit dans la raison et vu tout de suite, jusqu'à ce qu'il soit nommé. La garde est un guide, mais entre un refus qui se voit et une écriture qui ne se voit pas, elle prend le refus.

`memory` lit et écrit, sa commande décide donc : `view` lit, et `create`, `str_replace`, `insert`, `delete` et `rename` restent jugés comme avant.

## Ce que cela coûte

La liste suit le chat. Un lecteur qu'elle n'a pas reçoit encore le refus à tort que retire cet enregistrement, et une version qui renomme un outil ramène le refus jusqu'à ce que la liste soit mise à jour. Un outil nommé ici qui se mettrait à écrire dans une version suivante écrirait sans être jugé. C'est le risque que la liste d'écrivains prend pour chaque nouvel outil ; ici, elle ne le prend que pour un outil qui change de nature, ce que dirait le journal des versions du chat.

## Ce qui la renverserait

Un hôte qui applique les *matchers* du *plugin*, comme Claude Code, pour que les *hooks* d'écriture tournent sur les outils qui écrivent et sur rien d'autre. Ou un champ de l'entrée d'un *hook* qui dise si l'outil écrit.
