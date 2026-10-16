/* Vista Tier list: compos agrupadas por tier, con buscador y filtro de sinergias; a la derecha, la compo elegida. */
(function (root) {
  "use strict";

  const TIERS = ["S", "A", "B", "C"];

  function synergiesByUse(comps) {
    const count = {};
    comps.forEach((c) =>
      Object.keys(c.synergies).forEach((type) => {
        count[type] = (count[type] || 0) + 1;
      })
    );
    return Object.keys(count).sort((a, b) => count[b] - count[a] || (a < b ? -1 : 1));
  }

  function render(container, ctx, selectedKey) {
    const { dom, logic: L, views } = root.PAC;
    const { el } = dom;
    const ds = ctx.ds;
    ctx.filters = ctx.filters || { query: "", synergies: new Set() };
    const f = ctx.filters;

    const search = el("input", {
      id: "tl-search",
      type: "search",
      class: "search",
      placeholder: "Buscar Pokémon…",
      "aria-label": "Buscar compos por Pokémon",
      autocomplete: "off",
    });
    search.value = f.query;
    const synBar = el("div", { class: "syn-filter", role: "group", "aria-label": "Filtrar por sinergia" });
    const list = el("div", { class: "tl-list" });
    const detail = el("div", { class: "tl-detail" });
    const synTypes = synergiesByUse(ds.comps);

    const visible = () =>
      L.filterComps(ds.comps, f, ds.families, ds.t)
        .slice()
        .sort((a, b) => a.meanRank - b.meanRank);
    const firstVisible = visible()[0];
    const selected = (selectedKey && ctx.byKey(selectedKey)) || firstVisible || null;
    const activeKey = selected ? L.compKey(selected) : null;

    function drawSynBar() {
      synBar.replaceChildren(
        ...synTypes.map((type) =>
          el(
            "button",
            {
              type: "button",
              class: "syn-toggle",
              "aria-pressed": f.synergies.has(type) ? "true" : "false",
              title: ds.t.synergy(type),
              onclick: () => {
                if (f.synergies.has(type)) f.synergies.delete(type);
                else f.synergies.add(type);
                drawSynBar();
                drawList();
              },
            },
            [el("img", { src: dom.synergyIconUrl(type), alt: ds.t.synergy(type), width: 22, height: 22 })]
          )
        )
      );
    }

    function row(comp) {
      const key = L.compKey(comp);
      const { core, flex } = L.splitCoreFlex(comp);
      const name = L.compName(comp, ds.t);
      const tier = L.compTier(comp);
      return el(
        "button",
        {
          type: "button",
          class: "tl-row",
          "aria-current": key === activeKey ? "true" : null,
          "aria-label": name + ", tier " + tier + ", puesto medio " + dom.fmtRank(comp.meanRank),
          onclick: () => ctx.navigate("tier", key),
        },
        [
          el("span", { class: "tl-name" }, [
            el("strong", { text: name }),
            el("span", { class: "muted small", text: L.compTitle(comp, ds.t) }),
          ]),
          el("span", { class: "tl-syns" }, dom.compSynergyBadges(comp, ds, 3)),
          el(
            "span",
            { class: "tl-units" },
            core
              .concat(flex)
              .slice(0, 9)
              .map((u) => dom.unit(u.name, ds, { size: 40, items: u.itemCount >= 1 ? u.items : [], decorative: true }))
          ),
          el("span", { class: "tl-stats" }, [
            el("b", { text: dom.fmtRank(comp.meanRank) }),
            el("span", { class: "muted small", text: Math.round(comp.winrate) + " % top 1" }),
          ]),
        ]
      );
    }

    function drawList() {
      const comps = visible();
      list.replaceChildren();
      if (!comps.length) {
        list.appendChild(el("p", { class: "muted empty", text: "Ninguna compo coincide con los filtros." }));
        return;
      }
      TIERS.forEach((tier) => {
        const group = comps.filter((c) => L.compTier(c) === tier);
        if (!group.length) return;
        list.appendChild(
          el("section", { class: "tier-group", "aria-label": "Tier " + tier }, [
            el("div", { class: "tier-head" }, [
              dom.tierBadge(tier),
              el("span", { class: "muted small", text: group.length + (group.length === 1 ? " compo" : " compos") }),
            ]),
            ...group.map(row),
          ])
        );
      });
    }

    search.oninput = () => {
      f.query = search.value;
      drawList();
    };
    list.addEventListener("scroll", () => {
      ctx.tierScroll = list.scrollTop;
    });

    container.append(
      el("div", { class: "tl-layout" }, [
        el("div", { class: "tl-left" }, [el("div", { class: "tl-filters" }, [search, synBar]), list]),
        detail,
      ])
    );
    drawSynBar();
    drawList();
    list.scrollTop = ctx.tierScroll || 0;

    if (selected) views.comp.render(detail, ctx, selected);
    else detail.appendChild(el("p", { class: "muted empty", text: "Elige una compo de la lista." }));
  }

  root.PAC = root.PAC || {};
  root.PAC.views = root.PAC.views || {};
  root.PAC.views.tierlist = { render };
})(window);
