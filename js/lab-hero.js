/* Labo — bloc 00 : cinq en-tetes de fiche.

   Cinq facons d'ouvrir la fiche d'une bete, du dossier d'expedition a la
   carte a collectionner. Toutes tiennent le meme contenu : le nom, la
   phrase du manuscrit, les traits, les constantes. Seule la matiere change.

   Chaque version rend son HTML puis branche ce qui bouge dans mount(). */

(function (OW) {
  'use strict';

  const { escapeHtml, num, bg, DASH } = OW;
  const U = OW.labUtil;

  const FAMILY_LABEL = {
    terrestrial: 'Terrestre', aquatic: 'Aquatique', semi_aquatic: 'Semi-aquatique',
    aerial: 'Aérien', boss: 'Boss'
  };
  const DIET_LABEL = { CARNIVOROUS: 'Carnivore', VEGETARIAN: 'Végétarien', OMNIVOROUS: 'Omnivore' };
  const TEMPERAMENT_LABEL = { AGGRESSIVE: 'Agressif', NEUTRAL: 'Neutre', PASSIVE: 'Passif' };

  /* La phrase d'ouverture : les deux premieres phrases du manuscrit, sinon un
     mot de remplacement selon ce qu'est la bete. */
  function tagline(entity) {
    const first = entity.lore[0];
    if (first) return first.text.split('.').slice(0, 2).join('.') + '.';
    return entity.boss
      ? "Boss de tribu. Ne s'apprivoise pas et ne quitte pas son arène."
      : "Le manuscrit de l'aventurier ne couvre pas encore cette créature.";
  }

  function traits(entity) {
    return [
      ['Famille', FAMILY_LABEL[entity.family] || entity.family, 'assets/ui/animal.png'],
      ['Régime', entity.diet ? (DIET_LABEL[entity.diet.name] || entity.diet.name) : DASH,
        entity.diet && entity.diet.name === 'CARNIVOROUS' ? 'assets/item/raw_tiger.png' : 'assets/item/savage_berries.png'],
      ['Tempérament', entity.temperament ? (TEMPERAMENT_LABEL[entity.temperament] || entity.temperament) : DASH,
        'assets/item/predator_tooth.png'],
      ['Archétype', entity.archetype ? entity.archetype.name : DASH,
        OW.archetypeIcon(entity.archetype && entity.archetype.name)],
      ['Apprivoisable', entity.traits.tameable ? 'Oui' : 'Non', 'assets/ui/taming_exp.png'],
      ['Montable', entity.traits.rideable ? 'Oui' : 'Non',
        OW.saddleSprite(entity.slug) || 'assets/pages/tiger/saddle.png']
    ];
  }

  /* Les constantes qu'un en-tete affiche : peu, gros, et toujours les memes. */
  function vitals(entity, data) {
    const keep = ['hp', 'damage', 'walk', 'mounted', 'taming'];
    return U.statModel(entity, data).filter((s) => keep.indexOf(s.key) >= 0);
  }

  const solo = (entity) =>
    `<img class="crisp" src="${escapeHtml(U.soloArt(entity.slug))}" alt="${escapeHtml(entity.name)}"
          onerror="this.onerror=null;this.src='${escapeHtml(entity.art)}';this.classList.add('is-fallback')">`;

  const wallpaper = (entity, cls) =>
    `<span class="${cls}" aria-hidden="true" ${OW.imgAttr([entity.wallpaper, entity.art], { mode: 'bg' })}></span>`;

  /* La souris deplace un element de quelques pixels : --px et --py, lus par le
     CSS. Sans cela l'en-tete est une image posee sur la page. */
  function parallax(host, pairs) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    host.addEventListener('pointermove', (event) => {
      const r = host.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width - .5;
      const y = (event.clientY - r.top) / r.height - .5;
      pairs.forEach(([el, ax, ay]) => {
        if (!el) return;
        el.style.setProperty('--px', (x * ax).toFixed(1) + 'px');
        el.style.setProperty('--py', (y * ay).toFixed(1) + 'px');
      });
    }, { passive: true });
    host.addEventListener('pointerleave', () => {
      pairs.forEach(([el]) => {
        if (!el) return;
        el.style.setProperty('--px', '0px');
        el.style.setProperty('--py', '0px');
      });
    });
  }

  /* =========================================================================
     V1 — Dossier de terrain
     Une chemise d'expedition : la photo agrafee a gauche, la fiche
     dactylographiee a droite, tamponnee du numero de l'espece.
     ========================================================================= */

  OW.labVersions.hero.push({
    id: 'dossier',
    name: 'Dossier de terrain',
    note: "Une chemise d'expédition : photo agrafée, fiche dactylographiée, tampon du numéro d'espèce. Survolez la photo — elle respire.",
    render(ctx) {
      const e = ctx.entity;
      return `
        <div class="dos">
          <div class="dos-photo" data-photo>
            ${wallpaper(e, 'dos-paper')}
            <span class="dos-vignette" aria-hidden="true"></span>
            <span class="dos-solo" data-solo>${solo(e)}</span>
            <span class="dos-clip" aria-hidden="true"></span>
            <span class="dos-caption">Planche ${escapeHtml(String(e.id).padStart(3, '0').slice(-3))} · terrain</span>
          </div>

          <div class="dos-file">
            <span class="dos-stamp" aria-hidden="true">
              <b>${escapeHtml(e.boss ? 'BOSS' : (e.traits.tameable ? 'APPRIVOISABLE' : 'SAUVAGE'))}</b>
              <small>dossier ${escapeHtml(String(e.id))}</small>
            </span>
            <span class="dos-kicker">
              Relevé d'expédition · ${escapeHtml(FAMILY_LABEL[e.family] || e.family)}
            </span>
            <h3 class="dos-name">${escapeHtml(e.name)}</h3>
            <p class="dos-line">${escapeHtml(tagline(e))}</p>

            <dl class="dos-grid">
              ${traits(e).map(([key, value, sprite], i) => `
                <div class="dos-cell" style="--i:${i}">
                  <span class="dos-ico crisp" aria-hidden="true" style="${bg(sprite)}"></span>
                  <dt>${escapeHtml(key)}</dt>
                  <dd>${escapeHtml(value)}</dd>
                </div>`).join('')}
            </dl>

            <div class="dos-vitals">
              ${vitals(e, ctx.data).map((s) => `
                <span class="dos-vital">
                  ${U.icon(s.icon, ctx.ink)}
                  <b>${escapeHtml(s.text)}</b>
                  <small>${escapeHtml(s.label)}</small>
                </span>`).join('')}
            </div>
          </div>
        </div>`;
    },
    mount(stage) {
      const photo = stage.querySelector('[data-photo]');
      parallax(photo, [[stage.querySelector('[data-solo]'), -26, -16], [photo.querySelector('.dos-paper'), 14, 10]]);
    }
  });

  /* =========================================================================
     V2 — Scanner de terrain
     L'ecran d'un appareil : grille, reticule qui suit la souris, balayage qui
     revele les constantes une a une. Le bouton rejoue l'analyse.
     ========================================================================= */

  OW.labVersions.hero.push({
    id: 'scan',
    name: 'Scanner de terrain',
    note: "L'écran d'un appareil d'analyse : le réticule suit la souris, le balayage révèle les constantes une à une. Le bouton rejoue l'analyse.",
    render(ctx) {
      const e = ctx.entity;
      const rows = vitals(e, ctx.data);
      return `
        <div class="scn" data-scn>
          <span class="scn-grid" aria-hidden="true"></span>
          ${wallpaper(e, 'scn-back')}
          <span class="scn-beam" data-beam aria-hidden="true"></span>

          <div class="scn-view">
            <span class="scn-subject" data-solo>${solo(e)}</span>
            <span class="scn-reticle" data-reticle aria-hidden="true">
              <i></i><i></i><i></i><i></i>
            </span>
            <span class="scn-coords" data-coords>x 0.00 · y 0.00</span>
          </div>

          <div class="scn-panel">
            <div class="scn-head">
              <span class="scn-dot" aria-hidden="true"></span>
              <span class="scn-id">SUJET ${escapeHtml(String(e.id))}</span>
              <span class="scn-state" data-state>ANALYSE…</span>
            </div>
            <h3 class="scn-name" data-type="${escapeHtml(e.name)}"></h3>
            <p class="scn-line">${escapeHtml(tagline(e))}</p>

            <div class="scn-rows">
              ${rows.map((s, i) => `
                <span class="scn-row" style="--i:${i}" data-row>
                  ${U.icon(s.icon, ctx.ink)}
                  <small>${escapeHtml(s.label)}</small>
                  <b>${escapeHtml(s.text)}</b>
                  <span class="scn-track"><i style="--fill:${(s.part * 100).toFixed(1)}%"></i></span>
                </span>`).join('')}
            </div>

            <div class="scn-tags">
              ${traits(e).slice(0, 4).map(([key, value]) => `
                <span class="scn-tag"><small>${escapeHtml(key)}</small>${escapeHtml(value)}</span>`).join('')}
            </div>

            <button type="button" class="scn-btn" data-replay>Relancer l'analyse</button>
          </div>
        </div>`;
    },
    mount(stage) {
      const host = stage.querySelector('[data-scn]');
      const reticle = stage.querySelector('[data-reticle]');
      const coords = stage.querySelector('[data-coords]');
      const title = stage.querySelector('[data-type]');
      const state = stage.querySelector('[data-state]');
      const name = title.dataset.type;

      parallax(host, [[stage.querySelector('[data-solo]'), -20, -12]]);

      host.addEventListener('pointermove', (event) => {
        const r = host.getBoundingClientRect();
        reticle.style.left = (event.clientX - r.left) + 'px';
        reticle.style.top = (event.clientY - r.top) + 'px';
        coords.textContent = 'x ' + ((event.clientX - r.left) / r.width).toFixed(2)
          + ' · y ' + ((event.clientY - r.top) / r.height).toFixed(2);
      }, { passive: true });

      /* Le nom s'ecrit lettre a lettre, puis les lignes se remplissent : c'est
         l'appareil qui rend son verdict, pas une page qui s'affiche. */
      let timer = 0;
      function run() {
        clearInterval(timer);
        host.classList.remove('is-done');
        state.textContent = 'ANALYSE…';
        title.textContent = '';
        let i = 0;
        timer = setInterval(() => {
          title.textContent = name.slice(0, ++i);
          if (i < name.length) return;
          clearInterval(timer);
          host.classList.add('is-done');
          state.textContent = 'RELEVÉ COMPLET';
        }, 55);
      }
      stage.querySelector('[data-replay]').addEventListener('click', run);
      run();
    }
  });

  /* =========================================================================
     V3 — Avis de recherche
     L'affiche clouee sur une planche : papier use, grand nom, sceau de cire.
     Elle penche sous la souris, et les clous la retiennent.
     ========================================================================= */

  OW.labVersions.hero.push({
    id: 'poster',
    name: 'Avis de recherche',
    note: "Une affiche clouée sur une planche : papier usé, sceau de cire, gros titre. Elle penche sous la souris.",
    render(ctx) {
      const e = ctx.entity;
      const prime = vitals(e, ctx.data).slice(0, 3);
      return `
        <div class="pst" data-pst>
          <span class="pst-wood" aria-hidden="true"></span>
          <article class="pst-sheet" data-sheet>
            <span class="pst-nail pst-nail-l" aria-hidden="true"></span>
            <span class="pst-nail pst-nail-r" aria-hidden="true"></span>

            <span class="pst-top">Avis de l'expédition</span>
            <h3 class="pst-name">${escapeHtml(e.name)}</h3>
            <span class="pst-rule" aria-hidden="true"></span>

            <div class="pst-art">
              ${wallpaper(e, 'pst-back')}
              <span class="pst-solo">${solo(e)}</span>
            </div>

            <p class="pst-line">${escapeHtml(tagline(e))}</p>

            <div class="pst-figures">
              ${prime.map((s) => `
                <span class="pst-fig">
                  <b>${escapeHtml(s.text)}</b>
                  <small>${escapeHtml(s.label)}</small>
                </span>`).join('')}
            </div>

            <div class="pst-foot">
              <span class="pst-seal" aria-hidden="true">${U.icon(e.traits.tameable ? 'paw' : 'star', '#2B1B10')}</span>
              <span class="pst-small">
                ${escapeHtml(FAMILY_LABEL[e.family] || e.family)} ·
                ${escapeHtml(e.archetype ? e.archetype.name : 'archétype inconnu')} ·
                dossier n° ${escapeHtml(String(e.id))}
              </span>
            </div>
          </article>
        </div>`;
    },
    mount(stage) {
      const host = stage.querySelector('[data-pst]');
      const sheet = stage.querySelector('[data-sheet]');
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      host.addEventListener('pointermove', (event) => {
        const r = host.getBoundingClientRect();
        const x = (event.clientX - r.left) / r.width - .5;
        const y = (event.clientY - r.top) / r.height - .5;
        sheet.style.transform = `perspective(1100px) rotateY(${(x * 9).toFixed(2)}deg) rotateX(${(-y * 7).toFixed(2)}deg)`;
      }, { passive: true });
      host.addEventListener('pointerleave', () => { sheet.style.transform = ''; });
    }
  });

  /* =========================================================================
     Enclos — la version retenue
     Le biome vivant au fond, la fresque peinte du territoire au mur, la bete
     devant, et le panneau grave de l'enclos sur le cote. Le curseur de
     lumiere fait passer la scene du plein jour a la nuit.
     ========================================================================= */

  OW.labVersions.hero.push({
    id: 'enclos',
    name: 'Enclos',
    keep: true,
    note: "Le wallpaper de la bête tient tout le fond ; le biome vivant passe par-dessus, en transparence. Le curseur fait tomber la nuit.",
    render(ctx) {
      const e = ctx.entity;
      return `
        <div class="enc" data-enc>
          <!-- Le wallpaper tient tout le fond ; la scene vivante passe
               par-dessus en transparence, si bien qu'on garde le mouvement du
               biome sans perdre l'image de l'espece. -->
          ${wallpaper(e, 'enc-back')}
          <span class="enc-scene" data-scene aria-hidden="true"></span>
          <span class="enc-veil" aria-hidden="true"></span>
          <span class="enc-night" data-night aria-hidden="true"></span>
          <span class="enc-beast" data-solo>${solo(e)}</span>
          <span class="enc-ground" aria-hidden="true"></span>

          <div class="enc-sign">
            <span class="enc-screw enc-screw-a" aria-hidden="true"></span>
            <span class="enc-screw enc-screw-b" aria-hidden="true"></span>
            <span class="enc-kicker">Enclos ${escapeHtml(String(e.id))} · ${escapeHtml(U.habitatOf(e))}</span>
            <h3 class="enc-name">${escapeHtml(e.name)}</h3>
            <p class="enc-line">${escapeHtml(tagline(e))}</p>
            <div class="enc-plates">
              ${traits(e).map(([key, value, sprite]) => `
                <span class="enc-plate">
                  <span class="crisp" aria-hidden="true" style="${bg(sprite)}"></span>
                  <small>${escapeHtml(key)}</small>
                  <b>${escapeHtml(value)}</b>
                </span>`).join('')}
            </div>
          </div>

          <div class="enc-ctrl">
            <label class="enc-lab" for="enc-light">Lumière</label>
            <input id="enc-light" class="enc-range" type="range" min="0" max="100" value="100" data-light>
            <span class="enc-hour" data-hour>Plein jour</span>
          </div>
        </div>`;
    },
    mount(stage, ctx) {
      const holder = stage.querySelector('[data-scene]');
      const scene = OW.biomeScene ? OW.biomeScene(U.habitatOf(ctx.entity), holder && holder.clientWidth) : null;
      if (scene) holder.appendChild(scene);

      /* La bete et la fresque ne bougent pas du meme pas : c'est ce decalage
         qui donne la profondeur de l'enclos. */
      parallax(stage.querySelector('[data-enc]'), [
        [stage.querySelector('[data-solo]'), -18, -10],
        [stage.querySelector('.enc-back'), 12, 8]
      ]);

      const night = stage.querySelector('[data-night]');
      const hour = stage.querySelector('[data-hour]');
      const range = stage.querySelector('[data-light]');
      const label = (v) => (v > 80 ? 'Plein jour' : v > 55 ? 'Après-midi' : v > 30 ? 'Crépuscule' : v > 12 ? 'Nuit' : 'Nuit noire');
      const apply = () => {
        const v = Number(range.value);
        night.style.opacity = ((100 - v) / 100 * .88).toFixed(2);
        hour.textContent = label(v);
      };
      range.addEventListener('input', apply);
      apply();
    }
  });

  /* =========================================================================
     V5 — Carte a collectionner
     Une grosse carte holographique, qui penche sous la souris et se retourne
     au clic : la face porte la bete, le dos porte le manuscrit.
     ========================================================================= */

  OW.labVersions.hero.push({
    id: 'carte',
    name: 'Carte à collectionner',
    note: "Une carte holographique : elle penche sous la souris, et se retourne au clic pour montrer le manuscrit au dos.",
    render(ctx) {
      const e = ctx.entity;
      const rows = vitals(e, ctx.data);
      const pages = e.lore.length ? e.lore : [{ text: tagline(e) }];
      return `
        <div class="tcg" data-tcg>
          <div class="tcg-card" data-card>
            <div class="tcg-face">
              <span class="tcg-holo" aria-hidden="true"></span>
              <div class="tcg-top">
                <span class="tcg-name">${escapeHtml(e.name)}</span>
                <span class="tcg-cost">${escapeHtml(e.traits.tameable ? 'APPRIVOISABLE' : 'SAUVAGE')}</span>
              </div>
              <div class="tcg-art">
                ${wallpaper(e, 'tcg-back')}
                <span class="tcg-solo">${solo(e)}</span>
              </div>
              <span class="tcg-type">
                ${escapeHtml(FAMILY_LABEL[e.family] || e.family)}
                — ${escapeHtml(e.archetype ? e.archetype.name : 'sans archétype')}
              </span>
              <div class="tcg-rows">
                ${rows.map((s) => `
                  <span class="tcg-row">
                    ${U.icon(s.icon, ctx.ink)}
                    <small>${escapeHtml(s.label)}</small>
                    <b>${escapeHtml(s.text)}</b>
                  </span>`).join('')}
              </div>
              <span class="tcg-foot">Operation W.I.L.D · n° ${escapeHtml(String(e.id))}</span>
            </div>

            <div class="tcg-rear">
              <span class="tcg-holo" aria-hidden="true"></span>
              <span class="tcg-rear-mark crisp" aria-hidden="true" style="${bg(e.head)}"></span>
              <h4>${escapeHtml(e.name)}</h4>
              <p>${escapeHtml(pages[0].text)}</p>
              ${pages[1] ? `<p>${escapeHtml(pages[1].text)}</p>` : ''}
              <span class="tcg-rear-foot">Manuscrit de l'aventurier</span>
            </div>
          </div>

          <div class="tcg-side">
            <span class="tcg-kicker">Fiche n° ${escapeHtml(String(e.id))}</span>
            <h3 class="tcg-title">${escapeHtml(e.name)}</h3>
            <p class="tcg-line">${escapeHtml(tagline(e))}</p>
            <div class="tcg-chips">
              ${traits(e).map(([key, value, sprite]) => `
                <span class="tcg-chip">
                  <span class="crisp" aria-hidden="true" style="${bg(sprite)}"></span>
                  <small>${escapeHtml(key)}</small><b>${escapeHtml(value)}</b>
                </span>`).join('')}
            </div>
            <button type="button" class="tcg-flip" data-flip>Retourner la carte</button>
          </div>
        </div>`;
    },
    mount(stage) {
      const host = stage.querySelector('[data-tcg]');
      const card = stage.querySelector('[data-card]');
      const flip = () => card.classList.toggle('is-flipped');
      card.addEventListener('click', flip);
      stage.querySelector('[data-flip]').addEventListener('click', flip);

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      host.addEventListener('pointermove', (event) => {
        const r = card.getBoundingClientRect();
        const x = (event.clientX - r.left) / r.width - .5;
        const y = (event.clientY - r.top) / r.height - .5;
        card.style.setProperty('--rx', (-y * 14).toFixed(2) + 'deg');
        card.style.setProperty('--ry', (x * 16).toFixed(2) + 'deg');
        card.style.setProperty('--hx', ((x + .5) * 100).toFixed(1) + '%');
        card.style.setProperty('--hy', ((y + .5) * 100).toFixed(1) + '%');
      }, { passive: true });
      host.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    }
  });
}(window.OW = window.OW || {}));
