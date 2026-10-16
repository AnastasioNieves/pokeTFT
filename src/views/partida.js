/* Vista Mi partida: marcas lo que tienes y te dice qué compo seguir, qué comprar y cómo colocar. */
(function (root) {
  "use strict";

  function familyEntries(ds) {
    const L = root.PAC.logic;
    const fams = new Set();
    ds.comps.forEach((c) => c.units.forEach((u) => fams.add(u.family)));
    return Array.from(fams)
      .map((family) => {
        const names = ds.families[family] || [family];
        const display = L.finalStage(names, ds.pokedex);
        return {
          family,
          names,
          display,
          label: ds.t.pkm(display),
          search: L.normalizeSearch(names.map((n) => ds.t.pkm(n)).join(" ")),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }

  function render(container, ctx) {
    const { dom, logic: L, board } = root.PAC;
    const { el } = dom;
    const ds = ctx.ds;
    const state = ctx.state;
    ctx.partidaEntries = ctx.partidaEntries || familyEntries(ds);
    const entries = ctx.partidaEntries;
    let query = "";

    const search = el("input", { type: "search", class: "search", placeholder: "Buscar Pokémon…", "aria-label": "Buscar Pokémon", autocomplete: "off" });
    const chips = el("div", { class: "chips", "aria-live": "polite" });
    const grid = el("div", { class: "fam-grid" });
    const right = el("div", { class: "pt-right" });
    const reset = el("button", {
      type: "button",
      class: "btn danger",
      text: "Nueva partida",
      onclick: () => {
        state.owned = [];
        state.partidaKey = null;
        ctx.save();
        search.value = "";
        query = "";
        drawAll();
      },
    });

    container.append(
      el("div", { class: "pt-layout" }, [
        el("section", { class: "panel pt-left", "aria-label": "Mis Pokémon" }, [
          el("div", { class: "pt-left-head" }, [el("h2", { text: "Mis Pokémon" }), reset]),
          search,
          chips,
          grid,
        ]),
        right,
      ])
    );

    search.oninput = () => {
      query = L.normalizeSearch(search.value);
      drawGrid();
    };

    function toggle(family) {
      const i = state.owned.indexOf(family);
      if (i >= 0) state.owned.splice(i, 1);
      else state.owned.push(family);
      ctx.save();
      const btn = grid.querySelector('.fam[data-family="' + CSS.escape(family) + '"]');
      if (btn) btn.setAttribute("aria-pressed", state.owned.includes(family) ? "true" : "false");
      drawChips();
      drawRight();
    }

    function drawAll() {
      drawChips();
      drawGrid();
      drawRight();
    }

    function drawChips() {
      chips.replaceChildren();
      if (state.owned.length === 0) {
        chips.appendChild(el("p", { class: "muted small", text: "Haz clic en los Pokémon que tengas." }));
        return;
      }
      state.owned.forEach((family) => {
        const entry = entries.find((e) => e.family === family);
        if (!entry) return;
        chips.appendChild(
          el("button", { type: "button", class: "chip", "aria-label": "Quitar " + entry.label, onclick: () => toggle(family) }, [
            entry.label,
            el("span", { "aria-hidden": "true", text: " ✕" }),
          ])
        );
      });
    }

    function drawGrid() {
      grid.replaceChildren();
      const owned = new Set(state.owned);
      const list = entries.filter((e) => !query || e.search.includes(query));
      if (!list.length) {
        grid.appendChild(el("p", { class: "muted", text: "Ningún Pokémon coincide con la búsqueda." }));
        return;
      }
      list.forEach((e) => {
        grid.appendChild(
          el(
            "button",
            {
              type: "button",
              class: "fam",
              "data-family": e.family,
              "aria-pressed": owned.has(e.family) ? "true" : "false",
              title: e.names.map((n) => ds.t.pkm(n)).join(" → "),
              onclick: () => toggle(e.family),
            },
            [dom.unit(e.display, ds, { size: 48, decorative: true, title: "" }), el("span", { class: "fam-name", text: e.label })]
          )
        );
      });
    }

    function drawRight() {
      right.replaceChildren();
      const owned = new Set(state.owned);
      const ranked = L.rankComps(ds.comps, owned, { limit: 5 });
      right.appendChild(
        el("section", { class: "panel" }, [
          el("h2", { text: "Compos que te encajan" }),
          owned.size === 0 ? el("p", { class: "muted small", text: "Las mejores del meta. Marca tus Pokémon para ver cuál te encaja más." }) : null,
          el(
            "ol",
            { class: "pt-sugg" },
            ranked.map(({ comp, match }) => {
              const key = L.compKey(comp);
              return el("li", null, [
                el(
                  "button",
                  {
                    type: "button",
                    class: "pt-sugg-row",
                    "aria-pressed": state.partidaKey === key ? "true" : "false",
                    onclick: () => {
                      state.partidaKey = key;
                      ctx.save();
                      drawRight();
                    },
                  },
                  [
                    dom.tierBadge(L.compTier(comp)),
                    el("span", { class: "tl-name" }, [
                      el("strong", { text: ctx.nameOf(comp) }),
                      el("span", {
                        class: "muted small",
                        text: (owned.size ? "Coincide " + dom.fmtPct(match) + " · " : "") + "Puesto " + dom.fmtRank(comp.meanRank),
                      }),
                    ]),
                    el("span", { class: "tl-syns" }, dom.compSynergyBadges(comp, ds, 3)),
                  ]
                ),
              ]);
            })
          ),
        ])
      );
      const comp = state.partidaKey ? ctx.byKey(state.partidaKey) : null;
      if (!comp) {
        right.appendChild(
          el("section", { class: "panel empty" }, [
            el("p", { class: "empty-title", text: "Elige una compo" }),
            el("p", { class: "muted", text: "Verás qué te falta comprar, tus sinergias y cómo colocar a tus Pokémon." }),
          ])
        );
        return;
      }
      right.appendChild(detail(comp, owned));
    }

    function detail(comp, owned) {
      const key = L.compKey(comp);
      const { core, flex } = L.splitCoreFlex(comp);
      const units = core.concat(flex);
      const have = units.filter((u) => owned.has(u.family));
      const missing = units.filter((u) => !owned.has(u.family));
      const itemsByName = {};
      units.forEach((u) => {
        itemsByName[u.name] = u.items;
      });

      const sec = el("section", { class: "panel" }, [
        el("div", { class: "pt-detail-head" }, [
          dom.tierBadge(L.compTier(comp)),
          el("h2", { text: ctx.nameOf(comp) }),
          el("a", { href: "#tier/" + encodeURIComponent(key), class: "small", text: "Ver guía completa" }),
        ]),
        el("h3", { class: "sub", text: missing.length ? "Te falta comprar" : "¡Ya tienes toda la compo!" }),
      ]);
      if (missing.length) {
        sec.appendChild(
          el(
            "div",
            { class: "buy-list" },
            missing.map((u) => {
              const base = (ds.families[u.family] || [u.name])[0];
              return el("div", { class: "buy" }, [
                dom.unit(base, ds, { size: 48, decorative: true, tag: core.includes(u) ? "Núcleo" : null }),
                el("span", { class: "small", text: ds.t.pkm(base) }),
                base !== u.name ? el("span", { class: "muted small", text: "→ " + ds.t.pkm(u.name) }) : null,
              ]);
            })
          )
        );
      }

      const progress = L.synergyProgress(have.map((u) => u.name), ds.pokedex, ds.triggers);
      const counts = {};
      progress.forEach((p) => {
        counts[p.type] = p.count;
      });
      sec.appendChild(el("h3", { class: "sub", text: "Tus sinergias para esta compo" }));
      sec.appendChild(
        el(
          "div",
          { class: "syn-progress" },
          Object.keys(comp.synergies).map((type) => {
            const thresholds = ds.triggers[type] || [];
            const count = counts[type] || 0;
            return el("div", { class: "syn-line" }, [
              dom.synergyBadge(type, ds, { count, target: comp.synergies[type], level: L.synergyLevel(count, thresholds) }),
              el("span", { class: "pips" }, thresholds.map((x) => el("span", { class: "pip" + (count >= x ? " on" : ""), text: String(x) }))),
            ]);
          })
        )
      );

      sec.appendChild(el("h3", { class: "sub", text: "Coloca lo que tienes" }));
      const boardBox = el("div");
      board.render(boardBox, {
        boardKey: key,
        units: have.map((u) => ({ name: u.name, items: u.items })),
        ds,
        el,
        portrait: (n, d, size, decorative) => dom.unit(n, d, { size, decorative, title: "" }),
        piece: (n) => dom.unit(n, ds, { size: 56, items: itemsByName[n] || [], title: "" }),
      });
      sec.appendChild(boardBox);
      return sec;
    }

    drawAll();
  }

  root.PAC = root.PAC || {};
  root.PAC.views = root.PAC.views || {};
  root.PAC.views.partida = { render };
})(window);
