/* Biomes: what the mod adds, who spawns where, and the structures it places. */

(function (OW) {
  'use strict';

  const { loadWikiData, escapeHtml, mountHeader, mountFooter, reveal, animalHref, biomeName, plural, bg, tintStyle } = OW;

  /* Wiki copy for the biomes the export lists. The export ships ids and registry
     constants only, so descriptions and art live here, keyed by the same id. */
  const BIOME_COPY = {
    'ow:redwood_forest': {
      art: 'assets/biomes/redwood_forest.png',
      fiche: 'biome.html?b=redwood_forest',
      description: 'Troncs de séquoia, sous-bois de buissons à baies et lumière rase. '
        + 'Le kodiak y défend sa pente, le panda roux vit dans la canopée.'
    },
    'ow:mine_field': {
      art: null,
      description: 'Terrain miné hérité des expéditions précédentes. On y avance lentement ou pas du tout.'
    }
  };

  const STRUCTURES = [
    {
      name: 'Station immergée',
      image: 'assets/structures/submerged_station.png',
      accent: '#00A0C8',
      description: "Base sous-marine posée au fond de l'océan, sur la route des orques. "
        + "On y entre par un sas, on en ressort avec ce qu'on a pu prendre."
    }
  ];

  mountHeader();

  loadWikiData()
    .then((data) => {
      /* ---- intro ---------------------------------------------------------- */
      document.querySelector('[data-intro]').textContent =
        'Le mod ajoute ' + plural(data.biomes.length, 'biome')
        + " et enrichit les biomes vanilla par modificateurs d'apparition. "
        + 'Chaque bête tient un territoire précis.';
      if (OW.heroSigns) {
        const spawnBiomes = new Set();
        (data.spawns || []).forEach((sp) => (sp.biomes || []).forEach((b) => spawnBiomes.add(b)));
        OW.heroSigns(document.querySelector('[data-intro]'), [
          [data.biomes.length, 'Biomes ajoutés'], [spawnBiomes.size, 'Biomes de spawn'],
          [STRUCTURES.length, 'Structures']
        ]);
      }

      /* ---- biomes added by the mod ---------------------------------------- */
      const residentsOf = (id) => data.entities.filter(
        (e) => e.spawn && e.spawn.biomes.indexOf(id) !== -1
      );

      document.querySelector('[data-mod-biomes]').innerHTML = data.biomes.map((biome) => {
        const copy = BIOME_COPY[biome.id] || { art: null, description: 'Biome ajouté par le mod.' };
        const residents = residentsOf(biome.id);

        return `
          <article class="biome-card card-lift" data-reveal>
            <div class="biome-banner${copy.art ? '' : ' biome-banner-plain'}"
                 ${copy.art ? `style="${bg(copy.art)}"` : ''}>
              <div class="biome-banner-scrim"></div>
            </div>
            <div class="stack" style="gap:12px;padding:20px">
              <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
                <h3 class="t-display" style="font-size:30px;line-height:1">${escapeHtml(biomeName(biome.id))}</h3>
                <span class="t-pixel">${escapeHtml(biome.id)}</span>
              </div>
              <p class="t-body">${escapeHtml(copy.description)}</p>
              ${copy.fiche ? `<a class="btn btn-accent biome-fiche-link" href="${copy.fiche}">Ouvrir la fiche du biome →</a>` : ''}
              <div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:8px;border-top:1px solid var(--hairline)">
                ${residents.length
                  ? residents.map((e) => `
                      <a class="chip-label" href="${animalHref(e.slug)}">
                        <span class="resident-head crisp" aria-hidden="true" style="${bg(e.head)}"></span>${escapeHtml(e.name)}
                      </a>`).join('')
                  : '<span class="empty-note">Aucune créature ne s\'y génère naturellement.</span>'}
              </div>
            </div>
          </article>`;
      }).join('');

      /* ---- structures -------------------------------------------------------- */
      document.querySelector('[data-structures]').innerHTML = STRUCTURES.map((structure) => `
        <div class="structure-card card-lift" data-reveal style="--accent-line:${structure.accent}">
          <span class="structure-image crisp" aria-hidden="true" style="${bg(structure.image)}"></span>
          <span class="stack" style="gap:16px;padding:34px;justify-content:center">
            <span class="t-pixel tinted" style="${tintStyle(structure.accent)}">STRUCTURE</span>
            <span class="t-display" style="font-size:clamp(30px,3.4vw,50px);line-height:.95">${escapeHtml(structure.name)}</span>
            <span class="t-body" style="font-size:16px;line-height:1.64">${escapeHtml(structure.description)}</span>
          </span>
        </div>`).join('');

      mountFooter(data, 'VERSION ' + data.meta.version + ' · '
        + plural(data.biomes.length, 'BIOME DU MOD', 'BIOMES DU MOD').toUpperCase());

      reveal();
    })
    .catch((error) => {
      console.error(error);
      document.querySelector('[data-mod-biomes]').innerHTML =
        '<p class="empty-note">Les données du mod n\'ont pas pu être chargées. '
        + 'Ce wiki doit être servi par un serveur HTTP — voir le README.</p>';
    });
}(window.OW = window.OW || {}));
