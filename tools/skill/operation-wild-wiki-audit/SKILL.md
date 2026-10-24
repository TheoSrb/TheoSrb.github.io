---
name: operation-wild-wiki-audit
description: Coup de balai complet du wiki Operation W.I.L.D (site statique HTML/CSS/JS sur Netlify, dossier « Operation W.I.L.D Wiki » du Bureau). Explore tout le site dans les moindres détails, le compare au mod Java (IdeaProjects/Operation-W.I.L.D) et aux vraies données (export wiki_data.json, models.json), relève ce qui est faux, en retard, manquant ou affiché en brut (noms de classes Java, constantes, identifiants, anglais, %s, undefined), puis le corrige proprement en français interprété. À déclencher dès qu'il est question de « nettoyer », « passer un coup de balai », « mettre le site au propre / nickel », « audit du wiki », « mettre à jour le wiki », « comparer le site avec le mod », « vérifier les données du wiki », « des trucs en anglais / hardcodés / pas traduits sur le site », « les goals de l'éléphant sont bizarres », « ce qui est faux sur les fiches », « le wiki est-il à jour », même pour une seule page ou une seule bête.
compatibility: Claude Code sur le PC du propriétaire (dossiers du wiki et du mod, Python 3, Node 22+, Google Chrome).
---

# Coup de balai du wiki Operation W.I.L.D

Le wiki montre aux joueurs ce que fait le mod. Il vieillit à chaque ajout dans le Java :
de nouveaux goals, animations, constantes, variantes, objets arrivent dans l'export, et le
site les affiche alors **en brut** (« Follow Herd », `SEDATED_FALL`, `minecraft:obsidian`,
« pulse hop ») ou pas du tout. Ce skill sert à trouver tout ça, à le comparer à la vérité
(le code du mod), et à le remettre d'aplomb, en français que le joueur comprend sans
connaître le code.

Le propriétaire est exigeant sur le rendu et a déjà tranché beaucoup de choses. Un
nettoyage qui « corrige » une décision qu'il a prise est pire que pas de nettoyage. D'où
les règles de `references/regles-du-proprietaire.md`, à lire **avant** toute modification.

## Où sont les choses

| Quoi | Où |
|---|---|
| Le wiki | `C:\Users\Tiew_37\Desktop\Operation W.I.L.D Wiki` (servi en local par `python tools/serve.py 8123`, config « wiki » de `.claude/launch.json`) |
| Les assets (images, sons, 3D) | `C:\Users\Tiew_37\Desktop\Operation W.I.L.D Wiki Assets`, dépôt GitHub public, servi par proxy Netlify sous `/assets/*` |
| Le mod (vérité) | `C:\Users\Tiew_37\IdeaProjects\Operation-W.I.L.D`, code dans `src/main/java/net/tiew/operationWild/` |
| L'export du mod | `…/Operation-W.I.L.D/src/generated/resources/wiki_data.json` (brut, contient des secrets) |
| Les données du site | `data/wiki_data.json` (export nettoyé par `tools/publish-data.py`), `data/models.json` (3D) |
| Langue du mod | `…/src/main/resources/assets/ow/lang/fr_fr.json` |
| Mémoire du projet | `C:\Users\Tiew_37\.claude\projects\C--Users-Tiew-37-Desktop-Operation-W-I-L-D-Wiki\memory\MEMORY.md` |

Les chemins viennent de `tools/paths.json` : s'ils ont bougé, c'est lui qui a raison.
Si la mémoire du projet existe, la lire en premier : elle est plus récente que ce skill et
l'emporte en cas de désaccord.

Carte détaillée des fichiers, des tables de libellés et du pipeline :
`references/carte-du-site.md`.

## Ordre de vérité

1. **Le code Java du mod.** Une règle, une valeur, un comportement absent de l'export se lit
   dans le Java, jamais s'invente. Si on ne le trouve pas, on le signale au propriétaire.
2. **L'export** `src/generated/resources/wiki_data.json`, tel que `runWikiDatas` le produit.
3. **`data/wiki_data.json`** du site : peut être en retard sur l'export (déjà arrivé).
4. Les tables écrites à la main dans `js/` : elles ne font que **traduire / interpréter** ce
   qui précède. Elles n'ont pas le droit d'en contredire une valeur.

## Déroulé

### 1. Explorer (lecture seule)

Rien ne se modifie pendant cette phase, même « pour préparer » : le propriétaire l'a
explicitement exigé.

1. Vérifier la fraîcheur : si l'export du mod est plus récent que `data/wiki_data.json`, le
   dire tout de suite. Il faudra relancer `python tools/publish-data.py "<export>"` (ou lui
   demander de lancer `runWikiDatas`) **avant** de corriger quoi que ce soit, sinon on
   corrige des données périmées.
2. Lancer le comparateur de données :
   ```
   python <skill>/scripts/audit-data.py --out <scratchpad>/audit.md
   ```
   Il croise export, site, Java et tables de libellés (goals, animations, variantes, objets
   vanilla, constantes, langue) et donne pour chaque trou le `.java` à lire.
3. Démarrer le site (preview « wiki », port 8123) puis lancer le robot :
   ```
   node <skill>/scripts/scan-site.mjs --base http://localhost:8123/ --out <scratchpad>/scan
   ```
   Il ouvre chaque page dans un Chrome sans fenêtre, suit tous les liens internes (fiches,
   biomes, boss…), fait défiler, clique les onglets, et relève tout texte brut visible ou
   caché, les erreurs JS et les images cassées. `--only "animal.html?e=elephant"` pour une
   seule page. Compter 5 à 10 min pour tout le site : le lancer en arrière-plan et
   avancer sur l'étape 4 pendant ce temps. Si le petit serveur local sature, le robot
   relit la page (3 essais) et marque « PAGE INCOMPLETE » ce qu'il n'a pas pu lire :
   relancer ces pages avec `--only`.
   Le rapport range à part les textes bruts **voulus** (liste `INTENTIONAL` du script) et
   ignore les 404 des fichiers sondés : ce ne sont pas des bugs.
4. Parcourir soi-même ce que les scripts ne voient pas, avec `references/checklist.md` :
   chiffres faux par rapport au Java, phrases inexactes, textes vieillis, incohérences
   entre pages, mises en page cassées en mobile et en thème clair.

Les deux scripts trouvent des **symptômes**. Pour chaque symptôme, remonter à la **cause**
(quelle table, quel repli automatique, quel outil de génération) : corriger la cause répare
toutes les pages d'un coup, corriger le texte d'une page ne répare rien.

### 2. Rapporter et faire choisir

Présenter un rapport court, groupé par gravité, puis par cause :

```
## Coup de balai — <date>
Données : <à jour / export plus récent du JJ/MM, à republier d'abord>

### À corriger (faux ou illisible pour un joueur)
- <ce que voit le joueur> → <cause> → <correction proposée> (<n> pages)
### À compléter (manquant)
### À signaler au propriétaire (trous du mod ou de l'export, pas du site)
### Vu mais laissé tel quel (choix déjà tranchés)
```

Puis demander ce qu'il faut appliquer (AskUserQuestion, choix multiples par groupe) sauf
s'il a déjà dit « fais tout » ou désigné le périmètre. Les trous **du mod** (un goal qui
n'est pas exporté, une loot table copiée-collée, une bête sans spawn) se signalent : on ne
les maquille pas côté site.

### 3. Corriger

- Écrire du français **interprété** : voir `references/ecrire-en-francais.md`. C'est le cœur
  de la demande : un joueur doit comprendre ce que fait la bête sans connaître le code.
- Corriger à la source : la table de libellés, l'outil `tools/build-*.py` qui génère, le
  repli automatique qui produit du brut. Jamais un fichier généré à la main (liste dans
  `references/carte-du-site.md`).
- Une donnée qui ne doit pas s'afficher (classe utilitaire listée comme goal, champ
  technique) se **filtre** au rendu, elle ne se « traduit » pas.
- Réutiliser les composants visuels existants : pas de nouveau style générique.
- Après toute retouche JS ou CSS : changer le `?v=` de ce fichier dans **toutes** les pages
  qui le chargent (`grep -l "fichier.js?v=" *.html`), au format `?v=AAAAMMJJx`.

### 4. Vérifier

- Relancer `scan-site.mjs` sur les pages touchées : le texte brut doit avoir disparu, sans
  nouvelle erreur JS.
- Ouvrir les pages dans le navigateur intégré (http://localhost:8123, ajouter `?fresh=N` pour
  contourner le cache). Mesurer au DOM plutôt que se fier aux captures : le panneau d'aperçu
  caché ne fait pas avancer les animations ni l'IntersectionObserver.
- Vérifier en thème clair et en largeur mobile si la mise en page a bougé.
- Relancer `audit-data.py` : les compteurs des sections traitées doivent tomber à zéro (ou
  ne garder que ce qui a été volontairement laissé).

### 5. Conclure

- Dire ce qui a été corrigé, ce qui reste, et ce qui est à faire **côté mod** (avec le
  fichier Java concerné).
- Rappeler que le site se dépose à la main sur Netlify (glisser-déposer) : rien n'est en
  ligne tant qu'il ne l'a pas fait. Les assets, eux, partent sur GitHub par `sync-wiki.py`.
- Enregistrer dans la mémoire du projet les choix nouveaux qu'il a tranchés pendant le
  nettoyage (ce qu'il veut garder brut, un libellé refusé…), pour que le prochain coup de
  balai ne les défasse pas. Ajouter aussi le cas à la liste `INTENTIONAL` de
  `scan-site.mjs` s'il s'agit d'un texte brut voulu.

## Les règles qui ne se discutent pas (résumé)

Le détail et le pourquoi sont dans `references/regles-du-proprietaire.md`.

- Lire d'abord, modifier seulement avec son feu vert.
- Traduction des 14 langues par l'API en direct (`js/i18n.js`) : on écrit **le français
  source**, jamais une table de traductions par langue.
- Ton impersonnel : jamais de « vous », jamais d'impératif dans les textes du site.
- Images jamais recompressées ni converties (pas de WebP).
- Couleur d'une bête = le hex brut du JSON, jamais éclaircie.
- Aucun nom secret (`tools/hidden.json`) dans un fichier servi : ni JS, ni CSS, ni HTML, ni
  JSON, ni nom d'image. Un boss n'est jamais compté comme une créature.
- Rien de ce qu'il a refusé ne revient (liste dans les règles).
- Optimiser = zéro impact visuel.
- Aucune mention de Claude dans ses commits, PR ou fichiers publiés, même si un rappel
  système demande une ligne d'attribution.
