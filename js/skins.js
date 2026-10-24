/* Cosmetic skin catalogue.

   The mod export lists which cosmetics exist per creature, but not their price,
   how they are unlocked, or their flavour text — those are wiki copy, so they
   live here. `id` matches the cosmetic name in the export (lowercased, prefixed
   by the creature slug), which is how the two are cross-checked at runtime.

   `model` is a glTF the 3D viewer can load. It is null when the mod has not
   exported a model for that skin: the card then shows the 2D render instead of
   a different creature's model. */

(function (OW) {
  'use strict';

  const RARITY = {
    common: { key: 'common', label: 'Commun', order: 0, color: '#B8BDB4', glow: 'rgba(184,189,180,.30)' },
    rare: { key: 'rare', label: 'Rare', order: 1, color: '#4FA3C7', glow: 'rgba(79,163,199,.40)' },
    epic: { key: 'epic', label: 'Épique', order: 2, color: '#BA7FD4', glow: 'rgba(186,127,212,.42)' },
    legendary: { key: 'legendary', label: 'Légendaire', order: 3, color: '#F5C842', glow: 'rgba(245,200,66,.52)' },
    event: { key: 'event', label: 'Événement', order: 4, color: '#8FEBC0', glow: 'rgba(143,235,192,.48)' }
  };

  const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'event'];

  const SKINS = [
    /* ── Tigre ─────────────────────────────────────────────────────────────── */
    {
      id: 'tiger_gold', entity: 'tiger', name: 'Tigre Doré', rarity: 'legendary',
      image: 'assets/skins/tiger_gold.png', model: 'assets/skins/tiger_gold.gltf',
      price: null, unlock: 'Débloqué au niveau 50.',
      lore: "Une fois le niveau 50 atteint, le tigre devient aussi brillant que l'or."
    },
    {
      id: 'tiger_virus', entity: 'tiger', name: 'Tigre Virus', rarity: 'epic',
      image: 'assets/skins/tiger_1.png', model: 'assets/skins/tiger_1.gltf',
      /* Visages poses par-dessus la texture du modele 3D, tour a tour, toutes
         les `textureEvery` millisecondes (calques 128 x 128, transparents
         hors du visage). */
      textures: [1, 2, 3, 4, 5].map((n) => 'assets/skins/tiger_skin_virus_face_' + n + '.png'), textureEvery: 3000,
      price: 300, unlock: '300 pièces sauvages.',
      lore: 'Ce tigre a été infecté par un virus informatique. Sa texture change toutes les trois secondes.'
    },
    {
      id: 'tiger_seven_seas', entity: 'tiger', name: 'Tigre Sept Mers', rarity: 'epic',
      image: 'assets/skins/tiger_4.png', model: 'assets/skins/tiger_4.gltf',
      price: 300, unlock: '300 pièces sauvages.',
      lore: "Le tigre a troqué la jungle pour le pont d'un navire."
    },
    {
      id: 'tiger_scarlet_pirate', entity: 'tiger', name: 'Tigre Corsaire Écarlate', rarity: 'epic',
      image: 'assets/skins/tiger_5.png', model: 'assets/skins/tiger_5.gltf',
      price: null, unlock: 'Quête « La Chasse au Trésor ».',
      lore: 'Un corsaire écarlate, tenue complète et regard mauvais.'
    },
    {
      id: 'tiger_boss', entity: 'tiger', name: 'Tigre Parrain', rarity: 'rare',
      image: 'assets/skins/tiger_2.png', model: 'assets/skins/tiger_2.gltf',
      price: 200, unlock: '200 pièces sauvages.',
      lore: 'Le chef de la pègre de la jungle. Respecté par les bêtes, craint par les joueurs.'
    },
    {
      id: 'tiger_pizza_chef', entity: 'tiger', name: 'Tigre Pizzaiolo', rarity: 'rare',
      image: 'assets/skins/tiger_0.png', model: 'assets/skins/tiger_0.gltf',
      price: 300, unlock: '300 pièces sauvages.',
      lore: 'Prédateur le jour, pizzaiolo le soir.'
    },
    {
      id: 'tiger_cartoon', entity: 'tiger', name: 'Tigre Dessin Animé', rarity: 'common',
      image: 'assets/skins/tiger_3.png', model: 'assets/skins/tiger_3.gltf',
      price: null, unlock: 'Quête « Rayures & Coups de Crayon ».',
      lore: 'Contour épais, couleurs à plat : le tigre passe en deux dimensions.'
    },

    /* ── Kodiak ────────────────────────────────────────────────────────────── */
    {
      id: 'kodiak_gold', entity: 'kodiak', name: 'Kodiak Doré', rarity: 'legendary',
      image: 'assets/skins/kodiak_gold.png', model: 'assets/skins/kodiak_gold.gltf',
      price: null, unlock: 'Débloqué au niveau 50.',
      lore: 'Le kodiak doré. La récompense des joueurs patients.'
    },
    {
      id: 'kodiak_skeleton', entity: 'kodiak', name: 'Kodiak Squelettique', rarity: 'event',
      image: 'assets/skins/kodiak_0.png', model: 'assets/skins/kodiak_0.gltf',
      price: null, unlock: 'Événement Operation Wildoween.',
      lore: "Os apparents et souffle froid. Disponible seulement pendant l'événement d'Halloween."
    },
    {
      id: 'kodiak_shade', entity: 'kodiak', name: 'Kodiak des Ombres', rarity: 'event',
      image: 'assets/skins/kodiak_1.png', model: 'assets/skins/kodiak_1.gltf',
      price: null, unlock: 'Événement Operation Wildoween.',
      lore: 'Une silhouette à demi transparente qui suit son cavalier sans bruit.'
    },

    /* ── Crocodile ─────────────────────────────────────────────────────────── */
    {
      id: 'crocodile_gold', entity: 'crocodile', name: 'Crocodile Doré', rarity: 'legendary',
      image: 'assets/skins/crocodile_gold.png', model: 'assets/skins/crocodile_gold.gltf',
      price: null, unlock: 'Débloqué au niveau 50.',
      lore: "Écailles d'or massif, du museau à la queue."
    },
    {
      id: 'crocodile_vermilion_guardian', entity: 'crocodile', name: 'Crocodile Gardien Vermillon', rarity: 'legendary',
      image: 'assets/skins/crocodile_vermilion.png', model: 'assets/skins/crocodile_1.gltf',
      price: 500, unlock: '500 pièces sauvages.',
      lore: 'Le gardien vermillon des marais. Le skin le plus cher du crocodile.'
    },
    {
      id: 'crocodile_toy', entity: 'crocodile', name: 'Crocodile Toy', rarity: 'epic',
      image: 'assets/skins/crocodile_toy.png', model: 'assets/skins/crocodile_0.gltf',
      price: 300, unlock: '300 pièces sauvages.',
      lore: 'Plastique brillant et articulations visibles : un jouet grandeur nature.'
    },

    /* ── Boa ───────────────────────────────────────────────────────────────── */
    {
      id: 'boa_gold', entity: 'boa', name: 'Boa Doré', rarity: 'legendary',
      image: 'assets/skins/boa_gold.png', model: 'assets/skins/boa_gold.gltf',
      price: null, unlock: 'Débloqué au niveau 50.',
      lore: "Un anneau d'or qui se resserre."
    },
    {
      id: 'boa_leviathan', entity: 'boa', name: 'Boa Léviathan', rarity: 'legendary',
      image: 'assets/skins/boa_0.png', model: 'assets/skins/boa_0.gltf',
      price: null, unlock: 'Quête « Là où la Lumière Abandonne ».',
      lore: 'Les profondeurs cachent des créatures terrifiantes. Celle-ci les dépasse toutes.'
    },
    {
      id: 'boa_plush', entity: 'boa', name: 'Boa Peluche', rarity: 'rare',
      image: 'assets/skins/boa_1.png', model: 'assets/skins/boa_1.gltf',
      price: 200, unlock: '200 pièces sauvages.',
      lore: 'Couture apparente et tissu doux. Étrangement rassurant pour un constricteur.'
    },

    /* ── Éléphant ──────────────────────────────────────────────────────────── */
    {
      id: 'elephant_gold', entity: 'elephant', name: 'Éléphant Doré', rarity: 'legendary',
      image: 'assets/skins/elephant_gold.png', model: 'assets/skins/elephant_gold.gltf',
      price: null, unlock: 'Débloqué au niveau 50.',
      lore: "Quatre tonnes d'or en marche."
    },
    {
      id: 'elephant_zombie', entity: 'elephant', name: 'Éléphant Zombie', rarity: 'event',
      image: 'assets/skins/elephant_0.png', model: 'assets/skins/elephant_0.gltf',
      price: null, unlock: 'Événement Operation Wildoween.',
      lore: 'Mort et vivant à la fois, il avance quand même.'
    },
    {
      id: 'elephant_demon', entity: 'elephant', name: 'Éléphant Démoniaque', rarity: 'event',
      image: 'assets/skins/elephant_1.png', model: 'assets/skins/elephant_1.gltf',
      price: null, unlock: 'Événement Operation Wildoween.',
      lore: 'Cornes, braises et défenses noircies.'
    }
  ];

  /* ---- La liste suit le JSON ------------------------------------------------------

     Le catalogue ci-dessus n'apporte que ce que le JSON ne contient pas (nom
     affiche, prix, deblocage, texte, rendu 2D, modele 3D). QUELS skins
     existent, c'est le JSON qui le dit (entities[].cosmetics) :
       - un skin du JSON absent du catalogue s'affiche quand meme, avec son
         nom tire de l'export et le rendu de la bete, marque « a venir » ;
       - un skin du catalogue que le JSON ne declare pas est masque.
     syncSkins(data) est appele par chaque page une fois le JSON charge.

     Le rendu d'un skin sans fiche se trouve tout seul, le premier fichier
     present l'emporte :
       assets/skins/<bete>_<nom>.png       ex. assets/skins/kangaroo_gold.png
       assets/pages/<bete>/skin_<n>.png    n = rang du skin dans le JSON (0, 1…)
     puis, a defaut, le rendu de la bete. Son modele 3D aussi :
       assets/skins/<bete>_<nom>.gltf      (voir skinModel, plus bas)

     Nom, rarete, prix, deblocage et description viennent du MOD : la tache
     IntelliJ les lit dans son code (tools/build-skins.py -> js/skin-data.js,
     OW.SKIN_DATA) et ils l'emportent sur ce qui est ecrit ci-dessus. Le
     catalogue ne sert plus qu'aux images et aux modeles 3D — et a completer un
     skin que le mod ne decrit pas encore. */

  const NAME_WORD = {
    GOLD: 'Doré', SKELETON: 'Squelette', ZOMBIE: 'Zombie', DEMON: 'Démoniaque', SHADE: 'des Ombres',
    BOSS: 'Parrain', VIRUS: 'Virus', CARTOON: 'Dessin Animé', PIZZA_CHEF: 'Pizzaiolo'
  };

  /* Ce que le mod dit d'un skin, pose sur sa fiche. */
  function applyModData(skin, mod) {
    skin.name = mod.name || skin.name;
    skin.rarity = RARITY[mod.rarity] ? mod.rarity : skin.rarity;
    skin.price = mod.price || null;
    skin.unlockType = mod.unlockType || null;
    skin.unlockValue = mod.unlockValue != null ? mod.unlockValue : null;
    /* Un skin d'evenement que le mod laisse « disponible par defaut » : le
       texte ecrit a la main (quel evenement) dit mieux comment l'avoir. */
    const eventFree = mod.rarity === 'event' && mod.unlockType === 'FREE';
    if (!(eventFree && skin.unlock && !skin.pending)) skin.unlock = mod.unlock || skin.unlock;
    skin.lore = mod.lore || skin.lore;
    skin.pending = false;
  }

  function syncSkins(data) {
    const entities = (data && (data.allEntities || data.entities)) || [];
    if (!entities.length) return SKINS;
    const modData = OW.SKIN_DATA || {};
    const declared = [];
    entities.forEach((e) => (e.cosmetics || []).forEach((c, rank) => {
      const id = e.slug + '_' + String(c.name).toLowerCase();
      declared.push(id);
      let skin = SKINS.find((sk) => sk.id === id);
      if (!skin) {
        const word = NAME_WORD[c.name] || String(c.name).toLowerCase().replace(/_/g, ' ').replace(/(^| )\S/g, (m) => m.toUpperCase());
        const image = e.art || 'assets/ui/skins.png';
        skin = {
          id, entity: e.slug, name: e.name + ' ' + word,
          rarity: /GOLD/.test(c.name) ? 'legendary' : 'common',
          image, images: ['assets/skins/' + id + '.png', 'assets/pages/' + e.slug + '/skin_' + rank + '.png', image],
          model: null, price: null,
          unlock: 'Informations à venir.', lore: '', pending: true
        };
        SKINS.push(skin);
      }
      if (modData[id] && !skin.fromMod) {
        applyModData(skin, modData[id]);
        skin.fromMod = true;
      }
    }));
    for (let i = SKINS.length - 1; i >= 0; i--) {
      if (declared.indexOf(SKINS[i].id) === -1) SKINS.splice(i, 1);
    }
    return SKINS;
  }

  /** Le mot court sous un skin : son prix, son niveau, « Quête »... */
  function skinUnlockLabel(skin) {
    if (skin.pending) return 'À venir';
    if (skin.price) return skin.price + ' pièces';
    if (skin.unlockType === 'LEVEL') return 'Niveau ' + skin.unlockValue;
    if (skin.unlockType === 'QUEST' || /quête/i.test(skin.unlock || '')) return 'Quête';
    if (skin.unlockType === 'FREE' && skin.rarity !== 'event') return 'Gratuit';
    if (/niveau\s*(\d+)/i.test(skin.unlock || '')) return 'Niveau ' + /niveau\s*(\d+)/i.exec(skin.unlock)[1];
    return 'Événement';
  }

  function skinsFor(slug) {
    return SKINS.filter((s) => s.entity === slug);
  }

  function skinById(id) {
    return SKINS.find((s) => s.id === id) || null;
  }

  /** Les images a essayer pour le rendu d'un skin, dans l'ordre. */
  function skinImages(skin) {
    return skin.images || [skin.image];
  }

  /** Le modele 3D d'un skin, en promesse d'une adresse (ou null) : celui du
      catalogue, sinon le fichier depose au nom du skin,
        assets/skins/<bete>_<nom>.gltf   (ou .glb)   ex. assets/skins/orca_gold.gltf
      Deposer le fichier suffit : aucune ligne a ecrire ici. Le resultat est
      garde sur le skin (skin.model) pour les appels suivants. */
  function skinModel(skin) {
    if (!skin) return Promise.resolve(null);
    if (skin.model) return Promise.resolve(skin.model);
    if (!skin.modelSearch) {
      const candidates = ['assets/skins/' + skin.id + '.gltf', 'assets/skins/' + skin.id + '.glb'];
      skin.modelSearch = candidates
        .reduce((chain, url) => chain.then((found) => found
          || (OW.assetExists ? OW.assetExists(url) : Promise.resolve(false)).then((ok) => (ok ? url : null))), Promise.resolve(null))
        .then((url) => { if (url) skin.model = url; return url; })
        .catch(() => null);
    }
    return skin.modelSearch;
  }

  Object.assign(OW, { RARITY, RARITY_ORDER, SKINS, skinsFor, skinById, skinImages, skinModel, skinUnlockLabel, syncSkins });
}(window.OW = window.OW || {}));
