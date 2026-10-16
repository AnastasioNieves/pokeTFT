/* Vista Objetos: tier list de objetos del informe oficial, con descripción y en quién se usan. */
(function (root) {
  "use strict";

  function render(container, ctx) {
    const { dom, logic: L } = root.PAC;
    const { el } = dom;
    const ds = ctx.ds;
    let query = "";

    const search = el("input", { type: "search", class: "search", placeholder: "Buscar objeto…", "aria-label": "Buscar objeto", autocomplete: "off" });
    const body = el("tbody");
    container.append(
      el("section", { class: "panel items-view" }, [
        el("div", { class: "items-head" }, [
          el("h2", { text: "Objetos" }),
          el("p", {
            class: "muted small",
            text: "Puesto medio de los equipos que llevan cada objeto (más bajo = mejor). Solo objetos con 200 usos o más.",
          }),
          search,
        ]),
        el("div", { class: "table-wrap" }, [
          el("table", { class: "items-table" }, [
            el("thead", null, [
              el("tr", null, ["Tier", "Objeto", "Qué hace", "Puesto medio", "Usos", "Lo llevan"].map((h) => el("th", { scope: "col", text: h }))),
            ]),
            body,
          ]),
        ]),
      ])
    );

    function draw() {
      const rows = ds.itemStats.filter((x) => !query || L.normalizeSearch(ds.t.item(x.name)).includes(query));
      body.replaceChildren(
        ...rows.map((x) =>
          el("tr", null, [
            el("td", null, [dom.tierBadge(L.itemTier(x.rank))]),
            el("td", null, [el("span", { class: "item-cell" }, [dom.itemIcon(x.name, ds, 32), el("strong", { text: ds.t.item(x.name) })])]),
            el("td", { class: "small", text: ds.t.itemDesc(x.name) }),
            el("td", { class: "num", text: dom.fmtRank(x.rank) }),
            el("td", { class: "num", text: x.count.toLocaleString("es-ES") }),
            el("td", null, [el("span", { class: "holders" }, x.pokemons.filter((n) => ds.pokedex[n]).map((n) => dom.unit(n, ds, { size: 32 })))]),
          ])
        )
      );
      if (!rows.length) {
        body.appendChild(el("tr", null, [el("td", { colspan: "6", class: "muted", text: "Ningún objeto coincide con la búsqueda." })]));
      }
    }

    search.oninput = () => {
      query = L.normalizeSearch(search.value);
      draw();
    };
    draw();
  }

  root.PAC = root.PAC || {};
  root.PAC.views = root.PAC.views || {};
  root.PAC.views.items = { render };
})(window);
